import { useState } from 'react';

/**
 * Wraps a hint/help string so it's hidden behind a "Tap to reveal" toggle
 * instead of being shown by default. Preserves the original className so
 * existing CSS still applies once revealed.
 */
export default function TapToReveal({ className = '', children, as: Tag = 'p', revealLabel = 'Tap to reveal' }) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <Tag className={className}>
      <button
        type="button"
        className="tap-to-reveal__toggle"
        onClick={() => setRevealed(true)}
      >
        {revealLabel}
      </button>
    </Tag>
  );
}
