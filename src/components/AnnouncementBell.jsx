import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useSharedPoll } from '../utils/sharedPoll.js';
import './AnnouncementBell.css';

// A bell icon with an unread-count badge, used in every non-admin
// portal (landlord, manager, caretaker, tenant). Composing a new
// announcement is a separate component (AnnouncementComposer, now
// also available to caretakers per direct request).
//
// `role`: 'tenant' | 'landlord' | 'manager' (manager covers both full
// property managers and caretakers - the delete permissions are the
// same for both). Used purely to decide which delete options this
// viewer gets - the backend enforces the real rules regardless.
//
// Polls every 30s rather than a real websocket connection - "real
// time" here means "within 30 seconds", which is fine for an
// announcement (not a chat). If true push delivery is needed later,
// this is the one place that would need to change.
export default function AnnouncementBell({ token, role, propertyId }) {
  const [announcements, setAnnouncements] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [deleteMenuFor, setDeleteMenuFor] = useState(null); // announcement id whose "delete" options are showing
  const [deletingId, setDeletingId] = useState(null);
  const containerRef = useRef(null);

  function load() {
    if (!token) return;
    api.listAnnouncements(token, propertyId)
      .then((res) => {
        setAnnouncements(res.announcements || []);
        setUnreadCount(res.unreadCount || 0);
      })
      .catch(() => {}); // silent - a failed bell refresh shouldn't interrupt the portal
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, propertyId]);

  // FIX: this used to own its own independent setInterval(load, 30000)
  // - now rides the app-wide shared tick instead, alongside
  // NotificationsBell/PendingPaymentsBell/messages-badge polling, so a
  // portal isn't running 4-5 separate timers at once.
  useSharedPoll(load, 30000);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setDeleteMenuFor(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleOpen() {
    setOpen((v) => !v);
  }

  function handleItemClick(a) {
    if (!a.isRead) {
      api.markAnnouncementRead(a.id, token)
        .then(() => {
          setAnnouncements((list) => list.map((x) => (x.id === a.id ? { ...x, isRead: true } : x)));
          setUnreadCount((c) => Math.max(0, c - 1));
        })
        .catch(() => {});
    }
  }

  // Item 3 clarification: deleting is NEVER automatic delete-for-all.
  // A tenant only ever gets "delete for me" (hides it from their own
  // list - it stays visible to every other tenant, and the record
  // itself isn't touched). Landlord/manager/caretaker get a choice
  // between "delete for me" and "delete for everyone".
  function requestDelete(e, a) {
    e.stopPropagation();
    if (role === 'tenant') {
      runDelete(a.id, 'self');
    } else {
      setDeleteMenuFor((current) => (current === a.id ? null : a.id));
    }
  }

  function runDelete(announcementId, scope) {
    setDeletingId(announcementId);
    const wasUnread = announcements.some((x) => x.id === announcementId && !x.isRead);
    api.deleteAnnouncement(announcementId, scope, token)
      .then(() => {
        setAnnouncements((list) => list.filter((x) => x.id !== announcementId));
        if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
        setDeleteMenuFor(null);
      })
      .catch(() => {})
      .finally(() => setDeletingId(null));
  }

  const canChooseScope = role === 'landlord' || role === 'manager';

  return (
    <div className="announcement-bell" ref={containerRef}>
      <button type="button" className="announcement-bell__button" onClick={handleOpen} aria-label="Announcements">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="announcement-bell__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <>
          {/* FIX ("announcements open sideways and hide content"): this
              used to be a corner dropdown anchored to the bell, which
              on a narrow phone screen ran off the edge and clipped
              messages. It now opens as a centered modal like every
              other dialog in the app, so nothing is ever hidden. */}
          <div className="announcement-bell__backdrop" onClick={() => { setOpen(false); setDeleteMenuFor(null); }} />
          <div className="announcement-bell__dropdown" role="dialog" aria-modal="true" aria-label="Announcements">
            <div className="announcement-bell__header">
              Announcements
              <button type="button" className="announcement-bell__close" aria-label="Close" onClick={() => { setOpen(false); setDeleteMenuFor(null); }}>×</button>
            </div>
            {announcements.length === 0 ? (
              <div className="announcement-bell__empty">No announcements yet.</div>
            ) : (
              <ul className="announcement-bell__list">
                {announcements.map((a) => (
                  <li
                    key={a.id}
                    className={`announcement-bell__item ${a.isRead ? '' : 'announcement-bell__item--unread'}`}
                    onClick={() => handleItemClick(a)}
                  >
                    <div className="announcement-bell__item-top">
                      <span className={`announcement-bell__sender announcement-bell__sender--${a.sender_role || 'system'}`}>
                        {a.senderLabel || 'System'}
                      </span>
                      <button
                        type="button"
                        className="announcement-bell__delete-btn"
                        aria-label="Delete announcement"
                        disabled={deletingId === a.id}
                        onClick={(e) => requestDelete(e, a)}
                      >
                        ×
                      </button>
                    </div>
                    <p>{a.message}</p>
                    <span className="announcement-bell__time">{new Date(a.created_at).toLocaleString()}</span>

                    {canChooseScope && deleteMenuFor === a.id && (
                      <div className="announcement-bell__delete-menu" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => runDelete(a.id, 'self')} disabled={deletingId === a.id}>
                          Delete for me
                        </button>
                        <button type="button" className="announcement-bell__delete-menu-danger" onClick={() => runDelete(a.id, 'all')} disabled={deletingId === a.id}>
                          Delete for everyone
                        </button>
                        <button type="button" className="ghost-link" onClick={() => setDeleteMenuFor(null)}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
