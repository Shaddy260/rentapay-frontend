import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useSharedPoll } from '../utils/sharedPoll.js';
import './NotificationsBell.css';

// Direct request: "notifications should look native, and admin
// should be notified on payment submissions" - the backend already
// had a fully working inbox (notifications table + /notifications
// routes) but NOTHING in the frontend ever called it, so there was
// no bell anywhere for account/payment-style updates (as opposed to
// AnnouncementBell, which is specifically for landlord/admin-authored
// announcements - a different, narrower feature that already existed).
// Used identically in all four portals: landlord/manager/caretaker,
// tenant, scout, and now admin too.
export default function NotificationsBell({ token, propertyId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  function load() {
    if (!token) return;
    api.listNotifications(token, propertyId)
      .then((res) => {
        setNotifications(res.notifications || []);
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

  function handleItemClick(n) {
    if (!n.read_at) {
      api.markNotificationRead(n.id, token).catch(() => {});
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }

  function handleMarkAllRead() {
    api.markAllNotificationsRead(token, propertyId).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  }

  return (
    <div className="notifications-bell" ref={containerRef}>
      <button type="button" className="notifications-bell__trigger" onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="notifications-bell__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notifications-bell__panel">
          <div className="notifications-bell__header">
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button type="button" className="notifications-bell__mark-all" onClick={handleMarkAllRead}>
                Mark all read
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
