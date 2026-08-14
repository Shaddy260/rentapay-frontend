import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import './AdminBaPendingPayments.css';

/**
 * BA Monthly Payment Details & Payout Workflow - Phase 3.
 *
 * Pending Payments admin view: one compact card per unpaid BA
 * submission, across EVERY cycle that still has unpaid entries (a
 * still-open January card keeps showing here even after February's
 * cycle has started - each card visibly shows which month it belongs
 * to). Cards are grouped by identical owed amount, groups ordered
 * largest-group-first, so admin can batch-send payments to a
 * same-amount group efficiently. Checkbox per card + bulk "Mark
 * selected as paid" (works for a single selection too).
 *
 * Also surfaces the current month's shareable submission link (Phase
 * 1's cycle status endpoint had no admin UI consuming it yet) and BAs
 * who have earnings this cycle but haven't submitted payment details,
 * so they aren't missed.
 */
function fmtKes(amount) {
  return `KES ${Number(amount || 0).toLocaleString('en-KE')}`;
}

export default function AdminBaPendingPayments({ token }) {
  const [linkInfo, setLinkInfo] = useState(null);
  const [linkError, setLinkError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const [groups, setGroups] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [marking, setMarking] = useState(false);
  const [notice, setNotice] = useState('');

  const [awaiting, setAwaiting] = useState(null);
  const [awaitingError, setAwaitingError] = useState('');

  const loadLink = useCallback(() => {
    api
      .getBaPayoutLinkCurrent(token)
      .then((res) => setLinkInfo(res.cycle))
      .catch((err) => setLinkError(err instanceof ApiError ? err.message : 'Failed to load the current payment link.'));
  }, [token]);

  const loadPending = useCallback(() => {
    setError('');
    api
      .getBaPendingPayments(token)
      .then((res) => {
        setGroups(res.groups || []);
        setTotalCount(res.totalCount || 0);
        setSelected(new Set());
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load pending payments.'));
  }, [token]);

  const loadAwaiting = useCallback(() => {
    api
      .getBaAwaitingPaymentDetails(token)
      .then((res) => setAwaiting(res.bas || []))
      .catch((err) => setAwaitingError(err instanceof ApiError ? err.message : 'Failed to load BAs awaiting details.'));
  }, [token]);

  useEffect(() => {
    loadLink();
    loadPending();
    loadAwaiting();
  }, [loadLink, loadPending, loadAwaiting]);

  function toggleCard(submissionId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(submissionId)) next.delete(submissionId);
      else next.add(submissionId);
      return next;
    });
  }

  function toggleGroup(groupCards) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = groupCards.every((c) => next.has(c.submissionId));
      groupCards.forEach((c) => (allSelected ? next.delete(c.submissionId) : next.add(c.submissionId)));
      return next;
    });
  }

  async function copyLink() {
    if (!linkInfo?.link) return;
    try {
      await navigator.clipboard.writeText(linkInfo.link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard access can fail silently (permissions) - link is still
      // visible/selectable in the text below as a fallback.
    }
  }

  async function markSelectedPaid() {
    if (selected.size === 0) return;
    setMarking(true);
    setNotice('');
    setError('');
    try {
      const res = await api.markBaPaymentsPaid([...selected], token);
      setNotice(`Marked ${res.markedCount} payment${res.markedCount === 1 ? '' : 's'} as paid.`);
      loadPending();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to mark selected payments as paid.');
    } finally {
      setMarking(false);
    }
  }

  return (
    <section className="admin-ba-pending">
      <div className="admin-ba-pending__link-bar">
        {linkError && <p className="admin-ba-pending__error">{linkError}</p>}
        {!linkInfo && !linkError && <Skeleton height="40px" />}
        {linkInfo && (
          <>
            <div className="admin-ba-pending__link-info">
              <span className="admin-ba-pending__link-label">
                Payment details link — {linkInfo.periodKey} ({linkInfo.status})
              </span>
              <code className="admin-ba-pending__link-value">{linkInfo.link}</code>
            </div>
            <Button variant="ghost" onClick={copyLink}>
              {linkCopied ? 'Copied!' : 'Copy link'}
            </Button>
          </>
        )}
      </div>

      {awaitingError && <p className="admin-ba-pending__error">{awaitingError}</p>}
      {awaiting && awaiting.length > 0 && (
        <div className="admin-ba-pending__awaiting">
          <strong>{awaiting.length}</strong> BA{awaiting.length === 1 ? '' : 's'} with earnings this cycle haven't
          submitted payment details yet:{' '}
          {awaiting.map((b, i) => (
            <span key={b.baId}>
              {i > 0 && ', '}
              {b.baName}
              {b.baCode ? ` (${b.baCode})` : ''} — {fmtKes(b.estimatedAmountOwed)}
            </span>
          ))}
        </div>
      )}

      <div className="admin-ba-pending__toolbar">
        <span className="admin-ba-pending__count">
          {totalCount} pending card{totalCount === 1 ? '' : 's'}
          {selected.size > 0 ? ` · ${selected.size} selected` : ''}
        </span>
        <Button onClick={markSelectedPaid} disabled={selected.size === 0 || marking}>
          {marking ? 'Marking…' : `Mark selected as paid${selected.size ? ` (${selected.size})` : ''}`}
        </Button>
      </div>

      {notice && <p className="admin-ba-pending__notice">{notice}</p>}
      {error && <p className="admin-ba-pending__error">{error}</p>}

      {!groups && !error && <Skeleton height="200px" />}
      {groups && groups.length === 0 && <p className="admin-ba-pending__empty">No pending payments right now.</p>}

      {groups &&
        groups.map((group) => {
          const groupAllSelected = group.cards.every((c) => selected.has(c.submissionId));
          return (
            <div key={group.amountOwed} className="admin-ba-pending__group">
              <div className="admin-ba-pending__group-header">
                <label className="admin-ba-pending__group-select">
                  <input type="checkbox" checked={groupAllSelected} onChange={() => toggleGroup(group.cards)} />
                  <strong>{fmtKes(group.amountOwed)}</strong>
                  <span className="admin-ba-pending__group-count">
                    · {group.count} BA{group.count === 1 ? '' : 's'}
                  </span>
                </label>
              </div>
              <div className="admin-ba-pending__cards">
                {group.cards.map((card) => (
                  <label key={card.submissionId} className="admin-ba-pending__card">
                    <input
                      type="checkbox"
                      checked={selected.has(card.submissionId)}
                      onChange={() => toggleCard(card.submissionId)}
                    />
                    <div className="admin-ba-pending__card-body">
                      <div className="admin-ba-pending__card-line1">
                        <strong>{card.baName}</strong>
                        {card.baCode && <span className="admin-ba-pending__ba-code">({card.baCode})</span>}
                        <span className="admin-ba-pending__period">{card.periodKey}</span>
                      </div>
                      <div className="admin-ba-pending__card-line2">{card.submittedEmail}</div>
                      <div className="admin-ba-pending__card-line3">
                        {card.landlordsOnboarded} onboarded
                        {card.commissionPercentage != null ? ` · ${card.commissionPercentage}%` : ''}
                      </div>
                      <div className="admin-ba-pending__card-line4">
                        <strong>{fmtKes(card.amountOwed)}</strong>
                        <span className="admin-ba-pending__mpesa">{card.mpesaNumber}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
    </section>
  );
}
