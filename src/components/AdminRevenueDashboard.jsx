import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import './StatisticsPanel.css';
import './AdminPricingProposal.css';

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
    <>
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

      <AdminPricingProposal token={token} />
    </>
  );
}

// ---------------------------------------------------------------------
// PHASE 12 - Admin Revenue Statistics & Pricing Proposal.
//
// Looks at real numbers (true MRR, real BA payouts, real expenses) and
// proposes what price/unit and BA commission % would actually make
// sense at an admin-chosen target profit margin - side by side with
// the current live settings. Purely a proposal: nothing here changes
// live pricing/commission automatically - see admin.controller.js's
// getPricingProposal / pricingProposal.service.js for the calculation.
// ---------------------------------------------------------------------
function AdminPricingProposal({ token }) {
  const [margin, setMargin] = useState(40);
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getPricingProposal(token, margin)
      .then((res) => {
        if (!cancelled) setProposal(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load the pricing proposal.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, margin]);

  return (
    <section className="statistics-panel admin-pricing-proposal">
      <h2>Pricing &amp; Commission Proposal</h2>
      <p className="tenant-portal-hint">
        Based on this month's real revenue, BA payouts, and expenses - proposes a price/unit and BA commission %
        that would hit your target margin. This never changes your live settings automatically.
      </p>

      <div className="admin-pricing-proposal__margin-row">
        <label htmlFor="target-margin-slider">Target profit margin: <strong>{margin}%</strong></label>
        <input
          id="target-margin-slider"
          type="range"
          min="5"
          max="80"
          step="1"
          value={margin}
          onChange={(e) => setMargin(Number(e.target.value))}
        />
      </div>

      {loading && <p>Calculating proposal…</p>}
      {error && <p className="modal-error">{error}</p>}

      {!loading && !error && proposal && (
        <>
          {proposal.insufficientData ? (
            <p className="tenant-portal-hint">Not enough active-unit data yet to calculate a proposal.</p>
          ) : (
            <>
              <div className="admin-pricing-proposal__table-wrap">
                <table className="admin-pricing-proposal__table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Current</th>
                      <th>Proposed</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Price per unit</td>
                      <td>KES {Number(proposal.current.pricePerUnit).toLocaleString()}</td>
                      <td className="admin-pricing-proposal__proposed-cell">KES {Number(proposal.proposed.pricePerUnit).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>BA commission %</td>
                      <td>{proposal.current.commissionPct}%</td>
                      <td className="admin-pricing-proposal__proposed-cell">{proposal.proposed.commissionPct}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {proposal.breakEvenPricePerUnit != null && (
                <p className="tenant-portal-hint">Break-even price/unit: KES {Number(proposal.breakEvenPricePerUnit).toLocaleString()} (never proposed below this).</p>
              )}
            </>
          )}

          <details className="admin-pricing-proposal__inputs">
            <summary>Raw inputs used</summary>
            <div className="statistics-panel__cards">
              <div className="statistics-panel__card">
                <span className="statistics-panel__card-label">MRR</span>
                <span className="statistics-panel__card-value">KES {Number(proposal.inputs.mrr).toLocaleString()}</span>
              </div>
              <div className="statistics-panel__card">
                <span className="statistics-panel__card-label">Active units</span>
                <span className="statistics-panel__card-value">{proposal.inputs.activeUnits}</span>
              </div>
              <div className="statistics-panel__card">
                <span className="statistics-panel__card-label">BA commission payouts</span>
                <span className="statistics-panel__card-value">KES {Number(proposal.inputs.baCommissionPayouts).toLocaleString()}</span>
              </div>
              <div className="statistics-panel__card">
                <span className="statistics-panel__card-label">Operating expenses</span>
                <span className="statistics-panel__card-value">KES {Number(proposal.inputs.operatingExpenses).toLocaleString()}</span>
              </div>
              <div className="statistics-panel__card">
                <span className="statistics-panel__card-label">Net profit</span>
                <span className="statistics-panel__card-value">KES {Number(proposal.inputs.netProfit).toLocaleString()}</span>
              </div>
              <div className="statistics-panel__card">
                <span className="statistics-panel__card-label">Churn rate (30 days)</span>
                <span className="statistics-panel__card-value">{proposal.inputs.churnRatePct == null ? 'N/A' : `${proposal.inputs.churnRatePct}%`}</span>
              </div>
              {proposal.inputs.revenuePerUnit != null && (
                <>
                  <div className="statistics-panel__card">
                    <span className="statistics-panel__card-label">Revenue / unit (today)</span>
                    <span className="statistics-panel__card-value">KES {Number(proposal.inputs.revenuePerUnit).toLocaleString()}</span>
                  </div>
                  <div className="statistics-panel__card">
                    <span className="statistics-panel__card-label">Total cost / unit</span>
                    <span className="statistics-panel__card-value">KES {Number(proposal.inputs.totalCostPerUnit).toLocaleString()}</span>
                  </div>
                  <div className="statistics-panel__card">
                    <span className="statistics-panel__card-label">Current profit / unit</span>
                    <span className="statistics-panel__card-value">KES {Number(proposal.inputs.currentProfitPerUnit).toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
