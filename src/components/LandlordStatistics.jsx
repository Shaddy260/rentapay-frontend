import React, { useEffect, useState } from 'react';
import MiniBarChart from './MiniBarChart.jsx';
import MiniDualBarChart from './MiniDualBarChart.jsx';
import MiniDonutChart from './MiniDonutChart.jsx';
import AnnualReportPanel from './AnnualReportPanel.jsx';
import PendingRentChangesPanel from './PendingRentChangesPanel.jsx';
import { api, ApiError } from '../api/client.js';
import './StatisticsPanel.css';

/**
 * A percentage-based stat card that also shows the raw counts behind
 * it (e.g. "20% (1 of 5)") and, on a small sample, de-emphasizes the
 * number instead of letting it read as alarming/broken (spec:
 * "Misleading rate calculations on small sample sizes").
 */
function RateCard({ label, rate, counts, lowSample, notEnoughData }) {
  return (
    <div className={`statistics-panel__card${lowSample || notEnoughData ? ' statistics-panel__card--low-sample' : ''}`}>
      <span className="statistics-panel__card-label">{label}</span>
      {notEnoughData ? (
        <>
          <span className="statistics-panel__card-value statistics-panel__card-value--muted">Not enough data yet</span>
          {counts && <span className="statistics-panel__card-note">{counts}</span>}
        </>
      ) : (
        <>
          <span className="statistics-panel__card-value">
            {rate}%{counts ? <span className="statistics-panel__card-value-counts"> ({counts})</span> : null}
          </span>
          {lowSample && <span className="statistics-panel__card-note">Based on a small sample</span>}
        </>
      )}
    </div>
  );
}

/**
 * "Financial Statistics" for the landlord/manager portal (was missing -
 * only the tenant portal had a Statistics tab before). Late vs on-time
 * payments, collection rate against expected rent, occupancy breakdown,
 * and a 6-month collected-rent trend - all served by
 * GET /api/dashboard/statistics.
 */
