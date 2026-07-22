import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import { downloadCsv } from '../utils/downloadCsv.js';
import './StatisticsPanel.css';
import '../pages/TenantPortal.css';

/**
 * Full, all-time "Payment History" for the landlord/manager portal -
 * requested to live in the menu (not buried in a Quick Action) and be
 * downloadable, matching the tenant portal's equivalent. Backed by
 * GET /api/payments/history (see payment.controller.js).
 */
export default function PaymentHistoryPanel({ token, propertyId, propertyIdReady = true, canDelete = true }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    // BUG FIX: the parent (Dashboard.jsx) starts with activePropertyId
    // === null while it's still resolving which property to show, then
    // sets the real id a moment later. Without this guard, this effect
    // fired once with propertyId=null - which the backend correctly
    // reads as "no property filter, show every apartment's payments" -
    // and only THEN re-fired with the real, scoped propertyId. That's
    // the "shows 11 payments (one from a different apartment) then
    // blinks down to 10" bug: it wasn't a data bug, it was a real,
    // unscoped fetch briefly rendering before the scoped one replaced
    // it. propertyIdReady lets the parent tell us "I haven't resolved
    // the active property yet" so we skip fetching entirely until then,
    // instead of ever doing an unscoped fetch by accident.
    if (!propertyIdReady) return undefined;

    let cancelled = false;
    setLoading(true);
    api
      .getPaymentHistoryFull(token, propertyId)
      .then((res) => {
        if (!cancelled) setPayments(res.payments || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load payment history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, propertyId, propertyIdReady]);

  // FIX (direct request): "the landlord and manager should be able to
  // delete a payment history entry - and when they do it deletes for
  // all" - a real delete, gone from everyone's view (landlord's,
  // manager's, and the tenant's own payment history), not a hide.
  async function handleDelete(paymentId) {
    if (!window.confirm('Permanently delete this payment record? This removes it for everyone, including the tenant\'s own payment history, and cannot be undone.')) return;
    setDeletingId(paymentId);
    setError('');
    try {
      await api.deletePayment(paymentId, token);
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete that payment.');
    } finally {
      setDeletingId(null);
    }
  }

  function handleDownload() {
    downloadCsv(
      'rentapay-payment-history',
      ['Date', 'Tenant', 'Unit', 'Amount (KES)', 'Method', 'Status'],
      payments.map((p) => [
        p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '—',
        p.tenants?.full_name || '—',
        p.units?.unit_name || '—',
        p.amount,
        (p.payment_method || '').replace('_', ' '),
        p.status,
      ])
    );
  }

  if (loading) return <section className="statistics-panel"><p>Loading payment history…</p></section>;
  if (error) return <section className="statistics-panel"><p className="modal-error">{error}</p></section>;

  return (
    <section className="statistics-panel">
      <div className="tenant-section__header-row">
        <h2>Payment History</h2>
        {payments.length > 0 && (
          <button className="ghost-link" onClick={handleDownload}>Download</button>
        )}
      </div>
      {payments.length === 0 ? (
        <p className="tenant-portal-hint">No payments recorded yet.</p>
      ) : (
        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr><th>Date</th><th>Tenant</th><th>Unit</th><th>Amount</th><th>Method</th><th>Status</th>{canDelete && <th></th>}</tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '—'}</td>
                  <td>{p.tenants?.full_name || '—'}</td>
                  <td>{p.units?.unit_name || '—'}</td>
                  <td>KES {Number(p.amount).toLocaleString()}</td>
                  <td>{(p.payment_method || '').replace('_', ' ')}</td>
                  <td><span className={`payment-status payment-status--${p.status}`}>{p.status}</span></td>
                  {canDelete && (
                    <td>
                      <button
                        type="button"
                        className="ghost-link"
                        style={{ color: '#b3261e' }}
                        disabled={deletingId === p.id}
                        onClick={() => handleDelete(p.id)}
                      >
                        {deletingId === p.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
