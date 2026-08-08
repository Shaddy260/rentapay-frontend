import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';

/**
 * FEATURE (direct request: "in-app rent negotiation / payment plan
 * requests - tenant splits a payment, landlord approves/declines
 * in-app"). Drop this into the tenant portal's financials tab. Shows
 * the tenant's current request (if any) and its status, or a "Request
 * a payment plan" button that opens a builder for splitting
 * totalDue into installments.
 */
export default function PaymentPlanRequest({ token, totalDue }) {
  const [current, setCurrent] = useState(null); // most recent pending/approved/declined request
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  function load() {
    api
      .listPaymentPlanRequests({}, token)
      .then((res) => setCurrent((res.requests || [])[0] || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCancel() {
    if (!current) return;
    try {
      await api.cancelPaymentPlanRequest(current.id, token);
      load();
    } catch {
      // best-effort; load() below will just re-show the current state
      load();
    }
  }

  if (loading) return null;

  return (
    <div className="tenant-section" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Payment plan</h3>

      {current?.status === 'pending' && (
        <div className="stk-pending paybill-pending">
          <p>⏳ Your payment plan request is awaiting your landlord's decision.</p>
          <button onClick={handleCancel}>Withdraw request</button>
        </div>
      )}

      {current?.status === 'approved' && (
        <div className="paybill-pending" style={{ borderColor: '#2E7D32' }}>
          <p>✅ Your payment plan (KES {Number(current.total_amount).toLocaleString()}) was approved.</p>
          {current.decision_note && <p className="tenant-portal-hint">Note: {current.decision_note}</p>}
          <div className="paybill-pending__details">
            {(current.installments || []).map((inst, i) => (
              <div key={i}>
                <span>Installment {i + 1}</span>
                <span>KES {Number(inst.amount).toLocaleString()} by {new Date(inst.dueDate).toLocaleDateString('en-GB')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {current?.status === 'declined' && (
        <div className="paybill-rejected-banner">
          <p>❌ Your last payment plan request was declined.</p>
          {current.decision_note && <p className="paybill-rejected-banner__reason">Reason: {current.decision_note}</p>}
          <Button variant="mpesa" onClick={() => setModalOpen(true)}>Propose a new plan</Button>
        </div>
      )}

      {(!current || current.status === 'cancelled') && (
        <Button variant="ghost" onClick={() => setModalOpen(true)}>Request a payment plan</Button>
      )}

      {modalOpen && (
        <PaymentPlanBuilderModal
          token={token}
          defaultTotal={totalDue}
          onClose={() => setModalOpen(false)}
          onDone={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function PaymentPlanBuilderModal({ token, defaultTotal, onClose, onDone }) {
  const [installments, setInstallments] = useState([
    { amount: '', dueDate: '' },
    { amount: '', dueDate: '' },
  ]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const total = installments.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const target = Number(defaultTotal) || 0;

  function updateInstallment(idx, field, value) {
    setInstallments((prev) => prev.map((inst, i) => (i === idx ? { ...inst, [field]: value } : inst)));
  }
  function addInstallment() {
    setInstallments((prev) => [...prev, { amount: '', dueDate: '' }]);
  }
  function removeInstallment(idx) {
    setInstallments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (installments.some((i) => !i.amount || !i.dueDate)) {
      setError('Every installment needs an amount and a due date.');
      return;
    }
    setBusy(true);
    try {
      await api.createPaymentPlanRequest(
        {
          totalAmount: total,
          installments: installments.map((i) => ({ amount: Number(i.amount), dueDate: i.dueDate })),
          reason: reason.trim(),
        },
        token
      );
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>Propose a payment plan</h3>
          <button className="modal-card__close" onClick={onClose}>×</button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          {error && <p className="modal-error">{error}</p>}
          <p className="tenant-portal-hint">
            Split what you owe into installments your landlord can approve or decline. This sends them the proposal directly in chat.
          </p>

          {installments.map((inst, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="form-field__label">Amount (KES)</label>
                <input type="number" min="0" step="0.01" value={inst.amount} onChange={(e) => updateInstallment(idx, 'amount', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-field__label">Due date</label>
                <input type="date" value={inst.dueDate} onChange={(e) => updateInstallment(idx, 'dueDate', e.target.value)} />
              </div>
              {installments.length > 2 && (
                <button type="button" className="ghost-link" onClick={() => removeInstallment(idx)}>Remove</button>
              )}
            </div>
          ))}
          <button type="button" className="ghost-link" onClick={addInstallment}>+ Add another installment</button>

          <p className="tenant-portal-hint" style={{ marginTop: 8 }}>
            Total: KES {total.toLocaleString()}{target > 0 ? ` (balance due: KES ${target.toLocaleString()})` : ''}
          </p>

          <label className="form-field__label">Note to your landlord (optional)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Pay half now, half after my next paycheck…" />

          <Button type="submit" variant="primary" loading={busy}>Send proposal</Button>
        </form>
      </div>
    </div>
  );
}
