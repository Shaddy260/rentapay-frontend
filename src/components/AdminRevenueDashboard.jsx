import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import './StatisticsPanel.css';

/**
 * Business-metrics view for the platform admin - MRR, churn, renewals
 * due this week, and most-active landlords. Separate from
 * AdminStatistics.jsx (which shows CASH COLLECTED per month plus
 * county/growth breakdowns) - MRR is a different number from cash
 * collected: a landlord who prepays 12 months upfront at a discount
 * shows up as one lump sum in the month they pay under the cash view,
 * not spread across the year, so it doesn't tell you what recurring
 * revenue actually looks like right now. See admin.controller.js
 * getRevenueDashboard for the calculation.
 */
export default function AdminRevenueDashboard({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getRevenueDashboard(token)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load the revenue dashboard.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) return <section className="statistics-panel"><p>Loading revenue dashboard…</p></section>;
  if (error) return <section className="statistics-panel"><p className="modal-error">{error}</p></section>;
  if (!data) return null;

  return (
    <section className="statistics-panel">
      <h2>Revenue Dashboard</h2>

      <div className="statistics-panel__cards">
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">MRR (monthly recurring revenue)</span>
          <span className="statistics-panel__card-value">KES {Number(data.mrr).toLocaleString()}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Active landlords</span>
          <span className="statistics-panel__card-value">{data.activeLandlordCount}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Churn rate (30 days)</span>
          <span className="statistics-panel__card-value">
            {data.churn.rate == null ? 'N/A' : `${data.churn.rate}%`}
          </span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Renewals due this week</span>
          <span className="statistics-panel__card-value">{data.renewalsDueThisWeek.length}</span>
        </div>
      </div>

      <p className="tenant-portal-hint">{data.churn.note}</p>

      <div className="statistics-panel__chart-block">
        <h3>Renewals due within 7 days</h3>
        {data.renewalsDueThisWeek.length === 0 ? (
          <p className="tenant-portal-hint">No landlord subscriptions expiring in the next 7 days.</p>
        ) : (
          <div className="statistics-panel__county-table-wrap">
            <table className="statistics-panel__county-table">
              <thead>
                <tr>
                  <th>Landlord</th>
                  <th>Phone</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {data.renewalsDueThisWeek.map((l) => (
                  <tr key={l.id}>
                    <td>{l.full_name}</td>
                    <td>{l.phone}</td>
                    <td>{new Date(l.subscription_expires_at).toLocaleDateString('en-GB')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="statistics-panel__chart-block">
        <h3>Most-active landlords (rent collected, last 30 days)</h3>
        {data.mostActiveLandlords.length === 0 ? (
          <p className="tenant-portal-hint">No completed rent payments in the last 30 days yet.</p>
        ) : (
          <div className="statistics-panel__county-table-wrap">
            <table className="statistics-panel__county-table">
              <thead>
                <tr>
                  <th>Landlord</th>
                  <th>Payments processed</th>
                  <th>Rent collected</th>
                </tr>
              </thead>
              <tbody>
                {data.mostActiveLandlords.map((l) => (
                  <tr key={l.landlordId}>
                    <td>{l.name}</td>
                    <td>{l.paymentCount}</td>
                    <td>KES {Number(l.totalCollected).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
