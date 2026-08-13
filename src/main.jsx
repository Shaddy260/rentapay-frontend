import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';
import { initSentry } from './utils/sentry.js';
import { syncOfflineQueue } from './api/client.js';
import { initHintToggles } from './utils/hintToggle.js';

initSentry();
initHintToggles();

// OFFLINE FIX: replay anything queued while the connection was down
// (payment confirmations, chat messages, etc. - see offlineDb.js) as
// soon as we're back online, and once at startup in case the app was
// reopened after connectivity returned rather than while it did.
window.addEventListener('online', () => { syncOfflineQueue(); });
if (typeof navigator !== 'undefined' && navigator.onLine) {
  syncOfflineQueue();
}

// Apply the persisted dark/light preference before the first paint,
// so returning users with dark mode on don't see a flash of the light
// theme while React mounts. AccountMenu's ThemeToggle owns the actual
// toggle control and keeps this in sync going forward.
try {
  const savedTheme = localStorage.getItem('rentapay_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
} catch {
  // localStorage unavailable - defaults to light theme, no crash
}

// Direct request: "an app I can download". Registering the service
// worker unconditionally (not just when someone opts into push
// notifications) is what lets the browser offer "Install app" / "Add
// to Home Screen" - see manifest.json + index.html for the rest of
// the installability requirements. sw.js has no caching logic, so this
// never risks anyone getting stuck on an old version after a deploy.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {}); // quiet no-op if it fails - never block the app on this
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
