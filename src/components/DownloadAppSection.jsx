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
// FIX (direct request: was a large card section low on the page,
// styled like a paywall/subscription card - moved into the top nav as
// a small pill next to Log in / Get started, and the version string
// removed entirely (it read from package.json's "version" field,
// which tracks npm package versioning, not the Android app's release
// number, and had drifted out of sync - simplest fix is to just not
// show a version here rather than wire up a second, real source of
// truth for it).
const APK_PATH = '/downloads/rentapay.apk';

export default function DownloadAppSection() {
  return (
    <a href={APK_PATH} download="RentaPay.apk" className="download-app-pill">
      <span className="download-app-pill__icon" aria-hidden="true">📲</span>
      <span className="download-app-pill__label">Download App</span>
    </a>
  );
}
