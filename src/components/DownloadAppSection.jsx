import React from 'react';
import './DownloadAppSection.css';

// FEATURE (direct request: Play Store card on the landing page footer).
//
// UPDATE (direct request, replaces the old direct-APK-download card):
// there's no live Play Store listing yet, so this points at the Play
// Store search results page as a harmless placeholder. THE ONLY THING
// TO CHANGE once the app is published is PLAY_STORE_URL below - swap
// it for the real listing URL, e.g.
// "https://play.google.com/store/apps/details?id=com.rentapay.app",
// and the card starts sending people straight to the real listing.
// No other markup/CSS changes needed.
const PLAY_STORE_URL = 'https://play.google.com/store/search?q=rentapay';

export default function DownloadAppSection() {
  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="download-app-card"
      data-download-fx
    >
      <span className="download-app-card__icon" aria-hidden="true">▶️</span>
      <span className="download-app-card__text">
        <span className="download-app-card__subtitle">GET IT ON</span>
        <span className="download-app-card__title">Google Play</span>
      </span>
    </a>
  );
}

