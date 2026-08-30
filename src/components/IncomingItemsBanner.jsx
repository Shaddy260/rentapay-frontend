import { useState, useCallback } from 'react';
import './IncomingItemsBanner.css';

// FEATURE (direct request): "any incoming [payments, messages,
// notifications, reminders, requests, reported accounts...] should
// show as a visible notifications banner... like the pending payments
// in admin portal... but once tapped it directs to where it's seated
// and once opened the banner disappears."
//
// Generalized version of the single inline banner AdminDashboard.jsx
// already had for pending landlord manual payments - same visual
// treatment (admin-banner--warning), but reusable for any list of
// incoming items across any portal (admin, General Manager, landlord,
// manager, caretaker).
//
// "Once opened the banner disappears": tapping calls the item's
// onClick (which navigates/switches tabs to wherever it lives) and
// then hides that banner for the rest of THIS session - it's not
// marking the underlying item as read/resolved server-side, so it
// reappears next session if still genuinely pending. That matches
// "for easy noticing and access" (a nudge to go look) rather than
// being a second, competing read-state on top of whatever
// read/resolved status the destination screen already tracks.
//
// items: [{ key, icon, label, count, onClick }]
// variant: 'default' | 'priority' - priority renders with the app's
// primary brand color instead of the warning-amber, and sits in its
// own separate <div> from any other banner group next to it, so a
// caller can render two IncomingItemsBanner instances side by side
// (e.g. payments as its own prioritized banner, everything else as a
// second group) and they read as two distinct things, not one list.
export default function IncomingItemsBanner({ items, storageKeyPrefix = 'rentapay_banner_dismissed_', variant = 'default' }) {
  const [dismissed, setDismissed] = useState(() => new Set());

  const handleTap = useCallback(
    (item) => {
      item.onClick?.();
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(item.key);
        return next;
      });
      try {
        sessionStorage.setItem(`${storageKeyPrefix}${item.key}`, '1');
      } catch {
        // sessionStorage can throw in locked-down/private browsing contexts - the
        // in-memory dismissed set above still works for this session either way.
      }
    },
    [storageKeyPrefix]
  );

  const visible = (items || []).filter((it) => {
    if (!it || !(it.count > 0)) return false;
    if (dismissed.has(it.key)) return false;
    try {
      if (sessionStorage.getItem(`${storageKeyPrefix}${it.key}`) === '1') return false;
    } catch {
      // ignore - see note above
    }
    return true;
  });

  if (visible.length === 0) return null;

  return (
    <div className={`incoming-items-banner incoming-items-banner--${variant}`}>
      {visible.map((it) => (
        <button key={it.key} type="button" className="incoming-items-banner__item" onClick={() => handleTap(it)}>
          <span>{it.icon ? `${it.icon} ` : ''}{it.label}</span>
          <span className="incoming-items-banner__count">{it.count}</span>
        </button>
      ))}
    </div>
  );
}
