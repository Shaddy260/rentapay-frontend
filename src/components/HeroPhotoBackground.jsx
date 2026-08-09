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
const PHOTOS = [
  'https://images.pexels.com/photos/110928/pexels-photo-110928.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/7168552/pexels-photo-7168552.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/17887559/pexels-photo-17887559.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/18995134/pexels-photo-18995134.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/7168446/pexels-photo-7168446.jpeg?auto=compress&cs=tinysrgb&w=1600',
];

export default function HeroPhotoBackground() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % PHOTOS.length), 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="landing__hero-photos" aria-hidden="true">
      {PHOTOS.map((src, i) => (
        <div
          key={src}
          className="landing__hero-photo"
          style={{ backgroundImage: `url(${src})`, opacity: i === index ? 1 : 0 }}
        />
      ))}
      <div className="landing__hero-photo-overlay" />
    </div>
  );
}
