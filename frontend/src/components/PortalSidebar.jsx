import React, { useState, useMemo } from 'react';
import './PortalSidebar.css';

// Section 2 (Navigation - Collapsible Sidebar): the last-opened
// accordion section is remembered per browser so the sidebar looks
// the same way it did on the person's last visit.
const OPEN_SECTION_STORAGE_KEY = 'rentapay:sidebar:openSection';

/**
 * Collapsible left nav, styled after the "Dashboard / Messages /
 * Financials / Complaints / ..." university-portal reference the user
 * shared. Overlays the page when open (mobile-first - matches how the
 * reference screenshots behave), closes on backdrop click or item
 * select.
 *
 * Grouped sections (spec: "Sidebar Restructure" + Section 2 "Navigation
 * - Collapsible Sidebar"): `items` can either be a flat array of nav
 * items (existing behavior, unchanged - used by AdminDashboard/
 * Messages), or an array of section objects:
 *   { group: 'Finances', items: [ {key, label, icon, ...}, ... ] }
 * Grouped sections behave as a true accordion: only one section is
 * expanded at a time (expanding one collapses whichever was open
 * before), the last-opened section persists to localStorage so it's
 * still open on the next visit, and expand/collapse animates via a
 * CSS grid-rows transition (~200ms) with the chevron rotating on
 * toggle. Whichever group contains a "dashboard" item has that one
 * item pinned above the accordion instead, always visible, never
 * collapsed. Mixed shapes in the same array are NOT supported - pass
 * either all groups or all flat items.
 */
export default function PortalSidebar({ open, onClose, items, activeKey, brandName = 'RentaPay', notificationCount = 0 }) {
  const isGrouped = items.length > 0 && items[0] != null && 'group' in items[0];

  // Pull the "Dashboard" item out of whichever group it lives in so it
  // can render pinned above the accordion, always visible. Sections
  // that end up empty (e.g. "Overview" only ever held Dashboard) are
  // dropped from the accordion entirely rather than rendering an
  // empty, uncollapsible header.
  const { pinnedItem, sections } = useMemo(() => {
    if (!isGrouped) return { pinnedItem: null, sections: [] };
    let pinned = null;
    const cleaned = items
      .map((section) => {
        const remaining = section.items.filter((item) => {
          if (!pinned && item.key === 'dashboard') {
            pinned = item;
            return false;
          }
          return true;
        });
        return { ...section, items: remaining };
      })
      .filter((section) => section.items.length > 0);
    return { pinnedItem: pinned, sections: cleaned };
  }, [isGrouped, items]);

  const [openGroup, setOpenGroup] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(OPEN_SECTION_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Fall back to the first available section the first time this
  // renders with grouped items and nothing persisted yet (or the
  // persisted group no longer exists, e.g. role-based items changed).
  const effectiveOpenGroup = useMemo(() => {
    if (!isGrouped) return null;
    if (sections.some((s) => s.group === openGroup)) return openGroup;
    return sections[0]?.group ?? null;
  }, [isGrouped, sections, openGroup]);

  function toggleGroup(groupLabel) {
    setOpenGroup((prev) => {
      // Accordion, not independent toggles: opening a section always
      // closes whichever one was open before. Clicking the already-open
      // section's header closes it (collapses to nothing open).
      const current = sections.some((s) => s.group === prev) ? prev : effectiveOpenGroup;
      const next = current === groupLabel ? null : groupLabel;
      try {
        if (next) window.localStorage.setItem(OPEN_SECTION_STORAGE_KEY, next);
        else window.localStorage.removeItem(OPEN_SECTION_STORAGE_KEY);
      } catch {
        // localStorage unavailable (private browsing, etc.) - the
        // accordion still works in-memory for the rest of the session.
      }
      return next;
    });
  }

  function renderItem(item) {
    return (
      <li key={item.key}>
        <button
          type="button"
          data-tour={item.key}
          className={`portal-sidebar__item ${activeKey === item.key ? 'is-active' : ''}`}
          onClick={() => {
            // Order matters: close-then-select (not select-then-close).
            // Every normal nav item only touches activeView/navigate,
            // so order never mattered for them - but the "Virtual
            // Assistant" menu item's onClick re-opens the sidebar
            // (onRequestSidebarOpen) to spotlight items during the
            // walkthrough. With onClose firing last, that reopen was
            // getting immediately clobbered by this same-tick close,
            // so the tour started with the sidebar already collapsed -
            // the spotlight had nothing visible left to highlight,
            // just the dark overlay. Closing first means whichever
            // state a given item's own onClick sets afterward is what
            // actually sticks.
            onClose?.();
            item.onClick?.();
          }}
        >
          <span className="portal-sidebar__icon">{item.icon}</span>
          <span>{item.label}</span>
          {!!item.badge && (
            <span className="portal-sidebar__badge">{item.badge > 9 ? '9+' : item.badge}</span>
          )}
        </button>
      </li>
    );
  }

  return (
    <>
      {open && <div className="portal-sidebar__backdrop" onClick={onClose} />}
      <nav className={`portal-sidebar ${open ? 'portal-sidebar--open' : ''}`}>
        <div className="portal-sidebar__brand">
          <img className="portal-sidebar__logo" src="/logo.png" alt="" />
          <span>{brandName}</span>
          {notificationCount > 0 && (
            <span className="portal-sidebar__top-badge" aria-label={`${notificationCount} items need attention`}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </div>
        {isGrouped && pinnedItem && (
          <ul className="portal-sidebar__pinned-list">
            {renderItem(pinnedItem)}
          </ul>
        )}
        <ul className="portal-sidebar__list">
          {isGrouped
            ? sections.map((section) => {
                const isOpen = section.group === effectiveOpenGroup;
                return (
                  <li key={section.group} className="portal-sidebar__section">
                    <button
                      type="button"
                      data-tour={`group-${section.group}`}
                      className="portal-sidebar__group-header"
                      aria-expanded={isOpen}
                      onClick={() => toggleGroup(section.group)}
                    >
                      <span>{section.group}</span>
                      <span className={`portal-sidebar__chevron ${isOpen ? '' : 'is-collapsed'}`}>▾</span>
                    </button>
                    {/* Always rendered (not conditionally mounted) so the
                        grid-template-rows transition below has something
                        to animate between 0fr and 1fr instead of an
                        instant mount/unmount snap. */}
                    <div className={`portal-sidebar__group-content ${isOpen ? 'is-open' : ''}`}>
                      <div className="portal-sidebar__group-content-inner">
                        <ul className="portal-sidebar__group-list">
                          {section.items.map((item) => renderItem(item))}
                        </ul>
                      </div>
                    </div>
                  </li>
                );
              })
            : items.map((item) => renderItem(item))}
        </ul>
        <div className="portal-sidebar__footer">© {new Date().getFullYear()} RentaPay</div>
      </nav>
    </>
  );
}
