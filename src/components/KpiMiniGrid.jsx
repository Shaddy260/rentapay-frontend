import React from 'react';
import GlowCard from './GlowCard';
import './KpiMiniGrid.css';

/**
 * 2x2 (1x4 on wide screens) grid of small quiet GlowCards - RentaPay-
 * Glow-Dashboard-Build-Spec.md §1.5. `items` is
 * [{ label, value, caption }]. `accent` is passed straight through to
 * each child GlowCard so they share the parent section's color.
 */
export default function KpiMiniGrid({ items, accent }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="kpi-mini-grid">
      {items.map((item) => (
        <GlowCard key={item.label} accent={accent} quiet className="kpi-mini-grid__card" title={item.label}>
          <span className="kpi-mini-grid__label">{item.label}</span>
          <span className="kpi-mini-grid__value">{item.value}</span>
          {item.caption && <span className="kpi-mini-grid__caption">{item.caption}</span>}
        </GlowCard>
      ))}
    </div>
  );
}
