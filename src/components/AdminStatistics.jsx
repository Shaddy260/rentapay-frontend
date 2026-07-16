import React, { useEffect, useState } from 'react';
import MiniBarChart from './MiniBarChart.jsx';
import MiniDonutChart from './MiniDonutChart.jsx';
import { api, ApiError } from '../api/client.js';
import './StatisticsPanel.css';

/**
 * Platform-wide "Financial Statistics" for the admin portal (was
 * missing - only the tenant portal had a Statistics tab before).
 * Monthly revenue trend, landlord/tenant/unit counts, active vs
 * suspended landlords. See admin.controller.js getRevenueTrend for why
 * this shows "revenue per active landlord" rather than a profit
 * margin - the platform has no cost-basis data to compute one.
 */
export default function AdminStatistics({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getRevenueTrend(token)
      .then((res) => {
        if (!cancelled) setData(res);
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
  }, [token]);

  if (loading) return <section className="statistics-panel"><p>Loading statistics…</p></section>;
  if (error) return <section className="statistics-panel"><p className="modal-error">{error}</p></section>;
  if (!data) return null;

  const landlordSegments = [
    { label: 'Active', value: data.landlords.active, color: 'var(--color-mpesa)' },
    { label: 'Suspended', value: data.landlords.suspended, color: 'var(--color-error)' },
    { label: 'Other', value: Math.max(0, data.landlords.total - data.landlords.active - data.landlords.suspended), color: 'var(--color-ink-soft)' },
  ].filter((s) => s.value > 0);

  return (
    <section className="statistics-panel">
      <h2>Platform Financial Statistics</h2>

      <div className="statistics-panel__cards">
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Revenue this month</span>
          <span className="statistics-panel__card-value">KES {Number(data.revenueThisMonth).toLocaleString()}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Revenue per active landlord</span>
          <span className="statistics-panel__card-value">KES {Number(data.revenuePerActiveLandlord).toLocaleString()}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Active landlords</span>
          <span className="statistics-panel__card-value">{data.landlords.active}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Total tenants</span>
          <span className="statistics-panel__card-value">{data.totalTenants}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Total units</span>
          <span className="statistics-panel__card-value">{data.totalUnits}</span>
        </div>
      </div>

      <div className="statistics-panel__chart-block">
        <h3>Subscription revenue, last 6 months</h3>
        {data.monthlyRevenue.every((m) => m.value === 0) ? (
          <p className="tenant-portal-hint">No completed subscription payments yet to chart.</p>
        ) : (
          <MiniBarChart data={data.monthlyRevenue} />
        )}
      </div>

      {landlordSegments.length > 0 && (
        <div className="statistics-panel__chart-block">
          <h3>Landlords by status ({data.landlords.total} total)</h3>
          <MiniDonutChart segments={landlordSegments} centerLabel={`${data.landlords.total} landlords`} />
        </div>
      )}

      <p className="unit-detail-hint">
        Note: "profit margin" isn't shown here since RentaPay doesn't track platform costs (hosting, SMS,
        staff, etc) anywhere in the system - revenue per active landlord is the closest honest proxy available.
      </p>
    </section>
  );
}
