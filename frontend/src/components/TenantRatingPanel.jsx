import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import ModalShell from './ModalShell.jsx';
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

const ROLE_LABELS = { landlord: 'Landlord ratings', manager: 'Manager ratings', caretaker: 'Caretaker ratings' };

// DIRECT REQUEST: rate every category together in one submit instead
// of picking one category at a time. "Overall" is required; the rest
// are optional per submission (left at 0 = not sent for that category).
const CATEGORIES = [
  { key: 'overall', label: 'Overall', required: true },
  { key: 'payment', label: 'Payment reliability', required: false },
  { key: 'property_care', label: 'Property care', required: false },
  { key: 'communication', label: 'Communication', required: false },
  { key: 'conduct', label: 'Conduct', required: false },
];

/**
 * DIRECT REQUEST (reverses an earlier "moved out of an always-open
 * panel into a Rate tenant action" decision): the general/overall
 * rating now needs to be visible right under the tenant banner
 * without any click first, alongside a visible "Rate tenant" UI - not
 * buried behind a plain button that opens a modal before showing
 * anything. So: the star summary + per-role breakdown load and
 * render inline as soon as a tenant is on the unit; only the actual
 * rating-submission FORM still lives in a modal (tapping "Rate
 * tenant" / "Add / update my rating" opens it) since a 5-category
 * star-picker + comment box doesn't fit inline without pushing the
 * rest of the unit page down.
 *
 * Ratings are tied to the tenant's email/phone (see
 * tenant.controller.js -> reputationService, keyed by
 * tenant_email), so they follow the tenant to any future landlord who
 * adds them by that same email or phone.
 *
 * Landlords, managers, and caretakers can each rate a tenant, and the
 * breakdown is shown separately per role (rater_role, added in
 * 2026-07-tenant-rating-rater-role.sql) rather than blended together.
 *
 * Comments are intentionally not displayed anywhere in this view
 * (direct request to stop showing rating comments platform-wide) -
 * only the star rating, category, and role are shown. The comment
 * field is still collected on submission since it's useful context if
 * a tenant later flags the rating for admin review.
 */
export default function TenantRatingPanel({ tenantId, token }) {
  const [showForm, setShowForm] = useState(false);
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ratingsByCategory, setRatingsByCategory] = useState({});
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
    if (!ratingsByCategory.overall) {
      setSubmitError('Pick an overall star rating first.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const ratings = CATEGORIES
        .filter((c) => ratingsByCategory[c.key])
        .map((c) => ({ category: c.key, rating: ratingsByCategory[c.key], comment: c.key === 'overall' ? (comment || undefined) : undefined }));
      const res = await api.rateTenant(tenantId, { ratings }, token);
      setReputation(res.reputation);
      setShowForm(false);
      setRatingsByCategory({});
      setComment('');
    } catch (err) {
      setSubmitError(err.message || 'Failed to save rating.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tenant-rating-panel tenant-rating-panel--inline">
      {loading && <Skeleton rows={1} />}

      {!loading && reputation?.tenantEmail === null && (
        <p className="tenant-rating-panel__no-email">
          This tenant has no email on file, so ratings can't be linked to their portable reputation yet.
          Add one via <strong>Edit details</strong> first.
        </p>
      )}

      {!loading && reputation?.tenantEmail !== null && (
        <div className="tenant-rating-panel__summary">
          <StarDisplay average={reputation?.averageRating} total={reputation?.totalRatings} />
          {reputation?.priorLandlordCount > 1 && (
            <p className="tenant-rating-panel__note">Rated by {reputation.priorLandlordCount} landlords, portable across moves.</p>
          )}
          <button type="button" className="tenant-rating-panel__rate-btn" onClick={() => setShowForm(true)}>
            {reputation?.totalRatings ? 'Add / update my rating' : 'Rate this tenant'}
          </button>
        </div>
      )}

      {showForm && (
        <ModalShell title="Tenancy reputation" onClose={() => { setShowForm(false); setSubmitError(''); }}>
          <div className="tenant-rating-panel">
            <div className="tenant-rating-panel__by-role">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <div key={role} className="tenant-rating-panel__role-row">
                  <span className="tenant-rating-panel__role-label">{label}</span>
                  <StarDisplay average={reputation?.byRole?.[role]?.average} total={reputation?.byRole?.[role]?.count} />
                </div>
              ))}
            </div>

            <div className="tenant-rating-panel__form">
              {CATEGORIES.map((c) => (
                <div key={c.key} className="tenant-rating-panel__category-row">
                  <span className="tenant-rating-panel__category-label">
                    {c.label}{c.required ? '' : ' (optional)'}
                  </span>
                  <div className="tenant-rating-panel__form-stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        type="button"
                        key={n}
                        className={n <= (ratingsByCategory[c.key] || 0) ? 'star star--filled star--input' : 'star star--input'}
                        onClick={() => setRatingsByCategory((prev) => ({ ...prev, [c.key]: n }))}
                        aria-label={`${c.label}: ${n} star${n > 1 ? 's' : ''}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <textarea
                className="tenant-rating-panel__comment"
                placeholder="Optional note for your own records (not shown anywhere in the app)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
              {submitError && <p className="tenant-rating-panel__error">{submitError}</p>}
              <div className="tenant-rating-panel__actions">
                <button type="button" onClick={() => { setShowForm(false); setSubmitError(''); }} disabled={submitting}>Cancel</button>
                <button type="button" onClick={submitRating} disabled={submitting} className="tenant-rating-panel__submit">
                  {submitting ? 'Saving…' : 'Save all ratings'}
                </button>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
