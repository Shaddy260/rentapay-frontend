import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import './AdminGlobalSearch.css';

export default function AdminGlobalSearch({ token, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      api
        .adminGlobalSearch(query.trim(), token)
        .then((res) => {
          setResults(res.results || []);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, token]);

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
    setResults(null);
  }

  return (
    <div className="admin-global-search" ref={containerRef}>
      <input
        type="search"
        className="admin-global-search__input"
        placeholder="Global search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && results && setOpen(true)}
        aria-label="Search all accounts by email"
      />
      {open && (
        <div className="admin-global-search__dropdown">
          {loading && <p className="admin-global-search__empty">Searching…</p>}
          {!loading && results && results.length === 0 && (
            <p className="admin-global-search__empty">No accounts match "{query}".</p>
          )}
          {!loading &&
            results?.map((r) => (
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
            ))}
        </div>
      )}
    </div>
  );
}
