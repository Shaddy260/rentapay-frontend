import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Skeleton from './Skeleton.jsx';

/**
 * BUILD SPEC PHASE 8 - Admin: Today's Onboarded Landlords (System Panel).
 *
 * Pure system-of-record data - REAL landlord signups (landlords.created_at),
 * not BA claims (see AdminBrandAmbassadors.jsx, which reviews the BA's own
 * self-reported log) and not marketing leads (Phase 9). A date picker
 * (defaulting to today) plus a table of that range's signups, each tagged
 * "via <BA name/code>" or "Organic" depending on whether landlords.ba_id
 * was set at registration (Phase 4's referral link). Reuses the existing
 * admin-table/admin-status styling rather than introducing new components.
 */
function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminOnboardedLandlords({ token }) {
  const [dateFrom, setDateFrom] = useState(todayIsoDate());
  const [dateTo, setDateTo] = useState(todayIsoDate());
  const [landlords, setLandlords] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLandlords(null);
    setError('');
    const params = {};
    if (dateFrom) params.from = `${dateFrom}T00:00:00.000Z`;
    if (dateTo) params.to = `${dateTo}T23:59:59.999Z`;
    api
      .listLandlordsOnboarded(params, token)
      .then((res) => setLandlords(res.landlords || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load onboarded landlords.'));
  }, [dateFrom, dateTo, token]);

  useEffect(() => {
    load();
  }, [load]);

  function handleShowToday() {
    setDateFrom(todayIsoDate());
    setDateTo(todayIsoDate());
  }

  return (
    <section className="admin-section">
      <div className="admin-section__header-row">
        <h2>Today's Onboarded Landlords</h2>
        <label>
          From{' '}
          <input type="date" className="admin-search-input" style={{ maxWidth: 160 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} />
        </label>
        <label>
          To{' '}
          <input type="date" className="admin-search-input" style={{ maxWidth: 160 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />
        </label>
        <button type="button" className="ghost-link" onClick={handleShowToday}>Today</button>
      </div>

      {error && <p className="admin-section__hint">{error}</p>}

      {!landlords ? (
        <Skeleton rows={4} />
      ) : landlords.length === 0 ? (
        <p className="admin-section__hint">No landlord signups in this range.</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Location / County</th>
                <th>Signed up</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {landlords.map((l) => (
                <tr key={l.id}>
                  <td>{l.fullName}</td>
                  <td>{l.phone}</td>
                  <td>{[l.location, l.county].filter(Boolean).join(', ') || '—'}</td>
                  <td>{new Date(l.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    {l.baId ? (
                      <span className="admin-status admin-status--via-ba">via {l.baName || l.baCode || 'BA'}</span>
                    ) : (
                      <span className="admin-status admin-status--organic">Organic</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
