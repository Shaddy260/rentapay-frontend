import React, { useState, useEffect } from 'react';

/**
 * Live countdown to a target date/time, broken down into
 * years / months / days / hours / minutes / seconds - used for both
 * the subscription-expiry countdown (landlord dashboard) and the
 * rent-due / credit-runs-out countdown (tenant + landlord portals).
 *
 * Ticks every second on its own; the parent just hands it a target
 * date and doesn't need to manage any timer itself.
 */
export default function Countdown({ target, expiredLabel = 'Now due', className = '' }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!target) return null;

  const targetDate = target instanceof Date ? target : new Date(target);
  let diffMs = targetDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return <span className={`countdown countdown--expired ${className}`}>{expiredLabel}</span>;
  }

  // Calendar-aware breakdown (not just dividing milliseconds) so
  // "1 month" actually means one real calendar month, not a fixed
  // 30-day approximation that drifts.
  let years = 0;
  let months = 0;
  let cursor = new Date(now);

  while (true) {
    const next = new Date(cursor);
    next.setFullYear(next.getFullYear() + 1);
    if (next.getTime() <= targetDate.getTime()) {
      cursor = next;
      years += 1;
    } else {
      break;
    }
  }
  while (true) {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    if (next.getTime() <= targetDate.getTime()) {
      cursor = next;
      months += 1;
    } else {
      break;
    }
  }

  const remainderMs = targetDate.getTime() - cursor.getTime();
  const days = Math.floor(remainderMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remainderMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((remainderMs / (1000 * 60)) % 60);
  const seconds = Math.floor((remainderMs / 1000) % 60);

  // Redesigned: instead of a flat monospace string, render each unit as
  // its own small "chip" with the number on top and its label beneath -
  // reads more like a real countdown timer, and the seconds chip gets a
  // subtle per-tick pulse so the countdown visibly feels alive.
  const segments = [];
  if (years > 0) segments.push({ value: years, label: years === 1 ? 'yr' : 'yrs' });
  if (years > 0 || months > 0) segments.push({ value: months, label: months === 1 ? 'mo' : 'mos' });
  segments.push({ value: days, label: days === 1 ? 'day' : 'days' });
  segments.push({ value: hours, label: 'hrs' });
  segments.push({ value: minutes, label: 'min' });
  segments.push({ value: seconds, label: 'sec', pulse: true });

  return (
    <span className={`countdown ${className}`}>
      {segments.map((seg, i) => (
        <React.Fragment key={seg.label}>
          {i > 0 && <span className="countdown__sep">:</span>}
          <span className={`countdown__chip ${seg.pulse ? 'countdown__chip--pulse' : ''}`}>
            <span className="countdown__value">{String(seg.value).padStart(2, '0')}</span>
            <span className="countdown__label">{seg.label}</span>
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}
