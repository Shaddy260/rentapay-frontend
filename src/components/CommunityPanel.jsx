import React, { useState, useEffect, useCallback } from 'react';
import Button from './Button.jsx';
import { api } from '../api/client.js';
import './CommunityPanel.css';
import Skeleton from './Skeleton.jsx';

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

  const load = useCallback(() => {
    setLoading(true);
    api.listCommunityPosts(kind, token, propertyId)
      .then((res) => setPosts(res.posts || []))
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
      await api.createCommunityPost(
        { kind, title: title.trim() || undefined, body: body.trim(), price: kind === 'marketplace' && price ? Number(price) : undefined, propertyId },
        token
      );
      setTitle('');
      setBody('');
      setPrice('');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(postId) {
    if (!window.confirm('Delete this post?')) return;
    try {
      await api.deleteCommunityPost(postId, token);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      setError(err.message);
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

  async function deleteReply(replyId) {
    if (!window.confirm('Delete this reply?')) return;
    try {
      await api.deleteCommunityReply(replyId, token);
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

              <div className="community-panel__post-actions">
                {canModerate && (
                  <button className="ghost-link" onClick={() => togglePin(post)}>
                    {post.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                )}
                <button className="ghost-link" onClick={() => deletePost(post.id)}>
                  Delete
                </button>
              </div>

              {(post.community_post_replies || []).length > 0 && (
                <ul className="community-panel__replies">
                  {post.community_post_replies.map((r) => (
                    <li key={r.id} className="community-panel__reply">
                      <span className="community-panel__author">{r.authorName}</span>
                      <span>{r.body}</span>
                      <button className="ghost-link" onClick={() => deleteReply(r.id)}>
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
    </section>
  );
}
