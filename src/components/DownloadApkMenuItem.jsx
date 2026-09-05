import React, { useState } from 'react';
import './DownloadApkMenuItem.css';

// Companion to InstallAppMenuItem (PWA install). This is a plain
// download link for the native Android APK build. Browsers do not
// allow a website to trigger the native "install" prompt directly -
// that's a deliberate security restriction (otherwise any site could
// silently install apps). So the file downloads first, and we show
// a short in-app note right after the tap telling the user where to
// find it and finish the install, instead of leaving them wondering
// why nothing visibly happened.
const APK_PATH = '/downloads/app-release-signed.apk';

export default function DownloadApkMenuItem({ as: Component = 'a', className = '', onClick, children }) {
  const [showGuide, setShowGuide] = useState(false);

  function handleTriggered() {
    setShowGuide(true);
    onClick?.();
  }

  const extraProps =
    Component === 'a'
      ? { href: APK_PATH, download: true, onClick: handleTriggered }
      : { type: 'button', onClick: () => { window.location.href = APK_PATH; handleTriggered(); } };

  return (
    <>
      <Component className={className} data-download-fx {...extraProps}>
        {children || '⬇️ Download App'}
      </Component>
      {showGuide && (
        <div className="download-apk-item__modal" onClick={() => setShowGuide(false)}>
          <div className="download-apk-item__modal-card" onClick={(e) => e.stopPropagation()}>
            <h4>Almost there</h4>
            <ol>
              <li>Your download will finish in a few seconds</li>
              <li>Open it from your notification shade, or from your phone's Downloads</li>
              <li>Tap <strong>Install</strong> when prompted</li>
            </ol>
            <button type="button" onClick={() => setShowGuide(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
