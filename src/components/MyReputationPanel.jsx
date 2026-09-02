import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import './TenantReputationsPanel.css';
import './MyReputationPanel.css';
import Skeleton from './Skeleton.jsx';
import CommentReveal from './CommentReveal.jsx';
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

const CATEGORY_LABELS = {
  overall: 'Overall',
  payment: 'Payment reliability',
  property_care: 'Property care',
  communication: 'Communication',
  conduct: 'Conduct',
};

/**
 * Direct request: the tenant should be able to see their own
 * reputation profile before/same as any landlord does - same
 * distilled, email-portable aggregate a new landlord would see
 * (never raw amounts/dates from another landlord's ledger), scoped
 * server-side so a tenant can only ever fetch their own.
 *
 * FEATURE (direct request): tenants get the same recourse landlords
 * already have (ratingFlag.controller.js / MyOwnRatingPanel.jsx) -
 * every individual rating is now listed (not just the ones with a
 * comment) with WHO left it, and a "Flag as unfair" action per rating
 * instead of the old passive "contact support" line. See
 * 2026-07-tenant-rating-flag.sql for why attribution is fine to show
 * here even though the landlord-side ratings deliberately hide it.
 */
export default function MyReputationPanel({ token, tenantId }) {
  const [reputation, setReputation] = useState(null);
  const [error, setError] = useState('');
  const [flaggingId, setFlaggingId] = useState(null);
  const [flagReason, setFlagReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState('');

  // FEATURE (direct request #4): opt-in shareable link to this
  // reputation summary, for pasting into a WhatsApp inquiry to a
  // landlord about a vacant unit. Generated on demand, never
  // automatically - the tenant decides when/whether to share it.
  const [shareUrl, setShareUrl] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');
  const [copied, setCopied] = useState(false);

  async function generateShareLink() {
    setShareLoading(true);
    setShareError('');
    try {
      const res = await api.getMyReputationShareLink(token);
      setShareUrl(res.shareUrl);
    } catch (err) {
      setShareError(err instanceof ApiError ? err.message : 'Failed to generate share link.');
    } finally {
      setShareLoading(false);
    }
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable - link is still shown as selectable text
    }
  }

  function load() {
    if (!tenantId) return;
    api
      .getTenantReputation(tenantId, token)
      .then((res) => setReputation(res.reputation))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your reputation.'));
  }

  useEffect(load, [token, tenantId]);

  async function submitFlag(ratingId) {
    if (!flagReason.trim()) {
      setSubmitError('Please explain why you believe this rating is unfair.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.flagTenantRating(ratingId, { reason: flagReason.trim() }, token);
      setReputation(res.reputation);
      setFlaggingId(null);
      setFlagReason('');
      setNotice('Rating flagged for review. It will be excluded from your average while pending.');
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to flag rating.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <p className="dashboard-main__empty">{error}</p>;
  if (!reputation) return <Skeleton rows={2} />;

  if (!reputation.totalRatings) {
    return (
      <div className="my-reputation-panel">
        <h3>My Tenancy Reputation</h3>
        <p className="my-reputation-panel__empty">
          No landlord has rated you yet. Once they do, your score will appear here first - and it's the same score that will
          follow you (by this email address) to any future landlord who adds you on RentaPay.
        </p>
        <div style={{ marginTop: 16, padding: 12, background: 'var(--color-success-bg)', border: '1px solid var(--color-hairline)', borderRadius: 10 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#333' }}>
            You can still share your (currently empty) RentaPay profile link with a landlord - it'll fill in automatically
            as ratings come in.
          </p>
          {!shareUrl ? (
            <button type="button" onClick={generateShareLink} disabled={shareLoading} style={{ background: '#1f7a3f', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13 }}>
              {shareLoading ? 'Generating…' : 'Get shareable link'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 200, padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #ccc' }} />
              <button type="button" onClick={copyShareLink} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #1f7a3f', background: copied ? '#1f7a3f' : '#fff', color: copied ? '#fff' : '#1f7a3f', cursor: 'pointer', fontSize: 12 }}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
          {shareError && <p style={{ color: '#a33', fontSize: 12, marginTop: 6 }}>{shareError}</p>}
        </div>
      </div>
    );
  }

  const shareSection = (
    <div style={{ marginTop: 16, padding: 12, background: 'var(--color-success-bg)', border: '1px solid var(--color-hairline)', borderRadius: 10 }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#333' }}>
        Contacting a landlord about a vacant unit? Share this score with them - it's optional, and only your score is
        shown, never individual comments.
      </p>
      {!shareUrl ? (
        <button
          type="button"
          onClick={generateShareLink}
          disabled={shareLoading}
          style={{ background: '#1f7a3f', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13 }}
        >
          {shareLoading ? 'Generating…' : 'Get shareable link'}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 200, padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #ccc' }} />
          <button type="button" onClick={copyShareLink} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #1f7a3f', background: copied ? '#1f7a3f' : '#fff', color: copied ? '#fff' : '#1f7a3f', cursor: 'pointer', fontSize: 12 }}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      {shareError && <p style={{ color: '#a33', fontSize: 12, marginTop: 6 }}>{shareError}</p>}
    </div>
  );

  return (
    <div className="my-reputation-panel">
      <h3>My Tenancy Reputation</h3>
      <InfoTip text={<>
        This is portable - it's built from every rating any landlord has left for you on RentaPay, and it's the same summary
        a new landlord will see if they add you using this email address.
      </>} />

      <div className="my-reputation-panel__summary">
        <BigStars average={reputation.averageRating} />
        <span className="my-reputation-panel__score">{reputation.averageRating} / 5</span>
        <span className="my-reputation-panel__meta">
          {reputation.totalRatings} rating{reputation.totalRatings === 1 ? '' : 's'} from {reputation.priorLandlordCount} landlord{reputation.priorLandlordCount === 1 ? '' : 's'}
        </span>
      </div>

      {Object.keys(reputation.byCategory || {}).length > 1 && (
        <div className="my-reputation-panel__categories">
          {Object.entries(reputation.byCategory).map(([cat, stats]) => (
            <div key={cat} className="my-reputation-panel__category-row">
              <span className="my-reputation-panel__category-label">{cat.replace('_', ' ')}</span>
              <span>{stats.average} / 5 ({stats.count})</span>
            </div>
          ))}
        </div>
      )}

      {notice && <p className="my-reputation-panel__notice">{notice}</p>}

      {reputation.ratings?.length > 0 && (
        <div className="my-reputation-panel__comments">
          <h4>Individual ratings</h4>
          {reputation.ratings.map((r) => (
            <div key={r.id} className="my-reputation-panel__comment">
              <div className="my-reputation-panel__comment-head">
                <span>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className="my-reputation-panel__comment-landlord">{r.landlordName}</span>
                <span className="my-reputation-panel__comment-category">{CATEGORY_LABELS[r.category] || r.category}</span>
              </div>
              {r.comment && <CommentReveal text={r.comment} />}

              {r.flagStatus === 'none' && flaggingId !== r.id && (
                <button type="button" className="my-reputation-panel__flag-btn" onClick={() => { setFlaggingId(r.id); setSubmitError(''); }}>
                  Flag as unfair
                </button>
              )}
              {r.flagStatus === 'flagged' && <span className="my-reputation-panel__flag-status">Flagged - pending review, excluded from your average.</span>}
              {r.flagStatus === 'upheld' && <span className="my-reputation-panel__flag-status">Reviewed - kept as-is.</span>}
              {r.flagStatus === 'removed' && <span className="my-reputation-panel__flag-status">Reviewed - removed from your average.</span>}

              {flaggingId === r.id && (
                <div className="my-reputation-panel__flag-form">
                  <textarea
                    placeholder="Why do you believe this rating is unfair?"
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    rows={2}
                  />
                  {submitError && <p className="my-reputation-panel__flag-error">{submitError}</p>}
                  <div className="my-reputation-panel__flag-actions">
                    <button type="button" onClick={() => { setFlaggingId(null); setFlagReason(''); setSubmitError(''); }} disabled={submitting}>Cancel</button>
                    <button type="button" className="my-reputation-panel__flag-submit" onClick={() => submitFlag(r.id)} disabled={submitting}>
                      {submitting ? 'Submitting…' : 'Submit flag'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {shareSection}
    </div>
  );
}
