import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import './ChatConversation.css';

const POLL_MS = 4000;

/**
 * One open conversation. Works for all three thread types:
 *   admin_landlord, admin_tenant, landlord_tenant
 *
 * Tapping "Reply" on any bubble greys it out and quotes it above the
 * input box (exactly like WhatsApp) - sending then attaches
 * reply_to_id so the other side sees the same quote above the new
 * message.
 *
 * Props:
 *   token, role ('admin' | 'landlord' | 'tenant')
 *   thread: { threadType, landlordId?, tenantId?, name }
 *   onBack: optional - shows a back button (used in the popup widget)
 */
export default function ChatConversation({ token, role, roleLevel = null, thread, onBack, initialReplyTo = null }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(initialReplyTo);
  const [sending, setSending] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // FIX (direct request: "when an admin taps reply to a help request,
  // it should show the message he is replying to, so the other user
  // understands why"): initialReplyTo is only used as useState's
  // starting value, which only applies on the very FIRST mount - this
  // component stays mounted across thread switches (no `key` prop),
  // so tapping Reply on a second help request later wouldn't refresh
  // the quote without this effect explicitly re-applying it whenever
  // it changes.
  useEffect(() => {
    if (initialReplyTo) setReplyTo(initialReplyTo);
  }, [initialReplyTo]);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await api.listChatMessages(
        { threadType: thread.threadType, landlordId: thread.landlordId, tenantId: thread.tenantId, scoutId: thread.scoutId },
        token
      );
      setMessages(res.messages || []);
    } catch (err) {
      if (!silent) setError(err instanceof ApiError ? err.message : 'Failed to load messages.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, thread.threadType, thread.landlordId, thread.tenantId, thread.scoutId]);

  useEffect(() => {
    load(false);
    pollRef.current = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.threadType, thread.landlordId, thread.tenantId, thread.scoutId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await api.sendChatMessage(
        {
          threadType: thread.threadType,
          landlordId: thread.landlordId,
          tenantId: thread.tenantId,
          scoutId: thread.scoutId,
          body: draft.trim(),
          replyToId: replyTo?.id || null,
        },
        token
      );
      setDraft('');
      setReplyTo(null);
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    setBlocked(false);
  }, [thread.threadType, thread.landlordId, thread.scoutId]);

  async function handleBlockScout() {
    if (blocking || blocked) return;
    if (!window.confirm("Block this scout? They won't be able to message you or see your units.")) return;
    setBlocking(true);
    setError('');
    try {
      await api.blockScout(thread.scoutId, token);
      setBlocked(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to block scout.');
    } finally {
      setBlocking(false);
    }
  }

  async function handleDelete(message, scope) {
    setOpenMenuId(null);
    try {
      await api.deleteChatMessage(message.id, scope, token);
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete message.');
    }
  }

  // Mirrors the backend's rules so we only show a "Delete for everyone"
  // option when it would actually be allowed - the backend is still
  // the real gate, this is just so the button isn't misleading.
  function canDeleteForEveryone(m) {
    if (m.sender_role === 'admin') return false; // RentaPay messages: never
    const mine = m.sender_role === role;
    const isCaretakerMessage = m.sender_role === 'manager' && m.sender_role_level === 'caretaker';
    const isFullManagerOrLandlord = role === 'landlord' || (role === 'manager' && roleLevel !== 'caretaker');
    if (isCaretakerMessage) return isFullManagerOrLandlord; // never the caretaker themselves
    return mine || isFullManagerOrLandlord;
  }

  // FIX (direct request): "arrange messages in years, months, days...
  // well organized" - a long-running conversation used to render as
  // one flat, undated scroll of bubbles. This groups them into the
  // same WhatsApp-style day dividers used elsewhere in the app
  // (Today / Yesterday / 12 July 2026), computed fresh each render
  // rather than stored, so it costs nothing extra server-side.
  function dayKeyOf(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dayLabelOf(iso) {
    const key = dayKeyOf(iso);
    const todayKey = dayKeyOf(new Date().toISOString());
    const yesterdayKey = dayKeyOf(new Date(Date.now() - 86400000).toISOString());
    if (key === todayKey) return 'Today';
    if (key === yesterdayKey) return 'Yesterday';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  return (
    <div className="chat-conversation">
      <div className="chat-conversation__header">
        {onBack && (
          <button type="button" className="chat-conversation__back" onClick={onBack} aria-label="Back">‹</button>
        )}
        <h4>{thread.name}</h4>
        {role === 'landlord' && thread.threadType === 'scout_landlord' && (
          blocked ? (
            <span className="chat-conversation__blocked-tag">Blocked</span>
          ) : (
            <button type="button" className="chat-conversation__block-btn" onClick={handleBlockScout} disabled={blocking}>
              {blocking ? 'Blocking…' : 'Block this scout'}
            </button>
          )
        )}
      </div>

      <div className="chat-conversation__messages">
        {loading && <p className="chat-conversation__hint">Loading conversation…</p>}
        {!loading && messages.length === 0 && <p className="chat-conversation__hint">No messages yet — say hello 👋</p>}
        {!loading && messages.map((m, i) => {
          const mine = m.sender_role === role;
          const deleted = m.deletedForEveryone || m.deleted_for_everyone;
          const showDayDivider = i === 0 || dayKeyOf(m.created_at) !== dayKeyOf(messages[i - 1].created_at);
          return (
            <React.Fragment key={m.id}>
              {showDayDivider && (
                <div className="chat-conversation__day-divider">
                  <span>{dayLabelOf(m.created_at)}</span>
                </div>
              )}
              <div className={`chat-bubble-row ${mine ? 'chat-bubble-row--mine' : ''}`}>
              <div className={`chat-bubble ${mine ? 'chat-bubble--mine' : ''}`}>
                {m.reply_to && !deleted && (
                  <div className="chat-bubble__quote">
                    <span className="chat-bubble__quote-name">{m.reply_to.sender_name}</span>
                    <span className="chat-bubble__quote-body">{m.reply_to.body}</span>
                  </div>
                )}
                {!mine && <div className="chat-bubble__sender">{m.sender_name}</div>}
                {deleted ? (
                  <div className="chat-bubble__body chat-bubble__body--deleted">This message was deleted</div>
                ) : (
                  <div className="chat-bubble__body">{m.body}</div>
                )}
                <div className="chat-bubble__meta">
                  <span>{new Date(m.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {!deleted && (
                    <>
                      <button type="button" className="chat-bubble__reply-btn" onClick={() => setReplyTo(m)}>Reply</button>
                      <button
                        type="button"
                        className="chat-bubble__reply-btn"
                        onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                        aria-label="Message options"
                      >
                        ⋯
                      </button>
                    </>
                  )}
                </div>
                {openMenuId === m.id && !deleted && (
                  <div className="chat-bubble__menu">
                    <button type="button" onClick={() => handleDelete(m, 'self')}>Delete for me</button>
                    {canDeleteForEveryone(m) && (
                      <button type="button" onClick={() => handleDelete(m, 'everyone')}>Delete for everyone</button>
                    )}
                    <button type="button" onClick={() => setOpenMenuId(null)}>Cancel</button>
                  </div>
                )}
              </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="chat-conversation__error">{error}</p>}

      {replyTo && (
        <div className="chat-reply-preview">
          <div className="chat-reply-preview__body">
            <span className="chat-reply-preview__name">Replying to {replyTo.sender_name}</span>
            <span className="chat-reply-preview__text">{replyTo.body}</span>
          </div>
          <button type="button" className="chat-reply-preview__cancel" onClick={() => setReplyTo(null)} aria-label="Cancel reply">×</button>
        </div>
      )}

      <form className="chat-conversation__input-row" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={sending || blocked}
        />
        <button type="submit" disabled={sending || blocked || !draft.trim()}>{sending ? '…' : 'Send'}</button>
      </form>
    </div>
  );
}
