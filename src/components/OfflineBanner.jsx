import React, { useEffect, useState } from 'react';
import { onQueueChange, listQueuedActions, syncOfflineQueue, onSlowConnection } from '../api/client.js';
import './OfflineBanner.css';

// Sits once at the top of the app (see App.jsx). Three independent
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
//   3. FEATURE (Section 8: offline-friendly / low-data mode) - a
//      request that's been pending for longer than a normal round
//      trip (see onSlowConnection in api/client.js). Distinct from
//      #1: the connection is still up, just slow, so a screen isn't
//      broken - it just needs a moment. Surfaced here rather than in
//      every individual page's loading state, so it applies app-wide
//      with no per-page wiring.
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  const [pending, setPending] = useState([]);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => { setIsOffline(false); syncOfflineQueue(); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    listQueuedActions().then(setPending);
    const unsubscribeQueue = onQueueChange(setPending);
    const unsubscribeSlow = onSlowConnection(setIsSlow);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      unsubscribeQueue();
      unsubscribeSlow();
    };
  }, []);

  if (!isOffline && pending.length === 0 && !isSlow) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      {isOffline ? (
        <span>
          You're offline - showing the last saved data.
          {pending.length > 0 && ` ${pending.length} action${pending.length === 1 ? '' : 's'} will send once you're back online.`}
        </span>
      ) : pending.length > 0 ? (
        <span>Syncing {pending.length} pending action{pending.length === 1 ? '' : 's'}…</span>
      ) : (
        <span>This is taking longer than usual - check your connection if it doesn't finish soon.</span>
      )}
    </div>
  );
}
