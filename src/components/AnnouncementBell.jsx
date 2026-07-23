import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useSharedPoll } from '../utils/sharedPoll.js';
import './AnnouncementBell.css';

// A single bell icon with an unread-count badge, used in every
// non-admin portal (landlord, manager, caretaker, tenant, scout).
// Composing a new announcement is a separate component
// (AnnouncementComposer, now also available to caretakers per direct
// request).
//
// FIX (direct request: "divert the messages that currently come to
// notifications to be going to announcements and rename that
// announcements bell as notifications"): this used to only show
// announcements (landlord/admin broadcasts), with a second, separate
// NotificationsBell sitting next to it for individual per-account
// things like payment confirmations. The two are still two different
// tables/endpoints on the backend (announcements are a genuinely
// different shape - one message fanned out to many recipients, with
// its own read/hidden/delete-scope rules - notifications are already
// per-recipient rows), so nothing there changed. This component now
// just loads BOTH and merges them into one feed, so from a
// non-admin user's point of view there is only one bell, labeled
// "Notifications", and everything that used to only show in the old
// separate notifications bell now shows up here too. Admin is
// untouched - it never used this component, only NotificationsBell.
//
// `role`: 'tenant' | 'landlord' | 'manager' | 'scout' (manager covers
// both full property managers and caretakers).
//
// FIX (direct request: "remove delete for me / delete for all - tapping
// a single message should just delete it (for that user only, never for
// anyone else), and add a 'Read all' that clears the whole list the same
// way, again only for that one user"): this used to show a per-item ×
// button with a "delete for me" / "delete for everyone" menu, and
// separately a "Mark all read" button that only flipped a read flag,
// leaving old messages sitting in the list forever. There is now a
// single behavior everywhere in this bell: tapping an item, or tapping
// "Read all", removes it from THIS viewer's own inbox only (self scope)
// - it's simply gone and never reappears for them, while staying
// completely untouched for every other recipient. Nobody gets a
// "delete for everyone" option here anymore; that's a different,
// account-management-level action and doesn't belong in a personal
// notification inbox.
//
// Polls every 30s rather than a real websocket connection - "real
// time" here means "within 30 seconds", which is fine for this kind
// of feed (not a chat). If true push delivery is needed later, this
// is the one place that would need to change.
export default function AnnouncementBell({ token, role, propertyId }) {
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);
  const containerRef = useRef(null);

  function load() {
    if (!token) return;
    Promise.all([
      api.listAnnouncements(token, propertyId).catch(() => ({ announcements: [], unreadCount: 0 })),
      api.listNotifications(token, propertyId).catch(() => ({ notifications: [], unreadCount: 0 })),
    ])
      .then(([announcementRes, notificationRes]) => {
        setAnnouncements(announcementRes.announcements || []);
        setNotifications(notificationRes.notifications || []);
        setUnreadCount((announcementRes.unreadCount || 0) + (notificationRes.unreadCount || 0));
      })
      .catch(() => {}); // silent - a failed bell refresh shouldn't interrupt the portal
  }

  // Merges both feeds into one list, newest first, each item tagged
  // with `feed` so click/delete handling knows which API it came from.
  const items = [
    ...announcements.map((a) => ({ feed: 'announcement', id: a.id, data: a, created_at: a.created_at, isRead: a.isRead })),
    ...notifications.map((n) => ({ feed: 'notification', id: n.id, data: n, created_at: n.created_at, isRead: !!n.read_at })),
  ].sort((x, y) => new Date(y.created_at) - new Date(x.created_at));

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
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleOpen() {
    setOpen((v) => !v);
  }

  // Tapping an item now deletes it outright instead of just marking it
  // read - always scoped to this one viewer only (announcements use the
  // existing 'self' hide-scope; notifications are already per-recipient
  // rows, so deleting one can never touch anyone else's inbox). Either
  // way, it disappears from the list and won't be seen again by this
  // user.
  function handleItemClick(item) {
    setDeletingId(item.id);
    const wasUnread = !item.isRead;
    const request = item.feed === 'announcement'
      ? api.deleteAnnouncement(item.id, 'self', token)
      : api.deleteNotification(item.id, token);

    request
      .then(() => {
        if (item.feed === 'announcement') {
          setAnnouncements((list) => list.filter((x) => x.id !== item.id));
        } else {
          setNotifications((list) => list.filter((x) => x.id !== item.id));
        }
        if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
      })
      .catch(() => {})
      .finally(() => setDeletingId(null));
  }

  // "Read all" clears the whole combined inbox at once, for this viewer
  // only - same self-only scoping as a single-item tap, just applied to
  // everything currently loaded. Announcements have no bulk-delete
  // endpoint (they never needed one before delete was per-item scoped
  // like this), so those go out one at a time in parallel; notifications
  // already have a single bulk delete-all call.
  function handleReadAll() {
    setClearingAll(true);
    const announcementIds = announcements.map((a) => a.id);
    Promise.allSettled([
      api.deleteAllNotifications(token, propertyId),
      ...announcementIds.map((id) => api.deleteAnnouncement(id, 'self', token)),
    ]).finally(() => {
      setAnnouncements([]);
      setNotifications([]);
      setUnreadCount(0);
      setClearingAll(false);
    });
  }

  return (
    <div className="announcement-bell" ref={containerRef}>
      <button type="button" className="announcement-bell__button" onClick={handleOpen} aria-label="Notifications">
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
          <div className="announcement-bell__backdrop" onClick={() => setOpen(false)} />
          <div className="announcement-bell__dropdown" role="dialog" aria-modal="true" aria-label="Notifications">
            <div className="announcement-bell__header">
              Notifications
              {items.length > 0 && (
                <button type="button" className="announcement-bell__mark-all" onClick={handleReadAll} disabled={clearingAll}>
                  Read all
                </button>
              )}
              <button type="button" className="announcement-bell__close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </div>
            {items.length === 0 ? (
              <div className="announcement-bell__empty">Nothing yet.</div>
            ) : (
              <ul className="announcement-bell__list">
                {items.map((item) => {
                  if (item.feed === 'notification') {
                    const n = item.data;
                    return (
                      <li
                        key={`n-${n.id}`}
                        className={`announcement-bell__item ${item.isRead ? '' : 'announcement-bell__item--unread'}`}
                        onClick={() => handleItemClick(item)}
                      >
                        <div className="announcement-bell__item-top">
                          <span className="announcement-bell__sender announcement-bell__sender--system">
                            {n.title || 'Notification'}
                          </span>
                        </div>
                        <p>{n.body}</p>
                        <span className="announcement-bell__time">{new Date(n.created_at).toLocaleString()}</span>
                      </li>
                    );
                  }

                  const a = item.data;
                  return (
                    <li
                      key={`a-${a.id}`}
                      className={`announcement-bell__item ${item.isRead ? '' : 'announcement-bell__item--unread'}`}
                      aria-disabled={deletingId === a.id}
                      onClick={() => { if (deletingId !== a.id) handleItemClick(item); }}
                    >
                      <div className="announcement-bell__item-top">
                        <span className={`announcement-bell__sender announcement-bell__sender--${a.sender_role || 'system'}`}>
                          {a.senderLabel || 'System'}
                        </span>
                      </div>
                      <p>{a.message}</p>
                      <span className="announcement-bell__time">{new Date(a.created_at).toLocaleString()}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
