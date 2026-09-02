import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import Avatar from './Avatar.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import Button from './Button.jsx';
import { useToast } from './Toast.jsx';
import './PendingPaymentConfirmations.css';
import './StatisticsPanel.css';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';

// Landlord/property-manager side of the manual Paybill payment
// confirmation flow (see TenantPortal.jsx's PaybillModal for the
// tenant-facing submission side, and payment.controller.js /
// pendingPaymentConfirmation.controller.js on the backend). Follows
// the same list-panel conventions as ArchivedTenantsPanel.jsx /
// PaymentHistoryPanel.jsx.
export default function PendingPaymentConfirmations({ token, canConfirmReject = true, subscriptionExpired = false, propertyId }) {
  const toast = useToast();
  const [status, setStatus] = useState('pending'); // 'pending' | 'confirmed' | 'rejected'
  const [confirmations, setConfirmations] = useState(null);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null); // shows the inline reason field
  const [rejectReason, setRejectReason] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null); // record mid "are you sure" for Confirm
  const [deleteTarget, setDeleteTarget] = useState(null); // record mid "are you sure" for Delete

  // Multi-select delete (spec: Pending Payment Confirmations Card,
  // "long-press an entry to enter multi-select mode"). Only
  // confirmed/rejected records (or flagged duplicates) can actually be
  // deleted - see isDismissable below - so selection is limited to
  // those; a still-pending real submission has to be confirmed or
  // rejected first, same rule the single-delete flow already enforces.
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null); // 'selected' | 'all' mid "are you sure"
  const [bulkBusy, setBulkBusy] = useState(false);
  const longPressTimer = React.useRef(null);
  const longPressFired = React.useRef(false);

  function isDismissable(record) {
    return record.status !== 'pending' || !!record.duplicate_of;
  }

  function startLongPress(record) {
    if (!isDismissable(record)) return;
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setMultiSelectMode(true);
      setSelectedIds(new Set([record.id]));
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function exitMultiSelect() {
    setMultiSelectMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelected(record) {
    if (!isDismissable(record)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(record.id)) next.delete(record.id);
      else next.add(record.id);
      return next;
    });
  }

  function load() {
    setError('');
    api
      .getPendingPaymentConfirmations(status, token, propertyId)
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
    exitMultiSelect();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token, propertyId]);

  // Synchronous re-entry guard (belt-and-suspenders alongside the
  // fix above): React state (actioningId) only disables the button
  // AFTER a re-render, so two taps close enough together could both
  // fire handleConfirm/handleReject before that re-render happens -
  // same double-billing risk as the queueing bug, just from a fast
  // double-tap instead of a flaky connection. A plain ref updates
  // immediately, synchronously, with no render in between.
  const inFlightIds = React.useRef(new Set());

  async function handleConfirm(record) {
    if (inFlightIds.current.has(record.id)) return;
    inFlightIds.current.add(record.id);
    setActioningId(record.id);
    setError('');
    try {
      await api.confirmPendingPayment(record.id, token);
      toast.success(`✓ Payment from ${record.tenants?.full_name || 'tenant'} confirmed.`);
      setConfirmTarget(null);
      load();
      notifyBellOfChange();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to confirm payment.');
    } finally {
      setActioningId(null);
      inFlightIds.current.delete(record.id);
    }
  }

  async function handleReject(record) {
    if (inFlightIds.current.has(record.id)) return;
    inFlightIds.current.add(record.id);
    setActioningId(record.id);
    setError('');
    try {
      await api.rejectPendingPayment(record.id, { reason: rejectReason || undefined }, token);
      toast.success(`Submission from ${record.tenants?.full_name || 'tenant'} rejected.`);
      setRejectingId(null);
      setRejectReason('');
      load();
      notifyBellOfChange();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to reject submission.');
    } finally {
      setActioningId(null);
      inFlightIds.current.delete(record.id);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActioningId(deleteTarget.id);
    setError('');
    try {
      await api.deletePendingPaymentConfirmation(deleteTarget.id, token);
      toast.success('Removed from your list.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete record.');
    } finally {
      setActioningId(null);
    }
  }

  // "Delete selected" - dismisses exactly the checked rows from this
  // viewer's own inbox only (see dismissRecord on the backend).
  async function handleBulkDeleteSelected() {
    setBulkBusy(true);
    setError('');
    try {
      const res = await api.bulkDeletePendingPaymentConfirmations({ ids: Array.from(selectedIds) }, token);
      toast.success(res.message || 'Selected records removed from your list.');
      if (res.skipped?.length) {
        toast.error(`${res.skipped.length} still-pending submission${res.skipped.length === 1 ? '' : 's'} need${res.skipped.length === 1 ? 's' : ''} to be confirmed or rejected first, so ${res.skipped.length === 1 ? 'it was' : 'they were'} left as-is.`);
      }
      setBulkAction(null);
      exitMultiSelect();
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete selected records.');
    } finally {
      setBulkBusy(false);
    }
  }

  // "Delete all" - dismisses every record currently visible under this
  // status/property filter for this viewer, not just the checked ones.
  async function handleBulkDeleteAll() {
    setBulkBusy(true);
    setError('');
    try {
      const res = await api.bulkDeletePendingPaymentConfirmations({ all: true, status, propertyId }, token);
      toast.success(res.message || 'Records removed from your list.');
      if (res.skipped?.length) {
        toast.error(`${res.skipped.length} still-pending submission${res.skipped.length === 1 ? '' : 's'} need${res.skipped.length === 1 ? 's' : ''} to be confirmed or rejected first, so ${res.skipped.length === 1 ? 'it was' : 'they were'} left as-is.`);
      }
      setBulkAction(null);
      exitMultiSelect();
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete records.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleContactTenant(record) {
    const phone = record.tenants?.primary_phone;
    if (!phone) {
      toast.error('No phone number on file for this tenant.');
      return;
    }
    try {
      await navigator.clipboard.writeText(phone);
      toast.success(`Copied ${phone} to clipboard.`);
    } catch {
      // Clipboard access can fail (permissions, non-HTTPS context, etc.) -
      // still proceed to open the dialer either way, that's the part
      // that actually matters.
    }
    window.location.href = `tel:${phone}`;
  }

  function timeAgo(iso) {
    if (!iso) return '-';
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
      <InfoTip text={<>
        Tenants who paid rent directly via Paybill/Till submit proof here for you to confirm or reject. Confirming updates their balance and payment history immediately.
      </>} />

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
          <button type="button" className="ppc-status-tabs__download" data-download-fx onClick={downloadCsv}>⬇ Download</button>
        )}
      </div>

      {multiSelectMode && (
        <div className="ppc-multiselect-bar">
          <span className="ppc-multiselect-bar__count">{selectedIds.size} selected</span>
          <button
            type="button"
            className="ghost-link"
            disabled={selectedIds.size === 0}
            onClick={() => setBulkAction('selected')}
          >
            Delete selected
          </button>
          <button type="button" className="ghost-link" style={{ color: '#b3261e' }} onClick={() => setBulkAction('all')}>
            Delete all
          </button>
          <button type="button" className="ghost-link" onClick={exitMultiSelect}>Cancel</button>
        </div>
      )}

      {error && <p className="modal-error">{error}</p>}
      {confirmations === null && <Skeleton rows={4} />}
      {confirmations && confirmations.length === 0 && (
        <p className="tenant-portal-hint">No {status} submissions.</p>
      )}

      <div className="ppc-list">
        {groupByYearMonth(confirmations || []).map(([key, group]) => (
          <div key={key} className="ppc-group">
            <h3 className="ppc-group__label">{group.label}</h3>
            {group.records.map((record) => (
              <div
                key={record.id}
                className={`ppc-card ${record.resubmission_of ? 'ppc-card--resubmitted' : ''} ${selectedIds.has(record.id) ? 'ppc-card--selected' : ''}`}
                onMouseDown={() => startLongPress(record)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onTouchStart={() => startLongPress(record)}
                onTouchEnd={cancelLongPress}
                onClick={() => {
                  if (multiSelectMode) toggleSelected(record);
                }}
              >
                {multiSelectMode && (
                  <label className="ppc-card__checkbox" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(record.id)}
                      disabled={!isDismissable(record)}
                      onChange={() => toggleSelected(record)}
                    />
                  </label>
                )}
                {record.resubmission_of && (
                  <div className="ppc-card__resubmitted-banner">🔁 Resubmitted request</div>
                )}
                {record.duplicate_of && (
                  <div className="ppc-card__duplicate-banner">
                    ⚠️ Duplicate - this transaction code was already used for a confirmed payment. Contact the tenant to clarify, then delete this submission.
                  </div>
                )}
                <div className="ppc-card__row">
                  <Avatar name={record.tenants?.full_name} photoUrl={record.tenants?.photo_url} size={44} />
                  <div className="ppc-card__info">
                    <div className="ppc-card__name">
                      {record.tenants?.full_name || 'Unknown tenant'}
                      {/* Direct request: distinguish rent submissions from a
                          specific utility bill (water/electricity) right on
                          the card, not just inside the details. */}
                      <span className={`ppc-card__target-badge ppc-card__target-badge--${record.target_type === 'utility' ? (record.target_invoice?.utility_type || 'utility') : 'rent'}`}>
                        {record.target_type === 'utility'
                          ? (record.target_invoice?.utility_type === 'water' ? '💧 Water bill'
                            : record.target_invoice?.utility_type === 'electricity' ? '⚡ Electricity bill'
                            : '🔌 Utility bill')
                          : '🏠 Rent'}
                        {record.target_invoice?.month_key ? ` · ${record.target_invoice.month_key}` : ''}
                      </span>
                    </div>
                    <div className="ppc-card__unit">
                      {record.units?.properties?.name ? `${record.units.properties.name} · ` : ''}
                      {record.units?.unit_name || '-'}
                    </div>
                  </div>
                  <div className="ppc-card__submitted">{timeAgo(record.submitted_at)}</div>
                </div>

                <div className="ppc-card__details">
                  <div><span>Amount paid</span><span>KES {Number(record.amount_paid).toLocaleString()}</span></div>
                  <div><span>Transaction code</span><span>{record.transaction_code}</span></div>
                  <div><span>M-Pesa payer</span><span>{record.mpesa_payer_name}</span></div>
                  {record.mpesa_payer_phone && (
                    <div><span>Sent from phone</span><span>{record.mpesa_payer_phone}</span></div>
                  )}
                  {record.units?.unit_payment_code && (
                    <div><span>Room / unit</span><span>{record.units.unit_name || record.units.unit_payment_code}</span></div>
                  )}
                  {record.paymentInstructions && (
                    <div>
                      <span>Mode of payment</span>
                      <span>
                        {record.paymentInstructions.method === 'paybill' && `Paybill ${record.paymentInstructions.paybillNumber}, Acc. ${record.paymentInstructions.accountNumber}`}
                        {record.paymentInstructions.method === 'till' && `Till ${record.paymentInstructions.tillNumber}`}
                        {record.paymentInstructions.method === 'stk' && (record.paymentInstructions.stkPhoneNumber ? `M-Pesa to ${record.paymentInstructions.stkPhoneNumber}` : 'Contact landlord for details')}
                      </span>
                    </div>
                  )}
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

                {!multiSelectMode && record.status === 'pending' && record.duplicate_of && (
                  <div className="ppc-card__actions">
                    <button type="button" className="ghost-link" onClick={() => handleContactTenant(record)}>
                      Contact Tenant
                    </button>
                    <button type="button" className="ghost-link" style={{ color: '#b3261e' }} onClick={() => setDeleteTarget(record)}>
                      Delete
                    </button>
                  </div>
                )}

                {!multiSelectMode && record.status === 'pending' && !record.duplicate_of && subscriptionExpired && (
                  <p className="tenant-portal-hint ppc-card__expired-hint">
                    This apartment's subscription has expired - renew it to confirm or reject payments.
                  </p>
                )}

                {!multiSelectMode && record.status === 'pending' && !record.duplicate_of && canConfirmReject && !subscriptionExpired && (
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

                {!multiSelectMode && record.status !== 'pending' && (
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
        error={error}
        onConfirm={() => handleConfirm(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this from your list?"
        message="This only removes it from your own Pending Payment Confirmations list - it does not confirm, reject, or change the payment's actual status, and other people who can see this account (the landlord, other managers, or the caretaker) will still see it in theirs until they remove it themselves too."
        confirmLabel="Yes, remove"
        danger
        busy={actioningId === deleteTarget?.id}
        error={error}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={bulkAction === 'selected'}
        title={`Remove ${selectedIds.size} selected record${selectedIds.size === 1 ? '' : 's'}?`}
        message="This only removes them from your own list - it does not confirm, reject, or change any payment's actual status. Other people who can see this account will still see them in theirs until they remove them too."
        confirmLabel="Yes, remove selected"
        danger
        busy={bulkBusy}
        error={error}
        onConfirm={handleBulkDeleteSelected}
        onCancel={() => setBulkAction(null)}
      />

      <ConfirmDialog
        open={bulkAction === 'all'}
        title={`Remove all ${status} records from your list?`}
        message="This only removes them from your own list - it does not confirm, reject, or change any payment's actual status. Other people who can see this account will still see them in theirs until they remove them too. Still-pending submissions that haven't been confirmed or rejected yet will be left as-is."
        confirmLabel="Yes, remove all"
        danger
        busy={bulkBusy}
        error={error}
        onConfirm={handleBulkDeleteAll}
        onCancel={() => setBulkAction(null)}
      />
    </section>
  );
}
