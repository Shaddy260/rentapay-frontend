// Reusable loading-state placeholder.
//
// FEATURE (direct request: "skeleton loading states"): every portal
// previously just rendered the plain text "Loading…" while data
// fetched - for a payments app, a blank line during something like an
// M-Pesa STK push is a bad trust moment (does it look frozen, or is
// it working?). A skeleton that mimics the *shape* of what's coming
// reads as "actively working," not "maybe broken."
//
// Usage:
//   <Skeleton rows={3} />                  - a stack of text-line bars
//   <Skeleton variant="card" count={4} />  - a grid of card-shaped blocks
import './Skeleton.css';

export default function Skeleton({ variant = 'lines', rows = 3, count = 1, height }) {
  if (variant === 'card') {
    return (
      <div className="skeleton-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-bar skeleton-bar--title" />
            <div className="skeleton-bar" />
            <div className="skeleton-bar skeleton-bar--short" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="skeleton-lines" style={height ? { minHeight: height } : undefined}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-bar" style={i === rows - 1 ? { width: '60%' } : undefined} />
      ))}
    </div>
  );
}
