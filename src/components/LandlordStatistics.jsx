import React, { useEffect, useState } from 'react';
import MiniBarChart from './MiniBarChart.jsx';
import MiniDonutChart from './MiniDonutChart.jsx';
import { api, ApiError } from '../api/client.js';
import './StatisticsPanel.css';

/**
 * "Financial Statistics" for the landlord/manager portal (was missing -
 * only the tenant portal had a Statistics tab before). Late vs on-time
 * payments, collection rate against expected rent, occupancy breakdown,
 * and a 6-month collected-rent trend - all served by
 * GET /api/dashboard/statistics.
 */
export default function LandlordStatistics({ token, propertyId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
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
  }, [token, propertyId]);

  if (loading) return <section className="statistics-panel"><p>Loading statistics…</p></section>;
  if (error) return <section className="statistics-panel"><p className="modal-error">{error}</p></section>;
  if (!stats) return null;

  const { units, payments, monthlyCollected } = stats;

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
      <h2>Financial Statistics</h2>

      <div className="statistics-panel__cards">
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Collected this month</span>
          <span className="statistics-panel__card-value">KES {Number(payments.collectedThisMonth).toLocaleString()}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Collection rate</span>
          <span className="statistics-panel__card-value">{payments.collectionRate != null ? `${payments.collectionRate}%` : '—'}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">On-time payment rate</span>
          <span className="statistics-panel__card-value">{payments.onTimeRate != null ? `${payments.onTimeRate}%` : '—'}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Overdue right now</span>
          <span className="statistics-panel__card-value">{payments.overdueNow}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Occupancy rate</span>
          <span className="statistics-panel__card-value">{units.occupancyRate}%</span>
        </div>
      </div>

      <div className="statistics-panel__chart-block">
        <h3>Rent collected, last 6 months</h3>
        {monthlyCollected.every((m) => m.value === 0) ? (
          <p className="tenant-portal-hint">No completed payments yet to chart.</p>
        ) : (
          <MiniBarChart data={monthlyCollected} />
        )}
      </div>

      {paymentSplitSegments.length > 0 && (
        <div className="statistics-panel__chart-block">
          <h3>On-time vs late payments (last 6 months)</h3>
          <MiniDonutChart segments={paymentSplitSegments} centerLabel={`${payments.onTimeCount + payments.lateCount} total`} />
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
