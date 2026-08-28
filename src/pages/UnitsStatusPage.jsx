import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import { api, ApiError } from '../api/client.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import UnitTile from '../components/UnitTile.jsx';
import TopRefreshBar from '../components/TopRefreshBar.jsx';
import { computeUnitStatus, countByStatus, STATUS_META } from '../utils/unitStatus.js';
import './Dashboard.css';
import './UnitsStatusPage.css';

const PAGE_SIZE = 24;

const EMPTY_COPY = {
  overdue: { icon: '🎉', title: 'No overdue tenants', message: 'Nobody currently owes a balance past their due date.' },
  upcoming: { icon: '📅', title: 'Nothing due soon', message: 'No occupied units have a payment coming up right now.' },
  paid: { icon: '✅', title: 'No payments cleared yet', message: 'Once a tenant clears this cycle\u2019s rent, they\u2019ll show up here.' },
  vacant: { icon: '🏠', title: 'No vacant units', message: 'Every unit currently has a tenant assigned.' },
};

export default function UnitsStatusPage() {
  const { status } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('rentapay_token');

  // FIX (direct request: "loading and updating data should only occur
  // in the background... nothing loading, it should have contents
  // already"). The units list is the SAME data regardless of which
  // status tab you're on (overdue/upcoming/paid/vacant just filter it
  // client-side) - so it's cached per property, not per status, and
  // switching tabs no longer re-fetches or re-blanks the screen at
  // all; only a hard refresh or genuinely stale data triggers a
  // background re-fetch.
  const propertyIdForCache = localStorage.getItem('rentapay_active_property_id') || 'default';
  const unitsCache = (() => {
    try {
      const raw = localStorage.getItem('rentapay_units_status_cache_' + propertyIdForCache);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const [units, setUnits] = useState(() => unitsCache || null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => !unitsCache);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const validStatus = ['overdue', 'upcoming', 'paid', 'vacant'].includes(status);

  const load = useCallback(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    setError('');
    const propertyId = localStorage.getItem('rentapay_active_property_id') || undefined;
    api
      .listUnits(token, propertyId)
      .then((res) => {
        const list = res.units || [];
        setUnits(list);
        try {
          localStorage.setItem('rentapay_units_status_cache_' + propertyIdForCache, JSON.stringify(list));
        } catch {
          // non-fatal
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login');
          return;
        }
        setError(err.message || 'Failed to load units.');
      })
      .finally(() => setLoading(false));
  }, [token, navigate, propertyIdForCache]);

  useEffect(() => {
    load();
    // Only fetch once on mount (and if the active property changes) -
    // switching between status tabs re-filters the same cached list
    // instead of re-fetching, so tab taps are instant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyIdForCache]);

  useEffect(() => {
    setPageSize(PAGE_SIZE);
    setSearch('');
  }, [status]);

  const filteredUnits = useMemo(() => {
    if (!units) return [];
    const q = search.trim().toLowerCase();
    const searched = q
      ? units.filter((unit) => {
          const tenantNames = (unit.tenants || []).map((t) => t.full_name || '').join(' ');
          return `${unit.unit_name} ${tenantNames}`.toLowerCase().includes(q);
        })
      : units;
    return searched.filter((unit) => !unit.is_frozen && computeUnitStatus(unit).status === status);
  }, [units, search, status]);

  const counts = useMemo(() => (units ? countByStatus(units) : null), [units]);
  const toRender = filteredUnits.slice(0, pageSize);

  if (!validStatus) {
    return (
      <div className="dashboard-page">
        <main className="dashboard-main">
          <p>Unknown status page.</p>
          <Link to="/dashboard">← Back to dashboard</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <TopRefreshBar active={loading && units !== null} />
      <header className="units-status-header">
        <button type="button" className="ghost-link" onClick={() => navigate('/dashboard')}>← Back to dashboard</button>
        <h1 className={`units-status-header__title units-status-header__title--${status}`}>
          {STATUS_META[status].label} units
          {counts && <span className="units-status-header__count">{counts[status]}</span>}
        </h1>
      </header>

      <main className="dashboard-main">
        {units && units.length > 0 && (
          <input
            type="search"
            className="units-search-input"
            placeholder="Search by unit or tenant name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}

        {loading && units === null && (
          <div className="units-tile-grid" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="unit-tile-skeleton" key={i}>
                <Skeleton rows={3} />
              </div>
            ))}
          </div>
        )}

        {!(loading && units === null) && error && !units?.length && (
          <div className="units-error-card">
            <h2>Couldn't load these units</h2>
            <p>{error}</p>
            <button onClick={load}>Try again</button>
          </div>
        )}

        {!(loading && units === null) && (!error || units?.length > 0) && filteredUnits.length === 0 && (
          <EmptyState
            icon={search ? '🔍' : EMPTY_COPY[status].icon}
            title={search ? 'No matches' : EMPTY_COPY[status].title}
            message={search ? `No units or tenants match "${search}".` : EMPTY_COPY[status].message}
          />
        )}

        {!(loading && units === null) && filteredUnits.length > 0 && (
          <>
            <div className="units-tile-grid">
              {toRender.map((unit) => <UnitTile unit={unit} token={token} key={unit.id} />)}
            </div>
            {filteredUnits.length > pageSize && (
              <button
                type="button"
                className="units-status-show-more"
                onClick={() => setPageSize((s) => s + PAGE_SIZE)}
              >
                Show {Math.min(PAGE_SIZE, filteredUnits.length - pageSize)} more ({filteredUnits.length - pageSize} remaining)
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
