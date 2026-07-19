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
            <div style={{ display: 'grid', gap: 12 }}>
              {units.map((u) => (
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
                      {[u.county, u.constituency, u.area].filter(Boolean).join(' · ') || 'Location not set'}
                    </div>
                    <div style={{ marginTop: 4 }}>KES {Number(u.rentAmount).toLocaleString()}/month</div>
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
