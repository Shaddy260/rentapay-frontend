import React from 'react';
import EmptyState from './EmptyState';
import './RecentActivityList.css';

/**
 * Recent-activity list for inside a GlowCard - RentaPay-Glow-
 * Dashboard-Build-Spec.md §1.7. `items` is:
 *   [{ id, label, meta, status, statusTone, value }]
 * statusTone: 'good' | 'warn' | 'bad' | 'neutral' (drives the pill
 * color, always paired with the status TEXT itself - color is never
 * the only signal, per §1.10).
 */
export default function RecentActivityList({ items, emptyLabel = 'Nothing yet' }) {
  if (!items || items.length === 0) {
    return <EmptyState message={emptyLabel} compact />;
  }
  return (
    <ul className="recent-activity-list">
      {items.map((item) => (
        <li key={item.id} className="recent-activity-list__row">
          <span className={`recent-activity-list__dot recent-activity-list__dot--${item.statusTone || 'neutral'}`} aria-hidden="true" />
          <span className="recent-activity-list__body">
            <span className="recent-activity-list__label">{item.label}</span>
            {item.meta && <span className="recent-activity-list__meta">{item.meta}</span>}
          </span>
          {item.status && (
            <span className={`recent-activity-list__pill recent-activity-list__pill--${item.statusTone || 'neutral'}`}>
              {item.status}
            </span>
          )}
          {item.value !== undefined && <span className="recent-activity-list__value">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}
