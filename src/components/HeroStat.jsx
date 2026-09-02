import React from 'react';
import Button from './Button';
import './HeroStat.css';

/**
 * Hero stat block for inside a GlowCard - RentaPay-Glow-Dashboard-
 * Build-Spec.md §1.4. `delta` is optional: { value: '+12%', positive: true }.
 * `action` is optional: { label, onClick } - reuses the shared Button
 * component rather than a new one-off button (per spec).
 */
export default function HeroStat({ eyebrow, value, delta, action }) {
  return (
    <div className="hero-stat">
      {eyebrow && <div className="hero-stat__eyebrow">{eyebrow}</div>}
      <div className="hero-stat__value">{value}</div>
      {delta && (
        <span className={`hero-stat__delta ${delta.positive ? 'hero-stat__delta--positive' : 'hero-stat__delta--negative'}`}>
          {delta.value}
        </span>
      )}
      {action && (
        <div className="hero-stat__action">
          <Button variant="ghost" className="hero-stat__action-btn" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
