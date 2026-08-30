import { useNavigate as useRouterNavigate } from 'react-router-dom';
import { startTransition } from 'react';

// FIX (direct request: "changing the sites eg tapping unit gh1 or
// going back... gives a white screen with ...loading your
// dashboard... message. It should transition so fast... loading and
// updating data only occurs in the background").
//
// Every page is React.lazy-loaded (see App.jsx). By default, the
// instant you call the router's navigate(), React unmounts the
// current page, hits the <Suspense> boundary for the new page's not-
// yet-downloaded chunk, and shows the fallback ("Loading…") - a blank
// screen - until that chunk arrives, THEN mounts the new page which
// itself shows its own full-page "Loading your dashboard…" spinner
// while it fetches data. Two full blank screens back to back for one
// tap.
//
// Wrapping the navigation update in React 18's startTransition tells
// React this update is not urgent: React keeps rendering the CURRENT
// page on screen exactly as it is (no unmount, no blank Suspense
// fallback) until the next page's chunk has finished downloading, and
// only swaps the two over in one commit once it's ready. Combined
// with each page hydrating its data from the cache written by
// usePersistedData.js (so it has content immediately instead of
// needing its own fetch to finish first), a tap now goes: old screen
// stays put -> new screen appears already showing last-known data ->
// that data quietly refreshes in the background. No blank screen
// either step.
//
// Drop-in replacement for react-router-dom's useNavigate - same
// call signature, so every existing `navigate(path)` / `navigate(-1)`
// call site works unchanged; only the import line changes.
export function useAppNavigate() {
  const navigate = useRouterNavigate();
  return (...args) => {
    startTransition(() => {
      navigate(...args);
    });
  };
}
