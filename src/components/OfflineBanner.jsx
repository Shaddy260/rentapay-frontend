import React, { useEffect, useState } from 'react';
import { onQueueChange, listQueuedActions, syncOfflineQueue } from '../api/client.js';
import './OfflineBanner.css';

// Sits once at the top of the app (see App.jsx). Two independent
// things it tracks, since they can happen separately:
//
//   1. `navigator.onLine` - are we offline right now. Shown as a
//      quiet strip so people understand why screens might be showing
//      "last updated ..." data instead of live numbers.
//   2. The offline action queue (offlineDb.js) - anything saved while
//      offline (a payment confirmation, a chat message, etc.) that's
//      waiting to sync. This can be non-empty even while online, for
//      the brief window between reconnecting and the queue finishing
//      its replay, so it's tracked separately from #1.
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  const [pending, setPending] = useState([]);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => { setIsOffline(false); syncOfflineQueue(); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    listQueuedActions().then(setPending);
    const unsubscribe = onQueueChange(setPending);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      unsubscribe();
    };
  }, []);

  if (!isOffline && pending.length === 0) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      {isOffline ? (
        <span>
          You're offline — showing the last saved data.
          {pending.length > 0 && ` ${pending.length} action${pending.length === 1 ? '' : 's'} will send once you're back online.`}
        </span>
      ) : (
        <span>Syncing {pending.length} pending action{pending.length === 1 ? '' : 's'}…</span>
      )}
    </div>
  );
}
