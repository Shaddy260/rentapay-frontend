import React from 'react';
import './GlowCard.css';

/**
 * GlowCard - shared primitive every "Glow Dashboard" tile is built
 * from (RentaPay-Glow-Dashboard-Build-Spec.md §1.3). Renders a
 * <section> (required for the aria-label a11y rule in §1.10) with a
 * glass-ish surface, a 1px border in the section's accent color, a
 * glow box-shadow, and a top accent bar.
 *
 * accent: one of 'blue' | 'teal' | 'amber' | 'purple' | 'green' | 'red'
 * (maps to the --glow-* tokens in tokens.css).
 *
 * quiet: drops the glow box-shadow (keeps the 1px border) - used for
 * KPI mini-grid children so they read as children of the hero card,
 * not competing with it (§1.5).
 */
export default function GlowCard({
  accent = 'blue',
  title,
  children,
  className = '',
  quiet = false,
  as: Tag = 'section',
  style,
  ...props
}) {
  const cardStyle = {
    '--glow-accent': `var(--glow-${accent})`,
    '--glow-accent-a': `var(--glow-${accent}-a)`,
    '--glow-accent-text': `var(--glow-${accent}-text)`,
    ...style,
  };

  return (
    <Tag
      className={`glow-card${quiet ? ' glow-card--quiet' : ''}${className ? ` ${className}` : ''}`}
      style={cardStyle}
      aria-label={title || undefined}
      {...props}
    >
      <span className="glow-card__accent-bar" aria-hidden="true" />
      {children}
    </Tag>
  );
}
