import React from 'react';
import GlowCard from './GlowCard';
import MiniLineChart from './MiniLineChart';
import MiniBarChart from './MiniBarChart';
import './TrendCardMini.css';

/**
 * Small trend chart sitting in its own quiet GlowCard - RentaPay-
 * Glow-Dashboard-Build-Spec.md §1.6. Reuses MiniLineChart/MiniBarChart
 * rather than a new chart primitive; `variant` picks which one.
 * `data` is [{ label, value }].
 */
export default function TrendCardMini({ title, data, accent = 'blue', variant = 'line', formatValue }) {
  const colorVar = `var(--glow-${accent})`;
  return (
    <GlowCard accent={accent} quiet className="trend-card-mini" title={title}>
      {title && <span className="trend-card-mini__title">{title}</span>}
      <div className="trend-card-mini__chart">
        {variant === 'bar' ? (
          <MiniBarChart data={data} formatValue={formatValue || ((v) => String(v))} />
        ) : (
          <MiniLineChart data={data} color={colorVar} />
        )}
      </div>
    </GlowCard>
  );
}
