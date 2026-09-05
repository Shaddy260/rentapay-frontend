import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import './SupportChatWidget.css';

// AI Support Chat - see rentapay_ai_support_chat_spec.pdf. One widget,
// used identically across every portal (tenant/landlord/manager/
// caretaker) - the backend already knows the role from the token, so
// this component never asks for it (Section 10.1).
export default function SupportChatWidget({ token }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { from: 'user'|'assistant', text, menu? }
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingRating, setPendingRating] = useState(null); // escalation id
  const [ratingDismissed, setRatingDismissed] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  // DIRECT REQUEST (latest): "when one opens the chat, the navigation
  // bar should simply disappear and reappear when they leave." The
  // fullscreen chat already visually covers the nav (see the z-index
  // fix in SupportChatWidget.css), but the nav bar was still mounted
  // and could flash back into view during the chat's open/close
  // transition. Toggling this class lets BottomNav (a totally separate
  // component with no shared parent state) react to the chat's
  // open/closed state via a MutationObserver - see useChatOpenState in
  // BottomNav.jsx - so the two stay in sync without prop-drilling chat
  // state through every page that renders both.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.classList.toggle('support-chat-open', open);
    return () => document.body.classList.remove('support-chat-open');
  }, [open]);

  // DIRECT REQUEST: chat history used to live only in this component's
  // React state, so it vanished the moment the widget unmounted -
  // navigating away, closing the tab, or logging out and back in all
  // reset it to blank even though the backend has been storing every
  // message all along (support_sessions/support_messages - see
  // supportChat.service.js). This pulls that persisted history back on
  // mount so the conversation picks up where it left off instead of
  // starting over. Runs once per token (i.e. once per login), not on
  // every open/close, so re-opening the widget mid-session doesn't
  // re-fetch or lose any messages sent since the last load.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.getSupportChatHistory(token)
      .then((res) => {
        if (cancelled) return;
        const past = (res.messages || []).map((m) => ({ from: m.from, text: m.text }));
        if (past.length) setMessages(past);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Prevent the page behind a full-screen chat from scrolling with it.
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Section 9.1 - the moment the app regains focus (tab/app resume),
  // check for an unrated recent escalation and prompt for a rating.
  useEffect(() => {
    if (!token) return undefined;
    function checkPendingRating() {
      if (document.visibilityState !== 'visible') return;
      api.getPendingSupportRating(token)
        .then((res) => {
          if (res.escalation) {
            setPendingRating(res.escalation.id);
            setRatingDismissed(false);
          }
        })
        .catch(() => {});
    }
    checkPendingRating();
    document.addEventListener('visibilitychange', checkPendingRating);
    window.addEventListener('focus', checkPendingRating);
    return () => {
      document.removeEventListener('visibilitychange', checkPendingRating);
      window.removeEventListener('focus', checkPendingRating);
    };
  }, [token]);

  function pushMessage(msg) {
    setMessages((prev) => [...prev, msg]);
  }

  function goToAgent(tel) {
    // Section 4 - one clear tap, no manual copy-paste: opens the
    // native dialer directly, pre-filled with RentaPay's support line.
    window.location.href = tel || 'tel:+254710888917';
  }

  async function handleSend(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    pushMessage({ from: 'user', text });
    setSending(true);
    try {
      const res = await api.sendSupportMessage(text, token);
      pushMessage({
        from: 'assistant',
        text: res.reply,
        menu: res.menu || null,
        // DIRECT REQUEST (latest, USSD-style flow): a menu can now be
        // either the top-level category list or a category's numbered
        // submenu - res.category tells a submenu apart from the
        // top-level one, so tapping/typing into it is routed to the
        // right endpoint (see handleMenuSelect below).
        menuCategory: res.category || null,
        offerAgent: !!res.offerAgent,
        offerReason: res.offerReason || null,
        offerCategory: res.offerCategory || null,
        tel: res.escalate ? (res.tel || null) : null,
      });
      if (res.escalate && res.tel) {
        // Escalation already logged server-side (Section 8/7) - the
        // call itself still needs the user's explicit tap, per Section
        // 4 ("no manual copy-paste step" refers to the number, not to
        // skipping the user's own action of placing the call).
      }
    } catch {
      pushMessage({ from: 'assistant', text: "Sorry, something went wrong. You can talk to an agent instead.", offerAgent: true });
    } finally {
      setSending(false);
    }
  }

  // DIRECT REQUEST (latest): "the way USSD code works - you name the
  // menu and the user only enters the number, and the second menu as
  // per the flow comes in." Typing a digit already resolves against
  // the backend's stored pending menu via handleSend/sendSupportMessage
  // - this handles the equivalent TAP on a menu button, routing to the
  // top-level or submenu endpoint depending on which list is showing.
  async function handleMenuSelect(key, menuCategory, offerReason, offerCategory) {
    if (key === 'agent') {
      try {
        // Section 7.2: if this tap came from the repetition-detector's
        // proactive offer, log the real 'repetition' reason so admin
        // analytics can surface "repeated question" as a trend, per the
        // spec - rather than always falling back to menu_exhausted.
        const res = await api.escalateSupportToAgent({ category: offerCategory || menuCategory || null, reason: offerReason || 'menu_exhausted' }, token);
        pushMessage({ from: 'assistant', text: 'Connecting you with a support agent.' });
        goToAgent(res.tel);
      } catch {
        goToAgent();
      }
      return;
    }
    try {
      const res = menuCategory
        ? await api.selectSupportSubmenuOption(menuCategory, key, token)
        : await api.selectSupportMenuOption(key, token);
      // FIX: this used to drop res.tel/res.escalate, so when a category
      // tap resolved straight to an agent handoff (see the LOOP FIX in
      // supportChat.controller.js) there was no "Talk to an agent" call
      // button rendered for it - just plain text with no way to act on
      // it. Mirrors the shape handleSend() already uses for the same reply.
      pushMessage({
        from: 'assistant',
        text: res.reply,
        menu: res.menu || null,
        menuCategory: res.category || null,
        tel: res.escalate ? (res.tel || null) : null,
      });
    } catch {
      pushMessage({ from: 'assistant', text: "Sorry, something went wrong.", offerAgent: true });
    }
  }

  async function handleRate(stars, label) {
    if (!pendingRating) return;
    try {
      await api.submitSupportRating({ escalationId: pendingRating, stars, label }, token);
    } catch {
      // Non-critical - the rating is a nice-to-have, never worth a visible error.
    } finally {
      setPendingRating(null);
    }
  }

  return (
    <>
      {pendingRating && !ratingDismissed && (
        <div className="support-rating-prompt" role="dialog" aria-label="Rate your support call">
          <div className="support-rating-prompt__card">
            <button type="button" className="support-rating-prompt__close" aria-label="Dismiss" onClick={() => setRatingDismissed(true)}>×</button>
            <p>How did your call with our support agent go?</p>
            <div className="support-rating-prompt__stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => handleRate(n, n >= 4 ? 'great' : n >= 3 ? 'ok' : 'not_resolved')}>★</button>
              ))}
            </div>
            <div className="support-rating-prompt__quick">
              <button type="button" onClick={() => handleRate(5, 'great')}>Great</button>
              <button type="button" onClick={() => handleRate(3, 'ok')}>OK</button>
              <button type="button" onClick={() => handleRate(1, 'not_resolved')}>Not resolved</button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="support-chat-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label="Support chat"
        style={open ? { display: 'none' } : undefined}
      >
        💬
      </button>

      {open && (
        <div className="support-chat-window support-chat-window--fullscreen" role="dialog" aria-modal="true" aria-label="RentaPay support chat">
          <div className="support-chat-window__header">
            <span>RentaPay Support</span>
            <button type="button" className="support-chat-window__close" onClick={() => setOpen(false)} aria-label="Close support chat">×</button>
          </div>
          <div className="support-chat-window__list" ref={listRef}>
            {!historyLoaded && messages.length === 0 && (
              <div className="support-chat-window__intro">Loading your conversation…</div>
            )}
            {historyLoaded && messages.length === 0 && (
              <div className="support-chat-window__intro">Ask a question and I'll do my best to help - or tap "Talk to an agent" any time.</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`support-chat-window__msg support-chat-window__msg--${m.from}`}>
                <div className="support-chat-window__bubble">{m.text}</div>
                {m.tel && (
                  <button type="button" className="support-chat-window__agent-btn" onClick={() => goToAgent(m.tel)}>
                    📞 Call support now
                  </button>
                )}
                {m.offerAgent && !m.tel && (
                  <button type="button" className="support-chat-window__agent-btn" onClick={() => handleMenuSelect('agent', m.menuCategory, m.offerReason, m.offerCategory)}>
                    Talk to an agent
                  </button>
                )}
                {m.menu && (
                  <div className="support-chat-window__menu">
                    {m.menu.map((opt, i) => (
                      <button key={opt.key} type="button" onClick={() => handleMenuSelect(opt.key, m.menuCategory)}>
                        {i + 1}. {opt.label}
                      </button>
                    ))}
                    {/* DIRECT REQUEST (latest): USSD-style - name the
                       menu, reply with just the number. The buttons
                       above still work for a tap; this reminds anyone
                       who'd rather type that a bare digit does the
                       same thing (handled server-side in sendMessage). */}
                    <p className="support-chat-window__menu-hint">Or just type the number, e.g. "1".</p>
                  </div>
                )}
              </div>
            ))}
            {sending && <div className="support-chat-window__typing">Typing…</div>}
          </div>
          <form className="support-chat-window__input" onSubmit={handleSend}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your question…"
              disabled={sending}
            />
            <button type="submit" disabled={sending || !draft.trim()}>Send</button>
          </form>
        </div>
      )}
    </>
  );
}
