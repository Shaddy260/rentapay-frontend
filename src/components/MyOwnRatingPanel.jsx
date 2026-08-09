import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import './TenantReputationsPanel.css';
import './MyReputationPanel.css';
import Skeleton from './Skeleton.jsx';
import RatingFlagList from './RatingFlagList.jsx';

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
 * FEATURE (direct request #8): "landlords/managers/caretakers
 * currently have no visibility into their own ratings at all" -
 * this is that missing view. Same aggregate-only shape as
 * MyReputationPanel (tenant's own side): a star average and a count,
 * never a list singling out which tenant said what, for the same
 * anti-retaliation reason landlord_ratings/staff_ratings are only
 * ever exposed as aggregates.
 *
 * `viewerRole`: 'landlord' | 'manager' (covers caretaker too - both
 * log in with role='manager', roleLevel just changes the label here).
 */
export default function MyOwnRatingPanel({ token, viewerRole, roleLevel }) {
  const [reputation, setReputation] = useState(null);
  const [error, setError] = useState('');

  const isLandlord = viewerRole === 'landlord';
  const label = isLandlord ? 'landlord' : roleLevel === 'caretaker' ? 'caretaker' : 'property manager';

  useEffect(() => {
    const fetcher = isLandlord ? api.getMyReputationAsLandlord : api.getMyStaffReputation;
    fetcher(token)
      .then((res) => setReputation(res.reputation))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your rating.'));
  }, [token, isLandlord]);

  if (error) return <p className="dashboard-main__empty">{error}</p>;
  if (!reputation) return <Skeleton rows={2} />;

  return (
    <div className="my-reputation-panel">
      <h3>My Rating as {label.charAt(0).toUpperCase() + label.slice(1)}</h3>
      {!reputation.totalRatings ? (
        <p className="my-reputation-panel__empty">
          No tenant has rated you yet. Once they do, your star average and review count will appear here.
        </p>
      ) : (
        <>
          <p className="my-reputation-panel__intro">
            Built from every rating a tenant has left for you - shown only as an aggregate, never as a single review tied
            back to one tenant.
          </p>
          <div className="my-reputation-panel__summary">
            <BigStars average={reputation.averageRating} />
            <span className="my-reputation-panel__score">{reputation.averageRating} / 5</span>
            <span className="my-reputation-panel__meta">
              {reputation.totalRatings} rating{reputation.totalRatings === 1 ? '' : 's'}
            </span>
          </div>
        </>
      )}
      {reputation.totalRatings > 0 && (
        <RatingFlagList
          token={token}
          table={isLandlord ? 'landlord_ratings' : 'staff_ratings'}
          title="Dispute a rating"
          canFlag={isLandlord}
        />
      )}
    </div>
  );
}
