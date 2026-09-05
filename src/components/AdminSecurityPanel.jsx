import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import './AdminSecurityPanel.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
}

const RISK_LEVEL_CLASS = {
  low: 'admin-security__pill--low',
  medium: 'admin-security__pill--medium',
  high: 'admin-security__pill--high',
  critical: 'admin-security__pill--critical',
};

/**
 * Admin/GM UI for the zero-trust risk engine
 * (sql/2026-09-zero-trust-risk-engine.sql, serviceIdentity.middleware.js).
 * Before this component, `auth_risk_events` and `service_identities`
 * were SQL/script-only - browsing a risk decision or provisioning an
 * internal caller (WhatsApp bot, cron/worker, a future microservice)
 * meant opening a database console. This gives both a UI, backed by
 * GET /admin/security/* (admin.routes.js -> adminSecurity.controller.js).
 *
 * Provisioning/deactivating a service identity is admin-only server-
 * side (blockGeneralManagerSecurityProvisioning) - a General Manager
 * can view everything on this panel but the "New service identity"
 * form and activate/deactivate toggle are hidden for that role, same
 * treatment as the platform payment settings tab.
 */
export default function AdminSecurityPanel({ token, role }) {
  const [tab, setTab] = useState('risk-events');

  return (
    <section className="admin-security">
      <div className="admin-security__subtabs">
        <button
          type="button"
          className={tab === 'risk-events' ? 'is-active' : ''}
          onClick={() => setTab('risk-events')}
        >
          Risk Events
        </button>
        <button
          type="button"
          className={tab === 'service-identities' ? 'is-active' : ''}
          onClick={() => setTab('service-identities')}
        >
          Service Identities
        </button>
        <button
          type="button"
          className={tab === 'service-calls' ? 'is-active' : ''}
          onClick={() => setTab('service-calls')}
        >
          Service Call Log
        </button>
        <button
          type="button"
          className={tab === 'ip-bans' ? 'is-active' : ''}
          onClick={() => setTab('ip-bans')}
        >
          Blocked IPs
        </button>
      </div>

      {tab === 'risk-events' && <RiskEventsTab token={token} />}
      {tab === 'service-identities' && <ServiceIdentitiesTab token={token} role={role} />}
      {tab === 'service-calls' && <ServiceCallsTab token={token} />}
      {tab === 'ip-bans' && <IpBansTab token={token} />}
    </section>
  );
}

