import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import './GlobalSearch.css';

// Direct request: "no global search - with units, tenants, payments,
// and managers all as separate pages, there's no type a name/phone
// and jump straight to that tenant." Debounced so it doesn't fire a
// request on every keystroke, and closes on outside click/escape like
// any normal search dropdown.
export default function GlobalSearch({ token }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const timeout = setTimeout(() => {
      api.globalSearch(query, token).then((res) => { setResults(res); setOpen(true); }).catch(() => {});
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

  const hasResults = results && (results.tenants?.length > 0 || results.units?.length > 0);

  return (
    <div className="global-search" ref={containerRef}>
      <input
        type="text"
        className="global-search__input"
        placeholder="Search tenants or units..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
      />
      {open && results && (
        <div className="global-search__dropdown">
          {!hasResults && <p className="global-search__empty">No matches for "{query}"</p>}
          {results.tenants?.map((t) => (
            <button key={`t-${t.id}`} className="global-search__result" onClick={() => { navigate(`/units/${t.unitId}`); setOpen(false); setQuery(''); }}>
              <span className="global-search__result-name">{t.name}</span>
              <span className="global-search__result-meta">{t.unitName} - {t.phone}</span>
            </button>
          ))}
          {results.units?.map((u) => (
            <button key={`u-${u.id}`} className="global-search__result" onClick={() => { navigate(`/units/${u.id}`); setOpen(false); setQuery(''); }}>
              <span className="global-search__result-name">{u.name}</span>
              <span className="global-search__result-meta">{u.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
