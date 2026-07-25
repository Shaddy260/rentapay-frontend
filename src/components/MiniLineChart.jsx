import React from 'react';
import './MiniLineChart.css';

/**
 * Minimal SVG line chart, no charting library required (same
 * no-dependency approach as MiniBarChart/MiniDonutChart). `data` is
 * [{ label, value }], plotted as a running-total line - used for the
 * admin "landlords over time" / "tenants over time" growth graphs.
 */
export default function MiniLineChart({ data, color = 'var(--color-accent)', unitLabel = '' }) {
  const width = 320;
  const height = 140;
  const padX = 24;
  const padY = 16;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = height - padY - (d.value / max) * (height - padY * 2);
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1]?.x || 0},${height - padY} L${padX},${height - padY} Z`;

  return (
    <div className="mini-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="mini-line-chart__svg" preserveAspectRatio="none">
        <path d={areaPath} fill={color} opacity="0.12" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="3.5" fill={color}>
            <title>{`${p.label}: ${p.value.toLocaleString()}${unitLabel}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mini-line-chart__labels">
        {data.map((d) => (
          <span key={d.label} className="mini-line-chart__label">{d.label}</span>
        ))}
      </div>
    </div>
  );
}
