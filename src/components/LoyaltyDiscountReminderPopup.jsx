import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import './LoyaltyDiscountReminderPopup.css';

/**
 * DIRECT REQUEST: "should be sending such landlords whose subscription
 * is not ended that there is a discount to their next renewal...
 * reminding them... should be in app and popup not email." Mirrors
 * RateTenantReminderPopup exactly: polls periodically, dismissible,
 * "Renew now / Remind me later / Not today". The backend
 * (GET /subscriptions/loyalty-discount-reminder) already only ever
 * returns a reminder for a landlord whose subscription hasn't ended
 * and who has an active, not-yet-consumed loyalty discount and hasn't
 * snoozed it - so this component doesn't need to re-check any of that
 * itself.
 *
 * Mount once near the top of the landlord/manager/caretaker portal
 * layout, alongside RateTenantReminderPopup.
 */
export default function LoyaltyDiscountReminderPopup({ token }) {
  const navigate = useNavigate();
  const [reminder, setReminder] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    // Same cadence as RateTenantReminderPopup - fires shortly after
    // load, then again every ~20-40 min so it doesn't feel like a
    // fixed timer.
    function schedule(delayMs) {
      return setTimeout(async () => {
        if (cancelled) return;
        try {
          const res = await api.getLoyaltyDiscountReminder(token);
          if (!cancelled && res.reminder) {
            setReminder(res.reminder);
            setVisible(true);
          }
        } catch {
          // Silent - a missed nudge isn't worth surfacing an error for.
        }
        if (!cancelled) timer = schedule(20 * 60 * 1000 + Math.random() * 20 * 60 * 1000); // ~20-40 min
      }, delayMs);
    }

    let timer = schedule(15000); // first check shortly after load
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token]);

  if (!visible || !reminder) return null;

  async function handleSnooze(mode) {
    setVisible(false);
    try {
      await api.snoozeLoyaltyDiscountReminder(reminder.discountId, mode, token);
    } catch {
      // Non-fatal - it'll just resurface next cycle.
    }
  }

  function handleRenew() {
    setVisible(false);
    navigate('/subscription');
  }

  return (
    <div className="loyalty-reminder-overlay" role="dialog" aria-label="Loyalty discount reminder">
      <div className="loyalty-reminder-popup">
        <span className="loyalty-reminder-popup__badge">{reminder.discountPercentage}% OFF</span>
        <p className="loyalty-reminder-popup__text">
          You have a {reminder.discountPercentage}% loyalty discount waiting on your next subscription renewal. Renew now to use it.
        </p>
        {reminder.daysUntilExpiry != null && (
          <p className="loyalty-reminder-popup__expiry">
            {reminder.daysUntilExpiry <= 0
              ? 'Expires today.'
              : `Expires in ${reminder.daysUntilExpiry} day${reminder.daysUntilExpiry === 1 ? '' : 's'}.`}
          </p>
        )}
        <div className="loyalty-reminder-popup__actions">
          <button type="button" className="loyalty-reminder-popup__renew-btn" onClick={handleRenew}>
            Renew now
          </button>
          <button type="button" className="loyalty-reminder-popup__later-btn" onClick={() => handleSnooze('later')}>
            Remind me later
          </button>
          <button type="button" className="loyalty-reminder-popup__skip-btn" onClick={() => handleSnooze('not_today')}>
            Not today
          </button>
        </div>
      </div>
    </div>
  );
}
