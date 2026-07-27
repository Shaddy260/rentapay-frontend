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

/**
 * DIRECT REQUEST: moved out of an always-open panel into a "Rate
 * tenant" action alongside Edit details / Remind / Record payment
 * (only ever rendered when a tenant is keyed into the unit, same as
 * those). Ratings are tied to the tenant's email/phone (see
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
  const [open, setOpen] = useState(false);
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [category, setCategory] = useState('overall');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!open || !tenantId || !token) return;
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
  }, [open, tenantId, token]);

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
    <>
      <button type="button" onClick={() => setOpen(true)}>Rate tenant</button>

      {open && (
        <ModalShell title="Tenancy reputation" onClose={() => setOpen(false)}>
          <div className="tenant-rating-panel">
            {loading && <Skeleton rows={2} />}

            {!loading && reputation?.tenantEmail === null && (
              <p className="tenant-rating-panel__no-email">
                This tenant has no email on file, so ratings can't be linked to their portable reputation yet.
                Add one via <strong>Edit details</strong> first.
              </p>
            )}

            {!loading && reputation?.tenantEmail !== null && (
              <>
                <StarDisplay average={reputation?.averageRating} total={reputation?.totalRatings} />
                {reputation?.priorLandlordCount > 1 && (
                  <p className="tenant-rating-panel__note">Rated by {reputation.priorLandlordCount} landlords, portable across moves.</p>
                )}

                <div className="tenant-rating-panel__by-role">
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <div key={role} className="tenant-rating-panel__role-row">
                      <span className="tenant-rating-panel__role-label">{label}</span>
                      <StarDisplay average={reputation?.byRole?.[role]?.average} total={reputation?.byRole?.[role]?.count} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {!loading && reputation?.tenantEmail !== null && !showForm && (
              <button type="button" className="tenant-rating-panel__rate-btn" onClick={() => setShowForm(true)}>
                {reputation?.totalRatings ? 'Add / update my rating' : 'Rate this tenant'}
              </button>
            )}

            {reputation?.tenantEmail !== null && showForm && (
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
                  placeholder="Optional note for your own records (not shown anywhere in the app)"
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
        </ModalShell>
      )}
    </>
  );
}
