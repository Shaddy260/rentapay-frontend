import React from 'react';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';

/**
 * The "Chat directly with an agent" / "Text your landlord" / "Text your
 * tenant" / dispute-conversation entry point.
 *
 * FEATURE (direct request: "messages are supposed to be full screen,
 * not a popup - check with all portals and ensure that; in tenants
 * currently it's popping up"): this used to render its own overlay+
 * panel popup. It now navigates straight to the full-screen /messages
 * page instead, passing the target thread via router state so that
 * page opens directly into the right conversation - the same
 * behavior everywhere this is used: "Chat with an agent" (HelpButton),
 * "Text your landlord" (tenant portal), and dispute conversations
 * (DisputesPanel, DisputeChargeButton).
 *
 * Props: token, role, label (button text), directThread (optional -
 * the thread to open straight into, e.g. a "Text your landlord" button
 * placed elsewhere in the tenant portal). hideLauncher/controlledOpen
 * let a caller (e.g. DisputeChargeButton's "View conversation" button)
 * trigger the navigation programmatically instead of rendering its own
 * launcher button.
 */
export default function ChatWidget({
  role,
  label = 'Chat with an agent',
  directThread = null,
  renderAs = null,
  hideLauncher = false,
  controlledOpen = null,
  onOpenChange = null,
  onNavigate = null,
}) {
  const navigate = useNavigate();

  function goToMessages() {
    onNavigate?.();
    navigate('/messages', { state: { directThread } });
    onOpenChange?.(false);
  }

  React.useEffect(() => {
    if (controlledOpen) goToMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledOpen]);

  if (hideLauncher) return null;

  return (
    <button type="button" className={renderAs || 'chat-widget__launcher'} onClick={goToMessages}>
      {renderAs ? label : `💬 ${label}`}
    </button>
  );
}
