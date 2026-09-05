import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import './DarajaHealthBanner.css';

// DIRECT REQUEST: "a real-time banner always seen in landlord,
// manager and caretaker portals, showing if the automatic popups for
// M-Pesa are working - only if they set the Daraja credentials."
//
// Same "always on" pattern as OwnershipVerificationBanner.jsx (not
// dismissible - the whole point is it can't be nagged away), but this
// one is read-only status rather than an action item, so it's a
// compact strip rather than a full banner with a button.
//
// Renders nothing at all in three cases, by design:
//  - the health check hasn't resolved yet (avoids a flash on load)
//  - the landlord never saved Daraja credentials in the first place
//  - the landlord explicitly disabled automatic collection (an
//    intentional opt-out, not something to keep flagging)
// The /health endpoint itself returns { health: null } for the last
// two, so this component only has to check for null.
//
// "Real-time": polls every 45s while the tab is visible, so the
// banner reflects actual recent tenant payment attempts (not just
// the one-off setup verification) without needing a page reload.
const POLL_INTERVAL_MS = 45000;

export default function DarajaHealthBanner({ token }) {
  const [health, setHealth] = useState(undefined); // undefined = not loaded yet, null = nothing to show
  const timeoutRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await api.getDarajaHealth(token);
        if (!cancelled) setHealth(res.health || null);
      } catch {
        // Fail quiet, same reasoning as OwnershipVerificationBanner -
        // a transient error here shouldn't itself become a banner.
        // Keep whatever we last knew rather than flipping to "hidden".
      } finally {
        if (!cancelled) timeoutRef.current = setTimeout(load, POLL_INTERVAL_MS);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [token]);

  if (!health) return null;

  const { isHealthy, message, status } = health;
  const stateClass = isHealthy ? 'daraja-health-banner--ok' : status === 'pending_verification' ? 'daraja-health-banner--pending' : 'daraja-health-banner--down';

  return (
    <div className={`daraja-health-banner ${stateClass}`}>
      <span className="daraja-health-banner__icon">{isHealthy ? '🟢' : status === 'pending_verification' ? '🟡' : '🔴'}</span>
      <span className="daraja-health-banner__text">
        <strong>Automatic M-Pesa popups: </strong>
        {message}
      </span>
    </div>
  );
}
