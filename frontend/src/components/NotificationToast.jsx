import { useEffect, useState } from 'react';
import './NotificationToast.css';

// FEATURE: the in-app half of the "notification popup + unique sound"
// request - NotificationsBell fires this whenever a poll turns up a
// notification it hasn't shown before. Auto-dismisses on its own so
// it never piles up if several land close together.
export default function NotificationToast({ queue, onDismiss }) {
  const [visible, setVisible] = useState(null);

  useEffect(() => {
    if (!visible && queue.length > 0) {
      setVisible(queue[0]);
      const timer = setTimeout(() => {
        setVisible(null);
        onDismiss(queue[0].id);
      }, 5000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, visible]);

  if (!visible) return null;

  return (
    <div className="notification-toast" role="status" onClick={() => { setVisible(null); onDismiss(visible.id); }}>
      <span className="notification-toast__icon">🔔</span>
      <div className="notification-toast__body">
        <strong className="notification-toast__title">{visible.title}</strong>
        <span className="notification-toast__text">{visible.body}</span>
      </div>
    </div>
  );
}
