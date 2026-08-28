import React, { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import './PendingPaymentConfirmations.css';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';

/**
 * GM ADMIN CONFIRMATION QUEUE (direct request): "the general manager
 * account actions need confirmation by the admin even after they do
 * it with the pin ... these pending actions from general managers
 * [should] land in admin portal ... have their own dedicated ui, and
 * admin can confirm or reject one by one or multiple by selecting or
 * all."
 *
 * Every sensitive General Manager action (suspend/activate an
 * account, financial edits, add/delete an account, any status
 * change - the exact same set Section 10 already knows how to revert)
 * lands here the moment it happens, in addition to the GM's own
 * Operations-PIN confirmation. Confirm just clears the entry (the
 * action already took effect). Reject undoes it immediately, restoring
 * the affected record to its exact prior state, same as an admin
 * Revert.
 *
 * Same list/card visual language as LandlordManualPaymentConfirmations
 * (reuses PendingPaymentConfirmations.css) so it reads as part of the
 * same "things awaiting your review" family in the admin portal, with
 * an always-on checkbox column for select-one / select-several /
 * select-all bulk action.
 */
export default function GmPendingActionsPanel({ token, onReviewed }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null); // { mode: 'one'|'selected'|'all', decision, item? }

  const load = useCallback(() => {
    setError('');
    api
      .listGmPendingActions(token)
      .then((res) => {
        setItems(res.logs || []);
        setSelectedIds((prev) => {
          const ids = new Set((res.logs || []).map((l) => l.id));
          const next = new Set();
          prev.forEach((id) => {
            if (ids.has(id)) next.add(id);
          });
          return next;
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load pending actions.'));
  }, [token]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  function toggleOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      if (items && prev.size === items.length) return new Set();
      return new Set((items || []).map((it) => it.id));
    });
  }

  async function handleReviewOne(item, decision) {
    setBusyId(item.id);
    setError('');
    try {
      await api.reviewGmPendingAction(item.id, decision, token);
      setNotice(decision === 'confirm' ? 'Action confirmed.' : 'Action rejected and reverted.');
      setConfirmTarget(null);
      load();
      onReviewed?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to review this action.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReviewBulk(decision, all) {
    setBulkBusy(true);
    setError('');
    try {
      const res = all
        ? await api.bulkReviewGmPendingActions({ all: true }, decision, token)
        : await api.bulkReviewGmPendingActions({ logIds: Array.from(selectedIds) }, decision, token);
      const failedNote = res.failedCount ? ` (${res.failedCount} could not be reviewed)` : '';
      setNotice(`${res.succeededCount} action${res.succeededCount === 1 ? '' : 's'} ${decision === 'confirm' ? 'confirmed' : 'rejected'}${failedNote}.`);
      setSelectedIds(new Set());
      setConfirmTarget(null);
      load();
      onReviewed?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to review the selected actions.');
    } finally {
      setBulkBusy(false);
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
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  function describeChange(item) {
    if (!item.corrected_data) return null;
    const keys = Object.keys(item.corrected_data);
    if (!keys.length) return null;
    return keys.map((k) => `${k}: ${JSON.stringify(item.initial_data?.[k])} → ${JSON.stringify(item.corrected_data[k])}`).join(', ');
  }

  const allSelected = !!items && items.length > 0 && selectedIds.size === items.length;

  return (
    <section className="statistics-panel">
      <div className="tenant-section__header-row">
        <h2>
          General Manager — Pending Actions
          {items && items.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: '0.65em', background: '#B3261E', color: '#fff', borderRadius: 10, padding: '2px 8px', verticalAlign: 'middle' }}>
              {items.length} awaiting review
            </span>
          )}
        </h2>
      </div>
      <InfoTip
        text={
          <>
            Sensitive actions a General Manager confirmed with their own Operations PIN (suspend/activate an account, financial edits,
            adding or deleting an account, any status change) still wait here for your sign-off. <strong>Confirm</strong> just
            acknowledges it - the action already happened. <strong>Reject</strong> undoes it immediately, restoring the affected
            record to exactly how it was before.
          </>
        }
      />

      {notice && <p style={{ color: '#1a7a3c' }}>{notice}</p>}
      {error && <p className="modal-error">{error}</p>}
      {items === null && <Skeleton rows={4} />}
      {items && items.length === 0 && <p className="tenant-portal-hint">No General Manager actions awaiting review.</p>}

      {items && items.length > 0 && (
        <div className="ppc-multiselect-bar">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Select all
          </label>
          <span className="ppc-multiselect-bar__count">{selectedIds.size} selected</span>
          <Button variant="primary" disabled={selectedIds.size === 0 || bulkBusy} loading={bulkBusy} onClick={() => setConfirmTarget({ mode: 'selected', decision: 'confirm' })}>
            Confirm selected
          </Button>
          <button
            type="button"
            className="ghost-link"
            style={{ color: '#b3261e' }}
            disabled={selectedIds.size === 0 || bulkBusy}
            onClick={() => setConfirmTarget({ mode: 'selected', decision: 'reject' })}
          >
            Reject selected
          </button>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="ghost-link" disabled={bulkBusy} onClick={() => setConfirmTarget({ mode: 'all', decision: 'confirm' })}>
              Confirm all
            </button>
            <button type="button" className="ghost-link" style={{ color: '#b3261e' }} disabled={bulkBusy} onClick={() => setConfirmTarget({ mode: 'all', decision: 'reject' })}>
              Reject all
            </button>
          </span>
        </div>
      )}

      <div className="ppc-list">
        {(items || []).map((item) => {
          const change = describeChange(item);
          return (
            <div key={item.id} className={`ppc-card ${selectedIds.has(item.id) ? 'ppc-card--selected' : ''}`}>
              <label className="ppc-card__checkbox">
                <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleOne(item.id)} />
              </label>
              <div className="ppc-card__row">
                <div className="ppc-card__info">
                  <div className="ppc-card__name">
                    {item.data_type}
                    <span className="ppc-card__target-badge">{item.general_managers?.full_name || 'General Manager'}</span>
                  </div>
                  <div className="ppc-card__unit">{item.affected_person_label || item.affected_role || 'Affected record'}</div>
                </div>
                <div className="ppc-card__submitted">{timeAgo(item.created_at)}</div>
              </div>

              <div className="ppc-card__details">
                <div><span>Reason given</span><span>{item.reason}</span></div>
                {change && <div><span>Change</span><span>{change}</span></div>}
                {item.ip_address && <div><span>IP address</span><span>{item.ip_address}</span></div>}
              </div>

              <div className="ppc-card__actions">
                <Button variant="primary" loading={busyId === item.id} onClick={() => setConfirmTarget({ mode: 'one', decision: 'confirm', item })}>
                  Confirm
                </Button>
                <button type="button" className="ghost-link" style={{ color: '#b3261e' }} disabled={busyId === item.id} onClick={() => setConfirmTarget({ mode: 'one', decision: 'reject', item })}>
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title={
          confirmTarget?.decision === 'reject'
            ? confirmTarget.mode === 'one'
              ? 'Reject and revert this action?'
              : `Reject and revert ${confirmTarget?.mode === 'all' ? 'every pending action' : `${selectedIds.size} selected action${selectedIds.size === 1 ? '' : 's'}`}?`
            : confirmTarget?.mode === 'one'
            ? 'Confirm this action?'
            : `Confirm ${confirmTarget?.mode === 'all' ? 'every pending action' : `${selectedIds.size} selected action${selectedIds.size === 1 ? '' : 's'}`}?`
        }
        message={
          confirmTarget?.decision === 'reject'
            ? 'This restores the affected record(s) to exactly how they were before the General Manager made this change. This cannot be undone.'
            : 'This acknowledges the action - it already took effect and stays in place.'
        }
        confirmLabel={confirmTarget?.decision === 'reject' ? 'Yes, reject & revert' : 'Yes, confirm'}
        danger={confirmTarget?.decision === 'reject'}
        busy={confirmTarget?.mode === 'one' ? busyId === confirmTarget?.item?.id : bulkBusy}
        onConfirm={() => {
          if (!confirmTarget) return;
          if (confirmTarget.mode === 'one') handleReviewOne(confirmTarget.item, confirmTarget.decision);
          else handleReviewBulk(confirmTarget.decision, confirmTarget.mode === 'all');
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </section>
  );
}
