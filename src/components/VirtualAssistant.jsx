import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './VirtualAssistant.css';

/**
 * Virtual Assistant / Guided Walkthrough - spec section 1.
 *
 * A persistent, thumb-reachable "Assistant" floating button (bottom
 * right, every screen) that role-auto-detects and plays a short
 * spotlight/tooltip sequence over the sidebar - completely separate
 * from HelpButton.jsx, which stays support-contacts-only.
 *
 * Role auto-detection happens entirely in the PARENT: Dashboard.jsx and
 * TenantPortal.jsx already know their own role/permissions (isManager,
 * isCaretaker, etc.) - this component is never shown a role picker and
 * never asks for one. The parent simply passes the right `steps` array
 * for whoever is logged in.
 *
 * Manager/Caretaker walkthroughs are NOT hand-written separately here -
 * per spec ("filtered subset of the Landlord walkthrough, filtered by
 * that role's actual permissions"), the parent builds one landlord
 * step list and filters it down using the exact same isCaretaker/
 * isManager booleans it already uses to decide what to render in the
 * sidebar (see buildLandlordAssistantSteps below), so the walkthrough
 * can never spotlight something the role can't see.
 *
 * Spotlighting works by CSS selector against `data-tour="<key>"`
 * attributes already present on PortalSidebar's rendered buttons
 * (both flat items and group headers use this) - no separate
 * "walkthrough script" duplicating the sidebar structure.
 */

// Shared step-builder for the three landlord-style roles (Landlord,
// Manager, Caretaker all render the exact same PortalSidebar/Dashboard -
// see Dashboard.jsx). `perms.isManager` / `perms.isCaretaker` mirror
// the booleans Dashboard.jsx already computes from
// sessionStorage/roleLevel, so this can never drift from what's
// actually visible in the sidebar.
export function buildLandlordAssistantSteps({ isCaretaker } = {}) {
  const steps = [
    {
      target: '[data-tour="group-Overview"]',
      title: 'Overview',
      body: 'Your Dashboard and Due Dates live here - a quick snapshot of what needs your attention.',
    },
    {
      target: '[data-tour="group-Finances"]',
      title: 'Finances',
      // Caretaker never has access to Financial Statistics, Payment
      // History, Disputed Charges, or Payment Plan Requests (spec
      // section 3) - Dashboard.jsx already hides those items for a
      // caretaker, so this caption never promises access it can't
      // actually spotlight.
      body: isCaretaker
        ? 'Pending Payments lives here - you can view submitted payment proofs, but confirming or rejecting them is handled by the landlord or manager.'
        : 'Financial Statistics, Payment History, Disputed Charges, Payment Plan Requests, and Pending Payments all live here.',
      skipIfMissing: true,
    },
    {
      target: '[data-tour="group-Tenants"]',
      title: 'Tenants',
      body: 'Archived Tenants, Tenant Reputations, your own reputation, and Tenant Lists live here.',
      skipIfMissing: true,
    },
    {
      target: '[data-tour="group-Operations"]',
      title: 'Operations',
      body: 'Maintenance requests, Expenses, the Community Board, Messages, and Broadcasts all live here.',
    },
    {
      target: '[data-tour="group-Account"]',
      title: 'Account',
      body: isCaretaker
        ? 'Settings, Manage Subscription, FAQs, and Help/Complaints live here.'
        : 'Settings, Manage Subscription, First-Time Login Details, FAQs, and Help/Complaints all live here.',
    },
    {
      target: '[data-tour="virtual-assistant"]',
      title: "You're all set",
      body: 'Reopen this walkthrough any time from Virtual Assistant in the menu - it never changes anything, just guides you.',
    },
  ];
  // Financial Statistics/Payment History/Disputes/Payment Plans are
  // hidden for caretaker, but Pending Payments (read-only) still
  // renders, so the Finances group itself is never actually empty/
  // missing for any role - `skipIfMissing` on it is a defensive
  // no-op, kept in case that ever changes.
  return steps;
}

