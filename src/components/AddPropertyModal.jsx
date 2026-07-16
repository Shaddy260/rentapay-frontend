import React, { useState } from 'react';
import Button from './Button.jsx';
import { api, ApiError } from '../api/client.js';
import './AddPropertyModal.css';

/**
 * "+ Add a property" flow from the dashboard's property switcher.
 * A landlord who manages more than one property in their name can
 * register a new one here: name/location + how many units it has,
 * then pays for those units via M-Pesa STK push (prorated against
 * whatever's left of the current subscription period - same math as
 * adding units to an existing property). Only once that payment
 * completes does the property actually get created and become
 * switchable - it then lands on the dashboard scoped to the new
 * property, same as switching to any other one.
 */
export default function AddPropertyModal({ token, onClose, onDone }) {
  const [step, setStep] = useState('details'); // details -> paying -> polling -> done
  const [form, setForm] = useState({
    name: '',
    location: '',
    county: '',
    unitsCount: 1,
    caretakerName: '',
    caretakerPhone: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // { checkoutRequestId, amountDue }
  const [pollError, setPollError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

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
          unitsCount: Number(form.unitsCount),
          caretakerName: form.caretakerName || undefined,
          caretakerPhone: form.caretakerPhone || undefined,
        },
        token
      );
      setPending({ checkoutRequestId: res.checkoutRequestId, amountDue: res.amountDue });
      setStep('polling');
      pollStatus(res.checkoutRequestId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start payment.');
    } finally {
      setBusy(false);
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
          setPollError(res.reason ? `Payment was not completed: ${res.reason}.` : 'Payment was not completed (cancelled or timed out).');
          setStep('details');
          return;
        }
      } catch (err) {
        console.warn('Property payment poll failed, retrying:', err.message);
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
    setPollError("We couldn't confirm your payment yet. If you completed the M-Pesa prompt, wait a moment and try again.");
    setStep('details');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card add-property-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>Add a property</h3>
          <button className="modal-card__close" onClick={onClose}>×</button>
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
            <input value={form.county} onChange={(e) => update('county', e.target.value)} />

            <label className="form-field__label">Number of units</label>
            <input type="number" min="1" required value={form.unitsCount} onChange={(e) => update('unitsCount', e.target.value)} />

            <label className="form-field__label">Caretaker name (optional)</label>
            <input value={form.caretakerName} onChange={(e) => update('caretakerName', e.target.value)} />

            <label className="form-field__label">Their phone number (optional)</label>
            <input value={form.caretakerPhone} onChange={(e) => update('caretakerPhone', e.target.value)} placeholder="2547XXXXXXXX" />
            <p className="unit-detail-hint">Want to give someone their own login to manage this property? Add them as a Property Manager from Settings after it's created.</p>

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
