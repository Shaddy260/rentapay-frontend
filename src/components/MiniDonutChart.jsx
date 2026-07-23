import React from 'react';
import './MiniDonutChart.css';

/**
 * Minimal donut chart built with a CSS conic-gradient - no charting
 * library needed. `segments` is [{ label, value, color }].
 */
export default function MiniDonutChart({ segments, centerLabel }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let acc = 0;
  const stops = segments
    .map((s) => {
      const start = (acc / total) * 360;
      acc += s.value;
      const end = (acc / total) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    })
    .join(', ');

  return (
    <div className="mini-donut">
      <div className="mini-donut__ring" style={{ background: `conic-gradient(${stops})` }}>
        <div className="mini-donut__hole">
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="mini-donut__legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="mini-donut__swatch" style={{ background: s.color }} />
            {s.label} ({s.value})
          </li>
        ))}
      </ul>
    </div>
  );
}
