import { useEffect, useRef } from 'react';
import './PhotoScrollStrip.css';

// FEATURE (direct request): the "smooth scroll effect" trend - a
// horizontally scrollable strip where each item's scale and opacity
// respond live to how close it sits to the strip's center as the
// user scrolls, instead of a flat static row/grid of thumbnails.
//
// Shared by every place someone browses a set of unit photos: the
// landlord/manager's own unit-editor Photos panel (UnitPhotosPanel)
// and the full-screen photo viewer's thumbnail strip (PhotoLightbox)
// - which is also what the public listing pages open when a visitor
// taps a unit's cover photo. Wiring the effect in here once means it
// reaches the landlord side AND the public folder from one place,
// rather than two separate reimplementations drifting apart.
//
// Pure CSS transform/opacity driven by IntersectionObserver - no
// scroll event listener, no animation library, so it stays cheap on
// low-end phones (this app is mobile-first per the rest of the UI).
export default function PhotoScrollStrip({ children, className = '' }) {
  const stripRef = useRef(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return undefined;
    const items = Array.from(strip.querySelectorAll('.photo-scroll-strip__item'));
    if (items.length === 0) return undefined;

    // Only a slim vertical band running down the center of the strip
    // counts as "in view" for this observer (achieved by shrinking
    // the root with a large negative left/right rootMargin). As an
    // item's overlap with that center band grows from 0 -> 1 while
    // it scrolls past, we scale it up toward full size and full
    // opacity; everything outside the band settles back down. That's
    // what makes the centered photo "pop" while its neighbours stay
    // small, instead of a flat row.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const ratio = entry.intersectionRatio;
          const scale = 0.82 + 0.18 * ratio;
          const opacity = 0.45 + 0.55 * ratio;
          entry.target.style.transform = `scale(${scale.toFixed(3)})`;
          entry.target.style.opacity = opacity.toFixed(3);
        });
      },
      {
        root: strip,
        rootMargin: '0px -38%',
        threshold: CENTER_THRESHOLDS,
      }
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
    // Re-run whenever the photo list itself changes (upload/remove),
    // since that's a new set of DOM nodes to observe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  return (
    <div ref={stripRef} className={`photo-scroll-strip ${className}`}>
      {children}
    </div>
  );
}

// Fine-grained thresholds (0, 0.05, 0.10 ... 1) so the callback fires
// often enough for the scale/opacity change to read as smooth and
// continuous rather than a handful of visible jumps.
const CENTER_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);
