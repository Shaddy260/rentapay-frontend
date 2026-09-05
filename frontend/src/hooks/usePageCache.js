// FIX (direct request: "when i refresh any page... it clears the
// screen and gives the white screen... it should only update the
// contents in the background... there should be nothing loading, it
// should have contents already while it loads in the background").
//
// The pattern across every portal page was: useState(null) for the
// data, useState(true) for loading, fetch on mount, and a full-page
// "Loading…" screen shown whenever loading && !data. On a hard
// refresh, `data` starts null every single time - there's nothing to
// show, so that full-page loader is unavoidable UNLESS the page's
// last-known-good data survives the refresh somewhere. sessionStorage
// does survive a refresh (unlike component state), so this hook:
//
//   1. On first render, synchronously reads any cached copy of this
//      page's data out of sessionStorage and returns it as the
//      initial value - so the very first paint already has content,
//      even on a hard refresh.
//   2. Kicks off the real fetch in the background regardless (the
//      cache may be stale) and swaps in the fresh result the moment
//      it lands, silently re-caching it.
//   3. Exposes `refreshing` (true while that background fetch is in
//      flight) instead of a blocking `loading`, so callers can show a
//      small top-of-page skeleton/progress sliver over the existing
//      content instead of replacing the whole screen.
//
// `loading` is only ever true when there was truly nothing cached to
// show yet (this exact page, first visit this device) - every visit
// after that is instant.
import { useState, useRef, useCallback, useEffect } from 'react';

const PREFIX = 'rentapay_pagecache_';

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // sessionStorage full/unavailable - background refresh still
    // works, it just won't survive the next hard refresh.
  }
}

// key: a string unique to this screen + whatever it's scoped to
//      (e.g. `dashboard:${propertyId}`, `unit:${unitId}`) so
//      switching between two units/properties doesn't show one's
//      cached data under the other's URL.
// fetchFn: () => Promise<data>
// Returns { data, setData, loading, refreshing, error, reload }
export function usePageCache(key, fetchFn) {
  const cached = key ? readCache(key) : null;
  const [data, setData] = useState(cached);
  const [loading, setLoading] = useState(cached === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const keyRef = useRef(key);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const load = useCallback((k) => {
    const activeKey = k !== undefined ? k : keyRef.current;
    setRefreshing(true);
    return Promise.resolve(fetchRef.current())
      .then((result) => {
        setData(result);
        setError(null);
        if (activeKey) writeCache(activeKey, result);
        return result;
      })
      .catch((err) => {
        setError(err);
        throw err;
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    keyRef.current = key;
    // Switching to a different key (e.g. tapping into a different
    // unit) - show that key's own cache instantly if we have one,
    // rather than the previous unit's data or a blank loader.
    const next = key ? readCache(key) : null;
    setData(next);
    setLoading(next === null);
    load(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, setData, loading, refreshing, error, reload: load };
}
