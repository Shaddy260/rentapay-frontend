import React, { useEffect, useState, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import './ChatThreadList.css';

const POLL_MS = 6000;

/**
 * Inbox-style list of conversations. Used by:
 *   - Admin Messages tab (every landlord + tenant who has written in)
 *   - Landlord "Text your tenant" list (their admin thread + each tenant)
 *   - Tenant chat popup (their admin thread + their landlord thread)
 *
 * Props: token, role, onSelect(thread), selectedKey (to highlight)
 */
export default function ChatThreadList({ token, onSelect, selectedKey }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.listChatThreads(token);
      setThreads(res.threads || []);
      setError('');
    } catch (err) {
      if (!silent) setError(err instanceof ApiError ? err.message : 'Failed to load conversations.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function keyOf(t) {
    return `${t.threadType}:${t.landlordId || ''}:${t.tenantId || ''}:${t.scoutId || ''}`;
  }

  return (
    <div className="chat-thread-list">
      {loading && <p className="chat-thread-list__hint">Loading conversations…</p>}
      {error && <p className="chat-thread-list__error">{error}</p>}
      {!loading && threads.length === 0 && <p className="chat-thread-list__hint">No conversations yet.</p>}
      {threads.map((t) => (
        <button
          type="button"
          key={keyOf(t)}
          className={`chat-thread-item ${selectedKey === keyOf(t) ? 'chat-thread-item--active' : ''}`}
          onClick={() => onSelect(t)}
        >
          <div className="chat-thread-item__main">
            <span className="chat-thread-item__name">
              {t.name}
              {t.threadType === 'scout_landlord' && <span className="chat-thread-item__tag"> Scout</span>}
            </span>
            {t.lastMessage && <span className="chat-thread-item__preview">{t.lastMessage}</span>}
          </div>
          {!!t.unreadCount && <span className="chat-thread-item__badge">{t.unreadCount}</span>}
        </button>
      ))}
    </div>
  );
}
