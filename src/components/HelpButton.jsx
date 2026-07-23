import React, { useState } from 'react';
import ChatWidget from './ChatWidget.jsx';
import './HelpButton.css';

// Real contact details supplied directly - shown to BOTH landlord and
// tenant dashboards per blueprint section 15.
export const HELP_EMAIL = 'support@rentapay.co.ke';
export const HELP_WHATSAPP = '+254710888917';

/**
 * Help button + modal, used identically on both the landlord dashboard
 * and the tenant portal (blueprint 15: "visible on every page for all
 * users"). The old "send us a message directly" form (a one-way email
 * that vanished into an inbox) has been replaced with a real, live
 * "Chat with an agent" thread that lands directly in the admin
 * portal's Messages tab and can be replied to from there - the admin's
 * reply comes straight back into this same thread.
 */
export default function HelpButton({ role, token, renderAs, landlordContact }) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  // admin_tenant for tenants, admin_landlord for landlords - the
  // ChatWidget opens straight into this thread (no thread-list step)
  // since there's only ever one "chat with an agent" conversation per
  // account.
  const agentThread = { threadType: role === 'landlord' || role === 'manager' ? 'admin_landlord' : 'admin_tenant', name: 'Chat with an agent' };

  return (
    <>
      <button type="button" className={renderAs || 'help-button'} onClick={() => setOpen(true)}>
        Help
      </button>

      {open && (
        <div className="help-modal-overlay" onClick={close}>
          <div className="help-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-card__header">
              <h3>Need help?</h3>
              <button className="help-modal-card__close" onClick={close}>×</button>
            </div>

            {landlordContact && (
              <div className="help-channels help-channels--landlord">
                <p className="help-modal-or" style={{ marginTop: 0 }}>For rent/unit issues, contact directly:</p>
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
              <a href={`https://wa.me/${HELP_WHATSAPP.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="help-channel help-channel--whatsapp">
                WhatsApp: {HELP_WHATSAPP}
              </a>
              <a href={`mailto:${HELP_EMAIL}`} className="help-channel">
                Email: {HELP_EMAIL}
              </a>
            </div>

            <p className="help-modal-or">Or chat directly with an agent — your message lands in our team's inbox instantly and replies come straight back here:</p>

            <div className="help-chat-cta">
              <ChatWidget token={token} role={role} label="Chat with an agent" directThread={agentThread} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
