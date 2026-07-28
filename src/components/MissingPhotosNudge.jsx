// src/components/MissingPhotosNudge.jsx
//
// FEATURE (direct request #1): a dismissible nudge for vacant units
// with zero photos - "Units with photos get more inquiries." Never a
// blocking modal (landlords shouldn't be forced to add photos), just
// persistent enough to nag gently: dismissed state is stored in
// localStorage per-scope, so it goes away for the day/session rather
// than being gone forever, and comes back the next time there's
// actually something to nag about (a newly-added photo-less unit, or
// a fresh browser).
import React, { useState } from 'react';

const DISMISS_KEY_PREFIX = 'rentapay:missingPhotosDismissedAt:';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // re-surfaces once a day

function isDismissed(scopeKey) {
  try {
    const raw = localStorage.getItem(DISMISS_KEY_PREFIX + scopeKey);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function dismiss(scopeKey) {
  try {
    localStorage.setItem(DISMISS_KEY_PREFIX + scopeKey, String(Date.now()));
  } catch {
    // localStorage unavailable (private mode, etc.) - fine to just no-op
  }
}

/** Returns vacant units with no photos from a units array. */
export function vacantUnitsMissingPhotos(units) {
  return (units || []).filter((u) => u.status === 'vacant' && (!u.photo_urls || u.photo_urls.length === 0));
}

/**
 * Banner for a list of units (Dashboard) or a single unit (UnitDetail).
 * `scopeKey` should be stable per place-it's-shown (e.g. `dashboard:<propertyId>`
 * or `unit:<unitId>`) so dismissing one doesn't hide a different one.
 */
export function MissingPhotosBanner({ units, scopeKey, onAddPhotos }) {
  const [dismissedTick, setDismissedTick] = useState(0);
  const missing = vacantUnitsMissingPhotos(units);

  if (missing.length === 0) return null;
  if (isDismissed(scopeKey)) return null;

  const message =
    missing.length === 1
      ? `"${missing[0].unit_name}" has no photos. Units with photos get more inquiries - add some now.`
      : `${missing.length} vacant units have no photos. Units with photos get more inquiries - add some now.`;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 16px',
        margin: '12px 0',
        background: '#fff8e6',
        border: '1px solid #f0dfa6',
        borderRadius: 10,
        fontSize: 14,
      }}
    >
      <span>📷 {message}</span>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {onAddPhotos && (
          <button
            type="button"
            onClick={() => onAddPhotos(missing.length === 1 ? missing[0] : missing)}
            style={{ background: '#b8860b', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}
          >
            Add photos
          </button>
        )}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => { dismiss(scopeKey); setDismissedTick((t) => t + 1); }}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: '#8a7530', lineHeight: 1 }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** Small count badge, e.g. next to a property name in a list. */
export function MissingPhotosBadge({ units }) {
  const count = vacantUnitsMissingPhotos(units).length;
  if (count === 0) return null;
  return (
    <span
      title={`${count} vacant unit(s) missing photos`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginLeft: 8,
        padding: '1px 8px',
        borderRadius: 999,
        background: '#fff3cd',
        color: '#8a6d00',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      📷 {count} missing
    </span>
  );
}