export default function LandlordStatistics({ token, propertyId, isCaretaker = false }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    setPdfError('');
    try {
      await api.downloadStatisticsPdf(token, propertyId);
    } catch (err) {
      setPdfError(err instanceof ApiError ? err.message : 'Failed to generate PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  }

  useEffect(() => {
    // Role Permissions spec (Section 3): Financial Statistics is in
    // the caretaker "no access at all, not even read-only" list. The
    // backend already 403s GET /dashboard/statistics for a caretaker
    // token - this skips the fetch entirely rather than firing a
    // request that's just going to fail.
    if (isCaretaker) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getLandlordStatistics(token, propertyId)
      .then((res) => {
        if (!cancelled) setStats(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load statistics.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, propertyId, isCaretaker]);

  if (isCaretaker) {
    return (
      <section className="statistics-panel">
        <h2>Financial Statistics</h2>
        <p className="tenant-portal-hint">
          This section isn't available to caretaker accounts. Contact the landlord or property manager for financial statistics.
        </p>
      </section>
    );
  }

  if (loading) return <section className="statistics-panel"><p>Loading statistics…</p></section>;
  if (error) return <section className="statistics-panel"><p className="modal-error">{error}</p></section>;
  if (!stats) return null;

  const { units, payments, expenses, monthlyCollected, monthlyOwed = [], chronicallyLateUnits = [] } = stats;

  // FEATURE (Section 8: rent collection trend chart) - pairs each
  // month's collected total with its owed total for the grouped chart
  // below. monthlyOwed is trimmed in lockstep with monthlyCollected on
  // the backend, so these always line up index-for-index.
  const collectedVsOwed = monthlyCollected.map((m, i) => ({
    label: m.label,
    collected: m.value,
    owed: monthlyOwed[i]?.value ?? 0,
  }));

  const occupancySegments = [
    { label: 'Occupied', value: units.occupied, color: 'var(--color-mpesa)' },
    { label: 'Notice given', value: units.noticeGiven, color: 'var(--color-accent)' },
    { label: 'Vacant', value: units.vacant, color: 'var(--color-ink-soft)' },
    { label: 'Maintenance', value: units.maintenance, color: 'var(--color-error)' },
  ].filter((s) => s.value > 0);

  const paymentSplitSegments = [
    { label: 'On time', value: payments.onTimeCount, color: 'var(--color-mpesa)' },
    { label: 'Late', value: payments.lateCount, color: 'var(--color-error)' },
  ].filter((s) => s.value > 0);

  return (
    <section className="statistics-panel">
      <div className="tenant-section__header-row">
        <h2>Financial Statistics</h2>
        <button className="ghost-link" onClick={handleDownloadPdf} disabled={downloadingPdf}>
          {downloadingPdf ? 'Preparing PDF…' : '⬇ Download PDF'}
        </button>
      </div>

      <div className="statistics-panel__cards">
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Collected this month</span>
          <span className="statistics-panel__card-value">KES {Number(payments.collectedThisMonth).toLocaleString()}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Expenses this month</span>
          <span className="statistics-panel__card-value">KES {Number(expenses.expensesThisMonth).toLocaleString()}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Net profit this month</span>
          <span className="statistics-panel__card-value" style={{ color: expenses.netProfitThisMonth >= 0 ? 'var(--color-mpesa)' : 'var(--color-error)' }}>
            KES {Number(expenses.netProfitThisMonth).toLocaleString()}
          </span>
        </div>
        <RateCard
          label="Collection rate"
          rate={payments.collectionRate}
          counts={payments.collectionRate != null ? payments.collectionRateCounts : null}
          lowSample={payments.collectionRateLowSample}
          notEnoughData={payments.collectionRate == null}
        />
        <RateCard
          label="On-time payment rate"
          rate={payments.onTimeRate}
          counts={payments.onTimeRate != null ? payments.onTimeRateCounts : null}
          lowSample={payments.onTimeRateLowSample}
          notEnoughData={payments.onTimeRate == null}
        />
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Overdue right now</span>
          <span className="statistics-panel__card-value">{payments.overdueNow}</span>
        </div>
        <RateCard
          label="Occupancy rate"
          rate={units.occupancyRate}
          counts={units.total > 0 ? units.occupancyRateCounts : null}
          lowSample={units.occupancyRateLowSample}
          notEnoughData={units.total === 0}
        />
      </div>

      {pdfError && <p className="modal-error">{pdfError}</p>}

      <div className="statistics-panel__chart-block">
        <h3>Reports</h3>
        <AnnualReportPanel token={token} propertyId={propertyId} isCaretaker={isCaretaker} />
      </div>

      <PendingRentChangesPanel token={token} propertyId={propertyId} />

      <div className="statistics-panel__chart-block">
        <h3>Rent collected, last 6 months</h3>
        {stats.monthlyChartNote && (
          <p className="tenant-portal-hint statistics-panel__chart-note">{stats.monthlyChartNote}</p>
        )}
        {monthlyCollected.every((m) => m.value === 0) ? (
          <p className="tenant-portal-hint">No completed payments yet to chart.</p>
        ) : (
          <MiniBarChart data={monthlyCollected} />
        )}
      </div>

      <div className="statistics-panel__chart-block">
        <h3>Rent collected vs. rent owed, last 6 months</h3>
        {collectedVsOwed.every((m) => m.collected === 0 && m.owed === 0) ? (
          <p className="tenant-portal-hint">Not enough data yet to chart.</p>
        ) : (
          <MiniDualBarChart data={collectedVsOwed} seriesA="Collected" seriesB="Owed" />
        )}
      </div>

      {paymentSplitSegments.length > 0 && (
        <div className="statistics-panel__chart-block">
          <h3>On-time vs late payments (last 6 months)</h3>
          <MiniDonutChart segments={paymentSplitSegments} centerLabel={`${payments.onTimeCount + payments.lateCount} total`} />
        </div>
      )}

      {chronicallyLateUnits.length > 0 && (
        <div className="statistics-panel__chart-block">
          <h3>Chronically late units</h3>
          <p className="tenant-portal-hint">Units with 2 or more late payments in the last 6 months, worst first.</p>
          <div className="chronically-late-units__scroll payments-table-wrap">
            <table className="payments-table">
              <thead><tr><th>Unit</th><th>Late payments</th><th>Most recent late payment</th></tr></thead>
              <tbody>
                {chronicallyLateUnits.map((u) => (
                  <tr key={u.unitId}>
                    <td>{u.unitName}</td>
                    <td>{u.lateCount}</td>
                    <td>{u.lastLateAt ? new Date(u.lastLateAt).toLocaleDateString('en-GB') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="statistics-panel__chart-block">
        <h3>Units by status ({units.total} total)</h3>
        {occupancySegments.length > 0 ? (
          <MiniDonutChart segments={occupancySegments} centerLabel={`${units.total} units`} />
        ) : (
          <p className="tenant-portal-hint">No units yet.</p>
        )}
      </div>
    </section>
  );
}
