import React from 'react';
import pkg from '../../package.json';
import './DownloadAppSection.css';

// FEATURE (direct request: "Download RentaPay App" button on the landing
// page). This is a separate path from the browser's native PWA install
// banner (see InstallAppBanner) - it serves a real, signed Android APK
// as a static file, for people who don't get the PWA prompt or who
// specifically want the standalone app before we have a Play Store
// listing. Points at /downloads/rentapay.apk, which is not committed to
// the repo; it's dropped in manually after each `bubblewrap build`.
const APK_PATH = '/downloads/rentapay.apk';
const ANDROID_PACKAGE = 'ke.co.rentapay.twa';

export default function DownloadAppSection() {
  return (
    <section className="download-app">
      <div className="download-app__card">
        <div className="download-app__icon" aria-hidden="true">📲</div>
        <div className="download-app__body">
          <h3>Download RentaPay App</h3>
          <p className="download-app__desc">
            Get the real Android app, straight to your phone - no Play
            Store needed.
          </p>
          <a
            href={APK_PATH}
            download="RentaPay.apk"
            className="download-app__btn"
          >
            Download RentaPay App
          </a>
          <p className="download-app__note">
            Direct APK install - Android will ask you to allow installs
            from this source the first time, that&apos;s expected.
          </p>
          <p className="download-app__version">
            {ANDROID_PACKAGE} &middot; v{pkg.version}
          </p>
        </div>
      </div>
    </section>
  );
}
