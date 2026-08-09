import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import './PendingPaymentConfirmationsCard.css';

/**
 * Collapsed/summary-state dashboard card (spec: "Pending Payment
 * Confirmations Card" Section 4). Lives between Quick Actions and
 * Tenant Onboarding on the landlord/manager/caretaker dashboard - see
 * Dashboard.jsx. Deliberately does NOT duplicate the detailed
 * transaction rows (avatar, transaction code, M-Pesa payer, etc.) -
 * that level of detail stays on the full "Pending Payments" page only
 * (PendingPaymentConfirmations.jsx). Tapping the card jumps there.
 *
 * Same count source as PendingPaymentsBell (status='pending', minus
 * flagged duplicates) so the two badges never disagree, and follows
 * the same 'rentapay:pending-payments-changed' event/poll pattern to
 * stay live without its own separate refresh logic.
 */
export default function PendingPaymentConfirmationsCard({ token, onOpen }) {
  const [count, setCount] = useState(null); // null while first load is in flight

  function load() {
    if (!token) return;
    api
      .getPendingPaymentConfirmations('pending', token)
      .then((res) => setCount((res.confirmations || []).filter((c) => !c.duplicate_of).length))
      .catch(() => {}); // silent - a failed count refresh shouldn't break the dashboard
  }

  useEffect(() => {
    load();
    window.addEventListener('rentapay:pending-payments-changed', load);
    return () => window.removeEventListener('rentapay:pending-payments-changed', load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <section
      className="dashboard-card ppc-summary-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
    >
      <div className="ppc-summary-card__header-row">
        <h3 className="dashboard-card__header">
          Pending Payment Confirmations
          {count !== null && count > 0 && <span className="ppc-summary-card__count">{count}</span>}
        </h3>
        <span className="ppc-summary-card__link">View all →</span>
      </div>
      <p className="tenant-portal-hint">
        Tenants who paid rent directly via Paybill/Till submit proof here for you to confirm or reject. Confirming updates their balance and payment history immediately.
      </p>
    </section>
  );
}
