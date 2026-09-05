import React from 'react';
import Button from './Button.jsx';
import './EmptyState.css';

// Reusable empty-state block.
//
// PROBLEM: empty lists across the app just rendered a plain sentence
// ("No units found...") - a dead end, especially unhelpful for a
// brand-new landlord who has nothing set up yet and doesn't
// know what to do next.
//
// FIX: a shared icon + short encouraging copy + (optional) clear
// next-action button, e.g. "No vacant units yet" -> "Add your first
// unit". Drop this in anywhere a list/table currently falls back to a
// bare "No X found" sentence.
//
// `icon` accepts any emoji/character (kept consistent with the rest of
// the app's emoji-as-icon convention, e.g. the ⬇/🔁/⚠️ used elsewhere)
// or a small inline SVG/element if you need something custom.
export default function EmptyState({
  icon = '📭',
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}) {
  return (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''}`}>
      <div className="empty-state__icon" aria-hidden="true">{icon}</div>
      {title && <p className="empty-state__title">{title}</p>}
      {message && <p className="empty-state__message">{message}</p>}
      {actionLabel && onAction && (
        <div className="empty-state__action">
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
