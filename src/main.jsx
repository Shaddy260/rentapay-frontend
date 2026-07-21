import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';
import { initSentry } from './utils/sentry.js';

initSentry();

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
