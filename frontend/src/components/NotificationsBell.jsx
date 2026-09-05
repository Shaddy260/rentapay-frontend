import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useSharedPoll } from '../utils/sharedPoll.js';
import { playNotificationChime, ensureNotificationPermission, showBrowserNotification } from '../utils/notifySound.js';
import NotificationToast from './NotificationToast.jsx';
import './NotificationsBell.css';

// Direct request: "notifications should look native, and admin
// should be notified on payment submissions" - the backend already
// had a fully working inbox (notifications table + /notifications
// routes) but NOTHING in the frontend ever called it, so there was
// no bell anywhere for account/payment-style updates (as opposed to
// AnnouncementBell, which is specifically for landlord/admin-authored
// announcements - a different, narrower feature that already existed).
// Used identically in all portals: landlord/manager/caretaker,
// tenant, and now admin too.
export default function NotificationsBell({ token, propertyId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [toastQueue, setToastQueue] = useState([]);
  const containerRef = useRef(null);
  const seenIdsRef = useRef(null); // null until the first load completes, so we never "discover" the whole existing inbox as new on first render

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  function load() {
    if (!token) return;
    api.listNotifications(token, propertyId)
      .then((res) => {
        const list = res.notifications || [];

        if (seenIdsRef.current) {
          const freshlyArrived = list.filter((n) => !n.read_at && !seenIdsRef.current.has(n.id));
          if (freshlyArrived.length > 0) {
            playNotificationChime();
            showBrowserNotification(
              freshlyArrived.length === 1 ? freshlyArrived[0].title : 'RentaPay',
              freshlyArrived.length === 1 ? freshlyArrived[0].body : `${freshlyArrived.length} new notifications.`
            );
            setToastQueue((prev) => [...prev, ...freshlyArrived]);
          }
        }
        seenIdsRef.current = new Set(list.map((n) => n.id));

        setNotifications(list);
        setUnreadCount(res.unreadCount || 0);
      })
      .catch(() => {}); // silent - a failed bell refresh shouldn't interrupt the portal
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, propertyId]);

  useSharedPoll(load, 30000);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // FIX (direct request: "no delete for me/delete for all here - tapping
  // a message deletes it, and add a 'Read all' that clears the whole
  // inbox, both scoped to this one user only"): notification rows are
  // already per-recipient, so a tap or "Read all" just deletes the
  // row(s) for this account - it disappears and never comes back, and
  // no other account is ever touched.
  function handleItemClick(n) {
    const wasUnread = !n.read_at;
    // Optimistic delete - the row is removed from the UI immediately
    // below regardless of outcome. If the server call fails, it'll just
    // reappear next time the list refreshes; logged so that's traceable
    // instead of a bare swallow.
    api.deleteNotification(n.id, token).catch((err) => {
      console.warn('[NotificationsBell] failed to delete notification:', err);
    });
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
  }

  function handleReadAll() {
    api.deleteAllNotifications(token, propertyId).catch(() => {});
    setNotifications([]);
    setUnreadCount(0);
  }

  return (
    <div className="notifications-bell" ref={containerRef}>
      <NotificationToast
        queue={toastQueue}
        onDismiss={(id) => setToastQueue((prev) => prev.filter((n) => n.id !== id))}
      />
      <button type="button" className="notifications-bell__trigger" onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="notifications-bell__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notifications-bell__panel">
          <div className="notifications-bell__header">
            <strong>Notifications</strong>
            {notifications.length > 0 && (
              <button type="button" className="notifications-bell__mark-all" onClick={handleReadAll}>
                Read all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="notifications-bell__empty">Nothing yet.</p>
          ) : (
            <ul className="notifications-bell__list">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`notifications-bell__item ${n.read_at ? '' : 'notifications-bell__item--unread'}`}
                  onClick={() => handleItemClick(n)}
                >
                  <div className="notifications-bell__item-title">{n.title}</div>
                  <div className="notifications-bell__item-body">{n.body}</div>
                  <div className="notifications-bell__item-time">{new Date(n.created_at).toLocaleString('en-GB')}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
