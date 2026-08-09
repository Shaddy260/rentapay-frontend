import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import './RateLandlordWidget.css';

/** Reusable star-picker + submit form, shared by the landlord block and each staff block below. */
function StarRateForm({ ratingValue, setRatingValue, comment, setComment, submitting, submitError, onCancel, onSubmit }) {
  return (
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
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
      />
      {submitError && <p className="rate-landlord-widget__error">{submitError}</p>}
      <div className="rate-landlord-widget__actions">
        <button type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button type="button" onClick={onSubmit} disabled={submitting} className="rate-landlord-widget__submit">
          {submitting ? 'Saving…' : 'Save rating'}
        </button>
      </div>
    </div>
  );
}

/**
 * FEATURE (direct request #8): tenants can rate the property manager
 * and caretaker separately from the landlord - three distinct rating
 * relationships. Manager/caretaker sections only render if that role
 * is actually assigned to the tenant's property (listRateableStaff
 * resolves that server-side).
 */
function StaffRatingBlock({ token, staffId, roleLabel, initialReputation }) {
  const [reputation, setReputation] = useState(initialReputation);
  const [showForm, setShowForm] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  async function submit() {
    if (!ratingValue) {
      setSubmitError('Pick a star rating first.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.rateStaff(staffId, { rating: ratingValue, comment: comment || undefined }, token);
      setReputation(res.reputation);
      setShowForm(false);
    } catch (err) {
      setSubmitError(err.message || 'Failed to save rating.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rate-landlord-widget rate-landlord-widget--staff">
      <h3>Rate My {roleLabel}</h3>
      {reputation && reputation.totalRatings > 0 && (
        <p className="rate-landlord-widget__aggregate">
          Current aggregate: {reputation.averageRating} / 5 ({reputation.totalRatings} rating{reputation.totalRatings === 1 ? '' : 's'})
        </p>
      )}
      {!showForm && (
        <button type="button" className="rate-landlord-widget__open-btn" onClick={() => setShowForm(true)}>
          Rate my {roleLabel.toLowerCase()}
        </button>
      )}
      {showForm && (
        <StarRateForm
          ratingValue={ratingValue}
          setRatingValue={setRatingValue}
          comment={comment}
          setComment={setComment}
          submitting={submitting}
          submitError={submitError}
          onCancel={() => setShowForm(false)}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

/**
 * Mirror side of MyReputationPanel: the tenant rates their own
 * landlord (and, below, their property manager/caretaker
 * separately). Deliberately shows only the AGGREGATE score (never a
 * list of other tenants' individual ratings) - see
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
  const [staff, setStaff] = useState(null); // { manager, caretaker } from listRateableStaff

  useEffect(() => {
    api
      .getMyLandlordReputation(token)
      .then((res) => setReputation(res.reputation))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load landlord reputation.'));
    api
      .listRateableStaff(token)
      .then(setStaff)
      .catch(() => setStaff(null)); // non-fatal - the landlord block above still works fine on its own
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
    <>
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
          <StarRateForm
            ratingValue={ratingValue}
            setRatingValue={setRatingValue}
            comment={comment}
            setComment={setComment}
            submitting={submitting}
            submitError={submitError}
            onCancel={() => setShowForm(false)}
            onSubmit={submit}
          />
        )}
      </div>

      {staff?.manager && <StaffRatingBlock token={token} staffId={staff.manager.id} roleLabel="Property Manager" initialReputation={staff.manager} />}
      {staff?.caretaker && <StaffRatingBlock token={token} staffId={staff.caretaker.id} roleLabel="Caretaker" initialReputation={staff.caretaker} />}
    </>
  );
}
