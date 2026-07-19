import React from 'react';
import './MiniBarChart.css';

/**
 * Minimal bar chart, no charting library required (keeps the frontend
 * dependency-free rather than pulling in recharts/chart.js just for
 * one screen). `data` is [{ label, value }], values in KES.
 */
export default function MiniBarChart({ data, valuePrefix = 'KES ' }) {
  const max = Math.max(1, ...data.map((d) => d.value));

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
          <span className="mini-bar-chart__value">{d.value > 0 ? Math.round(d.value / 1000) + 'k' : '0'}</span>
          <span className="mini-bar-chart__label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
