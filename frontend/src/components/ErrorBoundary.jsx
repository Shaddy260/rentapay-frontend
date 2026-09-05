// src/components/ErrorBoundary.jsx
//
// PROBLEM (direct request: "nothing give white screen while changing
// uis and sites"): there was no React error boundary anywhere in the
// app. React.lazy + Suspense (see App.jsx) only handles the LOADING
// state of a route chunk - it does nothing for a FAILED render or a
// failed chunk fetch. Either one throws, React unmounts the entire
// tree because nothing catches it, and the browser tab is just blank
// white with no way back short of the user guessing to hit refresh.
//
// Two distinct cases handled here:
//
// 1. STALE CHUNK AFTER A DEPLOY - by far the most common trigger for
//    "changing UIs/sites gives a white screen". Vite content-hashes
//    every JS chunk (see vite.config.js + public/_headers), so once a
//    new build ships, the OLD hashed filenames a still-open tab is
//    holding references to can 404. That specific failure is
//    recoverable automatically: a hard reload just fetches the fresh
//    index.html and the new hashes, so this does exactly that once
//    (sessionStorage flag stops an infinite reload loop if reloading
//    somehow doesn't fix it - shows the manual fallback instead).
//
// 2. ANY OTHER RENDER ERROR - not auto-recoverable (reloading would
//    just hit the same bug again), so this shows a small, static,
//    animation-free "something went wrong" card with a manual reload
//    button instead of a blank tab.
import React from 'react';

const RELOAD_FLAG = 'rentapay_eb_reloaded';

function isChunkLoadError(error) {
  const msg = String(error?.message || error || '');
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error)) {
      // Reload at most once per browser session for this - if a hard
      // reload didn't fix it, the problem isn't a stale chunk anymore
      // and repeating it would just loop.
      let alreadyTried = false;
      try {
        alreadyTried = sessionStorage.getItem(RELOAD_FLAG) === '1';
      } catch {
        // sessionStorage unavailable (private mode, etc.) - fall
        // through to the manual fallback below instead of looping.
        alreadyTried = true;
      }
      if (!alreadyTried) {
        try {
          sessionStorage.setItem(RELOAD_FLAG, '1');
        } catch {
          // Nothing to do - worst case this reloads more than once.
        }
        window.location.reload();
      }
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const chunkError = isChunkLoadError(this.state.error);

    // While the auto-reload above is in flight, keep showing nothing
    // dramatic - the page is about to be replaced anyway.
    if (chunkError) return null;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'var(--font-body, system-ui, sans-serif)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Something went wrong.
          </p>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
            Please reload the page. If this keeps happening, try again in a
            moment.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#1f2937',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
