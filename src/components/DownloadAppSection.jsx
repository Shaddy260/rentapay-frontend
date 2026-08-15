import React from 'react';
import './DownloadAppSection.css';

// FEATURE (direct request: "Download RentaPay App" button on the landing
// page). This is a separate path from the browser's native PWA install
// banner (see InstallAppBanner) - it serves a real, signed Android APK
// as a static file, for people who don't get the PWA prompt or who
// specifically want the standalone app before we have a Play Store
// listing. Points at /downloads/rentapay.apk, which is not committed to
// the repo; it's dropped in manually after each `bubblewrap build`.
//
// REDESIGN (Premium Redesign Plan, Phase 1): moved out of the top nav
// entirely (nav is now just Logo | Login, per plan) and into the
// footer as a proper, well-designed tappable card - not a plain text
// link - with an icon and clear visual weight consistent with the
// rest of the premium redesign. Still points straight at the .apk
// file so tapping it triggers a direct file download, not an external
// store page.
const APK_PATH = '/downloads/rentapay.apk';

export default function DownloadAppSection() {
  return (
    <a href={APK_PATH} download="RentaPay.apk" className="download-app-card">
      <span className="download-app-card__icon" aria-hidden="true">📲</span>
      <span className="download-app-card__text">
        <span className="download-app-card__title">Download the app</span>
        <span className="download-app-card__subtitle">Get RentaPay for Android</span>
      </span>
      <span className="download-app-card__arrow" aria-hidden="true">↓</span>
    </a>
  );
}

