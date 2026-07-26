import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import './AttentionFeed.css';

// Direct request: "a single 'attention needed' feed on the dashboard
// - overdue rent, unconfirmed payment submissions, expiring
// subscriptions, unresolved help tickets - one list instead of
// making the landlord check 4 separate tabs." Everything this shows
// was already computed somewhere else in the app individually; this
// just merges those into one glanceable list at the top of the
// dashboard instead of leaving the landlord to go looking for each
// one on its own tab.
export default function AttentionFeed({ token, onOpenTenant, onOpenPendingPayments }) {
  const [feed, setFeed] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.getAttentionFeed(token).then(setFeed).catch(() => {});
  }, [token]);

  if (!feed || dismissed) return null;

  const items = [];

  if (feed.subscriptionExpiring) {
    const s = feed.subscriptionExpiring;
    items.push({
      key: 'subscription',
      tone: 'critical',
      text:
        s.status === 'expired'
          ? "Your subscription has expired - renew to restore full access."
          : `Your subscription expires in ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'}.`,
      link: '/subscription',
      linkLabel: 'Renew now',
    });
  }

  feed.overdueTenants?.slice(0, 5).forEach((t) => {
    items.push({
      key: `overdue-${t.tenantId}`,
      tone: 'warning',
      text: `${t.tenantName} (${t.unitName}) is ${t.daysOverdue} day${t.daysOverdue === 1 ? '' : 's'} overdue - KES ${t.amountDue.toLocaleString()}`,
      onClick: () => onOpenTenant?.(t.tenantId, t.unitId),
    });
  });
  if (feed.overdueTenants?.length > 5) {
    items.push({ key: 'overdue-more', tone: 'warning', text: `+${feed.overdueTenants.length - 5} more overdue tenant(s)` });
  }

  if (feed.pendingConfirmations?.length > 0) {
    items.push({
      key: 'pending-confirmations',
      tone: 'info',
      text: `${feed.pendingConfirmations.length} payment submission${feed.pendingConfirmations.length === 1 ? '' : 's'} waiting for your confirmation`,
      onClick: onOpenPendingPayments,
    });
  }

  feed.unresolvedHelpTickets?.forEach((h) => {
    items.push({ key: `help-${h.id}`, tone: 'info', text: `Open support request: ${h.subject || 'Untitled'}` });
  });

  feed.openMaintenanceRequests?.slice(0, 5).forEach((m) => {
    items.push({ key: `maintenance-${m.id}`, tone: m.status === 'in_progress' ? 'info' : 'warning', text: `${m.status === 'in_progress' ? 'In progress' : 'New'}: ${m.title} (${m.units?.unit_name || 'unit'})` });
  });

  if (items.length === 0) return null;

  return (
    <div className="attention-feed">
      <div className="attention-feed__header">
        <h3>Needs your attention</h3>
        <button className="attention-feed__dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss">×</button>
      </div>
      <ul className="attention-feed__list">
        {items.map((item) => (
          <li key={item.key} className={`attention-feed__item attention-feed__item--${item.tone}`}>
            <span onClick={item.onClick} className={item.onClick ? 'attention-feed__item-text--clickable' : ''}>
              {item.text}
            </span>
            {item.link && (
              <Link to={item.link} className="attention-feed__link">{item.linkLabel}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
