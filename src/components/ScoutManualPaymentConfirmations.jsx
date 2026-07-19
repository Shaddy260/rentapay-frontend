import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import './PendingPaymentConfirmations.css';

/**
 * Admin queue for Scout county-subscription payments submitted
 * manually (Paybill) instead of via the Daraja STK popup. Mirrors
 * LandlordManualPaymentConfirmations.jsx exactly - same backend shape
 * (scout_manual_county_payments), same confirm/reject/delete actions.
 *
 * FIX (direct request: "payment requests either for landlords or
 * scouts should be displayed like how tenant details display"):
 * rebuilt as the same card layout as the tenant/landlord panels, with
 * the same duplicate-transaction-code warning banner.
 */
export default function ScoutManualPaymentConfirmations({ token }) {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  function load() {
    setError('');
    api
      .listScoutManualCountyPayments(statusFilter, token)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load payments.'));
  }

  useEffect(() => {
    setItems(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, token]);

  async function handleConfirm(item) {
    setBusyId(item.id);
    setError('');
    try {
      await api.confirmScoutManualCountyPayment(item.id, token);
      setNotice(`Payment from ${item.scouts?.full_name || 'scout'} confirmed.`);
      setConfirmTarget(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to confirm.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(item) {
    setBusyId(item.id);
    setError('');
    try {
      await api.rejectScoutManualCountyPayment(item.id, rejectReason.trim(), token);
      setNotice('Submission rejected.');
      setRejectingId(null);
      setRejectReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setError('');
    try {
      await api.deleteScoutManualCountyPayment(deleteTarget.id, token);
      setNotice('Record deleted.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete.');
    } finally {
      setBusyId(null);
    }
  }

  function timeAgo(iso) {
    if (!iso) return '—';
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    return new Date(iso).toLocaleDateString('en-GB');
  }

  const pendingCount = (items || []).filter((i) => i.status === 'pending').length;

  return (
    <section className="statistics-panel">
      <div className="tenant-section__header-row">
        <h2>
          Scout Manual Payment Confirmations
          {statusFilter === 'pending' && pendingCount > 0 && (
            <span style={{ marginLeft: 8, fontSize: '0.65em', background: '#B3261E', color: '#fff', borderRadius: 10, padding: '2px 8px', verticalAlign: 'middle' }}>
              {pendingCount} awaiting review
            </span>
          )}
        </h2>
      </div>
      <p className="tenant-portal-hint">
        County-access payments Scouts submitted manually (Paybill) after not receiving or trusting the M-Pesa popup.
      </p>

      <div className="ppc-status-tabs">
        {['pending', 'confirmed', 'rejected', 'all'].map((s) => (
          <button
            key={s}
            type="button"
            className={`ppc-status-tabs__item ${statusFilter === s ? 'is-active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {notice && <p style={{ color: '#1a7a3c' }}>{notice}</p>}
      {error && <p className="modal-error">{error}</p>}
      {items === null && <p>Loading…</p>}
      {items && items.length === 0 && <p className="tenant-portal-hint">No {statusFilter === 'all' ? '' : statusFilter} payment submissions.</p>}

      <div className="ppc-list">
        {(items || []).map((item) => (
          <div key={item.id} className="ppc-card">
            {item.duplicate_of && (
              <div className="ppc-card__duplicate-banner">
                ⚠️ Duplicate — this transaction code was already used for a confirmed payment. Contact this scout to clarify before confirming.
              </div>
            )}
            <div className="ppc-card__row">
              <div className="ppc-card__info">
                <div className="ppc-card__name">{item.scouts?.full_name || 'Unknown scout'}</div>
                <div className="ppc-card__unit">{(item.counties || []).join(', ') || 'No counties listed'}</div>
              </div>
              <div className="ppc-card__submitted">{timeAgo(item.submitted_at)}</div>
            </div>

            <div className="ppc-card__details">
              <div><span>Amount paid</span><span>KES {Number(item.amount_paid).toLocaleString()}</span></div>
              <div><span>Transaction code</span><span>{item.transaction_code}</span></div>
              <div><span>M-Pesa payer</span><span>{item.mpesa_payer_name}</span></div>
              {item.mpesa_payer_phone && <div><span>Sent from phone</span><span>{item.mpesa_payer_phone}</span></div>}
              {item.scouts?.phone && <div><span>Account phone</span><span>{item.scouts.phone}</span></div>}
              {item.status === 'rejected' && item.rejection_reason && (
                <div><span>Rejection reason</span><span>{item.rejection_reason}</span></div>
              )}
            </div>

            {item.status === 'pending' ? (
              <div className="ppc-card__actions">
                <Button variant="primary" loading={busyId === item.id} onClick={() => setConfirmTarget(item)}>
                  Confirm
                </Button>
                {rejectingId === item.id ? (
                  <div className="ppc-card__reject-form">
                    <input placeholder="Reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                    <button type="button" className="ghost-link" disabled={busyId === item.id} onClick={() => handleReject(item)}>
                      {busyId === item.id ? 'Rejecting…' : 'Submit rejection'}
                    </button>
                    <button type="button" className="ghost-link" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</button>
                  </div>
                ) : (
                  <button type="button" className="ghost-link" style={{ color: '#b3261e' }} onClick={() => { setRejectingId(item.id); setRejectReason(''); }}>
                    Reject
                  </button>
                )}
                <button type="button" className="ghost-link" style={{ color: '#b3261e' }} onClick={() => setDeleteTarget(item)}>
                  Delete
                </button>
              </div>
            ) : (
              <div className="ppc-card__actions">
                <button type="button" className="ghost-link" style={{ color: '#b3261e' }} onClick={() => setDeleteTarget(item)}>
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title="Confirm this payment?"
        message={confirmTarget ? `This will activate county access for ${confirmTarget.scouts?.full_name || 'this scout'} - KES ${Number(confirmTarget.amount_paid).toLocaleString()}.` : ''}
        confirmLabel="Yes, confirm"
        danger={false}
        busy={busyId === confirmTarget?.id}
        onConfirm={() => handleConfirm(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this record?"
        message="This permanently removes this payment confirmation record. This cannot be undone."
        confirmLabel="Yes, delete"
        danger
        busy={busyId === deleteTarget?.id}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
