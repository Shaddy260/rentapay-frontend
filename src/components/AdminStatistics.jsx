import React, { useEffect, useState } from 'react';
import MiniBarChart from './MiniBarChart.jsx';
import MiniDonutChart from './MiniDonutChart.jsx';
import MiniLineChart from './MiniLineChart.jsx';
import { api, ApiError } from '../api/client.js';
import './StatisticsPanel.css';

/**
 * Platform-wide "Financial Statistics" for the admin portal (was
 * missing - only the tenant portal had a Statistics tab before).
 * Monthly revenue trend, landlord/tenant/unit counts, active vs
 * suspended landlords. See admin.controller.js getRevenueTrend for why
 * this shows "revenue per active landlord" rather than a profit
 * margin - the platform has no cost-basis data to compute one.
 *
 * Also shows the county-level breakdown and growth line graphs
 * (direct request: "group landlords based on counties... line graphs
 * of landlords and tenants... based on the 47 counties of Kenya") -
 * fetched separately from /admin/growth-statistics since it's a
 * different, heavier query (full landlord/tenant table scan) that
 * shouldn't slow down the revenue cards above it.
 */
export default function AdminStatistics({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [growth, setGrowth] = useState(null);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [growthError, setGrowthError] = useState('');

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

  useEffect(() => {
    let cancelled = false;
    setGrowthLoading(true);
    api
      .getGrowthStatistics(token)
      .then((res) => {
        if (!cancelled) setGrowth(res);
      })
      .catch((err) => {
        if (!cancelled) setGrowthError(err instanceof ApiError ? err.message : 'Failed to load county/growth statistics.');
      })
      .finally(() => {
        if (!cancelled) setGrowthLoading(false);
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

      {growthLoading ? (
        <p className="tenant-portal-hint">Loading county and growth statistics…</p>
      ) : growthError ? (
        <p className="modal-error">{growthError}</p>
      ) : growth ? (
        <>
          <div className="statistics-panel__chart-block">
            <h3>Landlords over time, last 6 months</h3>
            <MiniLineChart data={growth.landlordGrowth} color="var(--color-mpesa)" unitLabel=" landlords" />
          </div>

          <div className="statistics-panel__chart-block">
            <h3>Tenants over time, last 6 months</h3>
            <MiniLineChart data={growth.tenantGrowth} color="var(--color-accent)" unitLabel=" tenants" />
          </div>

          <div className="statistics-panel__chart-block">
            <h3>Landlords &amp; tenants by county (all 47 counties)</h3>
            <div className="statistics-panel__county-table-wrap">
              <table className="statistics-panel__county-table">
                <thead>
                  <tr><th>County</th><th>Landlords</th><th>Tenants</th></tr>
                </thead>
                <tbody>
                  {growth.countyBreakdown.map((row) => (
                    <tr key={row.county}>
                      <td>{row.county}</td>
                      <td>{row.landlords}</td>
                      <td>{row.tenants}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <p className="unit-detail-hint">
        Note: "profit margin" isn't shown here since RentaPay doesn't track platform costs (hosting, SMS,
        staff, etc) anywhere in the system - revenue per active landlord is the closest honest proxy available.
      </p>
    </section>
  );
}
