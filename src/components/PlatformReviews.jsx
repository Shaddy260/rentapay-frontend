import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import './PlatformReviews.css';

/**
 * DIRECT REQUEST: a way for RentaPay itself to be rated and reviewed
 * - by users with an account AND by anonymous visitors with no
 * account at all. Shown on the public landing page. Includes
 * schema.org Review/AggregateRating JSON-LD so Google search results
 * *can* surface a star rating for us (Google decides if/when to show
 * it - this just makes it possible).
 *
 * After submitting, also points the person to our real Google
 * Business Profile / Facebook page (the actual listings people see
 * when they search for us), since an on-site review alone doesn't
 * appear in Google search results the way an external one does.
 */
export default function PlatformReviews({ token }) {
  const [data, setData] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [thankYou, setThankYou] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getPlatformReviews(10).then((res) => {
      if (!cancelled) setData(res);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit() {
    if (!rating) {
      setError('Pick a star rating first.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.submitPlatformReview({ rating, displayName: displayName || undefined, comment: comment || undefined }, token);
      setThankYou(res.externalLinks);
      setShowForm(false);
      setRating(0);
      setDisplayName('');
      setComment('');
      // Refresh the list/aggregate to include the new review.
      api.getPlatformReviews(10).then(setData).catch(() => {});
    } catch (err) {
      setError(err.message || 'Failed to submit your review.');
    } finally {
      setSubmitting(false);
    }
  }

  const aggregate = data?.aggregate;
  const reviews = data?.reviews || [];

  // schema.org markup - only emitted once there's at least one review,
  // since an AggregateRating with zero reviews is invalid/misleading.
  const jsonLd = aggregate?.total > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'RentaPay',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: aggregate.average,
      reviewCount: aggregate.total,
    },
    review: reviews.slice(0, 5).map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.display_name },
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
      reviewBody: r.comment || undefined,
    })),
  } : null;

  return (
    <section className="platform-reviews">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}

      <h2>What people are saying about RentaPay</h2>

      {aggregate?.total > 0 && (
        <div className="platform-reviews__summary">
          <span className="platform-reviews__stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={n <= Math.round(aggregate.average) ? 'star star--filled' : 'star'}>★</span>
            ))}
          </span>
          <span>{aggregate.average} out of 5 ({aggregate.total} review{aggregate.total === 1 ? '' : 's'})</span>
        </div>
      )}

      {thankYou && (
        <div className="platform-reviews__thanks">
          <p>Thanks for the review! If you have a moment, it also really helps us if you leave one on:</p>
          <div className="platform-reviews__external-links">
            {thankYou.google && <a href={thankYou.google} target="_blank" rel="noreferrer" className="landing__btn landing__btn--secondary">Google</a>}
            {thankYou.facebook && <a href={thankYou.facebook} target="_blank" rel="noreferrer" className="landing__btn landing__btn--secondary">Facebook</a>}
          </div>
        </div>
      )}

      {!showForm && !thankYou && (
        <button type="button" className="landing__btn landing__btn--secondary" onClick={() => setShowForm(true)}>
          Leave a review
        </button>
      )}

      {showForm && (
        <div className="platform-reviews__form">
          <div className="platform-reviews__form-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={n <= rating ? 'star star--filled star--input' : 'star star--input'}
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                ★
              </button>
            ))}
          </div>
          {!token && (
            <input
              className="platform-reviews__name-input"
              placeholder="Your name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
            />
          )}
          <textarea
            className="platform-reviews__comment-input"
            placeholder="What's your experience been like? (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
          />
          {error && <p className="modal-error">{error}</p>}
          <div className="platform-reviews__form-actions">
            <button type="button" onClick={() => setShowForm(false)} disabled={submitting}>Cancel</button>
            <button type="button" className="landing__btn landing__btn--primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit review'}
            </button>
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <ul className="platform-reviews__list">
          {reviews.map((r) => (
            <li key={r.id} className="platform-reviews__item">
              <div className="platform-reviews__item-header">
                <span className="platform-reviews__item-name">{r.display_name}</span>
                {r.is_authenticated && r.user_type && (
                  <span className="platform-reviews__item-badge">Verified {r.user_type.replace('_', ' ')}</span>
                )}
                <span className="platform-reviews__item-stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={n <= r.rating ? 'star star--filled' : 'star'}>★</span>
                  ))}
                </span>
              </div>
              {r.comment && <p className="platform-reviews__item-comment">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
