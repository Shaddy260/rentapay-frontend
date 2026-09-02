import React, { useEffect, useState } from 'react';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import { api } from '../api/client.js';
import './RateTenantReminderPopup.css';

/**
 * DIRECT REQUEST: a dismissible popup that randomly nudges the
 * landlord/manager/caretaker to rate a tenant that hasn't been rated
 * yet - either at random or right after that tenant's payment is
 * confirmed (see tenantRatingReminder.service.js on the backend).
 * Tapping it opens that tenant's unit so the "Rate tenant" UI there
 * can be used; "Remind me later" snoozes ~1 hour, "Not today" hides
 * it for the rest of the day. Not mandatory - can always be dismissed.
 *
 * Mount once near the top of each portal's layout (landlord/manager/
 * caretaker only - tenants don't rate other tenants).
 */
export default function RateTenantReminderPopup({ token }) {
  const navigate = useNavigate();
  const [reminder, setReminder] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    // Fires once shortly after the portal loads, then again at a
    // random-ish interval so it doesn't feel like a fixed timer.
    function schedule(delayMs) {
      return setTimeout(async () => {
        if (cancelled) return;
        try {
          const res = await api.getNextRatingReminder(token);
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
      await api.snoozeRatingReminder(reminder.reminderId, mode, token);
    } catch {
      // Non-fatal - it'll just resurface next cycle.
    }
  }

  function handleOpen() {
    setVisible(false);
    if (reminder.unitId) navigate(`/units/${reminder.unitId}`);
  }

  const reasonText = reminder.reason === 'payment'
    ? `${reminder.tenantName} just paid - rate their tenancy while it's fresh?`
    : `Got a minute to rate ${reminder.tenantName}${reminder.unitLabel ? ` (${reminder.unitLabel})` : ''}?`;

  return (
    <div className="rate-reminder-overlay" role="dialog" aria-label="Rate tenant reminder">
      <div className="rate-reminder-popup">
        <p className="rate-reminder-popup__text">{reasonText}</p>
        <div className="rate-reminder-popup__actions">
          <button type="button" className="rate-reminder-popup__rate-btn" onClick={handleOpen}>
            Rate now
          </button>
          <button type="button" className="rate-reminder-popup__later-btn" onClick={() => handleSnooze('later')}>
            Remind me later
          </button>
          <button type="button" className="rate-reminder-popup__skip-btn" onClick={() => handleSnooze('not_today')}>
            Not today
          </button>
        </div>
      </div>
    </div>
  );
}
