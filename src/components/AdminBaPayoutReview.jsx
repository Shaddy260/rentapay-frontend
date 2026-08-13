import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import './AdminBaPayoutReview.css';

/**
 * BUILD SPEC PHASE 11 - Part A: Admin Payout Review.
 *
 * Period selector, list of BAs with owed totals (base + commission
 * shown separately, plus the total) and contact info shown directly on
 * the row, expandable to each qualifying landlord underneath, with a
 * Mark as Paid / Not Paid action per BA per period, and a "Download
 * Statement" button per BA.
 */

function currentWeekMonday() {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function money(n) {
  return `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_LABEL = {
  suspended: 'Suspended',
  inactive: 'Inactive',
  pending_approval: 'Pending Approval',
  rejected: 'Rejected',
};

export default function AdminBaPayoutReview({ token }) {
  const [periodType, setPeriodType] = useState('month');
  const [periodKey, setPeriodKey] = useState(currentMonthKey());
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [expandedBaId, setExpandedBaId] = useState(null);
  const [busyBaId, setBusyBaId] = useState(null);

  const load = useCallback(() => {
    setReview(null);
    setError('');
    api
      .getBaPayoutReview({ periodType, periodKey }, token)
      .then((res) => setReview(res))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the payout review.'));
  }, [periodType, periodKey, token]);

  useEffect(() => {
    load();
  }, [load]);

  function switchPeriodType(type) {
    setPeriodType(type);
    setPeriodKey(type === 'week' ? currentWeekMonday() : currentMonthKey());
  }

  function toggleExpanded(baId) {
    setExpandedBaId((prev) => (prev === baId ? null : baId));
  }

  // Commission accrues automatically per completed landlord payment
  // (no more per-landlord "claim" to hand-pick) - Mark Paid/Not Paid
  // always applies to this BA's whole selected cycle.
  async function markPaid(baId) {
    setBusyBaId(baId);
    setError('');
    try {
      await api.markBaPeriodPaid(baId, { periodType, periodKey }, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to mark this Brand Ambassador as paid.');
    } finally {
      setBusyBaId(null);
    }
  }

  async function markNotPaid(baId) {
    setBusyBaId(baId);
    setError('');
    try {
      await api.markBaPeriodNotPaid(baId, { periodType, periodKey }, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update this Brand Ambassador\'s payout status.');
    } finally {
      setBusyBaId(null);
    }
  }

  async function downloadStatement(baId) {
    setError('');
    try {
      await api.downloadBaPayoutStatement(baId, { periodType, periodKey }, token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download the statement.');
    }
  }

  // Phase 17 - the fuller PDF/CSV earnings statement, pulled for any
  // BA without leaving this screen. getBaEarningsStatement only
  // accepts 'month' or 'custom', so a 'week' period here is converted
  // to the equivalent custom from/to range (periodKey is already the
  // Monday date; add 6 days for the Sunday).
  function toEarningsStatementPeriod() {
    if (periodType === 'month') return { periodType: 'month', periodKey };
    const from = periodKey;
    const to = new Date(`${periodKey}T00:00:00.000Z`);
    to.setUTCDate(to.getUTCDate() + 6);
    return { periodType: 'custom', from, to: to.toISOString().slice(0, 10) };
  }

  async function downloadEarningsStatement(baId, format) {
    setError('');
    try {
      const period = toEarningsStatementPeriod();
      if (format === 'pdf') await api.downloadBaEarningsStatementPdf(baId, period, token);
      else await api.downloadBaEarningsStatementCsv(baId, period, token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download the statement.');
    }
  }

  return (
    <section className="admin-ba-payout">
      <div className="admin-ba-payout__period-bar">
        <div className="admin-ba-payout__filter">
          <button type="button" className={`admin-ba-payout__filter-btn ${periodType === 'week' ? 'admin-ba-payout__filter-btn--active' : ''}`} onClick={() => switchPeriodType('week')}>
            Weekly
          </button>
          <button type="button" className={`admin-ba-payout__filter-btn ${periodType === 'month' ? 'admin-ba-payout__filter-btn--active' : ''}`} onClick={() => switchPeriodType('month')}>
            Monthly
          </button>
        </div>
        {periodType === 'month' ? (
          <input type="month" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} className="admin-ba-payout__period-input" />
        ) : (
          <input type="date" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} className="admin-ba-payout__period-input" />
        )}
      </div>

      {error && <p className="admin-ba-payout__error">{error}</p>}

      {!review && !error && (
        <div className="admin-ba-payout__list">
          <Skeleton height="80px" />
          <Skeleton height="80px" />
        </div>
      )}

      {review && review.bas.length === 0 && <p className="admin-ba-payout__empty">No qualified claims for this period.</p>}

      {review && review.bas.length > 0 && (
        <>
        {review.runTotals && (
          <div className="admin-ba-payout__run-summary">
            <div><strong>{review.runTotals.qualifying}</strong> qualifying</div>
            <div><strong>{review.runTotals.notQualifying}</strong> not qualifying</div>
            <div><strong>{review.runTotals.landlordsOnboarded}</strong> landlords total</div>
            <div className="admin-ba-payout__run-summary-total">Grand total owed: {money(review.runTotals.amountOwed)}</div>
          </div>
        )}
        <ul className="admin-ba-payout__list">
          {review.bas.map((row) => {
            const isExpanded = expandedBaId === row.ba.id;
            const isInactive = row.ba.status !== 'active';

            return (
              <li key={row.ba.id} className={`admin-ba-payout__item ${isInactive ? 'admin-ba-payout__item--flagged' : ''}`}>
                <div className="admin-ba-payout__row" onClick={() => toggleExpanded(row.ba.id)}>
                  <div>
                    <strong>{row.ba.fullName}</strong> <span className="admin-ba-payout__code">({row.ba.baCode})</span>
                    {isInactive && <span className="admin-ba-payout__badge">{STATUS_LABEL[row.ba.status] || row.ba.status}</span>}
                    <div className="admin-ba-payout__contact">
                      {row.ba.phone} · {row.ba.email}
                    </div>
                  </div>
                  <div className="admin-ba-payout__totals">
                    <div>Base: {money(row.baseTotal)}</div>
                    <div>Commission: {money(row.commissionTotal)}</div>
                    <div className="admin-ba-payout__grand-total">Total: {money(row.grandTotal)}</div>
                    {row.periodMarkedStatus && <span className={`admin-ba-payout__mark admin-ba-payout__mark--${row.periodMarkedStatus}`}>{row.periodMarkedStatus === 'paid' ? 'Paid' : 'Not Paid'}</span>}
                  </div>
                </div>
                <div className="admin-ba-payout__ratio-bar">
                  <span>Commission rate: <strong>{row.commissionRatePercent}%</strong></span>
                  <span className="admin-ba-payout__ratio-qualifies">Qualifies: {row.qualifyingLandlords}</span>
                  <span className="admin-ba-payout__ratio-not-qualifies">Not qualifying: {row.notQualifyingLandlords}</span>
                  <span>Onboarded: {row.totalLandlordsOnboarded}</span>
                </div>

                {isExpanded && (
                  <div className="admin-ba-payout__detail">
                    <ul className="admin-ba-payout__claims">
                      {row.claims.map((c) => (
                        <li key={c.id} className="admin-ba-payout__claim">
                          <span>{c.landlordName} {c.landlordLocation ? `— ${c.landlordLocation}` : ''}</span>
                          <span>
                            {money(c.commissionBonusAmount)} commission · {c.qualificationStatus}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="admin-ba-payout__actions">
                      <Button onClick={() => markPaid(row.ba.id)} disabled={busyBaId === row.ba.id} >
                        Mark as Paid
                      </Button>
                      <Button onClick={() => markNotPaid(row.ba.id)} disabled={busyBaId === row.ba.id} variant="ghost">
                        Mark as Not Paid
                      </Button>
                      <Button onClick={() => downloadStatement(row.ba.id)} variant="ghost">
                        Download Statement
                      </Button>
                      <Button onClick={() => downloadEarningsStatement(row.ba.id, 'pdf')} variant="ghost">
                        Statement PDF
                      </Button>
                      <Button onClick={() => downloadEarningsStatement(row.ba.id, 'csv')} variant="ghost">
                        Statement CSV
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}
    </section>
  );
}
