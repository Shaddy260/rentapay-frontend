import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import CommentReveal from './CommentReveal.jsx';
import './RatingFlagList.css';
import InfoTip from './InfoTip.jsx';

function Stars({ value }) {
  return (
    <span className="rating-flag-list__stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? 'star star--filled' : 'star'}>★</span>
      ))}
    </span>
  );
}

const FLAG_STATUS_LABEL = {
  none: null,
  flagged: 'Flag pending review',
  upheld: 'Flag reviewed — rating upheld, counts normally',
  removed: 'Flag reviewed — excluded from your average',
};

/**
 * GAP CLOSED (direct request): "nothing stops one aggrieved tenant
 * from tanking a score with no recourse for the landlord to
 * respond/flag it." The aggregate-only panels (MyOwnRatingPanel etc.)
 * deliberately never show individual ratings, for the same
 * anti-retaliation reason tenant-facing reputation is aggregate-only
 * elsewhere - so this is a narrow, separate view: individual rows,
 * but only the rating content (stars/category/comment/date), never
 * who left it. That's enough to recognize a bad-faith entry and flag
 * it without reintroducing the "who said what" exposure problem.
 *
 * `table` is one of landlord_ratings | staff_ratings | property_ratings
 * (must match backend's FLAGGABLE_TABLES).
 */
export default function RatingFlagList({ token, table, title, canFlag = true, propertyId }) {
  const [ratings, setRatings] = useState(null);
  const [error, setError] = useState('');
  const [openFlagId, setOpenFlagId] = useState(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  function load() {
    api
      .listMyRatings(table, token, propertyId)
      .then((res) => setRatings(res.ratings || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load ratings.'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, table, propertyId]);

  async function submitFlag(id) {
    const trimmed = reason.trim();
    if (!trimmed) {
      setActionError('Please explain why you believe this rating is in bad faith.');
      return;
    }
    setBusyId(id);
    setActionError('');
    try {
      await api.flagRating(table, id, trimmed, token);
      setOpenFlagId(null);
      setReason('');
      setNotice('Rating flagged for review. It’s excluded from your average while pending.');
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to flag rating.');
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <p className="dashboard-main__empty">{error}</p>;
  if (!ratings) return null;
  if (!ratings.length) return null;

  return (
    <div className="rating-flag-list">
      <h4>{title || 'Individual ratings'}</h4>
      <InfoTip text={<>
        Shown here (and only here) so you can recognize and dispute a specific rating — never anywhere a tenant's name
        is attached.
      </>} />
      {notice && <p className="rating-flag-list__notice">{notice}</p>}
      <ul className="rating-flag-list__items">
        {ratings.map((r) => (
          <li key={r.id} className="rating-flag-list__item">
            <div className="rating-flag-list__row">
              <Stars value={r.rating} />
              {r.category && <span className="rating-flag-list__category">{r.category.replace(/_/g, ' ')}</span>}
              <span className="rating-flag-list__date">{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            {r.comment && <CommentReveal text={r.comment} />}

            {r.flag_status !== 'none' && (
              <p className={`rating-flag-list__status rating-flag-list__status--${r.flag_status}`}>
                {FLAG_STATUS_LABEL[r.flag_status]}
                {r.flag_resolution_note ? ` — ${r.flag_resolution_note}` : ''}
              </p>
            )}

            {canFlag && r.flag_status === 'none' && openFlagId !== r.id && (
              <Button variant="ghost" onClick={() => { setOpenFlagId(r.id); setReason(''); setActionError(''); }}>
                Flag as bad-faith
              </Button>
            )}

            {openFlagId === r.id && (
              <div className="rating-flag-list__flag-form">
                <label className="form-field__label" htmlFor={`flag-reason-${r.id}`}>
                  Why do you believe this rating is in bad faith?
                </label>
                <textarea
                  id={`flag-reason-${r.id}`}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. this tenant left the day before move-out inspection after a deposit dispute"
                />
                {actionError && <p className="rating-flag-list__error">{actionError}</p>}
                <div className="rating-flag-list__flag-actions">
                  <Button disabled={busyId === r.id} onClick={() => submitFlag(r.id)}>
                    {busyId === r.id ? 'Submitting…' : 'Submit flag'}
                  </Button>
                  <Button variant="ghost" disabled={busyId === r.id} onClick={() => setOpenFlagId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
