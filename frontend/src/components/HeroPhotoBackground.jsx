import { useEffect, useState } from 'react';

/**
 * DIRECT REQUEST: hero background photos, same idea as Sahal's
 * onboarding screen - a real building photo behind the headline
 * instead of abstract gradient blobs, to give the landing page an
 * emotional "this is about real homes" pull.
 *
 * Sourced from Pexels (pexels.com/license - "Free to use, no
 * attribution required" for commercial use), NOT the Pinterest/
 * Facebook screenshots shared earlier - those were professional
 * marketing photography for named developments with no license to
 * reuse. These are a placeholder; swap PHOTOS for real RentaPay
 * listing photos (via getPublicListings) once enough are available -
 * see the note in Landing.jsx.
 */
export const PHOTOS = [
  'https://images.pexels.com/photos/110928/pexels-photo-110928.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/7168552/pexels-photo-7168552.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/17887559/pexels-photo-17887559.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/18995134/pexels-photo-18995134.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/7168446/pexels-photo-7168446.jpeg?auto=compress&cs=tinysrgb&w=1600',
];

/**
 * REUSED (direct request): the same rotating set of property photos
 * used behind the landing page hero is now also the background for
 * the login/signup screens - reusing this one component (instead of
 * copy-pasting the rotation logic) keeps the photos and the timing
 * consistent everywhere it's used. Callers can override which class
 * wraps the crossfading layers and how dark the overlay reads, since
 * the landing hero and the auth screens want different overlay
 * strengths.
 */
export default function HeroPhotoBackground({ wrapClassName = 'landing__hero-photos', photoClassName = 'landing__hero-photo', overlayClassName = 'landing__hero-photo-overlay' }) {
  const [index, setIndex] = useState(0);
  // Tracks which PHOTOS entries have actually finished downloading, so the
  // rotation can never crossfade onto an image the browser hasn't fetched yet.
  const [loaded, setLoaded] = useState(() => PHOTOS.map(() => false));

  // Force-fetch every photo up front via a real Image() (background-image in
  // CSS only fetches lazily, right when it's painted - too late for a
  // crossfade). This warms the browser cache so later opacity flips are instant.
  useEffect(() => {
    let cancelled = false;
    const images = PHOTOS.map((src, i) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setLoaded((prev) => {
          if (prev[i]) return prev;
          const next = [...prev];
          next[i] = true;
          return next;
        });
      };
      // If a photo fails to load, don't let it block rotation forever -
      // treat it as "loaded" so we skip past it instead of stalling.
      img.onerror = () => {
        if (cancelled) return;
        setLoaded((prev) => {
          if (prev[i]) return prev;
          const next = [...prev];
          next[i] = true;
          return next;
        });
      };
      img.src = src;
      return img;
    });
    return () => {
      cancelled = true;
      images.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => {
        // Advance to the next photo that's confirmed loaded. If nothing
        // further is ready yet, hold on the current one rather than
        // crossfading onto a blank layer.
        for (let step = 1; step <= PHOTOS.length; step += 1) {
          const candidate = (i + step) % PHOTOS.length;
          if (loaded[candidate]) return candidate;
        }
        return i;
      });
    }, 6000);
    return () => clearInterval(id);
  }, [loaded]);

  return (
    <div className={wrapClassName} aria-hidden="true">
      {PHOTOS.map((src, i) => (
        <div
          key={src}
          className={photoClassName}
          style={{ backgroundImage: `url(${src})`, opacity: i === index && loaded[i] ? 1 : 0 }}
        />
      ))}
      <div className={overlayClassName} />
    </div>
  );
}