function RiskEventsTab({ token }) {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ riskLevel: '', accountType: '', accountId: '' });

  const load = useCallback(() => {
    setError('');
    api.getRiskSummary(token).then(setSummary).catch((err) => {
      // Secondary summary widget on this page - the risk events list
      // below (which does surface its own error via setError) is the
      // primary content, so this stays non-blocking. Still logged
      // rather than silently swallowed.
      console.warn('[AdminSecurityPanel] failed to load risk summary:', err);
    });
    api
      .getRiskEvents(filters, token)
      .then((res) => setEvents(res.events || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load risk events.'));
  }, [token, filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="admin-security__panel">
      {summary && (
        <div className="admin-security__summary">
          <div>
            <span className="admin-security__summary-label">Last 24h</span>
            <span className="admin-security__summary-value">{summary.total}</span>
          </div>
          {['low', 'medium', 'high', 'critical'].map((lvl) => (
            <div key={lvl}>
              <span className={`admin-security__pill ${RISK_LEVEL_CLASS[lvl]}`}>{lvl}</span>
              <span className="admin-security__summary-value">{summary.byLevel[lvl] || 0}</span>
            </div>
          ))}
          <div>
            <span className="admin-security__summary-label">Step-up challenges</span>
            <span className="admin-security__summary-value">{summary.stepUpChallenges}</span>
          </div>
          <div>
            <span className="admin-security__summary-label">Sessions terminated</span>
            <span className="admin-security__summary-value">{summary.sessionsTerminated}</span>
          </div>
        </div>
      )}

      <div className="admin-security__filters">
        <select value={filters.riskLevel} onChange={(e) => setFilters((f) => ({ ...f, riskLevel: e.target.value }))}>
          <option value="">All risk levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <input
          type="text"
          placeholder="Account type (e.g. landlord, tenant)"
          value={filters.accountType}
          onChange={(e) => setFilters((f) => ({ ...f, accountType: e.target.value }))}
        />
        <input
          type="text"
          placeholder="Account id"
          value={filters.accountId}
          onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value }))}
        />
        <Button type="button" variant="secondary" onClick={load}>Refresh</Button>
      </div>

      {error && <p className="admin-security__error">{error}</p>}
      {!events && !error && <Skeleton height="200px" />}

      {events && events.length === 0 && <p className="admin-security__empty">No risk events match these filters.</p>}

      {events && events.length > 0 && (
        <div className="admin-security__table-wrap">
          <table className="admin-security__table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Risk</th>
                <th>Account</th>
                <th>Route</th>
                <th>Reasons</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{formatDate(ev.created_at)}</td>
                  <td>{ev.event_type}</td>
                  <td>
                    <span className={`admin-security__pill ${RISK_LEVEL_CLASS[ev.risk_level] || ''}`}>
                      {ev.risk_level} ({ev.risk_score})
                    </span>
                  </td>
                  <td>{ev.account_type ? `${ev.account_type} / ${ev.account_id}` : '—'}</td>
                  <td>{ev.route || '—'}</td>
                  <td>{Array.isArray(ev.reasons) && ev.reasons.length ? ev.reasons.join(', ') : '—'}</td>
                  <td>{ev.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ServiceIdentitiesTab({ token, role }) {
  const canProvision = role === 'admin';
  const [identities, setIdentities] = useState(null);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState('');
  const [busy, setBusy] = useState(false);
  const [newRawKey, setNewRawKey] = useState(null);

  const load = useCallback(() => {
    setError('');
    api
      .getServiceIdentities(token)
      .then((res) => setIdentities(res.identities || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load service identities.'));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Service name is required.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.createServiceIdentity(
        {
          serviceName: name.trim(),
          allowedScopes: scopes.split(',').map((s) => s.trim()).filter(Boolean),
        },
        token
      );
      setNewRawKey({ serviceName: name.trim(), rawKey: res.rawKey });
      setName('');
      setScopes('');
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to provision service identity.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(identity) {
    setError('');
    try {
      await api.setServiceIdentityActive(identity.id, !identity.is_active, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update service identity.');
    }
  }

  return (
    <div className="admin-security__panel">
      <p className="admin-security__hint">
        Every internal caller (WhatsApp bot, background workers/cron, a future microservice) gets its own identity
        and its own scoped key, verified on every request by <code>verifyServiceIdentity</code> - instead of being
        implicitly trusted for running "inside our own network."
      </p>

      {newRawKey && (
        <div className="admin-security__raw-key">
          <strong>Raw key for "{newRawKey.serviceName}" - shown once, copy it now:</strong>
          <code>{newRawKey.rawKey}</code>
          <p>
            This is not stored anywhere and cannot be recovered. Put it directly into that service's own
            environment/secrets store.
          </p>
          <button type="button" onClick={() => setNewRawKey(null)}>Dismiss</button>
        </div>
      )}

      {error && <p className="admin-security__error">{error}</p>}

      {canProvision && (
        <div className="admin-security__create">
          <Button type="button" variant="secondary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Cancel' : 'New service identity'}
          </Button>
          {showCreate && (
            <form onSubmit={handleCreate} className="admin-security__create-form">
              <label>
                <span>Service name *</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. whatsapp-bot" required />
              </label>
              <label>
                <span>Allowed scopes (comma-separated)</span>
                <input type="text" value={scopes} onChange={(e) => setScopes(e.target.value)} placeholder="e.g. whatsapp-inbound, rent-reminders" />
              </label>
              <Button type="submit" variant="primary" loading={busy}>Provision</Button>
            </form>
          )}
        </div>
      )}

      {!identities && !error && <Skeleton height="150px" />}
      {identities && identities.length === 0 && <p className="admin-security__empty">No service identities provisioned yet.</p>}

      {identities && identities.length > 0 && (
        <div className="admin-security__table-wrap">
          <table className="admin-security__table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Scopes</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last used</th>
                {canProvision && <th></th>}
              </tr>
            </thead>
            <tbody>
              {identities.map((idn) => (
                <tr key={idn.id}>
                  <td>{idn.service_name}</td>
                  <td>{(idn.allowed_scopes || []).join(', ') || '—'}</td>
                  <td>
                    <span className={`admin-security__pill ${idn.is_active ? 'admin-security__pill--low' : 'admin-security__pill--critical'}`}>
                      {idn.is_active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td>{formatDate(idn.created_at)}</td>
                  <td>{formatDate(idn.last_used_at)}</td>
                  {canProvision && (
                    <td>
                      <button type="button" className="admin-security__link-btn" onClick={() => handleToggle(idn)}>
                        {idn.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IpBansTab({ token }) {
  const [bans, setBans] = useState(null);
  const [blocks, setBlocks] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.getIpBans(token).then((res) => setBans(res.bans || [])).catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load blocked IPs.'));
    api.getWafBlocks({}, token).then((res) => setBlocks(res.blocks || [])).catch((err) => {
      // Secondary list on this page, same reasoning as getRiskSummary
      // above - non-blocking, but logged.
      console.warn('[AdminSecurityPanel] failed to load WAF blocks:', err);
    });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="admin-security__panel">
      <p className="admin-security__hint">
        Escalating bans from adaptiveRateLimit.middleware.js (throttle → temporary ban → longer ban for repeat
        offenders) and blocks from wafFilter.middleware.js (obvious SQLi/XSS/path-traversal payloads). Neither
        replaces a real edge WAF (Cloudflare etc) - see DDOS-RESPONSE-PLAN.md.
      </p>
      <Button type="button" variant="secondary" onClick={load}>Refresh</Button>

      {error && <p className="admin-security__error">{error}</p>}

      <h4>IP bans</h4>
      {!bans && !error && <Skeleton height="120px" />}
      {bans && bans.length === 0 && <p className="admin-security__empty">No IP has been banned yet.</p>}
      {bans && bans.length > 0 && (
        <div className="admin-security__table-wrap">
          <table className="admin-security__table">
            <thead>
              <tr>
                <th>When</th>
                <th>IP</th>
                <th>Level</th>
                <th>Duration</th>
                <th>Route</th>
              </tr>
            </thead>
            <tbody>
              {bans.map((b) => (
                <tr key={b.id}>
                  <td>{formatDate(b.created_at)}</td>
                  <td>{b.ip}</td>
                  <td>{b.ban_level}</td>
                  <td>{Math.round(b.duration_ms / 60000)}min</td>
                  <td>{b.route || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4>WAF-pattern blocks</h4>
      {!blocks && <Skeleton height="120px" />}
      {blocks && blocks.length === 0 && <p className="admin-security__empty">No malicious-pattern requests blocked yet.</p>}
      {blocks && blocks.length > 0 && (
        <div className="admin-security__table-wrap">
          <table className="admin-security__table">
            <thead>
              <tr>
                <th>When</th>
                <th>IP</th>
                <th>Rule</th>
                <th>Route</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.id}>
                  <td>{formatDate(b.created_at)}</td>
                  <td>{b.ip || '—'}</td>
                  <td>{b.rule}</td>
                  <td>{b.route || '—'}</td>
                  <td>{b.method || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function ServiceCallsTab({ token }) {
  const [calls, setCalls] = useState(null);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState('');

  const load = useCallback(() => {
    setError('');
    api
      .getServiceCallEvents({ outcome }, token)
      .then((res) => setCalls(res.calls || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the service call log.'));
  }, [token, outcome]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="admin-security__panel">
      <p className="admin-security__hint">
        Every request through <code>verifyServiceIdentity</code> (allowed or rejected) once an internal caller is
        wired to it - nothing appears here until something actually consumes the middleware.
      </p>
      <div className="admin-security__filters">
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="">All outcomes</option>
          <option value="allowed">Allowed</option>
          <option value="rejected">Rejected</option>
        </select>
        <Button type="button" variant="secondary" onClick={load}>Refresh</Button>
      </div>

      {error && <p className="admin-security__error">{error}</p>}
      {!calls && !error && <Skeleton height="150px" />}
      {calls && calls.length === 0 && <p className="admin-security__empty">No service calls logged yet.</p>}

      {calls && calls.length > 0 && (
        <div className="admin-security__table-wrap">
          <table className="admin-security__table">
            <thead>
              <tr>
                <th>When</th>
                <th>Service</th>
                <th>Scope</th>
                <th>Route</th>
                <th>Outcome</th>
                <th>Reason</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id}>
                  <td>{formatDate(c.created_at)}</td>
                  <td>{c.service_name || '—'}</td>
                  <td>{c.scope || '—'}</td>
                  <td>{c.route || '—'}</td>
                  <td>
                    <span className={`admin-security__pill ${c.outcome === 'allowed' ? 'admin-security__pill--low' : 'admin-security__pill--critical'}`}>
                      {c.outcome}
                    </span>
                  </td>
                  <td>{c.reason || '—'}</td>
                  <td>{c.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
