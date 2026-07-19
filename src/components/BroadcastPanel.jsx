import { useState, useEffect, useRef } from 'react';
import Button from './Button.jsx';
import { api, ApiError } from '../api/client.js';

// FIX (direct request): broadcasting used to be a one-shot "type a
// message, hit send, modal closes" composer with no record of what
// was sent before. Moved out of the header (now lives in the side
// menu instead, on every portal) and rebuilt as a running
// conversation - the last thing sent is right there when this opens
// again, the full history scrolls above it, and each message can be
// deleted from here directly.
export default function BroadcastPanel({ token, role, properties, onClose }) {
  const [messages, setMessages] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [audience, setAudience] = useState('all');
  const [propertyId, setPropertyId] = useState('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const scrollRef = useRef(null);

  function load() {
    api.listAnnouncements(token)
      .then((res) => {
        // Only messages THIS account actually sent belong in "the
        // broadcast conversation" - platform-wide notices from admin
        // still show up in the regular notification bell, not mixed
        // into this thread.
        const sent = (res.announcements || []).filter((a) => !a.is_platform).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        setMessages(sent);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load broadcast history.'));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (messages && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    if (audience === 'property' && !propertyId) {
      setError('Pick a property to announce to, or switch to "All tenants".');
      return;
    }
    setSending(true);
    setError('');
    try {
      await api.createAnnouncement({ message: draft.trim(), audience, propertyId: audience === 'property' ? propertyId : undefined }, token);
      setDraft('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send broadcast.');
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(announcementId) {
    setDeletingId(announcementId);
    setError('');
    try {
      // scope 'all' removes it for everyone it was sent to, not just
      // hiding it from this account's own view.
      await api.deleteAnnouncement(announcementId, 'all', token);
      setMessages((prev) => prev.filter((m) => m.id !== announcementId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete that message.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="broadcast-panel" onClick={(e) => e.stopPropagation()}>
        <div className="broadcast-panel__header">
          <h2>Broadcast</h2>
          <button type="button" className="ghost-link" onClick={onClose}>Close</button>
        </div>
        <p className="broadcast-panel__hint">
          Sent messages show up as a bell notification for every tenant (and your {role === 'manager' ? 'team' : 'managers and caretakers'}).
        </p>

        <div className="broadcast-panel__thread" ref={scrollRef}>
          {messages === null && <p className="broadcast-panel__empty">Loading…</p>}
          {messages && messages.length === 0 && <p className="broadcast-panel__empty">No broadcasts sent yet - your first one will show up here.</p>}
          {messages && messages.map((m) => (
            <div key={m.id} className="broadcast-panel__bubble">
              <div className="broadcast-panel__bubble-meta">
                <span>{new Date(m.created_at).toLocaleString()}</span>
                <span>{m.audience === 'property' ? 'One property' : 'All tenants'}</span>
              </div>
              <p className="broadcast-panel__bubble-text">{m.message}</p>
              <button
                type="button"
                className="broadcast-panel__delete"
                disabled={deletingId === m.id}
                onClick={() => handleDelete(m.id)}
              >
                {deletingId === m.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}

        <form className="broadcast-panel__composer" onSubmit={handleSend}>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="broadcast-panel__audience">
            <option value="all">All tenants</option>
            {(properties || []).length > 0 && <option value="property">One property</option>}
          </select>
          {audience === 'property' && (
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="broadcast-panel__audience" required>
              <option value="" disabled>Select a property</option>
              {(properties || []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <textarea
            required
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message to broadcast…"
            className="broadcast-panel__input"
          />
          <Button type="submit" variant="primary" loading={sending}>Send</Button>
        </form>
      </div>
    </div>
  );
}