export function buildTenantAssistantSteps() {
  return [
    {
      target: '[data-tour="group-Overview"]',
      title: 'Overview',
      body: 'Your Dashboard and Contact & Notice details live here.',
    },
    {
      target: '[data-tour="group-Finances"]',
      title: 'Finances',
      body: 'Financial Statistics and Payment History live here - everything about your rent and past payments.',
    },
    {
      target: '[data-tour="group-Operations"]',
      title: 'Operations',
      body: 'Maintenance requests, the Community Board, and Messages all live here.',
    },
    {
      target: '[data-tour="group-Account"]',
      title: 'Account',
      body: 'Your Reputation, Documents, FAQs, and Help/Complaints live here.',
    },
    {
      target: '[data-tour="virtual-assistant"]',
      title: "You're all set",
      body: 'Reopen this walkthrough any time from Virtual Assistant in the menu - it never changes anything, just guides you.',
    },
  ];
}

export default forwardRef(function VirtualAssistant({ steps, autoOpen, onAutoOpenHandled, onRequestSidebarOpen, onRequestSidebarClose }, ref) {
  const [isOpen, setIsOpen] = useState(false);

  // Menu item (PortalSidebar "Virtual Assistant" entry) triggers this
  // imperatively instead of a floating button - keeps the walkthrough
  // reachable from one place (the menu) instead of a persistent FAB
  // that overlapped the support chat widget.
  useImperativeHandle(ref, () => ({ open: start }));
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const buttonRef = useRef(null);
  const autoOpenHandledRef = useRef(false);

  // Auto-launch once for a first login. `autoOpen` is a plain boolean
  // the parent derives from the server-side "has this account ever
  // seen it" flag (see api.getAssistantStatus) - this effect just
  // reacts to it becoming true, and immediately tells the parent it's
  // been handled so it never fires twice even if the prop stays true
  // across re-renders.
  useEffect(() => {
    if (autoOpen && !autoOpenHandledRef.current) {
      autoOpenHandledRef.current = true;
      start();
      onAutoOpenHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  function start() {
    setStepIndex(0);
    setIsOpen(true);
    onRequestSidebarOpen?.();
  }

  function close() {
    setIsOpen(false);
    onRequestSidebarClose?.();
  }

  function goTo(nextIndex) {
    if (nextIndex >= steps.length) {
      close();
      return;
    }
    setStepIndex(nextIndex);
  }

  // Recompute the highlighted element's position every time the step
  // changes, and keep it in sync with scroll/resize while open - a
  // sidebar item's on-screen position can shift (mobile viewport
  // rotation, a group collapsing) at any moment.
  useEffect(() => {
    if (!isOpen) return undefined;

    function measure() {
      const step = steps[stepIndex];
      if (!step) return;
      if (step.anchor === 'self') {
        const el = buttonRef.current;
        if (el) setRect(el.getBoundingClientRect());
        return;
      }
      const el = document.querySelector(step.target);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else if (step.skipIfMissing) {
        goTo(stepIndex + 1);
      } else {
        setRect(null); // fall back to a centered card with no spotlight cutout
      }
    }

    measure();
    const raf = requestAnimationFrame(measure); // catch layout settling right after sidebar opens
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stepIndex]);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  // Tooltip card position: prefer just below the highlighted element,
  // flip above it if that would run off the bottom of the viewport.
  let cardStyle = null;
  if (rect) {
    const viewportH = window.innerHeight;
    const preferBelow = rect.bottom + 160 < viewportH;
    cardStyle = preferBelow
      ? { top: rect.bottom + 12, left: Math.max(12, Math.min(rect.left, window.innerWidth - 300)) }
      : { top: Math.max(12, rect.top - 160), left: Math.max(12, Math.min(rect.left, window.innerWidth - 300)) };
  }

  return (
    <>
      {isOpen && step && createPortal(
        <div className="virtual-assistant__overlay">
          {rect && (
            <div
              className="virtual-assistant__spotlight"
              style={{
                top: rect.top - 6,
                left: rect.left - 6,
                width: rect.width + 12,
                height: rect.height + 12,
              }}
            />
          )}
          <div
            className="virtual-assistant__card"
            style={cardStyle || { top: '40%', left: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <div className="virtual-assistant__card-header">
              <span className="virtual-assistant__step-count">{stepIndex + 1} / {steps.length}</span>
              <button type="button" className="virtual-assistant__close" aria-label="Dismiss assistant" onClick={close}>×</button>
            </div>
            <h4>{step.title}</h4>
            <p>{step.body}</p>
            <div className="virtual-assistant__card-actions">
              <button type="button" className="virtual-assistant__skip" onClick={close}>Skip</button>
              <button type="button" className="virtual-assistant__next" onClick={() => goTo(stepIndex + 1)}>
                {isLast ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});
