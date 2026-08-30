import { useEffect, useRef } from 'react';

// FEATURE (direct request, with a Kilimall screenshot as the
// reference): "when one refreshes it gives complete whitescreen...
// it should already have data at any time anyone refreshes, not
// giving white screens." Kilimall's own pull-to-refresh keeps every
// existing card on screen and just shows a small indicator at the
// top while it quietly refetches, nothing ever disappears.
//
// The actual cause of RentaPay's white screen: mobile browsers have
// their OWN pull-to-refresh gesture built in, and it does a full page
// reload, the whole React app unmounts, the screen goes blank, then
// everything remounts and refetches from scratch. global.css now
// turns that native gesture off (overscroll-behavior-y: contain on
// html/body), and THIS component takes over that same swipe down at
// the top gesture itself, entirely inside the app.
//
// Dashboard.jsx, TenantPortal.jsx, BaPortal.jsx, and
// UnitsStatusPage.jsx already cache their data in sessionStorage and
// already show a subtle TopRefreshBar sliver, rather than a blank
// screen, whenever their own loading state is true during a
// background refetch, that part was already solid. This component
// deliberately renders nothing of its own; it is a pure gesture
// detector that calls the page's existing onRefresh loader, the same
// one TopRefreshBar's loading prop already reacts to, so pulling down
// triggers the exact same content stays, sliver shows behavior a
// background refresh already has, instead of a second, separate
// indicator competing with it.
//
// Usage: wrap a page's scrollable content in
// <PullToRefresh onRefresh={fn}>...</PullToRefresh>. onRefresh should
// be the page's existing data loader, one that already updates state
// in place rather than clearing it first.
const PULL_TRIGGER_PX = 56; // how far a finger must travel before release triggers a refresh

// FIX (direct request: "completely blocked from scrolling at all,
// anywhere"). Root cause: this component used to register its
// touchmove listener as `{ passive: false }` so it COULD call
// e.preventDefault() when it detected a deliberate pull. But a
// non-passive touchmove listener has a cost that has nothing to do
// with whether preventDefault ever actually fires: the browser is
// no longer allowed to scroll on its own fast compositor thread the
// instant a touch begins on this element - it must first run this
// JS handler synchronously on every single touchmove and wait to see
// whether it calls preventDefault(). If the main thread is busy (and
// the dashboard is exactly the page doing the most work right after
// load - several API calls landing, state updating, large lists
// re-rendering), those touchmove events queue up behind that work
// and scrolling can stall completely or feel totally frozen until
// the thread catches up - reproducing the "not able to scroll at
// all" bug even though the gesture-direction logic below is correct.
// Fix: the listener is now `{ passive: true }` and never calls
// preventDefault. It still tracks the pull distance purely for
// deciding whether to fire onRefresh on release; blocking the
// browser's OWN pull-to-reload gesture is left entirely to
// `overscroll-behavior-y: contain` in global.css, which stops that
// native reload without ever touching how touchmove is handled -
// so normal scrolling is never at the mercy of this component's own
// JS execution, on a busy thread or otherwise.
//   1. Require the gesture to be clearly MORE vertical than
//      horizontal (steeper than a 2:1 ratio) before treating it as a
//      candidate pull at all - a real scroll swipe on a touchscreen
//      is essentially never perfectly vertical from the first pixel,
//      but it's also never mistaken for a deliberate downward pull
//      once you compare against horizontal drift.
//   2. Re-check scrollTop() at every single move, not just once at
//      touchstart - the moment the page has scrolled even 1px away
//      from the top (which can happen mid-gesture on some browsers
//      due to momentum/rubber-banding), immediately release the
//      gesture back to native scrolling instead of continuing to
//      intercept it.
export default function PullToRefresh({ onRefresh, children, className = '' }) {
  const containerRef = useRef(null);
  const startYRef = useRef(null);
  const startXRef = useRef(null);
  const draggingRef = useRef(false);
  const pulledRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    function scrollTop() {
      // .dashboard-page (and most full pages in this app) scroll via
      // the document itself, not their own overflow box, so el.scrollTop
      // would always read 0 - check the actual page scroll position
      // instead.
      return window.scrollY || document.documentElement.scrollTop || el.scrollTop || 0;
    }

    function reset() {
      draggingRef.current = false;
      startYRef.current = null;
      startXRef.current = null;
      pulledRef.current = 0;
    }

    function onTouchStart(e) {
      if (refreshingRef.current) return;
      if (scrollTop() > 0) return;
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      draggingRef.current = true;
      pulledRef.current = 0;
    }

    function onTouchMove(e) {
      if (!draggingRef.current || startYRef.current === null) return;
      // Bail immediately if the page isn't at the top anymore, or if
      // this has stopped being a mostly-vertical gesture - either way
      // it's not a pull-to-refresh, so give native scroll the event.
      if (scrollTop() > 0) { reset(); return; }
      const deltaY = e.touches[0].clientY - startYRef.current;
      const deltaX = e.touches[0].clientX - startXRef.current;
      if (deltaY <= 0 || Math.abs(deltaY) < Math.abs(deltaX) * 2) {
        reset();
        return;
      }
      pulledRef.current = deltaY;
      // No preventDefault here (see note above) - native scroll is
      // always left free to run. The native pull-to-reload gesture
      // this used to block via preventDefault is instead blocked by
      // `overscroll-behavior-y: contain` in global.css.
    }

    function onTouchEnd() {
      if (!draggingRef.current) { reset(); return; }
      const pulled = pulledRef.current;
      reset();
      if (pulled >= PULL_TRIGGER_PX && !refreshingRef.current) {
        refreshingRef.current = true;
        Promise.resolve()
          .then(() => onRefresh?.())
          .catch(() => {})
          .finally(() => {
            refreshingRef.current = false;
          });
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [onRefresh]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
