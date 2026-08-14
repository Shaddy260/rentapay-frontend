import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import './StatisticsPanel.css';
import './TenantReputationsPanel.css';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';

function Stars({ average }) {
  if (!average) return <span className="tenant-reputations-panel__no-rating">Not yet rated</span>;
  const rounded = Math.round(average);
  return (
    <span className="tenant-reputations-panel__stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rounded ? 'star star--filled' : 'star'}>★</span>
      ))}
      <span className="tenant-reputations-panel__value"> {average}</span>
    </span>
  );
}

/**
 * Direct request: landlords rating tenants should "display in a
 * reputations table in the landlord's dashboard" - every active
 * tenant this landlord/manager currently has, with their portable
 * (email-keyed, cross-landlord) reputation score attached.
 */
export default function TenantReputationsPanel({ token }) {
  const [reputations, setReputations] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listTenantReputations(token)
      .then((res) => setReputations(res.reputations || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load tenant reputations.'));
  }, [token]);

  if (error) return <p className="dashboard-main__empty">{error}</p>;
  if (!reputations) return <Skeleton rows={3} />;
  if (!reputations.length) {
    return <p className="dashboard-main__empty">No tenants with an email on file yet - reputations are keyed by email, so add one to a tenant to start building their profile.</p>;
  }

  return (
    <div className="statistics-panel__county-table-wrap">
      <h3>Tenant Reputations</h3>
      <InfoTip text={<>
        Scores are portable - they follow a tenant by email across every landlord who has rated them on RentaPay, not just ratings you've given.
      </>} />
      <table className="statistics-panel__county-table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Unit</th>
            <th>Apartment</th>
            <th>Reputation</th>
            <th>Ratings</th>
            <th>Landlords</th>
          </tr>
        </thead>
        <tbody>
          {reputations.map((r) => (
            <tr key={r.tenantId}>
              <td>{r.fullName}</td>
              <td>{r.unitName || '—'}</td>
              <td>{r.propertyName || '—'}</td>
              <td><Stars average={r.averageRating} /></td>
              <td>{r.totalRatings}</td>
              <td>{r.priorLandlordCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
