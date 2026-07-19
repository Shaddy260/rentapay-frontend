import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import ChatWidget from '../components/ChatWidget.jsx';
import './AddTenant.css';
import './TenantPortal.css';
import './Login.css';

// Phase 6's vacancy browser, in minimal form: a scout can only see
// units in counties they currently have an ACTIVE subscription for
// (enforced server-side in getVacancies, not just hidden client-side).
// Defaults to vacant-only, since finding a vacancy for a client is the
// entire point of the product, but a scout can flip to "occupied" to
// see what's been filled (e.g. a unit they referred someone to) or
// "all" to see everything at once.
export default function ScoutVacancies() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('rentapay_token');

  const [statusFilter, setStatusFilter] = useState('vacant');
  const [countyFilter, setCountyFilter] = useState('all');
  const [data, setData] = useState(null); // { activeCounties, units }
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatThread, setChatThread] = useState(null);
  // Tracks per-unit "Share this unit" outcome (loading/success/error)
  // client-side only - the actual referral log lives in scout_referrals
  // server-side; this is just what lets the button flip to
  // "Shared ✓" instead of staying clickable forever after it worked.
  const [shareState, setShareState] = useState({}); // { [unitId]: 'sharing' | 'shared' | 'error' }

  function humanizeAgo(iso) {
    if (!iso) return null;
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  function shareUnit(unit) {
    setShareState((s) => ({ ...s, [unit.id]: 'sharing' }));
    api
      .referScoutUnit(unit.id, token)
      .then(() => {
        setShareState((s) => ({ ...s, [unit.id]: 'shared' }));
        // Build a WhatsApp-shareable message with the unit's details,
        // for the scout to actually send on to their client - the
        // referral log itself doesn't require this to be sent
        // anywhere, it's just the natural next step for the scout.
        const lines = [
          `${unit.unitName}${unit.unitType ? ` (${unit.unitType})` : ''} - KES ${Number(unit.rentAmount).toLocaleString()}/month`,
          [unit.county, unit.area].filter(Boolean).join(', '),
          unit.propertyName ? `Property: ${unit.propertyName}` : null,
        ].filter(Boolean);
        const waUrl = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      })
      .catch(() => setShareState((s) => ({ ...s, [unit.id]: 'error' })));
  }

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter]);

  function load() {
    setLoading(true);
    setError('');
    api
      .getScoutVacancies(statusFilter, token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load vacancies.'))
      .finally(() => setLoading(false));
  }

  const activeCounties = data?.activeCounties || [];
  const units = (data?.units || []).filter((u) => countyFilter === 'all' || u.county === countyFilter);

  // FEATURE (direct request: "arrange the units based on
  // constituencies to make work easier"): group the filtered units by
  // constituency (within whichever county/counties are selected above)
  // instead of one long flat list, so a scout working a specific area
  // can scan just that section instead of scrolling past every other
  // constituency's units to find it. Units without a constituency set
  // fall into a clearly-labeled catch-all group rather than silently
  // vanishing. Sorted alphabetically, catch-all always last.
  const groupsByConstituency = units.reduce((acc, u) => {
    const key = u.constituency || 'Constituency not set';
    if (!acc[key]) acc[key] = [];
    acc[key].push(u);
    return acc;
  }, {});
  // Within a constituency, order was previously whatever the backend's
  // two underlying queries (property units vs. ungrouped landlord
  // units) happened to interleave to - not wrong, just not obviously
  // ordered to a human scanning the list. Sorting by unit name gives a
  // predictable, scannable order instead.
  Object.values(groupsByConstituency).forEach((list) =>
    list.sort((a, b) => (a.unitName || '').localeCompare(b.unitName || ''))
  );
  const constituencyNames = Object.keys(groupsByConstituency).sort((a, b) => {
    if (a === 'Constituency not set') return 1;
    if (b === 'Constituency not set') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="add-tenant-page">
      <div className="add-tenant-header">
        <h1>Browse Vacancies</h1>
        <Link to="/scout-portal" className="login-page__link-btn">← Back to my counties</Link>
      </div>

      {activeCounties.length === 0 && !loading ? (
        <p className="tenant-portal-hint">
          You don't have any active county subscriptions yet. Subscribe to a county from your portal to see its
          vacant units here.
        </p>
      ) : (
        <>
          <p className="add-tenant-subtitle">
            Showing units in counties you're subscribed to: {activeCounties.join(', ') || '—'}
          </p>

          <div className="admin-tabs" style={{ marginBottom: 12 }}>
            {['vacant', 'occupied', 'all'].map((s) => (
              <button key={s} className={statusFilter === s ? 'is-active' : ''} onClick={() => setStatusFilter(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {activeCounties.length > 1 && (
            <div className="form-field" style={{ maxWidth: 280, marginBottom: 16 }}>
              <label className="form-field__label">Filter by county</label>
              <select value={countyFilter} onChange={(e) => setCountyFilter(e.target.value)}>
                <option value="all">All my counties</option>
                {activeCounties.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="login-page__error" role="alert">{error}</p>}

          {loading ? (
            <p>Loading…</p>
          ) : units.length === 0 ? (
            <p>No {statusFilter === 'all' ? '' : statusFilter} units found in your subscribed counties right now.</p>
          ) : (
            <div style={{ display: 'grid', gap: 24 }}>
              {constituencyNames.map((constituency) => (
                <div key={constituency}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '1em', color: '#333', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {constituency}
                    <span style={{ fontSize: '0.75em', fontWeight: 400, color: '#888' }}>
                      ({groupsByConstituency[constituency].length} unit{groupsByConstituency[constituency].length === 1 ? '' : 's'})
                    </span>
                  </h3>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {groupsByConstituency[constituency].map((u) => (
                      <div
                        key={u.id}
                        style={{
                          border: '1px solid #eee',
                          borderRadius: 10,
                          padding: 14,
                          display: 'flex',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong>{u.unitName}</strong>
                            {u.unitType && <span style={{ color: '#666' }}>· {u.unitType}</span>}
                            <span
                              style={{
                                fontSize: '0.75em',
                                padding: '2px 8px',
                                borderRadius: 12,
                                background: u.status === 'vacant' ? '#E8F5E9' : u.status === 'occupied' ? '#FFEBEE' : '#F5F5F5',
                                color: u.status === 'vacant' ? '#2E7D32' : u.status === 'occupied' ? '#B3261E' : '#555',
                              }}
                            >
                              {u.status}
                            </span>
                          </div>
                          {u.propertyName && <div style={{ color: '#666', fontSize: '0.9em' }}>{u.propertyName}</div>}
                          <div style={{ color: '#666', fontSize: '0.9em' }}>
                            {[u.county, u.area].filter(Boolean).join(' · ') || 'Location not set'}
                          </div>
                          {/* Freshness label (spec §2/§6): "Verified" is a
                              stronger trust signal than "Updated" - a
                              landlord tapping "Still vacant - confirm"
                              means someone actually checked, vs. any
                              edit (e.g. a rent typo fix) bumping
                              updatedAt too. Falls back to Updated when
                              this unit has never been explicitly verified. */}
                          <div style={{ color: '#888', fontSize: '0.8em', marginTop: 2 }}>
                            {u.lastVerifiedAt
                              ? `✓ Verified ${humanizeAgo(u.lastVerifiedAt)}`
                              : `Updated ${humanizeAgo(u.updatedAt)}`}
                          </div>
                          <div style={{ marginTop: 4 }}>KES {Number(u.rentAmount).toLocaleString()}/month</div>
                          {u.status === 'vacant' && (
                            <div style={{ marginTop: 8 }}>
                              <button
                                type="button"
                                className="login-page__link-btn"
                                disabled={shareState[u.id] === 'sharing' || shareState[u.id] === 'shared'}
                                onClick={() => shareUnit(u)}
                              >
                                {shareState[u.id] === 'shared' ? 'Shared ✓' : shareState[u.id] === 'sharing' ? 'Sharing…' : 'Share this unit'}
                              </button>
                              {shareState[u.id] === 'error' && (
                                <span style={{ color: '#B3261E', fontSize: '0.8em', marginLeft: 8 }}>Couldn't share — try again</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.85em', color: '#666' }}>Contact</div>
                          <div>{u.contactName || '—'}</div>
                          {u.contactPhone && (
                            <a href={`tel:${u.contactPhone}`} className="login-page__link-btn">{u.contactPhone}</a>
                          )}
                          {u.landlordId && (
                            <div style={{ marginTop: 6 }}>
                              <button
                                type="button"
                                className="login-page__link-btn"
                                onClick={() =>
                                  setChatThread({
                                    threadType: 'scout_landlord',
                                    landlordId: u.landlordId,
                                    name: u.contactName || 'Landlord',
                                  })
                                }
                              >
                                Message landlord
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {chatThread && (
        <ChatWidget
          token={token}
          role="scout"
          directThread={chatThread}
          hideLauncher
          controlledOpen={!!chatThread}
          onOpenChange={(open) => {
            if (!open) setChatThread(null);
          }}
        />
      )}
    </div>
  );
}
