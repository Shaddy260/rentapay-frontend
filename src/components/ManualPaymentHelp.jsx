import React, { useState, useEffect } from 'react';
import { useHelpContacts } from './HelpButton.jsx';
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
//
// DIRECT REQUEST: "when landlords choose to pay manually, there should
// be a clear message telling them that manual payment takes a while...
// but if it takes more than an hour to call customer care, the number
// in help." `submittedAt` (an ISO timestamp) drives that escalation -
// before an hour has passed, the message just sets expectations;
// after an hour, it switches to actively telling them to call, using
// the live admin-configured number from useHelpContacts (see
// HelpButton.jsx) rather than a hardcoded one.
const ONE_HOUR_MS = 60 * 60 * 1000;

export default function ManualPaymentHelp({ variant = 'admin', landlordContact, submittedAt }) {
  const [revealed, setRevealed] = useState(false);
  const toast = useToast();
  const { helpCall, helpEmail, helpNumbers } = useHelpContacts();
  const whatsappNumbers = helpNumbers.filter((n) => n.type === 'whatsapp');
  const callNumbers = helpNumbers.filter((n) => n.type === 'call');
  // Item 3: when the admin has configured more than one call number,
  // show "try this number, or this one" instead of a single line.
  const callNumbersText = callNumbers.map((n) => n.value).join(' or ') || helpCall;

  // Re-checked every 30s so the message escalates live if the admin
  // screen stays open past the one-hour mark without a refresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const elapsedMs = submittedAt ? now - new Date(submittedAt).getTime() : 0;
  const overAnHour = submittedAt ? elapsedMs > ONE_HOUR_MS : false;

  // Item 5 (direct request: "Call" used to just be a tel: link on the
  // WhatsApp number - now a separate, dedicated call-in number
  // (helpCall). Tapping it also copies the number to the clipboard
  // before opening the dialer, so it's still on hand if the person
  // needs to read it back to someone or paste it elsewhere, the same
  // pattern already used for "contact tenant" in
  // PendingPaymentConfirmations.jsx.
  async function handleCallTap(e, number) {
    e.preventDefault();
    const dialNumber = number || helpCall;
    try {
      await navigator.clipboard.writeText(dialNumber);
      toast.success(`Copied ${dialNumber} to clipboard.`);
    } catch {
      // Clipboard access can fail (permissions, non-HTTPS context, etc.) -
      // still proceed to open the dialer either way, that's the part
      // that actually matters.
    }
    window.location.href = `tel:${dialNumber}`;
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
      {variant === 'admin' ? (
        overAnHour ? (
          <p className="manual-payment-help__note manual-payment-help__note--urgent" role="alert">
            This is taking longer than usual - please call customer care on <strong>{callNumbersText}</strong> so we can help you directly.
          </p>
        ) : (
          <p className="manual-payment-help__note">
            Manual payments take a while to confirm since they're checked by hand - this can take anywhere from a few
            minutes up to about an hour. No need to resubmit; you'll be notified the moment it's verified.
          </p>
        )
      ) : (
        <p className="manual-payment-help__note">
          Verification may take a few minutes to a few hours. If it's been over 2 hours, please get in touch.
        </p>
      )}

      {variant === 'admin' ? (
        <div className="help-channels manual-payment-help__channels">
          {callNumbers.map((n) => (
            <a
              key={n.id || n.value}
              href={`tel:${n.value}`}
              onClick={(e) => handleCallTap(e, n.value)}
              className={`help-channel${overAnHour ? ' help-channel--urgent' : ''}`}
            >
              Call{n.label ? ` (${n.label})` : ''}: {n.value}
            </a>
          ))}
          {whatsappNumbers.map((n) => (
            <a
              key={n.id || n.value}
              href={`https://wa.me/${n.value.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="help-channel help-channel--whatsapp"
            >
              WhatsApp{n.label ? ` (${n.label})` : ''}: {n.value}
            </a>
          ))}
          <a href={`mailto:${helpEmail}`} className="help-channel">Email: {helpEmail}</a>
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
