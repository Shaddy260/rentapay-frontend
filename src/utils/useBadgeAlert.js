import { useEffect, useRef } from 'react';
import { playNotificationChime, showBrowserNotification } from './notifySound.js';

/**
 * @param {number} count - current badge value (e.g. unread messages)
 * @param {string} label - what to say in the popup, e.g. "New message"
 */
export function useBadgeAlert(count, label) {
  const prevRef = useRef(null);

  useEffect(() => {
    if (typeof count !== 'number') return;
    if (prevRef.current !== null && count > prevRef.current) {
      playNotificationChime();
      showBrowserNotification('RentaPay', label);
    }
    prevRef.current = count;
  }, [count, label]);
}
