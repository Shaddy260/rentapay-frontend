import React, { useState, useEffect } from 'react';
import Avatar from './Avatar.jsx';
import { api } from '../api/client.js';
import './TenantContactCard.css';
import Skeleton from './Skeleton.jsx';

/** Read-only 1-5 star display; `null` average renders "Not yet rated". */
function StarDisplay({ average, total }) {
  if (!average) return <span className="tenant-contact-card__no-rating">Not yet rated</span>;
  const rounded = Math.round(average);
  return (
    <span className="tenant-contact-card__stars" title={`${average} out of 5 from ${total} rating(s)`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rounded ? 'star star--filled' : 'star'}>★</span>
      ))}
      <span className="tenant-contact-card__stars-count"> {average} ({total})</span>
    </span>
  );
}

// FEATURE (direct request: "there's a UI to rate tenants but it should
// be visible... stars should be visible and displayed in tenant
// banner for every tenant"): the full StarDisplay above (with the
// "(count)" text) is designed for the popover card, where there's
// room. This is the same read-only stars, shrunk to fit right on the
// avatar/banner row itself - so a landlord/manager/caretaker sees at
// a glance how a tenant is rated without having to tap in first.
function InlineStars({ average, total }) {
  if (!average) return null;
  const rounded = Math.round(average);
  return (
    <span className="tenant-contact-card__inline-stars" title={`${average} out of 5 from ${total} rating(s)`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rounded ? 'star star--filled star--inline' : 'star star--inline'}>★</span>
      ))}
    </span>
  );
}

/**
 * Shows a tenant's avatar. Tapping it expands into a small card with
 * their photo (larger), name, and contact details - phone, secondary
 * phone, email, and emergency contact - so a landlord/admin doesn't
 * have to open the full unit/tenant page just to get a phone number.
 *
 * Deliberately self-contained (owns its own open/close state) so it
 * can be dropped into any table row or unit card without the parent
 * needing to track which tenant's modal is open.
 *
 * `token` + `canRate` are optional: pass both to also show the
 * tenant's portable reputation (aggregated across every landlord
 * they've had, not just this one) and let a landlord/manager submit
 * or update a rating for them right from this popover.
 */
// DIRECT REQUEST: every category rated together in one submit.
const CATEGORIES = [
  { key: 'overall', label: 'Overall', required: true },
  { key: 'payment', label: 'Payment reliability', required: false },
  { key: 'property_care', label: 'Property care', required: false },
  { key: 'communication', label: 'Communication', required: false },
  { key: 'conduct', label: 'Conduct', required: false },
];

