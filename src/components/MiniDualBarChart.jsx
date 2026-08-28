import React from 'react';
import './MiniDualBarChart.css';

/**
 * FEATURE (Section 8: rent collection trend chart) - grouped bar chart
 * showing two series per month (e.g. rent collected vs rent owed), no
 * charting library required - same dependency-free approach as
 * MiniBarChart/MiniLineChart elsewhere in this app.
 *
 * `data` is [{ label, collected, owed }].
 */
export default function MiniDualBarChart({ data, seriesA = 'Collected', seriesB = 'Owed', valuePrefix = 'KES ' }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.collected, d.owed)));

  return (
    <div className="mini-dual-bar-chart">
      <div className="mini-dual-bar-chart__legend">
        <span className="mini-dual-bar-chart__legend-item">
          <span className="mini-dual-bar-chart__swatch mini-dual-bar-chart__swatch--a" />{seriesA}
        </span>
        <span className="mini-dual-bar-chart__legend-item">
          <span className="mini-dual-bar-chart__swatch mini-dual-bar-chart__swatch--b" />{seriesB}
        </span>
      </div>
      <div className="mini-dual-bar-chart__cols">
        {data.map((d) => (
          <div className="mini-dual-bar-chart__col" key={d.label}>
            <div className="mini-dual-bar-chart__track">
              <div
                className="mini-dual-bar-chart__bar mini-dual-bar-chart__bar--a"
                style={{ height: `${Math.max(3, (d.collected / max) * 100)}%` }}
                title={`${seriesA}, ${d.label}: ${valuePrefix}${d.collected.toLocaleString()}`}
              />
              <div
                className="mini-dual-bar-chart__bar mini-dual-bar-chart__bar--b"
                style={{ height: `${Math.max(3, (d.owed / max) * 100)}%` }}
                title={`${seriesB}, ${d.label}: ${valuePrefix}${d.owed.toLocaleString()}`}
              />
            </div>
            <span className="mini-dual-bar-chart__label">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
