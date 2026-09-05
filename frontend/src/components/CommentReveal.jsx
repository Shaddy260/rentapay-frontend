import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import './CommentReveal.css';

/**
 * DIRECT REQUEST: comments everywhere in the app (rating comments,
 * flag reasons, etc.) are now condensed behind a tap instead of shown
 * inline - this is the shared "tap to reveal" component for that.
 *
 * Positioning is computed from the trigger button's own bounding rect
 * rather than plain CSS `position: absolute`, and then CLAMPED to stay
 * fully inside the viewport (direct request: popovers near a screen
 * edge were getting clipped, hiding part of the text). It also flips
 * to open above the trigger instead of below when there isn't enough
 * room underneath.
 */
export default function CommentReveal({ text, label = 'View comment' }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [style, setStyle] = useState(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;

    function reposition() {
      const rect = btnRef.current.getBoundingClientRect();
      const margin = 12;
      const popW = Math.min(320, window.innerWidth - margin * 2);
      const estHeight = 160;

      let left = rect.left;
      if (left + popW > window.innerWidth - margin) left = window.innerWidth - margin - popW;
      if (left < margin) left = margin;

      let top = rect.bottom + 8;
      if (top + estHeight > window.innerHeight - margin) {
        // Not enough room below - flip above the trigger instead.
        top = rect.top - estHeight - 8;
        if (top < margin) top = margin;
      }

      setStyle({ left, top, width: popW });
    }

    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  if (!text) return null;

  return (
    <>
      <button type="button" className="comment-reveal__trigger" ref={btnRef} onClick={() => setOpen((o) => !o)}>
        💬 {label}
      </button>
      {open && createPortal(
        <>
          <div className="comment-reveal__scrim" onClick={() => setOpen(false)} />
          <div className="comment-reveal__popover" style={style || { opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <p>{text}</p>
            <button type="button" className="comment-reveal__close" onClick={() => setOpen(false)}>Close</button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