export default function TenantContactCard({ tenant, size = 32, token, canRate = false }) {
  const [open, setOpen] = useState(false);
  const [reputation, setReputation] = useState(null);
  const [reputationLoading, setReputationLoading] = useState(false);
  const [showRateForm, setShowRateForm] = useState(false);
  const [ratingsByCategory, setRatingsByCategory] = useState({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token || !tenant?.id) return;
    let cancelled = false;
    setReputationLoading(true);
    api
      .getTenantReputation(tenant.id, token)
      .then((res) => {
        if (!cancelled) setReputation(res.reputation);
      })
      .catch(() => {
        if (!cancelled) setReputation(null);
      })
      .finally(() => {
        if (!cancelled) setReputationLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, tenant?.id]);

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
      const res = await api.rateTenant(tenant.id, { ratings }, token);
      setReputation(res.reputation);
      setSubmitted(true);
      setShowRateForm(false);
      setRatingsByCategory({});
      setComment('');
    } catch (err) {
      setSubmitError(err.message || 'Failed to save rating.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!tenant) return <Avatar name="-" size={size} />;

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        className="tenant-contact-trigger"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
        title={`View ${tenant.full_name}'s contact details`}
      >
        <Avatar name={tenant.full_name} photoUrl={tenant.photo_url} size={size} />
        {token && !reputationLoading && (
          <InlineStars average={reputation?.averageRating} total={reputation?.totalRatings} />
        )}
      </span>

      {open && (
        <div
          className="tenant-contact-overlay"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            setShowRateForm(false);
            setSubmitError('');
          }}
        >
          <div className="tenant-contact-card" onClick={(e) => e.stopPropagation()}>
            <button className="tenant-contact-card__close" onClick={() => setOpen(false)}>×</button>
            <Avatar name={tenant.full_name} photoUrl={tenant.photo_url} size={72} />
            <h3 className="tenant-contact-card__name">{tenant.full_name}</h3>
            {tenant.unit_name && <p className="tenant-contact-card__unit">{tenant.unit_name}</p>}

            <div className="tenant-contact-card__details">
              {tenant.primary_phone && (
                <a className="tenant-contact-card__row" href={`tel:${tenant.primary_phone}`}>
                  <span className="tenant-contact-card__label">Phone</span>
                  <span>{tenant.primary_phone}</span>
                </a>
              )}
              {tenant.secondary_phone && (
                <a className="tenant-contact-card__row" href={`tel:${tenant.secondary_phone}`}>
                  <span className="tenant-contact-card__label">Alt. phone</span>
                  <span>{tenant.secondary_phone}</span>
                </a>
              )}
              {tenant.email && (
                <a className="tenant-contact-card__row" href={`mailto:${tenant.email}`}>
                  <span className="tenant-contact-card__label">Email</span>
                  <span>{tenant.email}</span>
                </a>
              )}
              {(tenant.emergency_contact_name || tenant.emergency_contact_phone) && (
                <div className="tenant-contact-card__row tenant-contact-card__row--static">
                  <span className="tenant-contact-card__label">Emergency contact</span>
                  <span>
                    {tenant.emergency_contact_name || '-'}
                    {tenant.emergency_contact_phone ? ` - ${tenant.emergency_contact_phone}` : ''}
                  </span>
                </div>
              )}
              {!tenant.primary_phone && !tenant.email && !tenant.emergency_contact_name && (
                <p className="tenant-contact-card__empty">No contact details on file.</p>
              )}
            </div>

            {token && (
              <div className="tenant-contact-card__reputation">
                <span className="tenant-contact-card__label">Tenancy reputation</span>
                {reputationLoading && <Skeleton rows={1} />}
                {!reputationLoading && reputation && (
                  <>
                    <StarDisplay average={reputation.averageRating} total={reputation.totalRatings} />
                    {reputation.priorLandlordCount > 1 && (
                      <p className="tenant-contact-card__rep-note">Rated by {reputation.priorLandlordCount} landlords, portable across moves.</p>
                    )}
                  </>
                )}

                {canRate && !showRateForm && (
                  <button type="button" className="tenant-contact-card__rate-btn" onClick={() => setShowRateForm(true)}>
                    {submitted ? 'Update rating' : 'Rate this tenant'}
                  </button>
                )}

                {canRate && showRateForm && (
                  <div className="tenant-contact-card__rate-form">
                    {CATEGORIES.map((c) => (
                      <div key={c.key} className="tenant-contact-card__rate-category-row">
                        <span className="tenant-contact-card__rate-category-label">
                          {c.label}{c.required ? '' : ' (optional)'}
                        </span>
                        <div className="tenant-contact-card__rate-stars">
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
                      className="tenant-contact-card__rate-comment"
                      placeholder="Optional comment (e.g. paid on time, took good care of the unit)"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={2}
                    />
                    {submitError && <p className="tenant-contact-card__rate-error">{submitError}</p>}
                    <div className="tenant-contact-card__rate-actions">
                      <button type="button" onClick={() => setShowRateForm(false)} disabled={submitting}>Cancel</button>
                      <button type="button" onClick={submitRating} disabled={submitting} className="tenant-contact-card__rate-submit">
                        {submitting ? 'Saving…' : 'Save all ratings'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
