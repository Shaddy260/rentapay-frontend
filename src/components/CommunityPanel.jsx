import React, { useState, useEffect, useCallback } from 'react';
import Button from './Button.jsx';
import { api } from '../api/client.js';
import './CommunityPanel.css';
import Skeleton from './Skeleton.jsx';
import PhotoLightbox from './PhotoLightbox.jsx';

// Best-effort, UI-only decode of the JWT payload (id/role) so the
// panel can tell "is this my own post" apart from "someone else's" -
// purely cosmetic (whether the Delete button renders at all). The
// backend re-checks ownership on every delete request regardless, so
// there's no security reliance on this being unspoofable.
function decodeTokenPayload(token) {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/**
 * Community board + marketplace - the one tenant<->tenant surface in
 * the app. Separate from AnnouncementBell (landlord->tenant broadcast)
 * and ComplaintsPanel (tenant->landlord, private): this is neighbors
 * talking to neighbors, scoped to a single property.
 *
 * `canModerate`: true for landlord/manager (pin + delete any post),
 * false for tenants (delete only their own). Landlords/managers never
 * have to post here - the panel works fine with zero posts from them.
 */
export default function CommunityPanel({ token, canModerate = false, propertyId }) {
  const [kind, setKind] = useState('board');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [photoFiles, setPhotoFiles] = useState([]); // File[] selected for the new post
  const [photoPreviews, setPhotoPreviews] = useState([]); // matching object URLs
  const [lightbox, setLightbox] = useState(null); // { photos, index, title }

  const currentUser = React.useMemo(() => decodeTokenPayload(token), [token]);
  // Mirrors the backend's authorTypeFor(role) exactly, so "is this my
  // post" lines up with how author_type was actually stored.
  const currentAuthorType = currentUser?.role === 'tenant' ? 'tenant' : currentUser?.role === 'manager' ? 'manager' : 'landlord';

  const MAX_PHOTOS = 5;

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || []).slice(0, MAX_PHOTOS);
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotoFiles(files);
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
    e.target.value = ''; // allow re-selecting the same file(s) later
  }

  function removeSelectedPhoto(index) {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  const load = useCallback(() => {
    setLoading(true);
    api.listCommunityPosts(kind, token, propertyId)
      .then((res) => {
        const loadedPosts = res.posts || [];
        setPosts(loadedPosts);
        // NOTIFICATION COUNTER (direct request): viewing this panel is
        // what "reads" it - mark every post just fetched as seen, then
        // tell the sidebar badge to refresh so it drops immediately
        // instead of waiting for the next 20s poll tick.
        const postIds = loadedPosts.map((p) => p.id);
        if (postIds.length) {
          api.markCommunityRead(postIds, token)
            .then(() => window.dispatchEvent(new Event('rentapay:community-read')))
            .catch(() => {});
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [kind, token, propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitPost(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const payload = { kind, title: title.trim() || undefined, body: body.trim(), price: kind === 'marketplace' && price ? Number(price) : undefined, propertyId };
      if (photoFiles.length > 0) {
        await api.createCommunityPostWithPhotos(payload, photoFiles, token);
      } else {
        await api.createCommunityPost(payload, token);
      }
      setTitle('');
      setBody('');
      setPrice('');
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const [reportTarget, setReportTarget] = useState(null); // { postId?, replyId? }
  const [reportReason, setReportReason] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');

  // DIRECT REQUEST: "each user should be able to delete the messages
  // in their own inbox - when one deletes, it should delete for
  // himself only, except for landlord/manager/caretaker who can
  // choose to delete for all or for themselves." A regular tenant's
  // only option is "delete for me" (hide), even for their own post -
  // canModerate accounts get both.
  async function deletePostForEveryone(postId) {
    if (!window.confirm('Delete this post for everyone? This cannot be undone.')) return;
    try {
      await api.deleteCommunityPost(postId, token);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function hidePostForMe(postId) {
    try {
      await api.hideCommunityPost(postId, token);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteReplyForEveryone(replyId) {
    if (!window.confirm('Delete this reply for everyone? This cannot be undone.')) return;
    try {
      await api.deleteCommunityReply(replyId, token);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function hideReplyForMe(replyId) {
    try {
      await api.hideCommunityReply(replyId, token);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  // FEATURE (direct request): flag a post/reply as violating
  // RentaPay's terms - hate speech, nudity/sexual content, etc.
  async function submitReport() {
    if (!reportReason.trim()) {
      setReportError('Please explain why you are reporting this.');
      return;
    }
    setReportBusy(true);
    setReportError('');
    try {
      await api.reportCommunityContent({ ...reportTarget, reason: reportReason.trim() }, token);
      setReportTarget(null);
      setReportReason('');
    } catch (err) {
      setReportError(err.message || 'Failed to submit report.');
    } finally {
      setReportBusy(false);
    }
  }

  async function togglePin(post) {
    try {
      await api.pinCommunityPost(post.id, !post.is_pinned, token);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitReply(postId) {
    const text = (replyDrafts[postId] || '').trim();
    if (!text) return;
    try {
      await api.replyToCommunityPost(postId, text, token);
      setReplyDrafts((prev) => ({ ...prev, [postId]: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="community-panel">
      <div className="community-panel__header">
        <div className="community-panel__tabs">
          <button className={`community-panel__tab ${kind === 'board' ? 'active' : ''}`} onClick={() => setKind('board')}>
            Board
          </button>
          <button className={`community-panel__tab ${kind === 'marketplace' ? 'active' : ''}`} onClick={() => setKind('marketplace')}>
            Marketplace
          </button>
        </div>
        {!canModerate && (
          <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : kind === 'board' ? '+ Post' : '+ List Item'}
          </Button>
        )}
      </div>

      {kind === 'board' && (
        <p className="community-panel__hint">
          Day-to-day building life - a good plumber, a lost pet, borrowing a tool, carpooling. Not for rent or maintenance issues.
        </p>
      )}
      {kind === 'marketplace' && (
        <p className="community-panel__hint">
          Selling or giving away furniture when you move out, splitting a bulk delivery, recommending someone you trust. Peer-to-peer - not handled by your landlord.
        </p>
      )}

      {error && <p className="community-panel__error">{error}</p>}

      {showForm && !canModerate && (
        <form className="community-panel__form" onSubmit={submitPost}>
          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
          <textarea
            placeholder={kind === 'board' ? "What's going on? e.g. \"Anyone know a reliable plumber?\"" : 'What are you selling/giving away/looking for?'}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            required
          />
          {kind === 'marketplace' && (
            <input
              type="number"
              placeholder="Price (KES, leave blank if free/N/A)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="0"
            />
          )}
          <label className="community-panel__photo-attach">
            📷 Attach photos (up to {MAX_PHOTOS})
            <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} hidden />
          </label>
          {photoPreviews.length > 0 && (
            <div className="community-panel__photo-previews">
              {photoPreviews.map((url, i) => (
                <div className="community-panel__photo-preview" key={url}>
                  <img src={url} alt={`Attachment ${i + 1}`} />
                  <button type="button" className="community-panel__photo-remove" onClick={() => removeSelectedPhoto(i)} aria-label="Remove photo">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Posting…' : 'Post'}
          </Button>
        </form>
      )}

      {loading ? (
        <Skeleton rows={3} />
      ) : posts.length === 0 ? (
        <p className="community-panel__empty">
          {kind === 'board' ? 'No posts yet. Be the first to say hello to your neighbors.' : 'Nothing listed yet.'}
        </p>
      ) : (
        <ul className="community-panel__list">
          {posts.map((post) => (
            <li key={post.id} className={`community-panel__post ${post.is_pinned ? 'pinned' : ''}`}>
              <div className="community-panel__post-header">
                <span className="community-panel__author">{post.authorName}</span>
                <span className="community-panel__date">{new Date(post.created_at).toLocaleDateString('en-GB')}</span>
                {post.is_pinned && <span className="community-panel__pin-badge">Pinned</span>}
              </div>
              {post.title && <h4 className="community-panel__post-title">{post.title}</h4>}
              <p className="community-panel__post-body">{post.body}</p>
              {post.price != null && <p className="community-panel__price">KES {Number(post.price).toLocaleString()}</p>}

              {(() => {
                const photos = (Array.isArray(post.photo_urls) && post.photo_urls.length ? post.photo_urls : post.photo_url ? [post.photo_url] : []);
                if (photos.length === 0) return null;
                return (
                  <div className={`community-panel__gallery community-panel__gallery--count-${Math.min(photos.length, 4)}`}>
                    {photos.slice(0, 4).map((url, i) => (
                      <button
                        type="button"
                        key={url}
                        className="community-panel__gallery-item"
                        onClick={() => setLightbox({ photos, index: i, title: post.title || 'Post photo' })}
                        aria-label={`View photo ${i + 1} of ${photos.length}`}
                      >
                        <img src={url} alt="" loading="lazy" />
                        {i === 3 && photos.length > 4 && <span className="community-panel__gallery-more">+{photos.length - 4}</span>}
                      </button>
                    ))}
                  </div>
                );
              })()}

              <div className="community-panel__post-actions">
                {canModerate && (
                  <button className="ghost-link" onClick={() => togglePin(post)}>
                    {post.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                )}
                {/* DIRECT REQUEST: every user can remove ANY post from
                    their own view ("delete for me") - not just their
                    own posts. Landlord/manager/caretaker additionally
                    get "Delete for everyone" (the real, moderator-only
                    delete). A tenant's own post is no exception - it
                    only ever hides for them, same as anyone else's. */}
                <button className="ghost-link" onClick={() => hidePostForMe(post.id)}>
                  {canModerate ? 'Delete for me' : 'Delete'}
                </button>
                {canModerate && (
                  <button className="ghost-link" onClick={() => deletePostForEveryone(post.id)}>
                    Delete for everyone
                  </button>
                )}
                {!(post.author_type === currentAuthorType && post.author_id === currentUser?.id) && (
                  <button className="ghost-link" onClick={() => { setReportTarget({ postId: post.id }); setReportError(''); }}>
                    Report
                  </button>
                )}
              </div>

              {(post.community_post_replies || []).length > 0 && (
                <ul className="community-panel__replies">
                  {post.community_post_replies.map((r) => (
                    <li key={r.id} className="community-panel__reply">
                      <span className="community-panel__author">{r.authorName}</span>
                      <span>{r.body}</span>
                      {!(r.author_type === currentAuthorType && r.author_id === currentUser?.id) && (
                        <button className="ghost-link" onClick={() => { setReportTarget({ replyId: r.id }); setReportError(''); }}>
                          Report
                        </button>
                      )}
                      {canModerate && (
                        <button className="ghost-link" onClick={() => deleteReplyForEveryone(r.id)}>
                          Delete for everyone
                        </button>
                      )}
                      <button className="ghost-link" onClick={() => hideReplyForMe(r.id)}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="community-panel__reply-form">
                <input
                  type="text"
                  placeholder="Reply…"
                  value={replyDrafts[post.id] || ''}
                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitReply(post.id);
                  }}
                />
                <button className="ghost-link" onClick={() => submitReply(post.id)}>
                  Reply
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          title={lightbox.title}
          onIndexChange={(i) => setLightbox((prev) => ({ ...prev, index: i }))}
          onClose={() => setLightbox(null)}
        />
      )}

      {reportTarget && (
        <div className="modal-overlay" onClick={() => setReportTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <h3>Report this {reportTarget.replyId ? 'reply' : 'post'}</h3>
              <button className="modal-card__close" onClick={() => setReportTarget(null)}>×</button>
            </div>
            <div className="modal-form">
              <p>
                Report content that violates RentaPay's terms - hate speech, nudity or sexual
                content, harassment, or anything similarly inappropriate. Your landlord, manager,
                or caretaker (and RentaPay) will review it.
              </p>
              {reportError && <p className="modal-error">{reportError}</p>}
              <textarea
                placeholder="Why are you reporting this?"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={3}
                required
              />
              <Button variant="primary" loading={reportBusy} onClick={submitReport}>Submit report</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
