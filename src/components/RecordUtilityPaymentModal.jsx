import React, { useState } from 'react';
import Button from './Button.jsx';
import InfoTip from './InfoTip.jsx';
import { api, ApiError } from '../api/client.js';

// Direct request: "there should be a way for a landlord or manager
// only to enter the payment details for these bills as sometimes
// they usually are paid separately... and they should choose whether
// it affects a specific unit or it affects the whole units."
//
// UPDATE (direct request: "the manual recording aspect can be covered
// under the normal record payment under tenant/unit"): the "one
// specific unit" scope this modal used to offer is gone now - that
// case moved to the ordinary "Record payment" button already on every
// tenant's own unit page (see RecordPaymentModal in UnitDetail.jsx),
// which now offers their open water/electricity bills right alongside
// rent. No reason to make anyone come here just to record one
// tenant's bill. What's LEFT here is the one thing that genuinely has
// nowhere else to live: one lump payment (cash, bank transfer, a
// single M-Pesa payment) that settles the whole apartment's open
// bills of one utility type at once - there's no "tenant page" for
// that, it spans every unit.
export default function RecordUtilityPaymentModal({ token, propertyId, propertyName, onClose, onRecorded }) {
  const [utilityType, setUtilityType] = useState('water');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [mpesaReference, setMpesaReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // result message

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!paymentDate) {
      setError('Payment date is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        paymentDate,
        mpesaReference: mpesaReference.trim() || undefined,
        note: note.trim() || undefined,
        amount: amount.trim() ? Number(amount) : undefined,
        propertyId,
        utilityType,
      };
      const res = await api.recordManualUtilityPayment(payload, token);
      setDone(res.message || 'Payment recorded.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="modal-card__header">
            <h2>Payment recorded</h2>
            <button className="modal-card__close" onClick={onClose}>\u00d7</button>
          </div>
          <p className="tenant-portal-hint">{done}</p>
          <Button variant="primary" onClick={() => { onRecorded(); onClose(); }}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h2>
            Record a bulk utility payment
            <InfoTip text="For a single lump payment (cash, bank transfer, one M-Pesa payment) that settles every open water or electricity bill across the whole apartment at once. To record just one tenant's bill, use Record payment on their own unit page instead." />
          </h2>
          <button className="modal-card__close" onClick={onClose}>\u00d7</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          {error && <p className="modal-error">{error}</p>}

          <label className="form-field__label">Utility</label>
          <select value={utilityType} onChange={(e) => setUtilityType(e.target.value)}>
            <option value="water">Water</option>
            <option value="electricity">Electricity</option>
          </select>

          <p className="tenant-portal-hint">
            This settles every currently open {utilityType} bill across {propertyName || 'this apartment'}.
          </p>

          <label className="form-field__label">
            Amount paid (KES)
            <InfoTip text="Leave blank to mark each bill's full outstanding amount as paid. This amount is applied per bill (not split), so leave it blank unless every unit owes the same amount." />
          </label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Full amount owed if left blank" />

          <label className="form-field__label">Payment date</label>
          <input required type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />

          <label className="form-field__label">M-Pesa reference / receipt number (optional)</label>
          <input value={mpesaReference} onChange={(e) => setMpesaReference(e.target.value)} placeholder="e.g. QGH7XYZ123" />

          <label className="form-field__label">Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid by bank transfer to landlord" />

          <Button type="submit" variant="primary" loading={saving}>
            Record payment
          </Button>
        </form>
      </div>
    </div>
  );
}
