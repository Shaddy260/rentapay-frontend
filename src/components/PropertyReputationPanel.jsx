import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import './TenantReputationsPanel.css';
import './MyReputationPanel.css';
import Skeleton from './Skeleton.jsx';
import RatingFlagList from './RatingFlagList.jsx';
import InfoTip from './InfoTip.jsx';

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
 * FOLLOW-UP (flagged in the rating-flags review): property_ratings
 * already supported flagging at the API level, but there was no
 * landlord-facing view of a property's own reputation at all - only
 * tenants (via getMyPropertyReputation) and the public listing page
 * could see it. This closes that: same aggregate-only shape as
 * MyOwnRatingPanel, scoped to whichever property is currently
 * selected in the dashboard's property switcher, plus the same
 * individual-ratings flag list (identity-safe - never which tenant
 * left it).
 *
 * `viewerRole`: 'landlord' | 'manager' (manager/caretaker can view,
 * same as MyOwnRatingPanel, but only the landlord can flag - see
 * RatingFlagList's canFlag prop).
 */
export default function PropertyReputationPanel({ token, propertyId, viewerRole }) {
  const [reputation, setReputation] = useState(null);
  const [propertyName, setPropertyName] = useState('');
  const [error, setError] = useState('');

  const isLandlord = viewerRole === 'landlord';

  useEffect(() => {
    if (!propertyId) return;
    setReputation(null);
    setError('');
    api
      .getPropertyReputationForLandlord(propertyId, token)
      .then((res) => {
        setReputation(res.reputation);
        setPropertyName(res.property?.name || '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load property reputation.'));
  }, [token, propertyId]);

  if (!propertyId) {
    return (
      <p className="dashboard-main__empty">
        Select a specific property from the switcher above to see its reputation.
      </p>
    );
  }

  if (error) return <p className="dashboard-main__empty">{error}</p>;
  if (!reputation) return <Skeleton rows={2} />;

  return (
    <div className="my-reputation-panel">
      <h3>{propertyName ? `${propertyName}'s Rating` : 'This Property\'s Rating'}</h3>
      {!reputation.totalRatings ? (
        <p className="my-reputation-panel__empty">
          No tenant has rated this property yet. Once they do, its star average and review count will appear here.
        </p>
      ) : (
        <>
          <InfoTip text={<>
            Built from every rating a current tenant has left for this property - shown only as an aggregate, never as
            a single review tied back to one tenant.
          </>} />
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
          table="property_ratings"
          propertyId={propertyId}
          title="Dispute a rating"
          canFlag={isLandlord}
        />
      )}
    </div>
  );
}
