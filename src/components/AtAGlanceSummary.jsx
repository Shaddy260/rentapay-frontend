import React from 'react';
import './AtAGlanceSummary.css';

/**
 * FEATURE (direct request: "everything the user needs on the first
 * screen, just a summary"). Sits at the very top of the landlord/
 * manager dashboard home view, above everything else, and answers the
 * three questions someone actually opens this app to check: is
 * anything wrong right now, what should I do about it, and how's my
 * subscription. Full detail (the metrics row, attention feed,
 * subscription bar, payment method) still exists exactly as before -
 * it's just one tap away behind "View full details" instead of
 * something you have to scroll past every single time.
 *
 * Picks a single headline the same way a person would triage their
 * own morning: overdue rent first (it's money you're owed and it's
 * late), then a subscription about to lapse, then "all caught up" as
 * the calm default. Never shows more than one headline at once - the
 * rest is one tap away, not competing for attention.
 */
export default function AtAGlanceSummary({
  overdueCount = 0,
  overdueTotal = 0,
  paidThisMonthTotal = 0,
  paidThisMonthCount = 0,
  vacantCount = 0,
  subscriptionDaysLeft,
  subscriptionUrgent,
  subscriptionExpired,
  expanded,
  onToggle,
  onOpenOverdue,
  onOpenSubscription,
}) {
  let headline;
  let tone = 'good';
  let action;

  if (overdueCount > 0) {
    tone = 'warn';
    headline = `${overdueCount} tenant${overdueCount === 1 ? '' : 's'} overdue — KES ${Number(overdueTotal).toLocaleString()} owed`;
    action = { label: 'View overdue tenants', onClick: onOpenOverdue };
  } else if (subscriptionExpired) {
    tone = 'critical';
    headline = 'Your subscription has ended';
    action = { label: 'Renew now', onClick: onOpenSubscription };
  } else if (subscriptionUrgent) {
    tone = 'warn';
    headline = `Subscription renews in ${subscriptionDaysLeft} day${subscriptionDaysLeft === 1 ? '' : 's'}`;
    action = { label: 'Renew now', onClick: onOpenSubscription };
  } else {
    headline = 'All caught up — nothing needs your attention right now';
  }

  return (
    <section className={`glance glance--${tone}`}>
      <div className="glance__top">
        <div className="glance__headline-block">
          <span className="glance__eyebrow">At a glance</span>
          <p className="glance__headline">{headline}</p>
        </div>
        {action && (
          <button type="button" className="glance__action" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>

      <div className="glance__chips">
        <div className="glance__chip">
          <span className="glance__chip-label">Paid this month</span>
          <span className="glance__chip-value">KES {Number(paidThisMonthTotal).toLocaleString()}</span>
          <span className="glance__chip-sub">{paidThisMonthCount} payment{paidThisMonthCount === 1 ? '' : 's'}</span>
        </div>
        <div className="glance__chip">
          <span className="glance__chip-label">Vacant units</span>
          <span className="glance__chip-value">{vacantCount}</span>
        </div>
        {subscriptionDaysLeft != null && (
          <div className="glance__chip">
            <span className="glance__chip-label">Subscription</span>
            <span className="glance__chip-value">{subscriptionDaysLeft <= 0 ? 'Expired' : `${subscriptionDaysLeft}d left`}</span>
          </div>
        )}
      </div>

      <button type="button" className="glance__toggle" onClick={onToggle} aria-expanded={expanded}>
        {expanded ? 'Hide full details ▲' : 'View full details ▾'}
      </button>
    </section>
  );
}
