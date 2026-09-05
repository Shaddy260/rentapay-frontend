import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Skeleton from './Skeleton.jsx';
import Button from './Button.jsx';

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

export default function AdminOnboardedLandlords({ token, readOnly = false }) {
  const [dateFrom, setDateFrom] = useState(todayIsoDate());
  const [dateTo, setDateTo] = useState(todayIsoDate());
  const [landlords, setLandlords] = useState(null);
  const [error, setError] = useState('');
  // FEATURE (direct request): reward today's onboarded landlords with
  // free-tier time - extend by a quick preset (1/2/3 months from
  // whichever date is later of today or their current expiry, so
  // "extend by 1 month" never SHORTENS someone who already has time
  // left) or a specific custom date. Reuses the existing
  // PATCH /admin/landlords/:id/subscription endpoint (editLandlordSubscription)
  // that already powers subscription edits elsewhere in the admin
  // portal - nothing new on that side, just a UI for it here.
  const [extendingId, setExtendingId] = useState(null);
  const [customDateDrafts, setCustomDateDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccessId, setActionSuccessId] = useState(null);

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

  async function applyNewExpiry(landlord, newExpiryDate, reason) {
    setBusyId(landlord.id);
    setActionError('');
    try {
      await api.editLandlordSubscription(landlord.id, { newExpiryDate, reason }, token);
      setLandlords((prev) => prev.map((l) => (l.id === landlord.id ? { ...l, subscriptionExpiresAt: newExpiryDate, subscriptionStatus: 'active' } : l)));
      setActionSuccessId(landlord.id);
      setExtendingId(null);
      setTimeout(() => setActionSuccessId((id) => (id === landlord.id ? null : id)), 4000);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to update subscription expiry.');
    } finally {
      setBusyId(null);
    }
  }

  function handleExtendByMonths(landlord, months) {
    // Extends from whichever is later - today or their current expiry
    // - so rewarding someone who already has time left adds ON TOP of
    // it instead of resetting the clock backward.
    const now = new Date();
    const current = landlord.subscriptionExpiresAt ? new Date(landlord.subscriptionExpiresAt) : now;
    const base = current > now ? current : now;
    const next = new Date(base);
    next.setMonth(next.getMonth() + months);
    applyNewExpiry(landlord, next.toISOString(), `Free-tier reward: extended by ${months} month${months === 1 ? '' : 's'} (onboarding day bonus)`);
  }

  function handleCustomDateSubmit(landlord) {
    const raw = customDateDrafts[landlord.id];
    if (!raw) return;
    // End-of-day on the chosen date, same convention the "To" filter
    // above uses.
    applyNewExpiry(landlord, `${raw}T23:59:59.999Z`, 'Free-tier reward: custom expiry date set by admin');
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

      {actionError && <p className="admin-banner admin-banner--error">{actionError}</p>}

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
                <th>Subscription expiry</th>
                {!readOnly && <th>Reward</th>}
              </tr>
            </thead>
            <tbody>
              {landlords.map((l) => (
                <tr key={l.id}>
                  <td>{l.fullName}</td>
                  <td>{l.phone}</td>
                  <td>{[l.location, l.county].filter(Boolean).join(', ') || '-'}</td>
                  <td>{new Date(l.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    {l.baId ? (
                      <span className="admin-status admin-status--via-ba">via {l.baName || l.baCode || 'BA'}</span>
                    ) : (
                      <span className="admin-status admin-status--organic">Organic</span>
                    )}
                  </td>
                  <td>
                    {l.subscriptionExpiresAt ? new Date(l.subscriptionExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                  </td>
                  {!readOnly && (
                  <td>
                    {actionSuccessId === l.id ? (
                      <span className="admin-status admin-status--ok">Updated ✓</span>
                    ) : extendingId === l.id ? (
                      <div className="admin-onboarded__extend-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 220 }}>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          <Button variant="ghost" disabled={busyId === l.id} onClick={() => handleExtendByMonths(l, 1)}>+1 mo</Button>
                          <Button variant="ghost" disabled={busyId === l.id} onClick={() => handleExtendByMonths(l, 2)}>+2 mo</Button>
                          <Button variant="ghost" disabled={busyId === l.id} onClick={() => handleExtendByMonths(l, 3)}>+3 mo</Button>
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                          <input
                            type="date"
                            className="admin-search-input"
                            style={{ maxWidth: 150 }}
                            value={customDateDrafts[l.id] || ''}
                            onChange={(e) => setCustomDateDrafts((prev) => ({ ...prev, [l.id]: e.target.value }))}
                          />
                          <Button disabled={busyId === l.id || !customDateDrafts[l.id]} onClick={() => handleCustomDateSubmit(l)}>Set</Button>
                        </div>
                        <button type="button" className="ghost-link" onClick={() => setExtendingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button type="button" className="ghost-link" onClick={() => { setExtendingId(l.id); setActionError(''); }}>
                        🎁 Extend
                      </button>
                    )}
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
