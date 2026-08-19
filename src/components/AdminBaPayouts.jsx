import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';
import { buildWaMeLink } from '../utils/whatsapp.js';
import './AdminBaPayouts.css';

/**
 * BUILD SPEC PHASE 10 - Fix: BA Payout Submission Overwrite Bug.
 *
 * Replaces the old AdminBaPendingPayments / AdminBaCompletedPayments
 * pair with a single screen organized into three pill tabs - Pending,
 * Completed, Payment history - per the plan's layout spec, rather
 * than three separate pages.
 */
function fmtKes(amount) {
  return `KES ${Number(amount || 0).toLocaleString('en-KE')}`;
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminBaPayouts({ token }) {
  const [tab, setTab] = useState('pending'); // pending | completed | history

  return (
    <section className="admin-ba-payouts">
      <div className="admin-ba-payouts__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`admin-ba-payouts__tab${tab === 'pending' ? ' admin-ba-payouts__tab--active' : ''}`}
          onClick={() => setTab('pending')}
        >
          Pending
        </button>
        <button
          type="button"
          role="tab"
          className={`admin-ba-payouts__tab${tab === 'completed' ? ' admin-ba-payouts__tab--active' : ''}`}
          onClick={() => setTab('completed')}
        >
          Completed
        </button>
        <button
          type="button"
          role="tab"
          className={`admin-ba-payouts__tab${tab === 'history' ? ' admin-ba-payouts__tab--active' : ''}`}
          onClick={() => setTab('history')}
        >
          Payment history
        </button>
      </div>

      {tab === 'pending' && <PendingTab token={token} />}
      {tab === 'completed' && <CompletedTab token={token} />}
      {tab === 'history' && <HistoryTab token={token} />}
    </section>
  );
}

// =======================================================================
// PENDING
// =======================================================================
function PendingTab({ token }) {
  const [groups, setGroups] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [marking, setMarking] = useState(false);
  const [notice, setNotice] = useState('');

  const [awaiting, setAwaiting] = useState(null);
  const [awaitingError, setAwaitingError] = useState('');
  const [copiedBaId, setCopiedBaId] = useState('');

  async function copySubmissionLink(ba) {
    if (!ba.submissionLink) return;
    try {
      await navigator.clipboard.writeText(ba.submissionLink);
      setCopiedBaId(ba.baId);
      setTimeout(() => setCopiedBaId(''), 2000);
    } catch {
      // Soft failure - same pattern as the BA onboarding link copy on
      // AdminBrandAmbassadors: clipboard permissions/non-secure context
      // can fail, but the link itself is still available to share.
      setAwaitingError('Could not copy automatically - try again or share via WhatsApp instead.');
    }
  }

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
    loadPending();
    loadAwaiting();
  }, [loadPending, loadAwaiting]);

  function toggleCard(payoutKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(payoutKey)) next.delete(payoutKey);
      else next.add(payoutKey);
      return next;
    });
  }

  function toggleGroup(groupCards) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = groupCards.every((c) => next.has(c.payoutKey));
      groupCards.forEach((c) => (allSelected ? next.delete(c.payoutKey) : next.add(c.payoutKey)));
      return next;
    });
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
    <>
      <PayoutLinksPanel token={token} />

      {awaitingError && <p className="admin-ba-payouts__error">{awaitingError}</p>}
      {awaiting && awaiting.length > 0 && (
        <div className="admin-ba-payouts__awaiting">
          <strong>{awaiting.length}</strong> BA{awaiting.length === 1 ? '' : 's'} with earnings this cycle haven't
          submitted payment details yet (no one-time link submitted):
          <ul className="admin-ba-payouts__awaiting-list">
            {awaiting.map((b) => (
              <li key={b.baId} className="admin-ba-payouts__awaiting-item">
                <span>
                  {b.baName}
                  {b.baCode ? ` (${b.baCode})` : ''} — {fmtKes(b.estimatedAmountOwed)}
                </span>
                {b.submissionLink ? (
                  <span className="admin-ba-payouts__awaiting-actions">
                    <Button
                      variant="ghost"
                      onClick={() => copySubmissionLink(b)}
                    >
                      {copiedBaId === b.baId ? 'Copied!' : 'Copy submission link'}
                    </Button>
                    {b.phone && (
                      <a
                        href={buildWaMeLink(
                          b.phone,
                          `Hi ${b.baName}, please submit your M-Pesa payment details for RentaPay here: ${b.submissionLink}`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-ba-payouts__awaiting-whatsapp"
                      >
                        Share via WhatsApp
                      </a>
                    )}
                  </span>
                ) : (
                  // Defensive fallback - every BA gets a submission token
                  // at approval, so this shouldn't happen in practice,
                  // but avoids showing a dead/missing action if it does.
                  <span className="admin-ba-payouts__awaiting-actions admin-ba-payouts__awaiting-actions--muted">
                    No submission link on file for this BA.
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-ba-payouts__toolbar">
        <span className="admin-ba-payouts__count">
          {totalCount} pending card{totalCount === 1 ? '' : 's'}
          {selected.size > 0 ? ` · ${selected.size} selected` : ''}
        </span>
        <Button onClick={markSelectedPaid} disabled={selected.size === 0 || marking}>
          {marking ? 'Marking…' : `Mark selected as paid${selected.size ? ` (${selected.size})` : ''}`}
        </Button>
      </div>

      {notice && <p className="admin-ba-payouts__notice">{notice}</p>}
      {error && <p className="admin-ba-payouts__error">{error}</p>}

      {!groups && !error && <Skeleton height="200px" />}
      {groups && groups.length === 0 && <p className="admin-ba-payouts__empty">No pending payments right now.</p>}

      {groups &&
        groups.map((group) => {
          const groupAllSelected = group.cards.every((c) => selected.has(c.payoutKey));
          return (
            <div key={group.amountOwed} className="admin-ba-payouts__group">
              <div className="admin-ba-payouts__group-header">
                <label className="admin-ba-payouts__group-select">
                  <input type="checkbox" checked={groupAllSelected} onChange={() => toggleGroup(group.cards)} />
                  <strong>{fmtKes(group.amountOwed)}</strong>
                  <span className="admin-ba-payouts__group-count">
                    · {group.count} BA{group.count === 1 ? '' : 's'}
                  </span>
                </label>
              </div>
              <div className="admin-ba-payouts__cards">
                {group.cards.map((card) => (
                  <div key={card.payoutKey} className="admin-ba-payouts__card">
                    <label className="admin-ba-payouts__card-select">
                      <input type="checkbox" checked={selected.has(card.payoutKey)} onChange={() => toggleCard(card.payoutKey)} />
                    </label>
                    <div className="admin-ba-payouts__card-body">
                      <div className="admin-ba-payouts__card-line1">
                        <strong>{card.baName}</strong>
                        {card.baCode && <span className="admin-ba-payouts__ba-code">({card.baCode})</span>}
                        <span className="admin-ba-payouts__pill admin-ba-payouts__pill--locked">Locked</span>
                        <span className="admin-ba-payouts__period">{card.periodKey}</span>
                      </div>
                      <div className="admin-ba-payouts__card-line2">
                        {card.landlordsOnboarded} onboarded
                        {card.commissionPercentage != null ? ` · ${card.commissionPercentage}%` : ''}
                        {' · '}
                        {card.submittedEmail}
                      </div>
                      <div className="admin-ba-payouts__card-line3">
                        <strong>{fmtKes(card.amountOwed)}</strong>
                        <span className="admin-ba-payouts__mpesa">{card.mpesaNumber}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </>
  );
}

// =======================================================================
// PAYOUT LINKS (Prompt 4) - submission link (static, non-expiring,
// one-per-person) and correction link (universal, 24h-rotating) live
// together here, under Pending Payments - this is the stage where
// payout details actually need to be right before money moves.
// Neither link is ever personalized: the exact same URL goes to every
// Brand Ambassador regardless of which BA's context it's opened from.
// =======================================================================
function PayoutLinksPanel({ token }) {
  const [status, setStatus] = useState(null); // { link, expiresAt, expired }
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [notice, setNotice] = useState('');
  const [submitCopied, setSubmitCopied] = useState(false);

  const submissionLink = `${window.location.origin}/ba-payout-submit`;

  const load = useCallback(() => {
    api
      .getBaPayoutEditLinkStatus(token)
      .then(setStatus)
      .catch((err) => setNotice(err instanceof ApiError ? err.message : 'Failed to load the correction link.'));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setBusy(true);
    setNotice('');
    try {
      const res = await api.generateBaPayoutEditLink(token);
      setStatus({ link: res.link, expiresAt: res.expiresAt, expired: false });
      try {
        await navigator.clipboard.writeText(res.link);
        setCopied('correction');
        setTimeout(() => setCopied(''), 2000);
      } catch {
        // clipboard permissions can fail silently - the link is still
        // shown with an explicit Copy button below either way.
      }
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Failed to generate a correction link.');
    } finally {
      setBusy(false);
    }
  }

  async function copyCorrection() {
    if (!status?.link) return;
    try {
      await navigator.clipboard.writeText(status.link);
      setCopied('correction');
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setNotice('Could not copy automatically - select and copy the link shown below instead.');
    }
  }

  async function copySubmission() {
    try {
      await navigator.clipboard.writeText(submissionLink);
      setSubmitCopied(true);
      setTimeout(() => setSubmitCopied(false), 2000);
    } catch {
      setNotice('Could not copy automatically - select and copy the link shown below instead.');
    }
  }

  return (
    <div className="admin-ba-payouts__correction-panel">
      <div className="admin-ba-payouts__correction-panel-text">
        <strong>Submission link</strong>
        <InfoTip text="One static link, the same for every Brand Ambassador, forever - it never expires and never regenerates. Each BA verifies their own registered email + a one-time code before they can submit, and can only submit once, ever. Share the exact same URL with everyone." />
      </div>
      <div className="admin-ba-payouts__edit-link-actions">
        <code className="admin-ba-payouts__link-text">{submissionLink}</code>
        <Button variant="ghost" onClick={copySubmission}>{submitCopied ? 'Copied!' : 'Copy link'}</Button>
        <a
          href={buildWaMeLink('', `Please submit your M-Pesa payment details for RentaPay here: ${submissionLink}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--ghost"
        >
          Share via WhatsApp
        </a>
      </div>

      <div className="admin-ba-payouts__correction-panel-text u-mt-4">
        <strong>Correction link</strong>
        <InfoTip text="One shared link, valid 24 hours, for any Brand Ambassador who needs to fix an already-submitted payout detail - the exact same URL for everyone, regardless of which BA's record it's shared from. Each BA verifies their own email + a one-time code before they can edit. Correcting details never changes a record's paid/pending status." />
      </div>
      {notice && <p className="admin-ba-payouts__notice">{notice}</p>}
      {status?.link ? (
        <div className="admin-ba-payouts__edit-link-actions">
          <code className="admin-ba-payouts__link-text">{status.link}</code>
          <span className="admin-ba-payouts__edit-link-expiry">Expires {fmtDate(status.expiresAt)} (24 hours from generation)</span>
          <Button variant="ghost" onClick={copyCorrection}>{copied === 'correction' ? 'Copied!' : 'Copy link'}</Button>
          <a
            href={buildWaMeLink('', `If anything needs correcting on your RentaPay payout details, use this link: ${status.link}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--ghost"
          >
            Share via WhatsApp
          </a>
          <Button variant="ghost" disabled={busy} onClick={generate}>{busy ? 'Regenerating…' : 'Regenerate (invalidates old link)'}</Button>
        </div>
      ) : (
        <Button variant="primary" disabled={busy} onClick={generate}>
          {busy ? 'Generating…' : 'Generate 24-hour correction link'}
        </Button>
      )}
    </div>
  );
}

// =======================================================================
// COMPLETED
// =======================================================================
function CompletedTab({ token }) {
  const [periods, setPeriods] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getBaCompletedPeriods(token)
      .then((res) => setPeriods(res.periods || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load completed months.'));
  }, [token]);

  const load = useCallback(
    (periodKey) => {
      setError('');
      api
        .getBaCompletedPayments(periodKey, token)
        .then((res) => setData(res))
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load completed payments.'));
    },
    [token]
  );

  useEffect(() => {
    load(selectedPeriod || undefined);
  }, [load, selectedPeriod]);

  return (
    <>
      <div className="admin-ba-payouts__toolbar">
        <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="admin-ba-payouts__period-select">
          <option value="">All months</option>
          {(periods || []).map((p) => (
            <option key={p.periodKey} value={p.periodKey}>
              {p.periodKey} · {p.count} paid · {fmtKes(p.totalAmount)}
            </option>
          ))}
        </select>
        <Button variant="ghost" onClick={() => api.downloadBaCompletedPayoutPdf(selectedPeriod || undefined, token)}>
          Download PDF
        </Button>
      </div>

      {error && <p className="admin-ba-payouts__error">{error}</p>}

      {!data && !error && <Skeleton height="200px" />}
      {data && data.cards.length === 0 && <p className="admin-ba-payouts__empty">No completed payments for this selection.</p>}

      {data && data.cards.length > 0 && (
        <>
          <p className="admin-ba-payouts__count">
            {data.totals.count} paid · {fmtKes(data.totals.totalAmount)} total
          </p>
          <div className="admin-ba-payouts__cards">
            {data.cards.map((card) => (
              <div key={card.payoutKey} className="admin-ba-payouts__card admin-ba-payouts__card--completed">
                <div className="admin-ba-payouts__card-body">
                  <div className="admin-ba-payouts__card-line1">
                    <strong>{card.baName}</strong>
                    {card.baCode && <span className="admin-ba-payouts__ba-code">({card.baCode})</span>}
                    <span className="admin-ba-payouts__pill admin-ba-payouts__pill--completed">Completed</span>
                    <span className="admin-ba-payouts__period">{card.periodKey}</span>
                  </div>
                  <div className="admin-ba-payouts__card-line2">
                    {fmtKes(card.amountOwed)} · paid {fmtDate(card.paidAt)}
                  </div>
                  <div className="admin-ba-payouts__lock-note">
                    🔒 Locked. Won't return to Pending. Corrections don't touch payment status — only via the shared
                    correction link under Pending Payments.
                  </div>
                  {card.baPhone && (
                    <a
                      href={buildWaMeLink(
                        card.baPhone,
                        `Hi, if anything needs correcting on your RentaPay payout details, use the correction link RentaPay admin shares with you.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-ba-payouts__awaiting-whatsapp"
                    >
                      Nudge via WhatsApp
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// =======================================================================
// PAYMENT HISTORY
// =======================================================================
function HistoryTab({ token }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getBaPaymentHistory(token)
      .then((res) => setEntries(res.entries || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load payment history.'));
  }, [token]);

  return (
    <>
      <div className="u-flex-row" style={{ alignItems: 'center', gap: '6px' }}>
        <span className="admin-ba-payouts__title">Payment history</span>
        <InfoTip text="Every payout ever marked paid, across every Brand Ambassador and every cycle — an append-only audit trail." />
      </div>
      {error && <p className="admin-ba-payouts__error">{error}</p>}
      {!entries && !error && <Skeleton height="200px" />}
      {entries && entries.length === 0 && <p className="admin-ba-payouts__empty">No payments recorded yet.</p>}
      {entries && entries.length > 0 && (
        <div className="admin-ba-payouts__cards">
          {entries.map((e) => (
            <div key={e.payoutKey} className="admin-ba-payouts__card admin-ba-payouts__card--history">
              <div className="admin-ba-payouts__card-body">
                <div className="admin-ba-payouts__card-line1">
                  <strong>{e.baName}</strong>
                  {e.baCode && <span className="admin-ba-payouts__ba-code">({e.baCode})</span>}
                  <span className="admin-ba-payouts__period">{e.periodKey}</span>
                </div>
                <div className="admin-ba-payouts__card-line2">
                  {fmtKes(e.amount)} · paid {fmtDate(e.paidAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
