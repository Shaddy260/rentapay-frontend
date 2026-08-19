import React, { useState } from 'react';
import Button from './Button.jsx';
import InfoTip from './InfoTip.jsx';
import { api, ApiError } from '../api/client.js';

// Direct request: "there should be a way for a landlord or manager
// only to enter the payment details for these bills as sometimes
// they usually are paid separately... and they should choose whether
// it affects a specific unit or it affects the whole units."
//
// This is the landlord/manager-side counterpart to a tenant's own
// "Pay Water"/"Pay Electricity" flow - for when the bill was actually
// settled outside the app (cash, a bank transfer, one lump M-Pesa
// payment covering the whole property's water for the month, etc.)
// and someone who manages the property needs to mark it paid so the
// tenant's balance reflects reality. Backed by the existing
// POST /payments/utility-manual endpoint (recordManualUtilityPayment
// in payment.controller.js), which already supports both scopes:
// a single invoice, or every open invoice of one utility type across
// a property.
export default function RecordUtilityPaymentModal({ token, propertyId, propertyName, onClose, onRecorded }) {
  const [scope, setScope] = useState('property'); // 'property' | 'unit'
  const [utilityType, setUtilityType] = useState('water');
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [mpesaReference, setMpesaReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // result message

  function loadOpenInvoices(type) {
    setLoadingInvoices(true);
    setSelectedInvoiceId('');
    api
      .listUtilityInvoicesForProperty(token, propertyId, type)
      .then((res) => setInvoices(res.invoices || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load open bills for this apartment.'))
      .finally(() => setLoadingInvoices(false));
  }

  function handleScopeOrTypeChange(nextScope, nextType) {
    setScope(nextScope);
    setUtilityType(nextType);
    setError('');
    if (nextScope === 'unit') loadOpenInvoices(nextType);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (scope === 'unit' && !selectedInvoiceId) {
      setError('Choose which unit\u2019s bill this payment is for.');
      return;
    }
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
        ...(scope === 'unit'
          ? { invoiceId: selectedInvoiceId }
          : { propertyId, utilityType }),
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
            Record a utility payment
            <InfoTip text="Use this when water or electricity was paid outside the app - e.g. by cash, bank transfer, or one lump M-Pesa payment covering the whole apartment - so tenant balances reflect it." />
          </h2>
          <button className="modal-card__close" onClick={onClose}>\u00d7</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          {error && <p className="modal-error">{error}</p>}

          <label className="form-field__label">Utility</label>
          <select value={utilityType} onChange={(e) => handleScopeOrTypeChange(scope, e.target.value)}>
            <option value="water">Water</option>
            <option value="electricity">Electricity</option>
          </select>

          <label className="form-field__label">Applies to</label>
          <select value={scope} onChange={(e) => handleScopeOrTypeChange(e.target.value, utilityType)}>
            <option value="property">The whole apartment ({propertyName}) - settles every open {utilityType} bill</option>
            <option value="unit">One specific unit only</option>
          </select>

          {scope === 'unit' && (
            <>
              <label className="form-field__label">Which unit</label>
              {loadingInvoices ? (
                <p className="tenant-portal-hint">Loading open bills...</p>
              ) : invoices.length === 0 ? (
                <p className="tenant-portal-hint">No open {utilityType} bills for this apartment right now.</p>
              ) : (
                <select value={selectedInvoiceId} onChange={(e) => setSelectedInvoiceId(e.target.value)} required>
                  <option value="">Select a unit...</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.unit_name || inv.unitName} \u00b7 KES {Number(inv.amount - (inv.amount_paid || 0)).toLocaleString()} owed
                      {inv.month_key ? ` \u00b7 ${inv.month_key}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}

          <label className="form-field__label">
            Amount paid (KES)
            <InfoTip text="Leave blank to mark the full outstanding amount as paid. For the 'whole apartment' scope, this amount is applied per bill (not split), so leave it blank unless every unit owes the same amount." />
          </label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Full amount owed if left blank" />

          <label className="form-field__label">Payment date</label>
          <input required type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />

          <label className="form-field__label">M-Pesa reference / receipt number (optional)</label>
          <input value={mpesaReference} onChange={(e) => setMpesaReference(e.target.value)} placeholder="e.g. QGH7XYZ123" />

          <label className="form-field__label">Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid by bank transfer to landlord" />

          <Button type="submit" variant="primary" loading={saving} disabled={scope === 'unit' && invoices.length === 0}>
            Record payment
          </Button>
        </form>
      </div>
    </div>
  );
}
