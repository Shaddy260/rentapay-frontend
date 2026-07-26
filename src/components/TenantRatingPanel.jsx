import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Skeleton from './Skeleton.jsx';
import './TenantRatingPanel.css';

function StarDisplay({ average, total }) {
  if (!average) return <span className="tenant-rating-panel__no-rating">Not yet rated</span>;
  const rounded = Math.round(average);
  return (
    <span className="tenant-rating-panel__stars" title={`${average} out of 5 from ${total} rating(s)`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rounded ? 'star star--filled' : 'star'}>★</span>
      ))}
      <span className="tenant-rating-panel__stars-count"> {average} ({total})</span>
    </span>
  );
}

/**
 * Lets a landlord/manager rate a tenant right from the tenant details
 * section of the unit page, instead of that action being reachable
 * only by tapping the small avatar (see TenantContactCard) - the
 * rating and the tenant's current reputation are shown directly,
 * always visible, alongside the rest of the tenant's details.
 */
export default function TenantRatingPanel({ tenantId, token }) {
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [category, setCategory] = useState('overall');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!tenantId || !token) return;
    let cancelled = false;
    setLoading(true);
    api
      .getTenantReputation(tenantId, token)
      .then((res) => {
        if (!cancelled) setReputation(res.reputation);
      })
      .catch(() => {
        if (!cancelled) setReputation(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, token]);

  async function submitRating() {
    if (!ratingValue) {
      setSubmitError('Pick a star rating first.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.rateTenant(tenantId, { rating: ratingValue, category, comment: comment || undefined }, token);
      setReputation(res.reputation);
      setShowForm(false);
      setRatingValue(0);
      setComment('');
    } catch (err) {
      setSubmitError(err.message || 'Failed to save rating.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tenant-rating-panel">
      <span className="tenant-rating-panel__label">Tenancy reputation</span>
      {loading && <Skeleton rows={1} />}
      {!loading && (
        <>
          <StarDisplay average={reputation?.averageRating} total={reputation?.totalRatings} />
          {reputation?.priorLandlordCount > 1 && (
            <p className="tenant-rating-panel__note">Rated by {reputation.priorLandlordCount} landlords, portable across moves.</p>
          )}
        </>
      )}

      {!showForm && (
        <button type="button" className="tenant-rating-panel__rate-btn" onClick={() => setShowForm(true)}>
          {reputation?.totalRatings ? 'Update rating' : 'Rate this tenant'}
        </button>
      )}

      {showForm && (
        <div className="tenant-rating-panel__form">
          <select
            className="tenant-rating-panel__category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="overall">Overall</option>
            <option value="payment">Payment reliability</option>
            <option value="property_care">Property care</option>
            <option value="communication">Communication</option>
            <option value="conduct">Conduct</option>
          </select>
          <div className="tenant-rating-panel__form-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={n <= ratingValue ? 'star star--filled star--input' : 'star star--input'}
                onClick={() => setRatingValue(n)}
                aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            className="tenant-rating-panel__comment"
            placeholder="Optional comment (e.g. paid on time, took good care of the unit)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
          {submitError && <p className="tenant-rating-panel__error">{submitError}</p>}
          <div className="tenant-rating-panel__actions">
            <button type="button" onClick={() => { setShowForm(false); setSubmitError(''); }} disabled={submitting}>Cancel</button>
            <button type="button" onClick={submitRating} disabled={submitting} className="tenant-rating-panel__submit">
              {submitting ? 'Saving…' : 'Save rating'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
