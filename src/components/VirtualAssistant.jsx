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
      body: "Start your day here. Dashboard gives you a snapshot of what needs attention right now, and Due Dates lays out upcoming rent so you can follow up with tenants before they're late instead of after.",
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
        ? "Pending Payments is where you review payment proofs tenants have submitted. You can check the evidence and see what's waiting, but the landlord or manager has to confirm or reject it."
        : "This is money central. Check Financial Statistics for a bird's-eye view of collections, Payment History when you need to trace a specific transaction, Disputed Charges when a tenant contests something you billed, and Payment Plan Requests when someone asks to pay in installments. Pending Payments is where freshly submitted proofs land for you to confirm.",
      skipIfMissing: true,
    },
    {
      target: '[data-tour="group-Tenants"]',
      title: 'Tenants',
      body: "Use this when you need the full picture on a tenant. Tenant Reputations shows how they've behaved with past landlords before you commit to them, your own reputation is what other landlords see about you, Tenant Lists lets you export contact details in bulk, and Archived Tenants keeps history around after someone moves out.",
      skipIfMissing: true,
    },
    {
      target: '[data-tour="group-Operations"]',
      title: 'Operations',
      body: "Day-to-day running of the property lives here: log and track Maintenance requests as they come in, record Expenses so your books stay accurate, post to the Community Board for building-wide updates, and use Messages or Broadcasts when you need to reach one tenant or everyone at once.",
    },
    {
      target: '[data-tour="group-Account"]',
      title: 'Account',
      body: isCaretaker
        ? 'Manage your own login and password in Settings, keep tabs on the property subscription under Manage Subscription, and check FAQs or Help/Complaints any time something is unclear.'
        : "Settings is where you manage your login, password, and account details. Manage Subscription is where you keep your RentaPay plan active. First-Time Login Details are handy when you need to hand a new tenant their credentials, and FAQs or Help/Complaints are there whenever you get stuck.",
    },
    {
      target: '[data-tour="virtual-assistant"]',
      title: "You're all set",
      body: "That's the full tour. Come back to it any time from Virtual Assistant in the menu if you forget where something lives - it only ever shows you around, it never changes anything on your account.",
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
      body: "Dashboard is your quick check-in on where you stand - what's due and what you've paid. Contact & Notice is where you keep your phone, email, and emergency contact current, and where you'd give notice if you're planning to move out.",
    },
    {
      target: '[data-tour="group-Finances"]',
      title: 'Finances',
      body: "Use Financial Statistics when you want a summary of your rent activity at a glance, and Payment History when you need to look up or prove a specific past payment - handy if you ever need a receipt again.",
    },
    {
      target: '[data-tour="group-Operations"]',
      title: 'Operations',
      body: "Report anything broken or in need of fixing under Maintenance, catch building-wide updates from your landlord on the Community Board, and use Messages to reach your landlord or manager directly instead of texting or calling.",
    },
    {
      target: '[data-tour="group-Account"]',
      title: 'Account',
      body: "Your Reputation shows the tenancy record that follows you to future landlords, so it's worth checking in on. Documents keeps your lease and other paperwork in one place, and FAQs or Help/Complaints are there whenever something isn't working the way you expect.",
    },
    {
      target: '[data-tour="virtual-assistant"]',
      title: "You're all set",
      body: "That's the full tour. Come back to it any time from Virtual Assistant in the menu if you forget where something lives - it only ever shows you around, it never changes anything on your account.",
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

    // The sidebar itself slides in with a 0.22s CSS transform transition
    // (see PortalSidebar.css, .portal-sidebar--open). The very first
    // measure() above (and the rAF one) can land mid-slide, so the
    // "Overview" spotlight/tooltip on tour start was being positioned
    // against the sidebar's in-transit location instead of where it
    // actually comes to rest - looked "misaligned" even though the
    // target selector itself was correct. Re-measure once the sidebar's
    // own transform transition finishes, with a timeout fallback in case
    // the sidebar was already open (no transitionend fires) or the
    // transitionend event is missed for any reason.
    const sidebarEl = document.querySelector('.portal-sidebar');
    function onSidebarTransitionEnd(e) {
      if (e.propertyName === 'transform') measure();
    }
    sidebarEl?.addEventListener('transitionend', onSidebarTransitionEnd);
    const settleTimer = setTimeout(measure, 260); // 0.22s transition + buffer

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
      sidebarEl?.removeEventListener('transitionend', onSidebarTransitionEnd);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stepIndex]);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  // Spec 5.3: the walkthrough card itself always opens as a larger
  // panel centered on screen - it no longer tracks the highlighted
  // element's position (that used to make it feel like a small popover
  // "anchored to a corner" whenever the target was near an edge). The
  // spotlight cutout below still highlights the relevant sidebar item;
  // only the card's own placement is now fixed/centered.
  const cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

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
            style={cardStyle}
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
