import React, { useEffect, useState } from 'react';
import { subscribeToVacancyAlerts } from '../utils/vacancyAlertPush.js';
import { getCountyWithPrompt } from '../utils/geoCounty.js';
import { KENYA_COUNTIES } from '../constants/kenyaCounties.js';
import './VacancyAlertOptIn.css';

// DIRECT REQUEST: the real (not decorative) "receive browser
// notifications when a unit goes vacant around them, or just when a
// unit goes vacant" opt-in. Deliberately a custom pre-prompt UI shown
// first, since going straight to the browser's native permission
// dialog with no context is what gets sites' notification prompts
// reflexively denied/blocked - this explains the value first, and
// only calls Notification.requestPermission() once the visitor
// actually taps "Enable" here.
//
// Shown after a little more engagement than the decorative toast
// (see ENGAGE_THRESHOLD below), and NOT at all if the browser has
// already decided the permission (granted or denied) or the visitor
// dismissed it within the last 3 days.

const DISMISS_KEY = 'rentapay_vacancy_optin_dismissed_at';
const SUBSCRIBED_KEY = 'rentapay_vacancy_optin_subscribed';
const REASK_DAYS = 3;
const ENGAGE_MS = 20000; // a bit more time on site than the decorative toast needs

function wasRecentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < REASK_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
function markDismissed() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
}
function markSubscribed() {
  try { localStorage.setItem(SUBSCRIBED_KEY, '1'); } catch { /* ignore */ }
}
function alreadySubscribed() {
  try { return localStorage.getItem(SUBSCRIBED_KEY) === '1'; } catch { return false; }
}

export default function VacancyAlertOptIn() {
  const [open, setOpen] = useState(false);
  const [county, setCounty] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | working | done | denied | error

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return; // unsupported browser - no point ever showing this
    if (Notification.permission !== 'default') return; // already granted or denied - browser already decided
    if (alreadySubscribed() || wasRecentlyDismissed()) return;

    const timer = setTimeout(async () => {
      setOpen(true);
      setDetecting(true);
      const detected = await getCountyWithPrompt().catch(() => null);
      if (detected) setCounty(detected);
      setDetecting(false);
    }, ENGAGE_MS);

    return () => clearTimeout(timer);
  }, []);

  if (!open) return null;

  async function handleEnable() {
    setStatus('working');
    const result = await subscribeToVacancyAlerts(county || null);
    if (result === 'granted') {
      setStatus('done');
      markSubscribed();
      setTimeout(() => setOpen(false), 2000);
    } else if (result === 'denied') {
      setStatus('denied');
      markDismissed();
    } else {
      setStatus('error');
    }
  }

  function handleDismiss() {
    markDismissed();
    setOpen(false);
  }

  return (
    <div className="vacancy-optin" role="dialog" aria-label="Vacancy alerts">
      <button className="vacancy-optin__dismiss" aria-label="Dismiss" onClick={handleDismiss}>×</button>

      {status === 'done' ? (
        <p className="vacancy-optin__done">You're subscribed - we'll notify you the moment a matching unit goes vacant.</p>
      ) : status === 'denied' ? (
        <p className="vacancy-optin__done">No problem - you can always turn this on later from your browser's site settings.</p>
      ) : (
        <>
          <p className="vacancy-optin__title">Get notified the moment a unit goes vacant</p>
          <p className="vacancy-optin__body">
            We'll send a browser notification when a new vacancy appears - near you, or anywhere in Kenya.
          </p>

          <label className="vacancy-optin__county-label" htmlFor="vacancy-optin-county">
            {detecting ? 'Detecting your county…' : 'County'}
          </label>
          <select
            id="vacancy-optin-county"
            className="vacancy-optin__county-select"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            disabled={detecting}
          >
            <option value="">Any county (all vacancies)</option>
            {KENYA_COUNTIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {status === 'error' && (
            <p className="vacancy-optin__error">Something went wrong - please try again.</p>
          )}

          <div className="vacancy-optin__actions">
            <button className="vacancy-optin__btn vacancy-optin__btn--ghost" onClick={handleDismiss} disabled={status === 'working'}>
              Not now
            </button>
            <button className="vacancy-optin__btn vacancy-optin__btn--primary" onClick={handleEnable} disabled={status === 'working'}>
              {status === 'working' ? 'Enabling…' : 'Enable notifications'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
