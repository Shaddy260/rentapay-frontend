import { useEffect, useCallback } from 'react';

// FEATURE (direct request: unit photos were showing as a single,
// non-clickable thumbnail on vacancy cards - "it should have a
// small UI for the photos of the unit...and clickable and expands upon
// clicking"). A minimal, dependency-free full-screen viewer: tap a
// thumbnail anywhere in the app, see every photo for that unit,
// step through with arrows/keyboard, tap a strip thumbnail to jump.
export default function PhotoLightbox({ photos = [], index = 0, onIndexChange, onClose, title }) {
  const count = photos.length;

  const goTo = useCallback(
    (i) => {
      if (count === 0) return;
      const next = ((i % count) + count) % count;
      onIndexChange?.(next);
    },
    [count, onIndexChange]
  );

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight') goTo(index + 1);
      if (e.key === 'ArrowLeft') goTo(index - 1);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [index, goTo, onClose]);

  if (count === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title} photos` : 'Photo viewer'}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.9)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={(e) => { e.stopPropagation(); onClose?.(); }}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'rgba(255,255,255,0.15)',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 36,
          height: 36,
          fontSize: '1.1em',
          cursor: 'pointer',
        }}
      >
        ✕
      </button>

      {title && (
        <div style={{ color: '#fff', marginBottom: 10, fontSize: '0.95em', opacity: 0.85 }}>{title}</div>
      )}

      <div
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        {count > 1 && (
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => goTo(index - 1)}
            style={navButtonStyle('left')}
          >
            ‹
          </button>
        )}

        <img
          src={photos[index]}
          alt={`${title ? `${title} - ` : ''}photo ${index + 1} of ${count}`}
          style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain' }}
        />

        {count > 1 && (
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => goTo(index + 1)}
            style={navButtonStyle('right')}
          >
            ›
          </button>
        )}
      </div>

      {count > 1 && (
        <div style={{ color: '#fff', marginTop: 10, fontSize: '0.85em', opacity: 0.8 }}>
          {index + 1} / {count}
        </div>
      )}

      {count > 1 && (
        <div
          style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '90%' }}
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((url, i) => (
            <img
              key={url + i}
              src={url}
              alt={`Thumbnail ${i + 1}`}
              onClick={() => goTo(i)}
              style={{
                width: 48,
                height: 48,
                objectFit: 'cover',
                borderRadius: 6,
                cursor: 'pointer',
                border: i === index ? '2px solid #fff' : '2px solid transparent',
                opacity: i === index ? 1 : 0.6,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function navButtonStyle(side) {
  return {
    position: 'absolute',
    [side]: -8,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: 40,
    height: 40,
    fontSize: '1.6em',
    lineHeight: '1',
    cursor: 'pointer',
  };
}
