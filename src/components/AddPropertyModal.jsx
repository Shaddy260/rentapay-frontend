import React, { useState, useEffect } from 'react';
import Button from './Button.jsx';
import InfoTip from './InfoTip.jsx';
import ManualPaymentHelp from './ManualPaymentHelp.jsx';
import { api, ApiError } from '../api/client.js';
import { KENYA_COUNTIES } from '../constants/kenyaCounties.js';
import { KENYA_CONSTITUENCIES } from '../constants/kenyaConstituencies.js';
import { loadPricingSettings, previewCost } from '../utils/pricing.js';
import './AddPropertyModal.css';

/**
 * "+ Add a property" flow from the dashboard's property switcher.
 * A landlord who manages more than one property in their name can
 * register a new one here: name/location/description + how many
 * units and how many months, then pays for it via M-Pesa STK push -
 * priced as its own real subscription (see initiatePropertyPurchase
 * in property.controller.js), not prorated against or borrowing
 * anything from an existing property. Only once that payment
 * completes does the property actually get created and become
 * switchable - it then lands on the dashboard scoped to the new
 * property, same as switching to any other one.
 *
 * DIRECT REQUEST ("update the code such that everything matches as
 * just the first property... just copy everything they do during
 * first signup except email verification"): this used to be its own
 * separate, drifted-apart form - missing the description field
 * RegisterFlow.jsx's property step has, missing any way to choose a
 * subscription period longer than the silent 1-month default (the
 * backend has supported an independent periodMonths per property for
 * a while - see initiatePropertyPurchase's "don't fix the
 * subscription period" comment - this form just never exposed it),
 * and still asking for caretaker details even though that question
 * was already removed from RegisterFlow.jsx's property step (caretaker
 * contact is Settings-only now, added after a property exists). Now
 * field-for-field the same as the first-property step: name/estate
 * name, location, county + constituency (with the same searchable
 * selects), description, Maps link, units + period with the same live
 * cost preview (see utils/pricing.js - shared with RegisterFlow.jsx
 * so the two flows can never quote a different price for the same
 * inputs) - just without an email-verification step, since this
 * landlord is already logged in and already verified.
 *
 * DIRECT REQUEST ("each property should be independent... they
 * should share nothing at all"): every field below is entered fresh
 * for THIS property and sent as its own row (property_payments,
 * completed into its own properties row on payment - see
 * completePropertyPurchase) - nothing here reads from or defaults to
 * an existing property's name/location/description/Maps link/unit
 * count/period. The one thing genuinely shared across all of a
 * landlord's properties by design, not by accident, is the general
 * M-Pesa payment method (Settings) - same as it's shared for every
 * unit unless that unit sets its own override (see UnitDetail.jsx's
 * "Payment method for this unit" card); this form doesn't touch that
 * at all.
 *
 * DIRECT REQUEST ("hide those comments that appear there"): the
 * explanatory paragraphs that used to sit permanently under each
 * field now live behind InfoTip icons next to the relevant label,
 * same pattern used throughout Settings.jsx and UnitDetail.jsx.
 */
