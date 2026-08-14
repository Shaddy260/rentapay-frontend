import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import CommentReveal from './CommentReveal.jsx';
import './AdminRatingFlags.css';
import InfoTip from './InfoTip.jsx';

const TABLE_LABEL = {
  landlord_ratings: 'Landlord rating',
  staff_ratings: 'Staff rating',
  property_ratings: 'Property rating',
  tenant_ratings: 'Tenant rating (flagged by tenant)',
};

/**
 * GAP CLOSED (direct request): a landlord can now flag a rating as
 * bad-faith (see RatingFlagList.jsx), but a flag sitting forever in
 * 'flagged' status - excluded from the aggregate but never resolved
 * one way or the other - isn't real recourse. This is the other half:
 * a single worklist across all three flaggable tables so an admin can
 * uphold (rating was legitimate, counts again) or remove (confirmed
 * bad-faith, stays excluded) each one.
 */
export default function AdminRatingFlags({ token }) {
  const [status, setStatus] = useState('flagged');
  const [flags, setFlags] = useState(null);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [notes, setNotes] = useState({});

  const load = useCallback(() => {
    setFlags(null);
    api
      .listRatingFlags(status, token)
      .then((res) => setFlags(res.flags || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load rating flags.'));
  }, [status, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(table, id, resolution) {
    const key = `${table}:${id}`;
    setBusyKey(key);
    setError('');
    try {
      await api.resolveRatingFlag(table, id, resolution, notes[key] || '', token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resolve flag.');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="admin-rating-flags">
      <h2>Rating Flags</h2>
      <InfoTip text={<>
        Ratings a landlord has disputed as bad-faith. A flagged rating is excluded from that landlord's aggregate while
        pending — resolve it as upheld (counts again) or removed (stays excluded).
      </>} />

      <div className="admin-rating-flags__filter">
        {['flagged', 'upheld', 'removed'].map((s) => (
          <button
            key={s}
            type="button"
            className={`admin-rating-flags__filter-btn${status === s ? ' admin-rating-flags__filter-btn--active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="admin-rating-flags__error">{error}</p>}

      {!flags ? (
        <Skeleton rows={3} />
      ) : !flags.length ? (
        <p className="admin-rating-flags__empty">No {status} rating flags.</p>
      ) : (
        <ul className="admin-rating-flags__list">
          {flags.map((f) => {
            const key = `${f.table}:${f.id}`;
            return (
              <li key={key} className="admin-rating-flags__item">
                <div className="admin-rating-flags__row">
                  <span className="admin-rating-flags__type">{TABLE_LABEL[f.table] || f.table}</span>
                  <span className="admin-rating-flags__stars">{f.rating} / 5</span>
                  {f.category && <span className="admin-rating-flags__category">{f.category.replace(/_/g, ' ')}</span>}
                </div>
                {f.comment && <CommentReveal text={f.comment} />}
                <p className="admin-rating-flags__reason">
                  <strong>Landlord's reason:</strong> {f.flag_reason}
                </p>
                <p className="admin-rating-flags__meta">
                  Flagged {f.flagged_at ? new Date(f.flagged_at).toLocaleDateString() : '—'}
                  {f.flag_resolved_at ? ` · Resolved ${new Date(f.flag_resolved_at).toLocaleDateString()}` : ''}
                </p>
                {f.flag_resolution_note && (
                  <p className="admin-rating-flags__resolution-note"><strong>Resolution note:</strong> {f.flag_resolution_note}</p>
                )}

                {status === 'flagged' && (
                  <div className="admin-rating-flags__actions">
                    <input
                      type="text"
                      placeholder="Optional resolution note"
                      value={notes[key] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                    <Button disabled={busyKey === key} onClick={() => resolve(f.table, f.id, 'upheld')}>
                      Uphold rating
                    </Button>
                    <Button variant="danger" disabled={busyKey === key} onClick={() => resolve(f.table, f.id, 'removed')}>
                      Remove rating
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
