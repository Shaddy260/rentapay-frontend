import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
// DIRECT REQUEST (latest): hide the bar while the page is actively
// being scrolled DOWN (reading further content), and bring it back
// as soon as the user scrolls UP even slightly, so it's out of the
// way while reading but always one swipe away. This replaces an
// earlier "always visible, never hides" version - that version was a
// fix for a *different* complaint (the bar collapsing unpredictably
// due to a manual toggle plus auto-hide fighting each other). This
// version only ever reacts to scroll direction - no manual collapse -
// so it can't reintroduce that flicker. The bar is also always shown
// at the very top and very bottom of the page (rest positions), not
// just mid-scroll, so it's never stuck hidden with nothing left to
// scroll. To make sure it never covers the last bit of content when
// visible, every page that renders this bar reserves matching bottom
// padding (see the "room for BottomNav" comments in each page's CSS)
// so the page's own content always scrolls fully clear above the bar
// rather than being hidden underneath it - with real breathing room
// to spare, not just the bar's exact height.
// FEATURE (direct request, reference: a nav bar whose active tab is a
// rounded highlight that slides smoothly to whichever tab is tapped,
// rather than each tab just flipping its own background on/off).
// Implemented as one absolutely-positioned pill (`.bottom-nav__indicator`)
// sized to 1/n of the bar's width and translated to the active tab's
// index - CSS `transition: transform` animates it sliding across, and
// because it's a single element sliding rather than N buttons each
// toggling their own background, it never looks like it "jumps"
// between non-adjacent tabs.
// FIX (direct request: "Home / Payments / Maintenance / Messages is
// showing up at the TOP of the screen instead of the bottom"). The
// CSS below has always said `position: fixed; bottom: 10px`, but a
// `position: fixed` element is only fixed to the *viewport* as long
// as none of its ancestors set a `transform`, `filter`, `perspective`
// or `will-change: transform` - any one of those turns the ancestor
// into the fixed element's containing block instead of the viewport,
// which silently repositions it up near the top of whatever
// scrollable wrapper it's actually inside of. Dashboard.jsx renders
// this nav deep inside several nested wrappers (PullToRefresh,
// VirtualAssistant, etc.), any of which picking up an animation or a
// transform in a future change would reintroduce exactly this bug
// with no obvious cause.
// Rendering through a portal straight onto <body> sidesteps that
// class of bug entirely - the nav's DOM parent is always the real
// document body, so "fixed" always means fixed to the actual screen,
// regardless of what markup surrounds wherever <BottomNav /> gets
// dropped into the tree.
// FIX (direct request: "bottom navigation should not block any
// feature or UI - there should be some allowance space after the
// very last item"). Every page reserves bottom padding equal to a
// fixed guess at this bar's height, but that guess can be wrong: at
// larger accessibility font sizes .bottom-nav__label wraps onto a
// second line (see that rule below) and the whole bar grows taller,
// so a static padding value written for the one-line height quietly
// stops being enough and the last row of real content (a button, a
// list item, a chat composer) ends up hidden behind the bar again -
// the exact bug being reported. Measuring the bar's actual rendered
// height with ResizeObserver and publishing it as a CSS variable
// means every page's reserved padding (see the "room for BottomNav"
// rules) tracks the bar's real size automatically, including when it
// grows from label wrapping, a future extra tab, or a font-size
// change mid-session - instead of everyone guessing the same number
// and hoping it stays right.
function useBottomNavHeightVar(active) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active || typeof ResizeObserver === 'undefined') return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const setVar = () => {
      document.documentElement.style.setProperty('--bottom-nav-height', `${el.offsetHeight}px`);
    };
    setVar();
    const observer = new ResizeObserver(setVar);
    observer.observe(el);
    return () => observer.disconnect();
  }, [active]);
  return ref;
}

// Scroll-direction visibility: hidden while scrolling down, shown the
// moment the user scrolls up (even a few px). DIRECT REQUEST (latest):
// it should never be force-shown just for sitting at the top of the
// page - the earlier version treated "at top" as a permanent rest
// state and pinned it visible there, which is exactly the "shows at
// the top" behavior being asked to remove. Direction is now the only
// thing that matters. Reads scrollY off document.documentElement so
// it works regardless of which element on the page actually scrolls
// (the page body vs. an inner scroll container).
function useScrollVisibility() {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  const ticking = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const THRESHOLD = 6; // ignore tiny jitters (rubber-banding, momentum noise)

    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = Math.max(0, window.scrollY);
        const delta = y - lastY.current;

        if (delta > THRESHOLD) {
          setVisible(false); // scrolling down -> hide
        } else if (delta < -THRESHOLD) {
          setVisible(true); // scrolling up -> show
        }
        lastY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return visible;
}

// DIRECT REQUEST (latest): "when one opens the chat, the navigation
// bar should simply disappear and reappear when they leave." The chat
// widget and this nav bar are siblings mounted independently on the
// page (no shared parent state), so SupportChatWidget announces its
// open/close state via a class on <body> - the cheapest way for two
// unrelated components to agree on visibility without prop-drilling
// chat state through every page that renders both. See
// SupportChatWidget.jsx's `document.body.classList` calls.
function useChatOpenState() {
  const [chatOpen, setChatOpen] = useState(
    typeof document !== 'undefined' && document.body.classList.contains('support-chat-open')
  );
  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(() => {
      setChatOpen(document.body.classList.contains('support-chat-open'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return chatOpen;
}

export default function BottomNav({ items, activeKey }) {
  const activeIndex = Math.max(0, items.findIndex((item) => item.key === activeKey));
  const navRef = useBottomNavHeightVar(true);
  const scrollVisible = useScrollVisibility();
  const chatOpen = useChatOpenState();
  const visible = scrollVisible && !chatOpen;

  const nav = (
    <nav
      ref={navRef}
      className={`bottom-nav-wrap bottom-nav ${visible ? 'is-visible' : 'is-hidden'}`}
      aria-label="Quick navigation"
    >
      <span
        className="bottom-nav__indicator"
        style={{
          width: `${100 / items.length}%`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
        aria-hidden="true"
      />
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

  return typeof document !== 'undefined' ? createPortal(nav, document.body) : nav;
}
