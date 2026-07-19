import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';

/**
 * "Landlords manual payment confirmations" - direct request: admin
 * queue for landlord/manager/caretaker subscription payments made
 * manually to RentaPay's own paybill (400200 / 1341657388) instead of
 * via the Daraja STK popup. Confirm activates/renews the account
 * (see landlordManualSubscriptionPayment.controller.js for what that
 * does under the hood - direct verification + activation for a first
 * payment, expiry extension for a renewal). Reject leaves it actionable
 * with a reason. Delete removes the record entirely.
 */
export default function LandlordManualPaymentConfirmations({ token }) {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  function load() {
    setLoading(true);
    api
      .listManualSubscriptionPayments(statusFilter, token)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load payments.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [statusFilter, token]);

  async function handleConfirm(id) {
    setBusyId(id);
    setError('');
    try {
      await api.confirmManualSubscriptionPayment(id, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to confirm.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id) {
    setBusyId(id);
    setError('');
    try {
      await api.rejectManualSubscriptionPayment(id, rejectReason.trim(), token);
      setRejectingId(null);
      setRejectReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this payment record permanently? This cannot be undone.')) return;
    setBusyId(id);
    setError('');
    try {
      await api.deleteManualSubscriptionPayment(id, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="statistics-panel">
      <h2>Landlord Manual Payment Confirmations</h2>
      <p className="add-tenant-subtitle">
        Subscription payments landlords, managers, or caretakers submitted manually (Paybill 400200, Acc 1341657388) after not
        receiving or trusting the M-Pesa popup.
      </p>

      <div className="admin-tabs" style={{ marginBottom: '1rem' }}>
        {['pending', 'confirmed', 'rejected', 'all'].map((s) => (
          <button key={s} className={statusFilter === s ? 'is-active' : ''} onClick={() => setStatusFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="modal-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>No {statusFilter === 'all' ? '' : statusFilter} payment submissions.</p>
      ) : (
        <div className="statistics-panel__county-table-wrap">
          <table className="statistics-panel__county-table">
            <thead>
              <tr>
                <th>Landlord</th>
                <th>Submitted by</th>
                <th>Transaction code</th>
                <th>Amount</th>
                <th>Paid by</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <React.Fragment key={item.id}>
                  <tr>
                    <td>{item.landlords?.full_name || '—'}<br /><small>{item.landlords?.phone}</small></td>
                    <td>{item.submitted_by_role}</td>
                    <td>{item.transaction_code}</td>
                    <td>KES {Number(item.amount_paid).toLocaleString()}</td>
                    <td>{item.mpesa_payer_name}<br /><small>{item.mpesa_payer_phone}</small></td>
                    <td>{new Date(item.submitted_at).toLocaleString('en-GB')}</td>
                    <td>{item.status}</td>
                    <td>
                      {item.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button disabled={busyId === item.id} onClick={() => handleConfirm(item.id)}>Confirm</button>
                          <button disabled={busyId === item.id} onClick={() => setRejectingId(rejectingId === item.id ? null : item.id)}>Reject</button>
                          <button disabled={busyId === item.id} onClick={() => handleDelete(item.id)} style={{ color: '#B3261E' }}>Delete</button>
                        </div>
                      ) : (
                        <button disabled={busyId === item.id} onClick={() => handleDelete(item.id)} style={{ color: '#B3261E' }}>Delete</button>
                      )}
                    </td>
                  </tr>
                  {rejectingId === item.id && (
                    <tr>
                      <td colSpan={8}>
                        <input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason (optional)"
                          style={{ marginRight: 8 }}
                        />
                        <button disabled={busyId === item.id} onClick={() => handleReject(item.id)}>Confirm rejection</button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
