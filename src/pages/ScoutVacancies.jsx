import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import ChatWidget from '../components/ChatWidget.jsx';
import Skeleton from '../components/Skeleton.jsx';
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
    // FEATURE (onboarding checklist "browse vacancies" step, see
    // ScoutPortal.jsx/OnboardingChecklist.jsx): a plain, best-effort
    // signal that this scout has actually opened the vacancy-browsing
    // page at least once. Not stored server-side since it's not real
    // account data, just a local "have they looked yet" flag.
    try {
      localStorage.setItem('rentapay_scout_visited_vacancies', '1');
    } catch {
      // localStorage unavailable - checklist step just won't tick off, harmless
    }
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
  const unitsByCounty = (data?.units || []).filter((u) => countyFilter === 'all' || u.county === countyFilter);

  // FEATURE (direct request: "include a searchbar...where scouts are
  // browsing locations where there are vacant houses"): typing a
  // constituency, area, unit name, or property name narrows the whole
  // tree below instantly, instead of opening every accordion section
  // to hunt for the right one.
  const [areaSearch, setAreaSearch] = useState('');
  const searchNeedle = areaSearch.trim().toLowerCase();
  const units = searchNeedle
    ? unitsByCounty.filter((u) =>
        [u.constituency, u.area, u.unitName, u.propertyName].some((f) => (f || '').toLowerCase().includes(searchNeedle))
      )
    : unitsByCounty;

  // FEATURE (direct request: "arrange the vacant houses under
  // constituencies and location...list which location, under that
  // area now list the vacant houses"): a two-level grouping -
  // constituency, then location/area within it - instead of one long
  // flat list. Units without a constituency/area set fall into
  // clearly-labeled catch-all groups rather than silently vanishing.
  const groupsByConstituency = units.reduce((acc, u) => {
    const constKey = u.constituency || 'Constituency not set';
    const areaKey = u.area || 'Location not set';
    if (!acc[constKey]) acc[constKey] = {};
    if (!acc[constKey][areaKey]) acc[constKey][areaKey] = [];
    acc[constKey][areaKey].push(u);
    return acc;
  }, {});
  // Within an area, order was previously whatever the backend's two
  // underlying queries (property units vs. ungrouped landlord units)
  // happened to interleave to. Sorting by unit name gives a
  // predictable, scannable order instead.
  Object.values(groupsByConstituency).forEach((areaMap) =>
    Object.values(areaMap).forEach((list) => list.sort((a, b) => (a.unitName || '').localeCompare(b.unitName || '')))
  );
  const sortNames = (names, catchAllLabel) =>
    names.sort((a, b) => {
      if (a === catchAllLabel) return 1;
      if (b === catchAllLabel) return -1;
      return a.localeCompare(b);
    });
  const constituencyNames = sortNames(Object.keys(groupsByConstituency), 'Constituency not set');
  const constituencyUnitCount = (constituency) =>
    Object.values(groupsByConstituency[constituency]).reduce((sum, list) => sum + list.length, 0);

  // FEATURE (direct request: "show the content only when a scout taps
  // in that tab or location...otherwise hide to keep everything
  // tidy"): both levels are collapsed by default - tapping a
  // constituency reveals its locations, tapping a location reveals its
  // units. A search auto-expands every group so matches are never left
  // hidden behind an untapped accordion.
  const [expandedConstituencies, setExpandedConstituencies] = useState({});
  const [expandedAreas, setExpandedAreas] = useState({});
  const isConstituencyOpen = (c) => !!expandedConstituencies[c] || !!searchNeedle;
  const isAreaOpen = (c, a) => !!expandedAreas[`${c}|||${a}`] || !!searchNeedle;
  const toggleConstituency = (c) => setExpandedConstituencies((s) => ({ ...s, [c]: !s[c] }));
  const toggleArea = (c, a) => setExpandedAreas((s) => ({ ...s, [`${c}|||${a}`]: !s[`${c}|||${a}`] }));

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

          <div className="form-field" style={{ maxWidth: 360, marginBottom: 16 }}>
            <label className="form-field__label">Search constituency, location, or unit</label>
            <input
              type="search"
              placeholder="e.g. Westlands, Kilimani…"
              value={areaSearch}
              onChange={(e) => setAreaSearch(e.target.value)}
            />
          </div>

          {error && <p className="login-page__error" role="alert">{error}</p>}

          {loading ? (
            <Skeleton variant="card" count={4} />
          ) : units.length === 0 ? (
            <p>
              {searchNeedle
                ? `No ${statusFilter === 'all' ? '' : statusFilter} units match "${areaSearch}".`
                : `No ${statusFilter === 'all' ? '' : statusFilter} units found in your subscribed counties right now.`}
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {constituencyNames.map((constituency) => {
                const areaNames = sortNames(Object.keys(groupsByConstituency[constituency]), 'Location not set');
                const open = isConstituencyOpen(constituency);
                return (
                <div key={constituency} style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => toggleConstituency(constituency)}
                    aria-expanded={open}
                    aria-label={`${open ? 'Collapse' : 'Expand'} ${constituency} listings`}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 14px',
                      background: '#fafafa',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '1em',
                      color: '#333',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{constituency}</strong>
                      <span style={{ fontSize: '0.75em', fontWeight: 400, color: '#888' }}>
                        ({constituencyUnitCount(constituency)} unit{constituencyUnitCount(constituency) === 1 ? '' : 's'}, {areaNames.length} location{areaNames.length === 1 ? '' : 's'})
                      </span>
                    </span>
                    <span style={{ fontSize: '0.8em', color: '#888' }}>{open ? '▲ Hide' : '▼ Show'}</span>
                  </button>

                  {open && (
                    <div style={{ display: 'grid', gap: 8, padding: 12 }}>
                      {areaNames.map((area) => {
                        const areaOpen = isAreaOpen(constituency, area);
                        const areaUnits = groupsByConstituency[constituency][area];
                        return (
                          <div key={area} style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
                            <button
                              type="button"
                              onClick={() => toggleArea(constituency, area)}
                              aria-expanded={areaOpen}
                              aria-label={`${areaOpen ? 'Collapse' : 'Expand'} ${area} units`}
                              style={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 12px',
                                background: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '0.95em',
                                color: '#444',
                              }}
                            >
                              <span>
                                📍 {area}{' '}
                                <span style={{ fontSize: '0.8em', fontWeight: 400, color: '#999' }}>
                                  ({areaUnits.length} unit{areaUnits.length === 1 ? '' : 's'})
                                </span>
                              </span>
                              <span style={{ fontSize: '0.8em', color: '#888' }}>{areaOpen ? '▲' : '▼'}</span>
                            </button>

                            {areaOpen && (
                              <div style={{ display: 'grid', gap: 12, padding: 12, paddingTop: 0 }}>
                                {areaUnits.map((u) => (
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
                        {/* FEATURE (direct request: unit photos for
                            scouts browsing vacancies) - a small
                            thumbnail of the first photo if the
                            landlord has added any, otherwise a plain
                            placeholder so the layout stays consistent
                            rather than jumping around per-card. */}
                        {u.photoUrls?.[0] ? (
                          <img
                            src={u.photoUrls[0]}
                            alt={`${u.unitName} photo`}
                            style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            aria-hidden="true"
                            style={{
                              width: 72,
                              height: 72,
                              borderRadius: 8,
                              flexShrink: 0,
                              background: '#F5F5F5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#BBB',
                              fontSize: '1.4em',
                            }}
                          >
                            🏠
                          </div>
                        )}
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
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })}
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
