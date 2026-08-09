import { useEffect, useRef, useState } from 'react';
import './BottomNav.css';

// Direct request: "mobile bottom nav." The existing PortalSidebar is
// a full overlay menu (open it, then pick from a long list) - fine
// for the less-common sections, but a lot of real usage on a phone is
// "check my balance," "any new maintenance replies," "message the
// landlord" - repeatedly opening a hamburger menu for those is the
// friction being described. This sits fixed at the bottom of the
// screen (mobile widths only - hidden entirely on desktop via CSS,
// see BottomNav.css) with just the handful of items worth a single
// tap; everything else still lives in the sidebar as before.
//
// DIRECT REQUEST: the bar was permanently pinned to the bottom of the
// viewport, which meant it sat on top of whatever content/buttons a
// page put near its own bottom edge (e.g. a "Save" button, the last
// row of a table). It now auto-hides - slides down out of the way -
// while the person is actively scrolling down (reading further into
// the page), and slides back into view the moment they scroll up
// even slightly (the same pattern Instagram/Twitter use for their
// bottom bars), so it's never permanently blocking anything but is
// always one small upward scroll away.
//
// DIRECT REQUEST (follow-up): scroll-based auto-hide isn't enough on
// its own - some blocked controls (e.g. a fixed bottom action button,
// a chat composer) sit at the bottom of a page that doesn't scroll at
// all, so the bar never had a reason to auto-hide and just sat over
// them permanently. A small tab attached to the bar's top edge now
// lets the person manually collapse/reveal it on demand, independent
// of scroll position. The choice is remembered for the rest of the
// visit (sessionStorage, not localStorage) so collapsing it on one
// screen doesn't surprise them by staying collapsed days later on a
// screen where it isn't in the way.
const MANUAL_HIDE_KEY = 'rentapay_bottomnav_manually_hidden';

export default function BottomNav({ items, activeKey }) {
  const [autoHidden, setAutoHidden] = useState(false);
  const [manuallyHidden, setManuallyHidden] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(MANUAL_HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const lastScrollY = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  const ticking = useRef(false);

  useEffect(() => {
    function handleScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;
        const atTop = currentY <= 8;
        const nearBottom = window.innerHeight + currentY >= document.documentElement.scrollHeight - 8;

        // Small deltas (rubber-banding, minor jitter) are ignored so
        // the bar doesn't flicker; always show at the very top or
        // very bottom of the page so it never gets "stuck" hidden.
        if (atTop || nearBottom) {
          setAutoHidden(false);
        } else if (delta > 10) {
          setAutoHidden(true); // scrolling down -> get out of the way
        } else if (delta < -10) {
          setAutoHidden(false); // scrolling up -> come back
        }

        lastScrollY.current = currentY;
        ticking.current = false;
      });
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const hidden = autoHidden || manuallyHidden;

  // Based on the combined `hidden` state, not just `manuallyHidden` -
  // if the bar is currently hidden because of scroll direction (not a
  // manual choice), tapping the handle should reveal it, not toggle
  // an unrelated flag that would keep it stuck hidden after the next
  // upward scroll.
  function toggleManual() {
    const next = !hidden;
    setManuallyHidden(next);
    setAutoHidden(false);
    try {
      if (next) sessionStorage.setItem(MANUAL_HIDE_KEY, '1');
      else sessionStorage.removeItem(MANUAL_HIDE_KEY);
    } catch {
      // sessionStorage unavailable (private browsing, etc.) - the
      // toggle still works for this render, it just won't persist.
    }
  }

  return (
    <div className="bottom-nav-wrap">
      {/* Stays put and reachable even while the bar itself is
          fully slid out of view (scroll-hidden or manually
          collapsed) - otherwise, once hidden, there'd be no way
          left on screen to bring it back. */}
      <button
        type="button"
        className={`bottom-nav__handle ${hidden ? 'bottom-nav__handle--collapsed' : ''}`}
        onClick={toggleManual}
        aria-label={manuallyHidden ? 'Show quick navigation bar' : 'Hide quick navigation bar'}
        aria-expanded={!manuallyHidden}
      >
        <span className="bottom-nav__handle-chevron" aria-hidden="true">{hidden ? '▲' : '▼'}</span>
      </button>
      <nav className={`bottom-nav ${hidden ? 'bottom-nav--hidden' : ''}`} aria-label="Quick navigation">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`bottom-nav__item ${activeKey === item.key ? 'is-active' : ''}`}
            onClick={item.onClick}
            aria-label={item.label}
          >
            <span className="bottom-nav__icon">{item.icon}</span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
