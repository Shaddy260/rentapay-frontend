import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import './AdminBrandAmbassadors.css';

/**
 * BUILD SPEC PHASE 2 - admin review queue for pending BA applications
 * (Approve / Reject) plus the full BA roster (any status). Sits
 * alongside the other single-purpose admin panels
 * (AdminRatingFlags.jsx, AdminReportedAccounts.jsx) rendered inline
 * from AdminDashboard.jsx's tab switch.
 */
export default function AdminBrandAmbassadors({ token }) {
  const [view, setView] = useState('applications'); // 'applications' | 'roster'
  const [applications, setApplications] = useState(null);
  const [roster, setRoster] = useState(null);
  const [rosterStatus, setRosterStatus] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({});
  const [approvedInfo, setApprovedInfo] = useState(null);
  // PHASE 16 - suspend/reactivate are simple one-click toggles;
  // offboard is permanent, so it gets its own confirm dialog that
  // states plainly the referral link keeps working.
  const [statusActionBusyId, setStatusActionBusyId] = useState(null);
  const [pendingOffboard, setPendingOffboard] = useState(null); // { id, name }
  const [offboardError, setOffboardError] = useState('');

  const loadApplications = useCallback(() => {
    setApplications(null);
    api
      .listPendingBaApplications(1, token)
      .then((res) => setApplications(res.applications || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load applications.'));
  }, [token]);

  const loadRoster = useCallback(() => {
    setRoster(null);
    api
      .listBrandAmbassadors(rosterStatus, token)
      .then((res) => setRoster(res.brandAmbassadors || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load Brand Ambassadors.'));
  }, [rosterStatus, token]);

  useEffect(() => {
    if (view === 'applications') loadApplications();
    else loadRoster();
  }, [view, loadApplications, loadRoster]);

  async function approve(id) {
    setBusyId(id);
    setError('');
    try {
      const res = await api.approveBaApplication(id, token);
      if (res?.tempCredentials) setApprovedInfo(res.tempCredentials);
      loadApplications();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve application.');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id) {
    setBusyId(id);
    setError('');
    try {
      await api.rejectBaApplication(id, rejectReasons[id] || '', token);
      loadApplications();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject application.');
    } finally {
      setBusyId(null);
    }
  }

  async function suspend(id) {
    setStatusActionBusyId(id);
    setError('');
    try {
      await api.suspendBrandAmbassador(id, token);
      loadRoster();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to suspend this Brand Ambassador.');
    } finally {
      setStatusActionBusyId(null);
    }
  }

  async function reactivate(id) {
    setStatusActionBusyId(id);
    setError('');
    try {
      await api.reactivateBrandAmbassador(id, token);
      loadRoster();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reactivate this Brand Ambassador.');
    } finally {
      setStatusActionBusyId(null);
    }
  }

  async function confirmOffboard() {
    if (!pendingOffboard) return;
    setStatusActionBusyId(pendingOffboard.id);
    setOffboardError('');
    try {
      await api.offboardBrandAmbassador(pendingOffboard.id, token);
      setPendingOffboard(null);
      loadRoster();
    } catch (err) {
      setOffboardError(err instanceof ApiError ? err.message : 'Failed to offboard this Brand Ambassador.');
    } finally {
      setStatusActionBusyId(null);
    }
  }

  return (
    <div className="admin-ba">
      <h2>Brand Ambassadors</h2>

      <div className="admin-ba__filter">
        <button
          type="button"
          className={`admin-ba__filter-btn${view === 'applications' ? ' admin-ba__filter-btn--active' : ''}`}
          onClick={() => setView('applications')}
        >
          Pending Applications
        </button>
        <button
          type="button"
          className={`admin-ba__filter-btn${view === 'roster' ? ' admin-ba__filter-btn--active' : ''}`}
          onClick={() => setView('roster')}
        >
          Full Roster
        </button>
      </div>

      {error && <p className="admin-ba__error">{error}</p>}

      {approvedInfo && (
        <div className="admin-ba__approved-banner">
          <p>
            Approved as <strong>{approvedInfo.baCode}</strong>. Credentials were sent to {approvedInfo.phone} /{' '}
            {approvedInfo.email}. If delivery fails, share manually — temp password:{' '}
            <code>{approvedInfo.tempPassword}</code>, referral link:{' '}
            <a href={approvedInfo.referralLink} target="_blank" rel="noopener noreferrer">
              {approvedInfo.referralLink}
            </a>
          </p>
          <button type="button" onClick={() => setApprovedInfo(null)}>Dismiss</button>
        </div>
      )}

      {view === 'applications' && (
        !applications ? (
          <Skeleton rows={3} />
        ) : !applications.length ? (
          <p className="admin-ba__empty">No pending applications right now.</p>
        ) : (
          <ul className="admin-ba__list">
            {applications.map((a) => (
              <li key={a.id} className={`admin-ba__item${a.overdue ? ' admin-ba__item--overdue' : ''}`}>
                <div className="admin-ba__row">
                  <span className="admin-ba__name">{a.full_name}</span>
                  {a.overdue && <span className="admin-ba__overdue-flag">Overdue for review</span>}
                </div>
                <p className="admin-ba__meta">
                  {a.phone} · {a.email} · Submitted {new Date(a.created_at).toLocaleString()}
                </p>
                <div className="admin-ba__actions">
                  <Button disabled={busyId === a.id} onClick={() => approve(a.id)}>
                    Approve
                  </Button>
                  <input
                    type="text"
                    placeholder="Optional rejection reason"
                    value={rejectReasons[a.id] || ''}
                    onChange={(e) => setRejectReasons((prev) => ({ ...prev, [a.id]: e.target.value }))}
                  />
                  <Button variant="danger" disabled={busyId === a.id} onClick={() => reject(a.id)}>
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {view === 'roster' && (
        <>
          <div className="admin-ba__filter admin-ba__filter--status">
            {['', 'active', 'suspended', 'inactive', 'rejected'].map((s) => (
              <button
                key={s || 'all'}
                type="button"
                className={`admin-ba__filter-btn${rosterStatus === s ? ' admin-ba__filter-btn--active' : ''}`}
                onClick={() => setRosterStatus(s)}
              >
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
              </button>
            ))}
          </div>
          {!roster ? (
            <Skeleton rows={3} />
          ) : !roster.length ? (
            <p className="admin-ba__empty">No Brand Ambassadors match this filter.</p>
          ) : (
            <ul className="admin-ba__list">
              {roster.map((b) => (
                <li key={b.id} className="admin-ba__item">
                  <div className="admin-ba__row">
                    <span className="admin-ba__name">{b.full_name}</span>
                    <span className={`admin-ba__status admin-ba__status--${b.status}`}>{b.status}</span>
                  </div>
                  <p className="admin-ba__meta">
                    {b.ba_code || '—'} · {b.phone} · {b.email}
                  </p>
                  {b.referralLink && (
                    <p className="admin-ba__meta">
                      <a href={b.referralLink} target="_blank" rel="noopener noreferrer">{b.referralLink}</a>
                    </p>
                  )}
                  <p className="admin-ba__meta">
                    {b.landlordsOnboarded} landlord{b.landlordsOnboarded === 1 ? '' : 's'} onboarded ·{' '}
                    {b.qualifiedPendingPayout} qualified pending payout
                  </p>
                  {/* PHASE 16 - suspend/reactivate/offboard. 'inactive'
                      and 'rejected' are terminal here: nothing to do
                      from this row for either. */}
                  {(b.status === 'active' || b.status === 'suspended') && (
                    <div className="admin-ba__actions">
                      {b.status === 'active' && (
                        <Button variant="ghost" disabled={statusActionBusyId === b.id} onClick={() => suspend(b.id)}>
                          Suspend
                        </Button>
                      )}
                      {b.status === 'suspended' && (
                        <Button variant="ghost" disabled={statusActionBusyId === b.id} onClick={() => reactivate(b.id)}>
                          Reactivate
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        disabled={statusActionBusyId === b.id}
                        onClick={() => { setOffboardError(''); setPendingOffboard({ id: b.id, name: b.full_name }); }}
                      >
                        Offboard
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!pendingOffboard}
        title="Offboard this Brand Ambassador?"
        message={
          pendingOffboard
            ? `This permanently marks ${pendingOffboard.name} as inactive. Their referral link keeps working - new landlord signups through it will still be credited to them - but their pending claims will stop qualifying for new payouts going forward. Already-qualified or paid claims are untouched. This cannot be reversed from here.`
            : ''
        }
        confirmLabel="Yes, offboard"
        busy={statusActionBusyId === pendingOffboard?.id}
        error={offboardError}
        onConfirm={confirmOffboard}
        onCancel={() => { setPendingOffboard(null); setOffboardError(''); }}
      />
    </div>
  );
}
