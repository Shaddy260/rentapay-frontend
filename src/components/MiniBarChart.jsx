import React from 'react';
import './MiniBarChart.css';

/**
 * Minimal bar chart, no charting library required (keeps the frontend
 * dependency-free rather than pulling in recharts/chart.js just for
 * one screen). `data` is [{ label, value }].
 *
 * Defaults to KES-style values (rounded to the nearest thousand, e.g.
 * "12k") since that's every existing caller (AdminStatistics,
 * LandlordStatistics, StatisticsPanel). Pass `formatValue` to override
 * for non-money counts (e.g. the BA portal's "landlords onboarded"
 * rollups, Phase 5) without touching those callers.
 */
export default function MiniBarChart({ data, valuePrefix = 'KES ', formatValue }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const renderValue = formatValue || ((v) => (v > 0 ? Math.round(v / 1000) + 'k' : '0'));

  return (
    <div className="mini-bar-chart">
      {data.map((d) => (
        <div className="mini-bar-chart__col" key={d.label}>
          <div className="mini-bar-chart__track">
            <div
              className="mini-bar-chart__bar"
              style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }}
              title={`${d.label}: ${valuePrefix}${d.value.toLocaleString()}`}
            />
          </div>
          <span className="mini-bar-chart__value">{renderValue(d.value)}</span>
          <span className="mini-bar-chart__label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
