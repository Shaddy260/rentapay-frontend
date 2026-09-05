import React, { useId } from 'react';
import './MiniLineChart.css';

/**
 * Minimal SVG line chart, no charting library required (same
 * no-dependency approach as MiniBarChart/MiniDonutChart). `data` is
 * [{ label, value }] - used for the admin "landlords over time" /
 * "tenants over time" growth graphs.
 *
 * Styled like a trading/forex ticker chart: a smooth interpolated
 * curve (not sharp mountain-peak segments), a soft gradient fill that
 * fades to nothing, faint horizontal gridlines, and a single
 * highlighted last-point marker instead of a dot on every value.
 */
export default function MiniLineChart({ data, color = 'var(--color-accent)', unitLabel = '' }) {
  const gradientId = useId();
  const width = 320;
  const height = 140;
  const padX = 10;
  const padTop = 14;
  const padBottom = 16;

  const values = data.map((d) => d.value);
  const rawMax = Math.max(...values, 0);
  const rawMin = Math.min(...values, 0);
  // A little headroom above/below so the curve never touches the edges,
  // the way price charts pad their y-axis.
  const span = Math.max(rawMax - rawMin, 1);
  const max = rawMax + span * 0.15;
  const min = rawMin - span * 0.1;
  const range = Math.max(max - min, 1);

  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;
  const plotH = height - padTop - padBottom;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? padX + i * stepX : width / 2;
    const y = padTop + plotH - ((d.value - min) / range) * plotH;
    return { x, y, ...d };
  });

  // Catmull-Rom -> cubic bezier smoothing so the line reads as a
  // continuous curve rather than straight ruler-drawn segments.
  // TENSION controls how rounded peaks/troughs are - a wider fraction
  // of the neighbor-to-neighbor vector is used as the tangent, which
  // is what keeps even sparse, spiky data (e.g. a single day's signup
  // spike) reading as a soft wave rather than a sharp ruler-drawn
  // mountain peak, the way a real price/forex ticker line looks.
  const TENSION = 3.2; // higher = rounder curve (6 is a very gentle/subtle curve, forex-style needs more)
  const smoothPath = (pts) => {
    if (pts.length < 2) return pts.length === 1 ? `M${pts[0].x},${pts[0].y}` : '';
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / TENSION;
      const c1y = p1.y + (p2.y - p0.y) / TENSION;
      const c2x = p2.x - (p3.x - p1.x) / TENSION;
      const c2y = p2.y - (p3.y - p1.y) / TENSION;
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const linePath = smoothPath(points);
  const lastPoint = points[points.length - 1];
  const areaPath = points.length > 1
    ? `${linePath} L${lastPoint.x},${height - padBottom} L${points[0].x},${height - padBottom} Z`
    : '';

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => padTop + plotH * t);

  return (
    <div className="mini-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="mini-line-chart__svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="60%" stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map((y) => (
          <line key={y} x1={padX} x2={width - padX} y1={y} y2={y} className="mini-line-chart__grid" />
        ))}
        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {lastPoint && (
          <g>
            <circle cx={lastPoint.x} cy={lastPoint.y} r="7" fill={color} opacity="0.16" />
            <circle cx={lastPoint.x} cy={lastPoint.y} r="3" fill={color} stroke="var(--color-surface)" strokeWidth="1.5">
              <title>{`${lastPoint.label}: ${lastPoint.value.toLocaleString()}${unitLabel}`}</title>
            </circle>
          </g>
        )}
        {points.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="7" fill="transparent">
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
