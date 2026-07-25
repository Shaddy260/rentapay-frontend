import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatThreadList from '../components/ChatThreadList.jsx';
import ChatConversation from '../components/ChatConversation.jsx';
import PortalSidebar from '../components/PortalSidebar.jsx';
import BottomNav from '../components/BottomNav.jsx';
import './Messages.css';

/**
 * DIRECT REQUEST: "Messages should be a complete page on its own" -
 * previously the only way to see the full inbox was ChatWidget's
 * popup (an overlay panel triggered from a button), which meant
 * messages could never be linked to, bookmarked, refreshed into, or
 * given real screen space. This is the same underlying pieces
 * (ChatThreadList + ChatConversation) as the popup, just given a real
 * route and full-page layout instead of being boxed into a modal.
 *
 * The contextual quick-chat popups elsewhere (HelpButton's "Chat with
 * an agent", "Text your landlord/tenant" buttons, dispute threads)
 * are left as popups on purpose - those are one-off, in-context
 * conversations the person didn't come here looking for. This page is
 * specifically for the main "Messages" nav item, where a full inbox
 * makes sense.
 */
export default function Messages() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('rentapay_token');
  const role = sessionStorage.getItem('rentapay_role');
  const roleLevel = sessionStorage.getItem('rentapay_role_level');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  if (!token || !role) {
    navigate('/login');
    return null;
  }

  const isManager = role === 'manager';
  const homePath = role === 'landlord' || isManager ? '/dashboard' : '/portal';

  function keyOf(t) {
    if (!t) return null;
    return `${t.threadType}:${t.landlordId || ''}:${t.tenantId || ''}`;
  }

  return (
    <div className="messages-page">
      <PortalSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey="messages"
        items={[
          { key: 'dashboard', label: 'Dashboard', icon: '🏠', onClick: () => navigate(homePath) },
          { key: 'messages', label: 'Messages', icon: '💬', onClick: () => {} },
        ]}
      />

      <BottomNav
        activeKey="messages"
        items={[
          { key: 'dashboard', label: 'Home', icon: '🏠', onClick: () => navigate(homePath) },
          { key: 'messages', label: 'Messages', icon: '💬', onClick: () => {} },
        ]}
      />

      <header className="messages-page__header portal-topbar">
        <div className="portal-topbar__left">
          <button type="button" className="portal-topbar__hamburger" aria-label="Menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <button type="button" className="messages-page__back" onClick={() => navigate(homePath)} aria-label="Back">←</button>
          <div className="portal-topbar__brand-block">
            <div className="portal-topbar__brand">Messages</div>
          </div>
        </div>
      </header>

      <main className="messages-page__main">
        <div className="messages-page__layout">
          <div className={`messages-page__list ${selected ? 'messages-page__list--hidden-mobile' : ''}`}>
            <ChatThreadList token={token} onSelect={setSelected} selectedKey={keyOf(selected)} />
          </div>
          <div className={`messages-page__conversation ${!selected ? 'messages-page__conversation--hidden-mobile' : ''}`}>
            {selected ? (
              <ChatConversation
                token={token}
                role={isManager ? 'manager' : role}
                roleLevel={roleLevel}
                thread={selected}
                onBack={() => setSelected(null)}
              />
            ) : (
              <div className="messages-page__empty">Select a conversation to view it here.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
