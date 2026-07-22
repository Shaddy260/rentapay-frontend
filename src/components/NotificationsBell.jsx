import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { usePoll } from '../utils/usePoll.js';
import './NotificationsBell.css';

/**
 * FIX (direct request: "any message be it payments, announcements,
 * activities and updates... should come in this manner [like the OS
 * notification example]"): the `notifications` table + /api/notifications
 * routes already existed on the backend (every payment, reminder, and
 * account update was already being written there via notify.service.js),
 * but nothing in the frontend ever called GET /notifications - there
 * was no bell, no inbox, nowhere to see them in-app at all. The SMS +
 * "urgent" OS push (see utils/push.js / sw.js) were the only channels
 * that ever reached anyone. This adds the missing in-app inbox side,
 * polling every 20s, same pattern as AnnouncementBell.
 *
 * OS-level push (the actual Android/Chrome notification banner, like
 * the Discord example) is a separate, opt-in browser permission - see
 * utils/push.js / sw.js. It already fires for the "urgent" tier
 * (payment submissions, vacate notices, messages) with the RentaPay
 * name/icon, not the browser's. Making EVERY notification urgent-tier
 * would mean an OS banner for every rent reminder too, which is more
 * intrusive than most people want - so the quiet in-app bell below is
 * the right place for the rest.
 */
export default function NotificationsBell({ token }) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  function load() {
    if (!token) return;
    api.listNotifications(token)
      .then((res) => {
        setItems(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      })
      .catch(() => {});
  }

  usePoll(load, 20000, [token]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleItemClick(n) {
    if (!n.read_at) {
      api.markNotificationRead(n.id, token).then(load).catch(() => {});
    }
  }

  function handleMarkAllRead() {
    api.markAllNotificationsRead(token).then(load).catch(() => {});
  }

  function timeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-GB');
  }

  return (
    <div className="notif-bell" ref={containerRef}>
      <button type="button" className="notif-bell__trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
        🔔
        {unreadCount > 0 && <span className="notif-bell__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-bell__panel" role="menu">
          <div className="notif-bell__header">
            <span>Notifications</span>
            {unreadCount > 0 && <button type="button" className="ghost-link" onClick={handleMarkAllRead}>Mark all read</button>}
          </div>
          {items.length === 0 && <p className="notif-bell__empty">Nothing yet.</p>}
          <div className="notif-bell__list">
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`notif-bell__item ${n.read_at ? '' : 'notif-bell__item--unread'}`}
                onClick={() => handleItemClick(n)}
              >
                <div className="notif-bell__item-title">{n.title}</div>
                <div className="notif-bell__item-body">{n.body}</div>
                <div className="notif-bell__item-time">{timeAgo(n.created_at)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
