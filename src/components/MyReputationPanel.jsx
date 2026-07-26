import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import './TenantReputationsPanel.css';
import './MyReputationPanel.css';
import Skeleton from './Skeleton.jsx';

function BigStars({ average }) {
  if (!average) return null;
  const rounded = Math.round(average);
  return (
    <span className="my-reputation-panel__big-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rounded ? 'star star--filled' : 'star'}>★</span>
      ))}
    </span>
  );
}

/**
 * Direct request: the tenant should be able to see their own
 * reputation profile before/same as any landlord does - same
 * distilled, email-portable aggregate a new landlord would see
 * (never raw amounts/dates from another landlord's ledger), scoped
 * server-side so a tenant can only ever fetch their own.
 */
export default function MyReputationPanel({ token, tenantId }) {
  const [reputation, setReputation] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    api
      .getTenantReputation(tenantId, token)
      .then((res) => setReputation(res.reputation))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your reputation.'));
  }, [token, tenantId]);

  if (error) return <p className="dashboard-main__empty">{error}</p>;
  if (!reputation) return <Skeleton rows={2} />;

  if (!reputation.totalRatings) {
    return (
      <div className="my-reputation-panel">
        <h3>My Tenancy Reputation</h3>
        <p className="my-reputation-panel__empty">
          No landlord has rated you yet. Once they do, your score will appear here first - and it's the same score that will
          follow you (by this email address) to any future landlord who adds you on RentaPay.
        </p>
      </div>
    );
  }

  return (
    <div className="my-reputation-panel">
      <h3>My Tenancy Reputation</h3>
      <p className="my-reputation-panel__intro">
        This is portable - it's built from every rating any landlord has left for you on RentaPay, and it's the same summary
        a new landlord will see if they add you using this email address.
      </p>

      <div className="my-reputation-panel__summary">
        <BigStars average={reputation.averageRating} />
        <span className="my-reputation-panel__score">{reputation.averageRating} / 5</span>
        <span className="my-reputation-panel__meta">
          {reputation.totalRatings} rating{reputation.totalRatings === 1 ? '' : 's'} from {reputation.priorLandlordCount} landlord{reputation.priorLandlordCount === 1 ? '' : 's'}
        </span>
      </div>

      {Object.keys(reputation.byCategory || {}).length > 1 && (
        <div className="my-reputation-panel__categories">
          {Object.entries(reputation.byCategory).map(([cat, stats]) => (
            <div key={cat} className="my-reputation-panel__category-row">
              <span className="my-reputation-panel__category-label">{cat.replace('_', ' ')}</span>
              <span>{stats.average} / 5 ({stats.count})</span>
            </div>
          ))}
        </div>
      )}

      {reputation.ratings?.some((r) => r.comment) && (
        <div className="my-reputation-panel__comments">
          <h4>Feedback from landlords</h4>
          {reputation.ratings.filter((r) => r.comment).map((r, i) => (
            <div key={i} className="my-reputation-panel__comment">
              <div className="my-reputation-panel__comment-head">
                <span>{'★'.repeat(r.rating)}</span>
                <span className="my-reputation-panel__comment-landlord">{r.landlordName}</span>
              </div>
              <p>{r.comment}</p>
            </div>
          ))}
        </div>
      )}

      <p className="my-reputation-panel__disagree">
        See something that isn't right? Contact support so we can look into it.
      </p>
    </div>
  );
}
