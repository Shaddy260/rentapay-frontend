import React, { useState, useEffect, useRef } from 'react';
import Button from './Button.jsx';
import { api, ApiError } from '../api/client.js';
import { KENYA_COUNTIES } from '../constants/kenyaCounties.js';
import { KENYA_CONSTITUENCIES } from '../constants/kenyaConstituencies.js';
import './AddPropertyModal.css';

const STORAGE_KEY = 'rentapay_add_property_pending';

function loadPersisted() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function savePersisted(data) {
  try {
    if (data) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable - non-fatal, just means a hard reload mid-payment won't resume
  }
}

/**
 * "+ Add a property" flow from the dashboard's property switcher.
 * A landlord who manages more than one property in their name can
 * register a new one here: name/location + how many units + how many
 * months to subscribe for, then pays for those units via M-Pesa STK
 * push. Only once that payment completes (via Daraja OR an admin
 * confirming a manual paybill payment) does the property actually get
 * created and become switchable.
 *
 * FIX (direct request, 3 things):
 *  1. "no option for them to type how many months they want to
 *     subscribe for" - added a Period (months) field, same discount
 *     table as SubscriptionManage.jsx, backend already accepted
 *     periodMonths, only this form was missing it.
 *  2. "manual payment feature ... not persistent, not visible until I
 *     reload the page and it only appears for like 2 seconds and
 *     disappears" - this component previously had NO manual-pay
 *     fallback at all, and kept everything in plain useState with no
 *     persistence, so a reload (or the modal remounting) lost the
 *     pending checkout entirely and dumped the landlord back on a
 *     blank details form. Now: (a) a manual-pay form exists, mirroring
 *     SubscriptionManage.jsx's; (b) checkoutRequestId/propertyPaymentId/
 *     step are written to sessionStorage on every change and re-read on
 *     mount, so a reload resumes exactly where it left off instead of
 *     losing the payment; (c) the "submitted, awaiting admin
 *     confirmation" banner is driven by the server (checkPropertyPurchaseStatus's
 *     manual_pending status), not local state, so it can't silently
 *     disappear on its own.
 *  3. "no matter what they should always be brought to that payment
 *     page till the payment is confirmed" - once a purchase has been
 *     initiated (STK sent), the details form is no longer reachable by
 *     closing/reopening the modal or reloading the page; it always
 *     reopens on the payment/manual-pay screen until the backend
 *     reports completed. The only way out is the modal's own close (×),
 *     which does NOT cancel the pending purchase - reopening "+ Add a
 *     property" resumes it. "← Back" is only shown while still on the
 *     details step (nothing paid for yet), never during/after payment.
 */
const PERIOD_DISCOUNTS = { 1: 0, 3: 0.05, 6: 0.10, 12: 0.15 };
const BASE_RATE = 50;

