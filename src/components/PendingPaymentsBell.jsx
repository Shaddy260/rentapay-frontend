import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { usePoll } from '../utils/usePoll.js';
import './PendingPaymentsBell.css';

// A small badge-only bell for the landlord/manager header, next to
// AnnouncementBell. Shows how many manual Paybill payment submissions
// are sitting in pending_payment_confirmations (status='pending') for
// this landlord/manager - i.e. things actually waiting on THEM to
// confirm or reject, as opposed to AnnouncementBell's read-only
// announcement feed.
//
// Clicking it jumps straight to the Pending Payments panel
// (onOpenPendingPayments, wired to Dashboard's setActiveView).
//
// Polls every 20s like the rest of the app's bells/badges, but also
// listens for the 'rentapay:pending-payments-changed' event that
// PendingPaymentConfirmations.jsx dispatches right after a confirm/
// reject/delete succeeds, so the count decrements immediately instead
// of waiting out the poll interval.
// Deliberately NOT scoped to the active property (unlike the list
// panel itself) - this is a "something needs you" indicator, and
// switching to Apartment B shouldn't make a pending item in Apartment
// A invisible. It still counts across every property the landlord/
// manager has, so nothing gets missed just because they're looking at
// a different one right now.
export default function PendingPaymentsBell({ token, onOpenPendingPayments }) {
  const [count, setCount] = useState(0);

  function load() {
    if (!token) return;
    api
      .getPendingPaymentConfirmations('pending', token)
      .then((res) => setCount((res.confirmations || []).filter((c) => !c.duplicate_of).length))
      .catch(() => {}); // silent - a failed badge refresh shouldn't interrupt the portal
  }

  usePoll(load, 20000, [token]);

  useEffect(() => {
    window.addEventListener('rentapay:pending-payments-changed', load);
    return () => window.removeEventListener('rentapay:pending-payments-changed', load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <button
      type="button"
      className="pending-payments-bell"
      onClick={onOpenPendingPayments}
      aria-label="Pending payment confirmations"
      title="Pending payment confirmations"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.5 2.5L16 9.5" />
      </svg>
      {count > 0 && <span className="pending-payments-bell__badge">{count > 9 ? '9+' : count}</span>}
    </button>
  );
}
