import React, { useState, useEffect } from 'react';
import ChatThreadList from './ChatThreadList.jsx';
import ChatConversation from './ChatConversation.jsx';
import './ChatWidget.css';

/**
 * The "Chat directly with an agent" / "Text your landlord" / "Text your
 * tenant" popup. Replaces the old email-only "reach us directly" button.
 *
 * - Tenant portal: shows 2 threads — "RentaPay Support (Chat with an
 *   agent)" and "Your Landlord" (the landlord_tenant thread).
 * - Landlord dashboard: shows the admin_landlord thread plus one
 *   landlord_tenant thread per active tenant ("text your tenant").
 *
 * Props: token, role, label (button text), directThread (optional -
 * skip the thread list and open straight into one conversation, e.g. a
 * "Text your landlord" button placed elsewhere in the tenant portal).
 */
export default function ChatWidget({
  token,
  role,
  roleLevel = null,
  label = 'Chat with an agent',
  directThread = null,
  renderAs = null,
  hideLauncher = false,
  controlledOpen = null,
  onOpenChange = null,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selected, setSelected] = useState(directThread);
  const isControlled = controlledOpen !== null;
  const open = isControlled ? controlledOpen : internalOpen;

  useEffect(() => {
    if (isControlled && controlledOpen) setSelected(directThread || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledOpen]);

  function keyOf(t) {
    if (!t) return null;
    return `${t.threadType}:${t.landlordId || ''}:${t.tenantId || ''}`;
  }

  function handleOpen() {
    setSelected(directThread || null);
    if (isControlled) onOpenChange?.(true);
    else setInternalOpen(true);
  }

  function handleClose() {
    if (isControlled) onOpenChange?.(false);
    else setInternalOpen(false);
  }

  return (
    <>
      {!hideLauncher && (
        <button type="button" className={renderAs || 'chat-widget__launcher'} onClick={handleOpen}>
          {renderAs ? label : `💬 ${label}`}
        </button>
      )}

      {open && (
        <div className="chat-widget__overlay" onClick={handleClose}>
          <div className="chat-widget__panel" onClick={(e) => e.stopPropagation()}>
            <div className="chat-widget__panel-header">
              <span>{directThread ? directThread.name : 'Messages'}</span>
              <button className="chat-widget__close" onClick={handleClose}>×</button>
            </div>

            <div className="chat-widget__body">
              {!directThread && !selected && (
                <ChatThreadList token={token} onSelect={setSelected} selectedKey={keyOf(selected)} />
              )}
              {selected && (
                <ChatConversation
                  token={token}
                  role={role}
                  roleLevel={roleLevel}
                  thread={selected}
                  onBack={directThread ? undefined : () => setSelected(null)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
