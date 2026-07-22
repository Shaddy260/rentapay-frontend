import { useEffect, useRef } from 'react';

/**
 * PERFORMANCE FIX (direct request: "check anything causing low speed
 * and too much loading"): every portal had 3-4 independent
 * setInterval polls running at once (announcements, notifications,
 * pending payments, message badges) - each kept firing on its own
 * schedule even when the browser tab was in the background/minimized,
 * which is wasted network and battery on a phone, and on a slow
 * connection it competes with whatever the person actually opened the
 * tab to do once they switch back.
 *
 * Drop-in replacement for `useEffect(() => { const id = setInterval(fn,
 * ms); return () => clearInterval(id); }, [deps])`: same call `fn`
 * immediately and then every `ms`, but skips the call entirely while
 * `document.visibilityState === 'hidden'`, and always runs one fresh
 * call the moment the tab becomes visible again so nothing feels stale
 * when someone switches back.
 */
export function usePoll(fn, ms, deps = [], { skipInitialCall = false } = {}) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    function tick() {
      if (document.visibilityState !== 'hidden') fnRef.current();
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') fnRef.current();
    }

    if (!skipInitialCall) tick();
    const id = setInterval(tick, ms);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}
