import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import './AdminReportedAccounts.css';
import InfoTip from './InfoTip.jsx';

const ACCOUNT_LABEL = { landlord: 'Landlord', manager: 'Manager', tenant: 'Tenant' };

/**
 * FEATURE (direct request): the admin side of Community's report
 * system - review open reports, warn/suspend the reported account, and
 * a separate "reported accounts" worklist by moderation state (warned
 * / temporarily suspended / suspended), each showing how many times
 * that account has been warned and reported so a repeat offender is
 * obvious at a glance.
 */
export default function AdminReportedAccounts({ token, readOnly = false }) {
  const [view, setView] = useState('reports'); // 'reports' | 'warned' | 'temporary' | 'suspended'
  const [reports, setReports] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [reasonDrafts, setReasonDrafts] = useState({});
  const [daysDrafts, setDaysDrafts] = useState({});

  const load = useCallback(() => {
    setError('');
    if (view === 'reports') {
      setReports(null);
      api.listCommunityReports('open', token)
        .then((res) => setReports(res.reports || []))
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load reports.'));
    } else {
      setAccounts(null);
      api.listModeratedAccounts(view, token)
        .then((res) => setAccounts(res.accounts || []))
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load accounts.'));
    }
  }, [view, token]);

  useEffect(() => {
    load();
  }, [load]);

  function keyFor(accountType, accountId) {
    return `${accountType}:${accountId}`;
  }

  async function warn(accountType, accountId, reportId) {
    const key = keyFor(accountType, accountId);
    setBusyKey(key);
    setError('');
    try {
      await api.warnAccount(accountType, accountId, { reason: reasonDrafts[key] || undefined, reportId }, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to warn account.');
    } finally {
      setBusyKey(null);
    }
  }

  async function suspendPermanent(accountType, accountId, reportId) {
    const key = keyFor(accountType, accountId);
    if (!window.confirm('Suspend this account indefinitely? They will not be able to log in or reset their password until unsuspended.')) return;
    setBusyKey(key);
    setError('');
    try {
      await api.suspendAccountPermanently(accountType, accountId, { reason: reasonDrafts[key] || undefined, reportId }, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to suspend account.');
    } finally {
      setBusyKey(null);
    }
  }

  async function suspendTemporary(accountType, accountId, reportId) {
    const key = keyFor(accountType, accountId);
    const days = Number(daysDrafts[key]);
    if (!days || days < 1) {
      setError('Enter how many days to suspend for.');
      return;
    }
    setBusyKey(key);
    setError('');
    try {
      await api.suspendAccountTemporarily(accountType, accountId, { days, reason: reasonDrafts[key] || undefined, reportId }, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to suspend account.');
    } finally {
      setBusyKey(null);
    }
  }

  async function unsuspend(accountType, accountId) {
    const key = keyFor(accountType, accountId);
    setBusyKey(key);
    setError('');
    try {
      await api.unsuspendAccount(accountType, accountId, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to lift suspension.');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="admin-reported-accounts">
      <h2>Reported Accounts</h2>
      <InfoTip text={<>
        Content reported from the Community board, and every account currently warned, temporarily
        suspended, or suspended indefinitely. A suspended account can't log in or reset their
        password.
      </>} />

      <div className="admin-reported-accounts__filter">
        {[
          { key: 'reports', label: 'Open reports' },
          { key: 'warned', label: 'Warned' },
          { key: 'temporary', label: 'Temporarily suspended' },
          { key: 'suspended', label: 'Suspended' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`admin-reported-accounts__filter-btn${view === tab.key ? ' admin-reported-accounts__filter-btn--active' : ''}`}
            onClick={() => setView(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="admin-reported-accounts__error">{error}</p>}

      {view === 'reports' && (
        !reports ? (
          <Skeleton rows={3} />
        ) : !reports.length ? (
          <p className="admin-reported-accounts__empty">No open reports.</p>
        ) : (
          <ul className="admin-reported-accounts__list">
            {reports.map((r) => {
              const key = keyFor(r.reported_type, r.reported_id);
              return (
                <li key={r.id} className="admin-reported-accounts__item">
                  <div className="admin-reported-accounts__row">
                    <span className="admin-reported-accounts__type">{ACCOUNT_LABEL[r.reported_type]} reported</span>
                    <span className="admin-reported-accounts__meta">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="admin-reported-accounts__reason"><strong>Reason:</strong> {r.reason}</p>
                  {r.content_snapshot && (
                    <p className="admin-reported-accounts__snapshot">"{r.content_snapshot}"</p>
                  )}
                  {r.photo_urls?.length > 0 && (
                    <div className="admin-reported-accounts__photos">
                      {r.photo_urls.map((url) => (
                        <img key={url} src={url} alt="Reported content" loading="lazy" decoding="async" />
                      ))}
                    </div>
                  )}

                  <div className="admin-reported-accounts__actions">
                    {readOnly ? (
                      <p className="admin-reported-accounts__readonly-note">View only</p>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="Reason shown to the account (optional)"
                          value={reasonDrafts[key] || ''}
                          onChange={(e) => setReasonDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                        <Button disabled={busyKey === key} onClick={() => warn(r.reported_type, r.reported_id, r.id)}>
                          Warn
                        </Button>
                        <input
                          type="number"
                          min="1"
                          placeholder="Days"
                          className="admin-reported-accounts__days-input"
                          value={daysDrafts[key] || ''}
                          onChange={(e) => setDaysDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                        <Button variant="ghost" disabled={busyKey === key} onClick={() => suspendTemporary(r.reported_type, r.reported_id, r.id)}>
                          Suspend temporarily
                        </Button>
                        <Button variant="danger" disabled={busyKey === key} onClick={() => suspendPermanent(r.reported_type, r.reported_id, r.id)}>
                          Suspend indefinitely
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      {view !== 'reports' && (
        !accounts ? (
          <Skeleton rows={3} />
        ) : !accounts.length ? (
          <p className="admin-reported-accounts__empty">No accounts in this list.</p>
        ) : (
          <ul className="admin-reported-accounts__list">
            {accounts.map((a) => {
              const key = keyFor(a.accountType, a.id);
              return (
                <li key={key} className="admin-reported-accounts__item">
                  <div className="admin-reported-accounts__row">
                    <span className="admin-reported-accounts__type">{ACCOUNT_LABEL[a.accountType]}: {a.label}</span>
                    <span className="admin-reported-accounts__counts">
                      Warned {a.warning_count || 0}x · Reported {a.report_count || 0}x
                    </span>
                  </div>
                  {a.suspension_reason && <p className="admin-reported-accounts__reason"><strong>Reason:</strong> {a.suspension_reason}</p>}
                  {a.suspended_until && view === 'temporary' && (
                    <p className="admin-reported-accounts__meta">Until {new Date(a.suspended_until).toLocaleString()}</p>
                  )}

                  <div className="admin-reported-accounts__actions">
                    {(view === 'temporary' || view === 'suspended') ? (
                      readOnly ? (
                        <p className="admin-reported-accounts__readonly-note">View only</p>
                      ) : (
                        <Button disabled={busyKey === key} onClick={() => unsuspend(a.accountType, a.id)}>
                          Lift suspension
                        </Button>
                      )
                    ) : readOnly ? (
                      <p className="admin-reported-accounts__readonly-note">View only</p>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={reasonDrafts[key] || ''}
                          onChange={(e) => setReasonDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="Days"
                          className="admin-reported-accounts__days-input"
                          value={daysDrafts[key] || ''}
                          onChange={(e) => setDaysDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                        <Button variant="ghost" disabled={busyKey === key} onClick={() => suspendTemporary(a.accountType, a.id, null)}>
                          Suspend temporarily
                        </Button>
                        <Button variant="danger" disabled={busyKey === key} onClick={() => suspendPermanent(a.accountType, a.id, null)}>
                          Suspend indefinitely
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
}
