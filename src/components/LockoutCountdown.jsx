import React, { useEffect, useState } from 'react';

/**
 * DIRECT REQUEST: the account-lockout message was showing the raw
 * ISO "try again after 2026-08-13T08:03:24.63+00:00" timestamp -
 * confusing to read. This renders a plain-language "try again in
 * ~N mins" instead, and keeps counting down live rather than showing
 * a single frozen number, so it visibly approaches zero as the lock
 * expires.
 *
 * `until` is an ISO timestamp string. Calls onExpire() once the
 * countdown reaches zero, so the caller can clear the locked state
 * and let the person retry immediately instead of waiting for them
 * to manually resubmit.
 */
export default function LockoutCountdown({ until, onExpire }) {
  const target = React.useMemo(() => new Date(until).getTime(), [until]);
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    setRemainingMs(Math.max(0, target - Date.now()));
    const interval = setInterval(() => {
      const next = Math.max(0, target - Date.now());
      setRemainingMs(next);
      if (next === 0) {
        clearInterval(interval);
        if (onExpire) onExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const friendly =
    totalSeconds <= 0
      ? 'You can try again now.'
      : minutes >= 1
      ? `Try again in about ${minutes} minute${minutes === 1 ? '' : 's'} (${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')})`
      : `Try again in ${seconds} second${seconds === 1 ? '' : 's'}`;

  return <span>{friendly}</span>;
}
