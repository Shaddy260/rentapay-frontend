import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import './RateLandlordWidget.css';

/**
 * Mirror side of MyReputationPanel: the tenant rates their own
 * landlord. Deliberately shows only the AGGREGATE score for the
 * landlord (never a list of other tenants' individual ratings) - see
 * landlordReputation.service.js for why: a single visible review
 * could expose a still-living-there tenant to retaliation.
 */
export default function RateLandlordWidget({ token }) {
  const [reputation, setReputation] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    api
      .getMyLandlordReputation(token)
      .then((res) => setReputation(res.reputation))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load landlord reputation.'));
  }, [token]);

  async function submit() {
    if (!ratingValue) {
      setSubmitError('Pick a star rating first.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.rateLandlord({ rating: ratingValue, category: 'overall', comment: comment || undefined }, token);
      setReputation(res.reputation);
      setShowForm(false);
    } catch (err) {
      setSubmitError(err.message || 'Failed to save rating.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return null;

  return (
    <div className="rate-landlord-widget">
      <h3>Rate My Landlord</h3>
      <p className="rate-landlord-widget__intro">
        Your rating is combined anonymously with other tenants' - it's never shown as a single review tied to you.
      </p>

      {reputation && reputation.totalRatings > 0 && (
        <p className="rate-landlord-widget__aggregate">
          Current aggregate: {reputation.averageRating} / 5 ({reputation.totalRatings} rating{reputation.totalRatings === 1 ? '' : 's'})
        </p>
      )}

      {!showForm && (
        <button type="button" className="rate-landlord-widget__open-btn" onClick={() => setShowForm(true)}>
          Rate my landlord
        </button>
      )}

      {showForm && (
        <div className="rate-landlord-widget__form">
          <div className="rate-landlord-widget__stars">
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
            className="rate-landlord-widget__comment"
            placeholder="Optional comment (e.g. quick to fix maintenance issues)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
          {submitError && <p className="rate-landlord-widget__error">{submitError}</p>}
          <div className="rate-landlord-widget__actions">
            <button type="button" onClick={() => setShowForm(false)} disabled={submitting}>Cancel</button>
            <button type="button" onClick={submit} disabled={submitting} className="rate-landlord-widget__submit">
              {submitting ? 'Saving…' : 'Save rating'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
