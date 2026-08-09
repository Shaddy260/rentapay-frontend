import React, { useEffect, useRef, useState } from 'react';
import './InfoTip.css';

/**
 * FEATURE (direct request): "audit every screen for inline
 * explanatory text placed next to UI elements... replace the
 * always-visible text with a small dropdown/info icon next to the
 * element - the explanation should only appear when the user
 * taps/expands it, not be permanently displayed."
 *
 * A small "ⓘ" button that reveals a short explanation in a popover on
 * tap, and closes again on an outside tap or a second tap - so the
 * explanation is available on demand instead of permanently taking up
 * space on the screen.
 */
export default function InfoTip({ text, label = 'More info' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [open]);

  return (
    <span className="info-tip" ref={ref}>
      <button type="button" className="info-tip__icon" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        ⓘ
      </button>
      {open && (
        <span className="info-tip__bubble" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
