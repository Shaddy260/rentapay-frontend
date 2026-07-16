import React from 'react';
import './PortalSidebar.css';

/**
 * Collapsible left nav, styled after the "Dashboard / Messages /
 * Financials / Complaints / ..." university-portal reference the user
 * shared. Overlays the page when open (mobile-first - matches how the
 * reference screenshots behave), closes on backdrop click or item
 * select.
 */
export default function PortalSidebar({ open, onClose, items, activeKey, brandName = 'RentaPay' }) {
  return (
    <>
      {open && <div className="portal-sidebar__backdrop" onClick={onClose} />}
      <nav className={`portal-sidebar ${open ? 'portal-sidebar--open' : ''}`}>
        <div className="portal-sidebar__brand">
          <img className="portal-sidebar__logo" src="/logo.png" alt="" />
          <span>{brandName}</span>
        </div>
        <ul className="portal-sidebar__list">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className={`portal-sidebar__item ${activeKey === item.key ? 'is-active' : ''}`}
                onClick={() => {
                  item.onClick?.();
                  onClose?.();
                }}
              >
                <span className="portal-sidebar__icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="portal-sidebar__footer">© {new Date().getFullYear()} RentaPay</div>
      </nav>
    </>
  );
}
