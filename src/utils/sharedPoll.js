import { useEffect, useRef } from 'react';

// Direct follow-up: "there are 4-5 independent 20-30s polling
// intervals per portal (announcements, notifications, payment
// badges, messages) that aren't coordinated - not a page-load
// problem, just some avoidable background chatter on slow
// connections."
//
// This replaces N independent setInterval timers with ONE shared
// tick. Each caller just says "call my function every ~20s" (or
// whatever) and gets woken up on the next shared tick at or after
// that interval - it doesn't need its own timer. As a genuine bonus
// (not just consolidation), the shared tick pauses entirely while
// the tab is in the background (Page Visibility API), which none of
// the original independent timers did - a portal left open in a
// background tab now does zero polling until it's looked at again.
//
// Deliberately NOT used for time-critical polling (STK/manual
// payment-status checks at 3s, or chat message polling) - those stay
// on their own fast, independent timers exactly as before. This is
// only for the slower "badge/inbox" tier.

const BASE_TICK_MS = 5000;
const listeners = new Set(); // { fn, everyMs, lastRun }
let intervalId = null;

function tick() {
  if (typeof document !== 'undefined' && document.hidden) return;
  const now = Date.now();
  for (const entry of listeners) {
    if (now - entry.lastRun >= entry.everyMs) {
      entry.lastRun = now;
      try {
        entry.fn();
      } catch {
        // a single failing listener should never take down the shared tick
      }
    }
  }
}

function subscribe(fn, everyMs) {
  const entry = { fn, everyMs, lastRun: Date.now() };
  listeners.add(entry);
  if (!intervalId) intervalId = setInterval(tick, BASE_TICK_MS);
  return () => {
    listeners.delete(entry);
    if (listeners.size === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

/**
 * Runs `fn` on the shared tick roughly every `everyMs`, instead of
 * this component owning its own setInterval. `fn` should be stable
 * across renders (wrap in useCallback if it closes over changing
 * values) - pass an up-to-date ref internally if not.
 */
export function useSharedPoll(fn, everyMs) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!everyMs) return undefined;
    return subscribe(() => fnRef.current(), everyMs);
  }, [everyMs]);
}
