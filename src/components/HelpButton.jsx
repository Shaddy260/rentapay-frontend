import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import ChatWidget from './ChatWidget.jsx';
import { useToast } from './Toast.jsx';
import { useHelpContacts, DEFAULT_HELP_CONTACTS } from '../utils/platformSettings.js';
import './HelpButton.css';

// FIX (Admin Settings - editable Help contact details): these used to
// be hardcoded here. Numbers change, and WhatsApp Business numbers can
// get suspended, so they now live in the platformSettings store (backed
// by /settings/public/help-contacts, editable from Admin > Settings)
// with these as the offline/first-paint fallback. Kept exported under
// their old names so any other code importing them still gets a sane
// default; live components should prefer the useHelpContacts() hook.
export const HELP_EMAIL = DEFAULT_HELP_CONTACTS.helpEmail;
export const HELP_WHATSAPP = DEFAULT_HELP_CONTACTS.helpWhatsapp;
// Item 5 (direct request: manual-payment help was only ever showing a
// WhatsApp number for "Call" too - tapping it dialed the WhatsApp
// number instead of a real phone line). This is a separate, dedicated
// call-in number, kept apart from HELP_WHATSAPP so the two can change
// independently of each other in future.
export const HELP_CALL = DEFAULT_HELP_CONTACTS.helpCall;

/**
 * Help button + modal, used identically on both the landlord dashboard
 * and the tenant portal (blueprint 15: "visible on every page for all
 * users"). The old "send us a message directly" form (a one-way email
 * that vanished into an inbox) has been replaced with a real, live
 * "Chat with an agent" thread that lands directly in the admin
 * portal's Messages tab and can be replied to from there - the admin's
 * reply comes straight back into this same thread.
 */
export default function HelpButton({ role, token, renderAs, landlordContact, onOpen }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const { helpWhatsapp, helpCall, helpEmail } = useHelpContacts();
  // FIX (direct request: "tap Help in the profile dropdown... just
  // closes the dropdown and does not show the help details"): the
  // overlay below sits at position:fixed/inset:0, directly on top of
  // wherever the Help button was tapped. Many mobile browsers fire a
  // synthetic "click" ~300ms after the actual touch, by which point
  // this overlay already exists at that exact spot - so the delayed
  // click lands on the overlay instead of the button, and its
  // onClick={close} fires immediately, closing the modal in the same
  // frame it opened. Net visible effect: dropdown closes, modal never
  // appears to have shown. Standard fix: only treat a click on the
  // overlay as "close" if the press ALSO started on the overlay -
  // i.e. this is a real, deliberate tap on the backdrop, not a
  // leftover event from whatever was there a moment before.
  const overlayPressStartedHere = React.useRef(false);

  function close() {
    setOpen(false);
  }

  // FEATURE (direct request: "add this [Call: 254710888917] to all
  // other help UIs across the portals"): this modal is the one Help
  // surface shared by every portal (profile dropdown, dashboard,
  // login screen, tenant portal - see AccountMenu.jsx/Dashboard.jsx/
  // Login.jsx/TenantPortal.jsx), so adding it here covers all of
  // them in one place. Same copy-then-dial pattern already used for
  // the manual-payment "Call" link in ManualPaymentHelp.jsx, kept
  // consistent rather than reinvented.
  async function handleCallTap(e) {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(helpCall);
      toast.success(`Copied ${helpCall} to clipboard.`);
    } catch {
      // Clipboard access can fail (permissions, non-HTTPS context, etc.) -
      // still proceed to open the dialer either way, that's the part
      // that actually matters.
    }
    window.location.href = `tel:${helpCall}`;
  }

  // admin_tenant for tenants, admin_landlord for landlords - the
  // ChatWidget opens straight into this thread (no thread-list step)
  // since there's only ever one "chat with an agent" conversation per
  // account.
  //
  // FIX (item 8, BA Portal Help): the live "chat with an agent" thread
  // system (chat.controller.js) only understands admin_landlord/
  // admin_tenant/landlord_tenant threads - there's no admin_brand_
  // ambassador thread type on the backend yet. Defaulting an
  // unsupported role to admin_tenant would silently drop a BA's
  // support message into a stranger's tenant-support inbox (or error
  // out), so live chat is gated to the roles the backend actually
  // supports; everyone else (currently: brand_ambassador) still gets
  // the WhatsApp/Call/Email channels above, just not the chat CTA.
  const CHAT_SUPPORTED_ROLES = ['landlord', 'manager', 'tenant'];
  const chatSupported = CHAT_SUPPORTED_ROLES.includes(role);
  const agentThread = { threadType: role === 'landlord' || role === 'manager' ? 'admin_landlord' : 'admin_tenant', name: 'Chat with an agent' };

  return (
    <>
      <button
        type="button"
        className={renderAs || 'help-button'}
        onClick={() => {
          setOpen(true);
          // FEATURE (direct request: "once a UI in the menu is tapped,
          // the menu should disappear"): when this Help entry lives
          // inside another dropdown (AccountMenu), that dropdown needs
          // to close itself the moment this opens - otherwise it's
          // still sitting open behind this modal.
          onOpen?.();
        }}
      >
        Help
      </button>

      {open && createPortal(
        <div
          className="help-modal-overlay"
          onPointerDown={(e) => { overlayPressStartedHere.current = e.target === e.currentTarget; }}
          onClick={() => { if (overlayPressStartedHere.current) close(); }}
        >
          <div className="help-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-card__header">
              <h3>Need help?</h3>
              <button className="help-modal-card__close" onClick={close}>×</button>
            </div>

            {landlordContact && (
              <div className="help-channels help-channels--landlord">
                <p className="help-modal-or u-mt-0">For rent/unit issues, contact directly:</p>
                <a href={`tel:${landlordContact.phone}`} className="help-channel">
                  {landlordContact.label || 'Landlord'}: {landlordContact.name} — {landlordContact.phone}
                </a>
                {landlordContact.managerPhone && (
                  <a href={`tel:${landlordContact.managerPhone}`} className="help-channel">
                    Property manager: {landlordContact.managerName} — {landlordContact.managerPhone}
                  </a>
                )}
              </div>
            )}

            <div className="help-channels">
              <a href={`https://wa.me/${helpWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="help-channel help-channel--whatsapp">
                WhatsApp: {helpWhatsapp}
              </a>
              <a href={`tel:${helpCall}`} onClick={handleCallTap} className="help-channel">
                Call: {helpCall}
              </a>
              <a href={`mailto:${helpEmail}`} className="help-channel">
                Email: {helpEmail}
              </a>
            </div>

            <p className="help-modal-or">
              {token && chatSupported
                ? "Or chat directly with an agent — your message lands in our team's inbox instantly and replies come straight back here:"
                : token
                  ? 'You can reach us directly through WhatsApp, phone, or email above.'
                  : 'Log in to chat directly with an agent, or reach us through WhatsApp or email above.'}
            </p>

            {token && chatSupported && (
              <div className="help-chat-cta">
                <ChatWidget role={role} label="Chat with an agent" directThread={agentThread} onNavigate={close} />
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
