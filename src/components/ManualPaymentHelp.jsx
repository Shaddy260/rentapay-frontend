import React, { useState } from 'react';
import { useHelpContacts } from '../utils/platformSettings.js';
import { useToast } from './Toast.jsx';
import './ManualPaymentHelp.css';

// Shared across every "waiting for manual payment verification" screen -
// landlord sign-up, landlord subscription renewal/failed-prompt (verified
// by an admin), and tenant rent payment (verified by the landlord/manager
// for that tenant's unit, not an automated system - so the tenant needs a
// different contact than the landlord flows do).
//
// variant="admin": platform WhatsApp/Call/Email, shown directly (this is
//   who verifies landlord payments).
// variant="tenant": a tappable "Help" control that unveils the specific
//   landlord's or manager's contact for that tenant's unit only once
//   tapped, per direct request - not a generic platform number.
export default function ManualPaymentHelp({ variant = 'admin', landlordContact }) {
  const [revealed, setRevealed] = useState(false);
  const toast = useToast();
  const { helpWhatsapp: HELP_WHATSAPP, helpEmail: HELP_EMAIL, helpCall: HELP_CALL } = useHelpContacts();
  const whatsappHref = `https://wa.me/${HELP_WHATSAPP.replace(/[^0-9]/g, '')}`;

  // Item 5 (direct request: "Call" used to just be a tel: link on the
  // WhatsApp number - now a separate, dedicated call-in number
  // (HELP_CALL). Tapping it also copies the number to the clipboard
  // before opening the dialer, so it's still on hand if the person
  // needs to read it back to someone or paste it elsewhere, the same
  // pattern already used for "contact tenant" in
  // PendingPaymentConfirmations.jsx.
  async function handleCallTap(e) {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(HELP_CALL);
      toast.success(`Copied ${HELP_CALL} to clipboard.`);
    } catch {
      // Clipboard access can fail (permissions, non-HTTPS context, etc.) -
      // still proceed to open the dialer either way, that's the part
      // that actually matters.
    }
    window.location.href = `tel:${HELP_CALL}`;
  }

  // Manager takes priority over landlord when both exist for the unit -
  // whichever is actually applicable for that tenant's apartment.
  const unitContact = landlordContact?.managerPhone
    ? { label: landlordContact.managerName || 'Property manager', phone: landlordContact.managerPhone }
    : landlordContact?.phone
      ? { label: landlordContact.name || 'Landlord', phone: landlordContact.phone }
      : null;

  return (
    <div className="manual-payment-help">
      <p className="manual-payment-help__note">
        Verification may take a few minutes to a few hours. If it's been over 2 hours, please get in touch.
      </p>

      {variant === 'admin' ? (
        <div className="help-channels manual-payment-help__channels">
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="help-channel help-channel--whatsapp">
            WhatsApp: {HELP_WHATSAPP}
          </a>
          <a href={`tel:${HELP_CALL}`} onClick={handleCallTap} className="help-channel">Call: {HELP_CALL}</a>
          <a href={`mailto:${HELP_EMAIL}`} className="help-channel">Email: {HELP_EMAIL}</a>
        </div>
      ) : (
        unitContact && (
          <>
            <button
              type="button"
              className="ghost-link manual-payment-help__toggle"
              onClick={() => setRevealed((v) => !v)}
            >
              {revealed ? 'Hide contact' : 'Help - contact for this unit'}
            </button>
            {revealed && (
              <div className="help-channels manual-payment-help__channels">
                <a href={`tel:${unitContact.phone}`} className="help-channel">
                  {unitContact.label}: {unitContact.phone}
                </a>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
