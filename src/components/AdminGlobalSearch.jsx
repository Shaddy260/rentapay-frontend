import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { filterPageIndex } from '../data/pageSearchIndex.js';
import './AdminGlobalSearch.css';

export default function AdminGlobalSearch({ token, onSelect, pageIndex = [] }) {
  const [query, setQuery] = useState('');
  const [accountResults, setAccountResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setAccountResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      api
        .adminGlobalSearch(query.trim(), token)
        .then((res) => {
          setAccountResults(res.results || []);
          setOpen(true);
        })
        .catch(() => setAccountResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, token]);

  // Pages/settings are a fixed, small list, so they're filtered
  // instantly client-side (no debounce, no round-trip) and merged in
  // ahead of the account results - a settings screen is usually what
  // someone's after when they type something like "mpesa" or "audit".
  const pageResults = filterPageIndex(pageIndex, query).map((p) => ({ ...p, role: 'page', roleLabel: 'Page' }));
  const results = accountResults === null ? (pageResults.length ? pageResults : null) : [...pageResults, ...accountResults];

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    function onEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  function handleSelect(result) {
    onSelect?.(result);
    setOpen(false);
    setQuery('');
    setAccountResults(null);
  }

  return (
    <div className="admin-global-search" ref={containerRef}>
      <input
        type="search"
        className="admin-global-search__input"
        placeholder="Global search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        aria-label="Search all accounts, apartments, pages, and settings"
      />
      {open && (
        <div className="admin-global-search__dropdown">
          {loading && (results === null || results.length === 0) && <p className="admin-global-search__empty">Searching…</p>}
          {!loading && results !== null && results.length === 0 && (
            <p className="admin-global-search__empty">Nothing matches "{query}".</p>
          )}
          {results?.map((r) =>
            r.role === 'page' ? (
              <button
                key={`page-${r.id}`}
                type="button"
                className="admin-global-search__result admin-global-search__result--page"
                onClick={() => handleSelect(r)}
              >
                <span className="admin-global-search__result-top">
                  <span className="admin-global-search__result-name">{r.label}</span>
                  <span className="admin-global-search__badge admin-global-search__badge--page">Go to page</span>
                </span>
              </button>
            ) : (
              <button
                key={`${r.role}-${r.id}`}
                type="button"
                className="admin-global-search__result"
                onClick={() => handleSelect(r)}
              >
                <span className="admin-global-search__result-top">
                  <span className="admin-global-search__result-name">{r.name}</span>
                  <span className={`admin-global-search__badge admin-global-search__badge--${r.role}`}>{r.roleLabel}</span>
                </span>
                <span className="admin-global-search__result-meta">
                  {[r.email, r.phone].filter(Boolean).join(' · ')}
                </span>
                {r.context && <span className="admin-global-search__result-context">{r.context}</span>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