export default function AddPropertyModal({ token, onClose, onDone }) {
  const persisted = loadPersisted();
  const [step, setStep] = useState(persisted?.step || 'details'); // details -> polling -> manual_pending -> done
  const [form, setForm] = useState({
    name: '',
    location: '',
    county: '',
    constituency: '',
    unitsCount: 1,
    periodMonths: 1,
    caretakerName: '',
    caretakerPhone: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(persisted?.pending || null); // { checkoutRequestId, propertyPaymentId, amountDue }
  const [pollError, setPollError] = useState('');
  const [manualRejected, setManualRejected] = useState(null); // rejection reason, if the last manual submission was turned down

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ transactionCode: '', amountPaid: '', mpesaPayerName: '', mpesaPayerPhone: '', mpesaSmsTimestamp: '' });
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');

  const pollStopRef = useRef(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  useEffect(() => {
    savePersisted(step === 'details' ? null : { step, pending });
  }, [step, pending]);

  // Resume an in-flight purchase on mount (covers both a hard page
  // reload and the modal being closed and reopened).
  useEffect(() => {
    if (persisted && persisted.pending && persisted.step !== 'done') {
      setStep(persisted.step === 'details' ? 'polling' : persisted.step);
      pollStatus(persisted.pending.checkoutRequestId);
    }
    return () => {
      pollStopRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const discount = PERIOD_DISCOUNTS[form.periodMonths] ?? 0;
  const rate = Math.round(BASE_RATE * (1 - discount) * 100) / 100;
  const estimatedTotal = Math.round(rate * Number(form.unitsCount || 0) * Number(form.periodMonths || 1) * 100) / 100;

  async function handlePurchase(e) {
    e.preventDefault();
    if (!form.name.trim() || Number(form.unitsCount) < 1) return;
    setError('');
    setBusy(true);
    try {
      const res = await api.purchaseProperty(
        {
          name: form.name.trim(),
          location: form.location || undefined,
          county: form.county || undefined,
          constituency: form.constituency || undefined,
          unitsCount: Number(form.unitsCount),
          periodMonths: Number(form.periodMonths) || 1,
          caretakerName: form.caretakerName || undefined,
          caretakerPhone: form.caretakerPhone || undefined,
        },
        token
      );
      const nextPending = { checkoutRequestId: res.checkoutRequestId, propertyPaymentId: res.propertyPaymentId, amountDue: res.amountDue };
      setPending(nextPending);
      setStep('polling');
      pollStopRef.current = false;
      pollStatus(res.checkoutRequestId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start payment.');
    } finally {
      setBusy(false);
    }
  }

  // Self-heal poll, same pattern used at registration and subscription
  // renewal. Once a manual payment is submitted it keeps polling too -
  // the backend flips to manual_pending / completed the moment an admin
  // acts, no separate code path needed.
  async function pollStatus(checkoutRequestId) {
    setPollError('');
    while (!pollStopRef.current) {
      try {
        const res = await api.checkPropertyPurchaseStatus(checkoutRequestId, token);
        if (res.status === 'completed') {
          setStep('done');
          savePersisted(null);
          setTimeout(() => onDone?.(res.propertyId), 900);
          return;
        }
        if (res.status === 'manual_pending') {
          setStep('manual_pending');
        } else if (res.status === 'failed') {
          if (res.manualRejected) {
            setManualRejected(res.manualRejectionReason || 'No reason given.');
          } else {
            setPollError(res.reason ? `Payment was not completed: ${res.reason}.` : 'Payment was not completed (cancelled or timed out).');
          }
          // Stay on the payment step (never bounce back to details) -
          // the manual-pay form is always reachable from here instead.
          setStep('polling');
        } else if (res.manualRejected) {
          setManualRejected(res.manualRejectionReason || 'No reason given.');
        }
      } catch (err) {
        console.warn('Property payment poll failed, retrying:', err.message);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  async function handleManualSubmit(e) {
    e.preventDefault();
    setManualError('');
    if (!manualForm.transactionCode || !manualForm.amountPaid || !manualForm.mpesaPayerName || !manualForm.mpesaPayerPhone) {
      setManualError('Please fill in all fields exactly as shown on your M-Pesa confirmation SMS.');
      return;
    }
    setManualSubmitting(true);
    try {
      await api.submitManualPropertyPayment(
        {
          propertyPaymentId: pending.propertyPaymentId,
          transactionCode: manualForm.transactionCode.trim(),
          amountPaid: Number(manualForm.amountPaid),
          mpesaPayerName: manualForm.mpesaPayerName.trim(),
          mpesaPayerPhone: manualForm.mpesaPayerPhone.trim(),
          mpesaSmsTimestamp: manualForm.mpesaSmsTimestamp ? new Date(manualForm.mpesaSmsTimestamp).toISOString() : null,
        },
        token
      );
      setShowManualForm(false);
      setManualRejected(null);
      setStep('manual_pending');
    } catch (err) {
      setManualError(err instanceof ApiError ? err.message : 'Failed to submit payment.');
    } finally {
      setManualSubmitting(false);
    }
  }

  // The × always works (it just hides the modal) - it never cancels a
  // pending purchase. Reopening "+ Add a property" resumes it.
  function handleClose() {
    onClose?.();
  }

  const onPaymentStep = step === 'polling' || step === 'manual_pending' || step === 'done';

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card add-property-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>Add a property</h3>
          <button className="modal-card__close" onClick={handleClose}>×</button>
        </div>

        {step === 'details' && (
          <form className="modal-form" onSubmit={handlePurchase}>
            <p className="unit-detail-hint">
              Register another property in your name and add its units. You'll pay for those units via
              M-Pesa before the property becomes available to switch into.
            </p>
            {error && <p className="modal-error">{error}</p>}
            {pollError && <p className="modal-error">{pollError}</p>}

            <label className="form-field__label">Property name</label>
            <input required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Greenwood Apartments" />

            <label className="form-field__label">Location (optional)</label>
            <input value={form.location} onChange={(e) => update('location', e.target.value)} />

            <label className="form-field__label">County (optional)</label>
            <select value={form.county} onChange={(e) => { update('county', e.target.value); update('constituency', ''); }}>
              <option value="">Select a county…</option>
              {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label className="form-field__label">Constituency (optional)</label>
            <select value={form.constituency} disabled={!form.county} onChange={(e) => update('constituency', e.target.value)}>
              <option value="">{form.county ? 'Select a constituency…' : 'Select a county first…'}</option>
              {(KENYA_CONSTITUENCIES[form.county] || []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label className="form-field__label">Number of units</label>
            <input type="number" min="1" required value={form.unitsCount} onChange={(e) => update('unitsCount', e.target.value)} />

            <label className="form-field__label">Period (months)</label>
            <input type="number" min="1" step="1" required value={form.periodMonths} onChange={(e) => update('periodMonths', e.target.value)} />
            <p className="form-field__hint">Enter any length you want - discounts apply automatically at 3, 6, and 12 months.</p>
            <p style={{ fontWeight: 700 }}>Estimated total: KES {estimatedTotal.toLocaleString()} (KES {rate}/unit/month)</p>

            <label className="form-field__label">Caretaker name (optional)</label>
            <input value={form.caretakerName} onChange={(e) => update('caretakerName', e.target.value)} />

            <label className="form-field__label">Their phone number (optional)</label>
            <input value={form.caretakerPhone} onChange={(e) => update('caretakerPhone', e.target.value)} placeholder="07XXXXXXXX or 2547XXXXXXXX" />
            <p className="unit-detail-hint">Want to give someone their own login to manage this property? Add them as a Property Manager from Settings after it's created.</p>

            <Button type="submit" variant="mpesa" loading={busy}>Continue to payment</Button>
          </form>
        )}

        {onPaymentStep && step !== 'done' && (
          <div className="modal-form add-property-modal__polling">
            <span className="add-property-modal__icon">📲</span>
            <h4>Check your phone</h4>
            <p>
              An M-Pesa prompt for KES {pending?.amountDue?.toLocaleString()} was sent for "{form.name || 'your new property'}".
              Enter your PIN to complete the purchase - this updates automatically, even if you reload this page.
            </p>

            {pollError && <p className="modal-error">{pollError}</p>}

            {step === 'manual_pending' && (
              <div className="stk-pending paybill-pending">
                <p>⏳ Manual payment submitted, awaiting admin confirmation. This page will move on automatically once it's confirmed.</p>
              </div>
            )}

            {manualRejected && step !== 'manual_pending' && (
              <div className="paybill-rejected-banner">
                <p>❌ Your last manual payment submission was not approved.</p>
                <p className="paybill-rejected-banner__reason">Reason: {manualRejected}</p>
              </div>
            )}

            {step !== 'manual_pending' && (
              <>
                <button type="button" className="ghost-link" onClick={() => setShowManualForm((o) => !o)}>
                  {showManualForm ? 'Hide manual payment form' : "Didn't receive the popup? Pay manually"}
                </button>

                {showManualForm && (
                  <div className="add-tenant-form" style={{ marginTop: '1rem', border: '1px solid var(--color-hairline, #e5e7eb)', borderRadius: 10, padding: '1rem' }}>
                    <p>
                      Send payment to Paybill <strong>522522</strong>, Account Number <strong>1341657388</strong>. Once you've paid, fill in the
                      details below exactly as shown on your M-Pesa confirmation SMS.
                    </p>
                    {manualError && <p className="add-tenant-error">{manualError}</p>}
                    <form onSubmit={handleManualSubmit}>
                      <label className="form-field__label">Transaction code</label>
                      <input required value={manualForm.transactionCode} onChange={(e) => setManualForm((f) => ({ ...f, transactionCode: e.target.value }))} placeholder="e.g. QGH7XYZ123" />

                      <label className="form-field__label">Amount paid (KES)</label>
                      <input required type="number" min="0" step="0.01" value={manualForm.amountPaid} onChange={(e) => setManualForm((f) => ({ ...f, amountPaid: e.target.value }))} />

                      <label className="form-field__label">M-Pesa payer name</label>
                      <input required value={manualForm.mpesaPayerName} onChange={(e) => setManualForm((f) => ({ ...f, mpesaPayerName: e.target.value }))} placeholder="Name shown on the M-Pesa SMS" />

                      <label className="form-field__label">Phone number paid from</label>
                      <input required value={manualForm.mpesaPayerPhone} onChange={(e) => setManualForm((f) => ({ ...f, mpesaPayerPhone: e.target.value }))} placeholder="e.g. 0712345678" />

                      <label className="form-field__label">M-Pesa SMS time</label>
                      <input type="datetime-local" value={manualForm.mpesaSmsTimestamp} onChange={(e) => setManualForm((f) => ({ ...f, mpesaSmsTimestamp: e.target.value }))} />

                      <Button type="submit" variant="mpesa" loading={manualSubmitting} style={{ marginTop: '0.75rem' }}>Submit for review</Button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="modal-form add-property-modal__polling">
            <span className="add-property-modal__icon">✅</span>
            <h4>Property added</h4>
            <p>Taking you to your new property's dashboard…</p>
          </div>
        )}
      </div>
    </div>
  );
}