export default function AddPropertyModal({ token, onClose, onDone }) {
  const [step, setStep] = useState('details'); // details -> polling -> done
  const [form, setForm] = useState({
    name: '',
    location: '',
    county: '',
    constituency: '',
    description: '',
    mapsLink: '',
    unitsCount: '',
    periodMonths: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // { checkoutRequestId, propertyPaymentId, amountDue }
  const [pollError, setPollError] = useState('');
  // "Didn't receive the popup? Pay manually" fallback - same pattern as
  // SubscriptionManage.jsx, wired to property_payment_id instead of the
  // landlord's own subscription (see initiatePropertyPurchase's
  // stkFailed handling).
  const [manualForm, setManualForm] = useState({ transactionCode: '', mpesaPayerName: '', mpesaPayerPhone: '', mpesaSmsTimestamp: '' });
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualSubmitted, setManualSubmitted] = useState(false);
  // FEATURE (direct request: "include a searchbar when the landlords
  // are choosing counties"): same searchable-select pattern as the
  // onboarding wizard (RegisterFlow.jsx) - narrows the county/
  // constituency dropdown as the landlord types instead of scrolling
  // a 47-entry list.
  const [countySearch, setCountySearch] = useState('');
  const [constituencySearch, setConstituencySearch] = useState('');
  const filteredCounties = KENYA_COUNTIES.filter((c) => c.toLowerCase().includes(countySearch.trim().toLowerCase()));
  const filteredConstituencies = (KENYA_CONSTITUENCIES[form.county] || []).filter((c) =>
    c.toLowerCase().includes(constituencySearch.trim().toLowerCase())
  );

  // DIRECT REQUEST: some landlords only start working with a Brand
  // Ambassador after their first property already exists - this is a
  // manual, OPTIONAL slot, never auto-filled or auto-linked from
  // anything (unlike RegisterFlow.jsx's ?ref= link-based field, there
  // is no URL-based version of this - the landlord always has to type
  // it in themselves). Same live "Referred by <n>" resolution as
  // RegisterFlow.jsx's manual-entry path, reusing the identical
  // resolveBaReferralCode lookup so a typo'd/expired code is caught
  // before submitting rather than failing silently on the backend.
  const [refCode, setRefCode] = useState('');
  const [referredByName, setReferredByName] = useState(null);
  const [referralNotFound, setReferralNotFound] = useState(false);
  useEffect(() => {
    const code = refCode.trim();
    if (!code) { setReferredByName(null); setReferralNotFound(false); return; }
    let cancelled = false;
    api
      .resolveBaReferralCode(code)
      .then((res) => {
        if (cancelled) return;
        if (res.matched) {
          setReferredByName(res.fullName);
          setReferralNotFound(false);
        } else {
          setReferredByName(null);
          setReferralNotFound(res.reason === 'not_found');
        }
      })
      .catch(() => { if (!cancelled) { setReferredByName(null); setReferralNotFound(false); } });
    return () => { cancelled = true; };
  }, [refCode]);

  const [, setPricingLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // Live rate/discount tiers from admin's current settings - see
    // utils/pricing.js. Forces a re-render once loaded so the cost
    // preview below reflects the freshly-cached values.
    loadPricingSettings().then(() => { if (!cancelled) setPricingLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const cost = form.unitsCount && form.periodMonths
    ? previewCost(Number(form.unitsCount), Number(form.periodMonths))
    : null;

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handlePurchase(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!form.unitsCount || Number(form.unitsCount) < 1) {
      setError('Please enter the number of units for this property.');
      return;
    }
    if (!form.periodMonths || Number(form.periodMonths) < 1) {
      setError('Please enter a subscription period in months.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await api.purchaseProperty(
        {
          name: form.name.trim(),
          location: form.location || undefined,
          county: form.county || undefined,
          constituency: form.constituency || undefined,
          description: form.description || undefined,
          mapsLink: form.mapsLink || undefined,
          unitsCount: Number(form.unitsCount),
          periodMonths: Number(form.periodMonths),
          refCode: refCode.trim() || undefined,
        },
        token
      );
      setPending({ checkoutRequestId: res.checkoutRequestId, propertyPaymentId: res.propertyPaymentId, amountDue: res.amountDue });
      if (res.stkFailed) {
        // Same fallback as signup/renewal: no prompt went out, so skip
        // straight to the manual-payment form instead of polling for
        // an STK completion that will never come.
        setPollError("We couldn't send the automatic M-Pesa prompt right now - pay manually below instead.");
        setStep('manual');
        return;
      }
      setStep('polling');
      pollStatus(res.checkoutRequestId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start payment.');
    } finally {
      setBusy(false);
    }
  }

  async function handleManualSubmit(e) {
    e.preventDefault();
    setManualError('');
    if (!manualForm.transactionCode || !manualForm.mpesaPayerName || !manualForm.mpesaPayerPhone) {
      setManualError('Please fill in all fields exactly as shown on your M-Pesa confirmation SMS.');
      return;
    }
    setManualSubmitting(true);
    try {
      await api.submitManualSubscriptionPayment(
        {
          propertyPaymentId: pending.propertyPaymentId,
          transactionCode: manualForm.transactionCode.trim(),
          amountPaid: pending.amountDue,
          mpesaPayerName: manualForm.mpesaPayerName.trim(),
          mpesaPayerPhone: manualForm.mpesaPayerPhone.trim(),
          mpesaSmsTimestamp: manualForm.mpesaSmsTimestamp ? new Date(manualForm.mpesaSmsTimestamp).toISOString() : null,
          periodMonths: Number(form.periodMonths),
          unitsCount: Number(form.unitsCount),
        },
        token
      );
      setManualSubmitted(true);
      pollManualStatus();
    } catch (err) {
      setManualError(err instanceof ApiError ? (Array.isArray(err.details) ? err.details.join(' ') : err.message) : 'Failed to submit payment.');
    } finally {
      setManualSubmitting(false);
    }
  }

  // Waiting on admin review rather than Safaricom - polls less
  // aggressively and for longer, same as SubscriptionManage.jsx.
  async function pollManualStatus() {
    setPollError('');
    const MAX_ATTEMPTS = 40;
    const INTERVAL_MS = 15000;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const res = await api.checkPropertyPurchaseStatusById(pending.propertyPaymentId, token);
        if (res.status === 'completed') {
          setStep('done');
          setTimeout(() => onDone?.(res.propertyId), 900);
          return;
        }
        if (res.status === 'failed') {
          setPollError('Your submitted payment could not be verified. Please double-check the transaction code and try again, or contact support.');
          setManualSubmitted(false);
          return;
        }
      } catch (err) {
        console.warn('Manual property payment poll failed, retrying:', err.message);
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
  }

  // Same self-heal poll pattern used at registration and subscription
  // renewal - keeps checking until Safaricom confirms one way or the
  // other, instead of trusting the webhook alone.
  async function pollStatus(checkoutRequestId) {
    setPollError('');
    const MAX_ATTEMPTS = 20;
    const INTERVAL_MS = 3000;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const res = await api.checkPropertyPurchaseStatus(checkoutRequestId, token);
        if (res.status === 'completed') {
          setStep('done');
          setTimeout(() => onDone?.(res.propertyId), 900);
          return;
        }
        if (res.status === 'failed') {
          setPollError(
            res.reason
              ? `Payment was not completed: ${res.reason}. You can pay manually below instead.`
              : 'Payment was not completed (cancelled or insufficient funds). You can pay manually below instead.'
          );
          setStep('manual');
          return;
        }
      } catch (err) {
        console.warn('Property payment poll failed, retrying:', err.message);
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
    setPollError("We couldn't confirm your payment yet. If the M-Pesa prompt failed, was cancelled, or you had insufficient funds, you can pay manually below instead.");
    setStep('manual');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card add-property-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>
            Add a property
            <InfoTip text="Registers a new, completely independent property - its own name, location, units, and subscription period. Nothing here is shared with or copied from your other properties." />
          </h3>
          <button className="modal-card__close" onClick={onClose}>×</button>
        </div>

        {step === 'details' && (
          <form className="modal-form" onSubmit={handlePurchase}>
            {error && <p className="modal-error">{error}</p>}
            {pollError && <p className="modal-error">{pollError}</p>}

            <label className="form-field__label" htmlFor="propName">Estate name</label>
            <input id="propName" required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Greenwood Apartments" />

            <label className="form-field__label" htmlFor="propRefCode">Referral code (optional)</label>
            <input
              id="propRefCode"
              value={refCode}
              onChange={(e) => setRefCode(e.target.value.toUpperCase())}
              placeholder="e.g. JASRAH-4KLT7"
              aria-invalid={referralNotFound || undefined}
              className={referralNotFound ? 'form-field__input--error' : undefined}
            />
            {referredByName ? (
              <p className="form-field__hint">Referred by <strong>{referredByName}</strong>.</p>
            ) : referralNotFound ? (
              <p className="form-field__error">
                No such referral code exists - please check with your BA or leave this field blank.
              </p>
            ) : (
              <InfoTip text={<>Working with a RentaPay Brand Ambassador on this property? Enter their code here - completely optional, and only applies if you don't already have one linked to your account.</>} />
            )}

            <label className="form-field__label" htmlFor="propLocation">Location</label>
            <input id="propLocation" value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Kilimani" />

            <label className="form-field__label" htmlFor="propCounty">County</label>
            <input
              type="text"
              placeholder="Type to search counties…"
              value={countySearch}
              onChange={(e) => setCountySearch(e.target.value)}
              className="u-mb-2"
            />
            <select
              id="propCounty"
              value={form.county}
              onChange={(e) => { update('county', e.target.value); update('constituency', ''); setConstituencySearch(''); }}
            >
              <option value="">Select a county…</option>
              {filteredCounties.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label className="form-field__label" htmlFor="propConstituency">Constituency</label>
            <input
              type="text"
              placeholder={form.county ? 'Type to search constituencies…' : 'Select a county first…'}
              value={constituencySearch}
              disabled={!form.county}
              onChange={(e) => setConstituencySearch(e.target.value)}
              className="u-mb-2"
            />
            <select id="propConstituency" disabled={!form.county} value={form.constituency} onChange={(e) => update('constituency', e.target.value)}>
              <option value="">{form.county ? 'Select a constituency…' : 'Select a county first…'}</option>
              {filteredConstituencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label className="form-field__label" htmlFor="propDescription">Description (optional)</label>
            <input id="propDescription" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="3-storey block, 12 units" />

            <label className="form-field__label" htmlFor="propMapsLink">
              Google Maps link (recommended)
              <InfoTip text="Open Google Maps, find this property, tap Share, then paste the link here. Prospective tenants browsing vacant units will be able to tap it to see exactly where this property is." />
            </label>
            <input
              id="propMapsLink"
              type="url"
              value={form.mapsLink}
              onChange={(e) => update('mapsLink', e.target.value)}
              placeholder="https://maps.app.goo.gl/…"
            />

            {/* DIRECT REQUEST: the caretaker question used to live here
                too, duplicating Settings > Caretaker contacts. It's
                removed - same as RegisterFlow.jsx's property step -
                caretaker contact is only ever added/edited from
                Settings, once the property already exists. */}

            <div className="register-page__form-grid">
              <div className="form-field">
                <label className="form-field__label" htmlFor="propUnitsCount">Number of units</label>
                <input id="propUnitsCount" type="number" min="1" required value={form.unitsCount} onChange={(e) => update('unitsCount', e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="propPeriodMonths">
                  Subscription period (months)
                  <InfoTip text="This property's own subscription clock - separate from any of your other properties. Any length you want; discounts apply automatically at 3, 6, and 12 months." />
                </label>
                <input
                  id="propPeriodMonths"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={form.periodMonths}
                  onChange={(e) => update('periodMonths', e.target.value)}
                />
              </div>
            </div>

            {cost && (
              <div className="cost-summary">
                <div className="cost-summary__row">
                  <span>KES {cost.rate.toFixed(2)} / unit / month</span>
                  <span>{form.unitsCount} units × {form.periodMonths} mo</span>
                </div>
                {cost.discount > 0 && (
                  <div className="cost-summary__row">
                    <span>Discount applied</span>
                    <span>{Math.round(cost.discount * 100)}% off</span>
                  </div>
                )}
                <div className="cost-summary__row cost-summary__row--total">
                  <span>Total due today</span>
                  <span className="cost-summary__total-value">KES {cost.total.toLocaleString()}</span>
                </div>
              </div>
            )}

            <Button type="submit" variant="mpesa" loading={busy}>Continue to payment</Button>
          </form>
        )}

        {step === 'polling' && (
          <div className="modal-form add-property-modal__polling">
            <span className="add-property-modal__icon">📲</span>
            <h4>Check your phone</h4>
            <p>
              An M-Pesa prompt for KES {pending?.amountDue?.toLocaleString()} was sent. Enter your PIN to
              complete the purchase - this page will update automatically.
            </p>
          </div>
        )}

        {step === 'manual' && (
          <div className="modal-form">
            {pollError && !manualSubmitted && <p className="modal-error">{pollError}</p>}
            {manualSubmitted ? (
              <>
                <p>Your payment is being reviewed. This page will update automatically once it's confirmed.</p>
                {pollError && <p className="modal-error">{pollError}</p>}
                <ManualPaymentHelp variant="admin" />
              </>
            ) : (
              <form onSubmit={handleManualSubmit}>
                <p>
                  Pay KES {pending?.amountDue?.toLocaleString()} directly to RentaPay's paybill, then enter the
                  M-Pesa confirmation details below so it can be verified.
                </p>
                {manualError && <p className="modal-error">{manualError}</p>}

                <label className="form-field__label" htmlFor="manualTxCode">M-Pesa transaction code</label>
                <input id="manualTxCode" required value={manualForm.transactionCode} onChange={(e) => setManualForm((f) => ({ ...f, transactionCode: e.target.value }))} placeholder="e.g. QGH7XYZ123" />

                <label className="form-field__label" htmlFor="manualPayerName">Name on the M-Pesa SMS</label>
                <input id="manualPayerName" required value={manualForm.mpesaPayerName} onChange={(e) => setManualForm((f) => ({ ...f, mpesaPayerName: e.target.value }))} />

                <label className="form-field__label" htmlFor="manualPayerPhone">Phone number that paid</label>
                <input id="manualPayerPhone" required value={manualForm.mpesaPayerPhone} onChange={(e) => setManualForm((f) => ({ ...f, mpesaPayerPhone: e.target.value }))} placeholder="07XXXXXXXX" />

                <label className="form-field__label" htmlFor="manualTimestamp">Time of payment (optional)</label>
                <input id="manualTimestamp" type="datetime-local" value={manualForm.mpesaSmsTimestamp} onChange={(e) => setManualForm((f) => ({ ...f, mpesaSmsTimestamp: e.target.value }))} />

                <Button type="submit" variant="mpesa" loading={manualSubmitting}>Submit for review</Button>
              </form>
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
