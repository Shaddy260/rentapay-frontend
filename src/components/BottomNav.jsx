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
export default function BottomNav({ items, activeKey }) {
  const [hidden, setHidden] = useState(false);
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
          setHidden(false);
        } else if (delta > 10) {
          setHidden(true); // scrolling down -> get out of the way
        } else if (delta < -10) {
          setHidden(false); // scrolling up -> come back
        }

        lastScrollY.current = currentY;
        ticking.current = false;
      });
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
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
  );
}
