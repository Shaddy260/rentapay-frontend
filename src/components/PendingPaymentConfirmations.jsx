import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import Avatar from './Avatar.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import Button from './Button.jsx';
import './PendingPaymentConfirmations.css';
import './StatisticsPanel.css';

// Landlord/property-manager side of the manual Paybill payment
// confirmation flow (see TenantPortal.jsx's PaybillModal for the
// tenant-facing submission side, and payment.controller.js /
// pendingPaymentConfirmation.controller.js on the backend). Follows
// the same list-panel conventions as ArchivedTenantsPanel.jsx /
// PaymentHistoryPanel.jsx.
export default function PendingPaymentConfirmations({ token, canConfirmReject = true }) {
  const [status, setStatus] = useState('pending'); // 'pending' | 'confirmed' | 'rejected'
  const [confirmations, setConfirmations] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null); // shows the inline reason field
  const [rejectReason, setRejectReason] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null); // record mid "are you sure" for Confirm
  const [deleteTarget, setDeleteTarget] = useState(null); // record mid "are you sure" for Delete

  function load() {
    setError('');
    api
      .getPendingPaymentConfirmations(status, token)
      .then((res) => setConfirmations(res.confirmations || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load payment confirmations.'));
  }

  // Lets PendingPaymentsBell (a sibling component in the header, not a
  // parent/child of this one) decrement its badge the instant a
  // pending record is confirmed/rejected/deleted, rather than waiting
  // out its own poll interval.
  function notifyBellOfChange() {
    window.dispatchEvent(new Event('rentapay:pending-payments-changed'));
  }

  useEffect(() => {
    setConfirmations(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token]);

  async function handleConfirm(record) {
    setActioningId(record.id);
    setError('');
    try {
      await api.confirmPendingPayment(record.id, token);
      setNotice(`Payment from ${record.tenants?.full_name || 'tenant'} confirmed.`);
      setConfirmTarget(null);
      load();
      notifyBellOfChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to confirm payment.');
    } finally {
      setActioningId(null);
    }
  }

  async function handleReject(record) {
    setActioningId(record.id);
    setError('');
    try {
      await api.rejectPendingPayment(record.id, { reason: rejectReason || undefined }, token);
      setNotice(`Submission from ${record.tenants?.full_name || 'tenant'} rejected.`);
      setRejectingId(null);
      setRejectReason('');
      load();
      notifyBellOfChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject submission.');
    } finally {
      setActioningId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActioningId(deleteTarget.id);
    setError('');
    try {
      await api.deletePendingPaymentConfirmation(deleteTarget.id, token);
      setNotice('Record deleted.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete record.');
    } finally {
      setActioningId(null);
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

  // "Categorize these requests in year, and months requests - this
  // month's under this month, last month's, and so on." Resubmitted
  // records are already sorted to the very top by the backend and
  // kept there regardless of group, so they stay impossible to miss.
  function groupByYearMonth(records) {
    const groups = new Map();
    for (const record of records) {
      const d = new Date(record.submitted_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      if (!groups.has(key)) groups.set(key, { label, records: [] });
      groups.get(key).records.push(record);
    }
    return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }

  function downloadCsv() {
    if (!confirmations || !confirmations.length) return;
    const headers = ['Tenant', 'Unit', 'Amount Paid', 'Transaction Code', 'M-Pesa Payer', 'SMS Time', 'Status', 'Submitted At', 'Actioned By', 'Rejection Reason'];
    const rows = confirmations.map((r) => [
      r.tenants?.full_name || '',
      r.units?.unit_name || '',
      r.amount_paid,
      r.transaction_code,
      r.mpesa_payer_name,
      r.mpesa_sms_timestamp ? new Date(r.mpesa_sms_timestamp).toLocaleString('en-GB') : '',
      r.status,
      new Date(r.submitted_at).toLocaleString('en-GB'),
      r.confirmed_by_landlord?.full_name || r.confirmed_by_manager?.full_name || '',
      r.rejection_reason || '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-confirmations-${status}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="statistics-panel">
      <div className="tenant-section__header-row">
        <h2>Pending Payment Confirmations</h2>
      </div>
      <p className="tenant-portal-hint">
        Tenants who paid rent directly via Paybill/Till submit proof here for you to confirm or reject. Confirming updates their balance and payment history immediately.
      </p>

      <div className="ppc-status-tabs">
        {['pending', 'confirmed', 'rejected'].map((s) => (
          <button
            key={s}
            type="button"
            className={`ppc-status-tabs__item ${status === s ? 'is-active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        {status !== 'pending' && confirmations && confirmations.length > 0 && (
          <button type="button" className="ppc-status-tabs__download" onClick={downloadCsv}>⬇ Download</button>
        )}
      </div>

      {notice && <p style={{ color: '#1a7a3c' }}>{notice}</p>}
      {error && <p className="modal-error">{error}</p>}
      {confirmations === null && <p>Loading…</p>}
      {confirmations && confirmations.length === 0 && (
        <p className="tenant-portal-hint">No {status} submissions.</p>
      )}

      <div className="ppc-list">
        {groupByYearMonth(confirmations || []).map(([key, group]) => (
          <div key={key} className="ppc-group">
            <h3 className="ppc-group__label">{group.label}</h3>
            {group.records.map((record) => (
              <div key={record.id} className={`ppc-card ${record.resubmission_of ? 'ppc-card--resubmitted' : ''}`}>
                {record.resubmission_of && (
                  <div className="ppc-card__resubmitted-banner">🔁 Resubmitted request</div>
                )}
                {record.duplicate_of && (
                  <div className="ppc-card__duplicate-banner">
                    ⚠️ Possible duplicate — this transaction code matches an already-confirmed payment. Review carefully before confirming.
                  </div>
                )}
                <div className="ppc-card__row">
                  <Avatar name={record.tenants?.full_name} photoUrl={record.tenants?.photo_url} size={44} />
                  <div className="ppc-card__info">
                    <div className="ppc-card__name">{record.tenants?.full_name || 'Unknown tenant'}</div>
                    <div className="ppc-card__unit">{record.units?.unit_name || '—'}</div>
                  </div>
                  <div className="ppc-card__submitted">{timeAgo(record.submitted_at)}</div>
                </div>

                <div className="ppc-card__details">
                  <div><span>Amount paid</span><span>KES {Number(record.amount_paid).toLocaleString()}</span></div>
                  <div><span>Transaction code</span><span>{record.transaction_code}</span></div>
                  <div><span>M-Pesa payer</span><span>{record.mpesa_payer_name}</span></div>
                  {record.mpesa_sms_timestamp && (
                    <div><span>SMS time</span><span>{new Date(record.mpesa_sms_timestamp).toLocaleString('en-GB')}</span></div>
                  )}
                  {record.status === 'rejected' && record.rejection_reason && (
                    <div><span>Rejection reason</span><span>{record.rejection_reason}</span></div>
                  )}
                  {record.status !== 'pending' && (record.confirmed_by_landlord?.full_name || record.confirmed_by_manager?.full_name) && (
                    <div>
                      <span>{record.status === 'confirmed' ? 'Confirmed by' : 'Rejected by'}</span>
                      <span>{record.confirmed_by_landlord?.full_name || record.confirmed_by_manager?.full_name}</span>
                    </div>
                  )}
                </div>

                {record.status === 'pending' && canConfirmReject && (
                  <div className="ppc-card__actions">
                    <Button variant="primary" loading={actioningId === record.id} onClick={() => setConfirmTarget(record)}>
                      Confirm
                    </Button>
                    {rejectingId === record.id ? (
                      <div className="ppc-card__reject-form">
                        <input
                          placeholder="Reason (optional)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <button type="button" className="ghost-link" disabled={actioningId === record.id} onClick={() => handleReject(record)}>
                          {actioningId === record.id ? 'Rejecting…' : 'Submit rejection'}
                        </button>
                        <button type="button" className="ghost-link" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="ghost-link"
                        style={{ color: '#b3261e' }}
                        onClick={() => { setRejectingId(record.id); setRejectReason(''); }}
                      >
                        Reject
                      </button>
                    )}
                  </div>
                )}

                {record.status !== 'pending' && (
                  <div className="ppc-card__actions">
                    <button type="button" className="ghost-link" style={{ color: '#b3261e' }} onClick={() => setDeleteTarget(record)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title="Confirm this payment?"
        message={
          confirmTarget
            ? `This will mark KES ${Number(confirmTarget.amount_paid).toLocaleString()} from ${confirmTarget.tenants?.full_name || 'this tenant'} as confirmed, update their balance, and notify them.`
            : ''
        }
        confirmLabel="Yes, confirm"
        danger={false}
        busy={actioningId === confirmTarget?.id}
        onConfirm={() => handleConfirm(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this record?"
        message="This permanently removes this payment confirmation record. This cannot be undone."
        confirmLabel="Yes, delete"
        danger
        busy={actioningId === deleteTarget?.id}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
