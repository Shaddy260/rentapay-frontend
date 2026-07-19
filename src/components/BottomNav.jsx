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
export default function BottomNav({ items, activeKey }) {
  return (
    <nav className="bottom-nav" aria-label="Quick navigation">
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
