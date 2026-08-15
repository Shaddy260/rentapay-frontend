import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import InfoTip from './InfoTip.jsx';
import AdminBaPayoutRules from './AdminBaPayoutRules.jsx';
import AdminBaPayoutQualificationReport from './AdminBaPayoutQualificationReport.jsx';
import AdminBaPayouts from './AdminBaPayouts.jsx';
import { buildWaMeLink } from '../utils/whatsapp.js';
import './AdminBrandAmbassadors.css';
import './TenantOnboardingPanel.css';

/**
 * BUILD SPEC PHASE 2 - admin review queue for pending BA applications
 * (Approve / Reject) plus the full BA roster (any status). Sits
 * alongside the other single-purpose admin panels
 * (AdminRatingFlags.jsx, AdminReportedAccounts.jsx) rendered inline
 * from AdminDashboard.jsx's tab switch.
 */
export default function AdminBrandAmbassadors({ token }) {
  const [view, setView] = useState('applications'); // 'applications' | 'roster' | 'payout-rules' | 'payout-qualification-report' | 'payouts'
  const [applications, setApplications] = useState(null);
  const [roster, setRoster] = useState(null);
  const [rosterStatus, setRosterStatus] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({});
  const [approvedInfo, setApprovedInfo] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // The one generic "Become a Brand Ambassador" link, now rotating:
  // admin generates it here and it's only good for 24h (or until the
  // next regenerate, whichever comes first) - see
  // brandAmbassador.controller.js's ba_onboarding_links table.
  const [baLink, setBaLink] = useState(null); // { link, expiresAt, expired } | null while loading
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');

  const loadOnboardingLink = useCallback(() => {
    api
      .getBaOnboardingLink(token)
      .then((res) => setBaLink(res))
      .catch((err) => setLinkError(err instanceof ApiError ? err.message : 'Failed to load the onboarding link.'));
  }, [token]);

  useEffect(() => { loadOnboardingLink(); }, [loadOnboardingLink]);

  async function generateOnboardingLink() {
    setLinkBusy(true);
    setLinkError('');
    try {
      const res = await api.generateBaOnboardingLink(token);
      setBaLink({ link: res.link, expiresAt: res.expiresAt, expired: false });
    } catch (err) {
      setLinkError(err instanceof ApiError ? err.message : 'Failed to generate a new link.');
    } finally {
      setLinkBusy(false);
    }
  }

  async function copyOnboardingLink() {
    if (!baLink?.link) return;
    try {
      await navigator.clipboard.writeText(baLink.link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, non-secure context) -
      // the link is still shown and selectable in the input below,
      // so this is a soft failure, not a blocker.
      setLinkError('Could not copy automatically - select and copy the link below instead.');
    }
  }
  // PHASE 16 - suspend/reactivate/offboard/restore all route through
  // ConfirmDialog with requirePassword, same as a landlord's
  // suspend/activate does on the main admin dashboard - none of these
  // fire on a bare click anymore.
  const [statusActionBusyId, setStatusActionBusyId] = useState(null);
  const [pendingOffboard, setPendingOffboard] = useState(null); // { id, name }
  const [offboardError, setOffboardError] = useState('');
  // FIX (direct request: "under admin portal to suspend a BA there
  // should be a confirmation as well - currently none"): Suspend used
  // to fire straight from the button's onClick. Now it opens the same
  // ConfirmDialog pattern already used for Offboard below, instead of
  // acting on a single click.
  const [pendingSuspend, setPendingSuspend] = useState(null); // { id, name }
  const [suspendError, setSuspendError] = useState('');
  // FIX (direct request: "offboard or activate an account should ask
  // for the password"): Reactivate used to fire straight from the
  // button's onClick with no password check. Now it opens a confirm
  // dialog too, same shape as suspend/offboard.
  const [pendingReactivate, setPendingReactivate] = useState(null); // { id, name }
  const [reactivateError, setReactivateError] = useState('');
  // FIX (direct request: "there should be a way for admin to restore
  // an offboarded BA account"): offboard was previously a one-way
  // door in the UI (backend already only allowed active/suspended ->
  // inactive). This adds the missing reverse action for an inactive
  // BA, gated behind the admin password like every other status
  // change here.
  const [pendingRestore, setPendingRestore] = useState(null); // { id, name }
  const [restoreError, setRestoreError] = useState('');

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
    else if (view === 'roster') loadRoster();
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

  async function confirmSuspend(password) {
    if (!pendingSuspend) return;
    setStatusActionBusyId(pendingSuspend.id);
    setSuspendError('');
    try {
      await api.suspendBrandAmbassador(pendingSuspend.id, password, token);
      setPendingSuspend(null);
      loadRoster();
    } catch (err) {
      setSuspendError(err instanceof ApiError ? err.message : 'Failed to suspend this Brand Ambassador.');
    } finally {
      setStatusActionBusyId(null);
    }
  }

  async function confirmReactivate(password) {
    if (!pendingReactivate) return;
    setStatusActionBusyId(pendingReactivate.id);
    setReactivateError('');
    try {
      await api.reactivateBrandAmbassador(pendingReactivate.id, password, token);
      setPendingReactivate(null);
      loadRoster();
    } catch (err) {
      setReactivateError(err instanceof ApiError ? err.message : 'Failed to reactivate this Brand Ambassador.');
    } finally {
      setStatusActionBusyId(null);
    }
  }

  async function confirmOffboard(password) {
    if (!pendingOffboard) return;
    setStatusActionBusyId(pendingOffboard.id);
    setOffboardError('');
    try {
      await api.offboardBrandAmbassador(pendingOffboard.id, password, token);
      setPendingOffboard(null);
      loadRoster();
    } catch (err) {
      setOffboardError(err instanceof ApiError ? err.message : 'Failed to offboard this Brand Ambassador.');
    } finally {
      setStatusActionBusyId(null);
    }
  }

  async function confirmRestore(password) {
    if (!pendingRestore) return;
    setStatusActionBusyId(pendingRestore.id);
    setRestoreError('');
    try {
      await api.restoreBrandAmbassador(pendingRestore.id, password, token);
      setPendingRestore(null);
      loadRoster();
    } catch (err) {
      setRestoreError(err instanceof ApiError ? err.message : 'Failed to restore this Brand Ambassador.');
    } finally {
      setStatusActionBusyId(null);
    }
  }

  return (
    <div className="admin-ba">
      <h2>Brand Ambassadors</h2>

      {/* Onboard a new BA: share this one generic, reusable link with
          whoever you want to become a Brand Ambassador. They open it,
          fill in their own details, and their application lands in
          "Pending Applications" below for you to approve or reject. */}
      <div className="admin-ba__link-card">
        <p className="admin-ba__link-card-title">Onboard a new Brand Ambassador</p>
        <InfoTip text={<>
          Generate a link and send it to the person you want to onboard as a BA. They'll fill in their own details
          and submit — you approve or reject it from Pending Applications below. The link expires 24 hours after
          it's generated; after that (or once you generate a new one) the old one stops working and whoever has it
          is told to request a fresh one.
        </>} />
        {linkError && <p className="admin-ba__error">{linkError}</p>}
        {!baLink ? (
          <p className="admin-ba__meta">Loading…</p>
        ) : !baLink.link || baLink.expired ? (
          <div className="admin-ba__link-row">
            <p className="admin-ba__meta">No live link right now — generate one to share.</p>
            <Button variant="primary" loading={linkBusy} onClick={generateOnboardingLink}>Generate Link</Button>
          </div>
        ) : (
          <>
            <div className="admin-ba__link-row">
              <input type="text" readOnly value={baLink.link} onFocus={(e) => e.target.select()} />
              <Button variant="ghost" onClick={copyOnboardingLink}>{linkCopied ? 'Copied!' : 'Copy Link'}</Button>
              <a
                href={buildWaMeLink('', `Onboard as a RentaPay Brand Ambassador: ${baLink.link}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--ghost"
              >
                Share via WhatsApp
              </a>
            </div>
            <p className="admin-ba__meta">
              Expires {new Date(baLink.expiresAt).toLocaleString()} ·{' '}
              <button type="button" className="admin-ba__link-regenerate" disabled={linkBusy} onClick={generateOnboardingLink}>
                {linkBusy ? 'Regenerating…' : 'Regenerate now'}
              </button>
            </p>
          </>
        )}
      </div>

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
        <button
          type="button"
          className={`admin-ba__filter-btn${view === 'payout-rules' ? ' admin-ba__filter-btn--active' : ''}`}
          onClick={() => setView('payout-rules')}
        >
          Pricing &amp; Commission
        </button>
        <button
          type="button"
          className={`admin-ba__filter-btn${view === 'payout-qualification-report' ? ' admin-ba__filter-btn--active' : ''}`}
          onClick={() => setView('payout-qualification-report')}
        >
          Payout Run
        </button>
        <button
          type="button"
          className={`admin-ba__filter-btn${view === 'payouts' ? ' admin-ba__filter-btn--active' : ''}`}
          onClick={() => setView('payouts')}
        >
          Payouts
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
          <div className="onboarding-requests__scroll">
            {applications.map((a) => (
              <div key={a.id} className={`onboarding-request-card${a.overdue ? ' admin-ba__item--overdue' : ''}`}>
                <div className="onboarding-request-card__summary">
                  <strong>{a.full_name}</strong>
                  {a.overdue && <span className="admin-ba__overdue-flag">Overdue for review</span>}
                  <span>{a.phone}</span>
                  <span>{a.email}</span>
                  <span>ID: {a.national_id || '—'}</span>
                  <span>Submitted {new Date(a.created_at).toLocaleString()}</span>
                </div>
                <div className="onboarding-request-card__actions">
                  <input
                    type="text"
                    placeholder="Optional rejection reason"
                    value={rejectReasons[a.id] || ''}
                    onChange={(e) => setRejectReasons((prev) => ({ ...prev, [a.id]: e.target.value }))}
                  />
                  <Button variant="ghost" disabled={busyId === a.id} onClick={() => reject(a.id)}>
                    Reject
                  </Button>
                  <Button variant="primary" loading={busyId === a.id} onClick={() => approve(a.id)}>
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
                  {/* PHASE 16 - suspend/reactivate/offboard for an
                      active or suspended BA; restore for an offboarded
                      (inactive) one. 'rejected' stays terminal - no
                      action from this row. */}
                  {(b.status === 'active' || b.status === 'suspended') && (
                    <div className="admin-ba__actions">
                      {b.status === 'active' && (
                        <Button
                          variant="ghost"
                          disabled={statusActionBusyId === b.id}
                          onClick={() => { setSuspendError(''); setPendingSuspend({ id: b.id, name: b.full_name }); }}
                        >
                          Suspend
                        </Button>
                      )}
                      {b.status === 'suspended' && (
                        <Button
                          variant="ghost"
                          disabled={statusActionBusyId === b.id}
                          onClick={() => { setReactivateError(''); setPendingReactivate({ id: b.id, name: b.full_name }); }}
                        >
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
                  {b.status === 'inactive' && (
                    <div className="admin-ba__actions">
                      <Button
                        variant="ghost"
                        disabled={statusActionBusyId === b.id}
                        onClick={() => { setRestoreError(''); setPendingRestore({ id: b.id, name: b.full_name }); }}
                      >
                        Restore
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view === 'payout-rules' && <AdminBaPayoutRules token={token} />}

      {view === 'payout-qualification-report' && <AdminBaPayoutQualificationReport token={token} />}

      {view === 'payouts' && <AdminBaPayouts token={token} />}

      <ConfirmDialog
        open={!!pendingSuspend}
        title="Suspend this Brand Ambassador?"
        message={
          pendingSuspend
            ? `${pendingSuspend.name} will stop earning new payouts and their referral link/code will stop attributing new landlord signups until you reactivate them. Already-qualified or paid claims are untouched. Re-enter your admin password to proceed.`
            : ''
        }
        confirmLabel="Yes, suspend"
        danger
        requirePassword
        busy={statusActionBusyId === pendingSuspend?.id}
        error={suspendError}
        onConfirm={confirmSuspend}
        onCancel={() => { setPendingSuspend(null); setSuspendError(''); }}
      />

      <ConfirmDialog
        open={!!pendingReactivate}
        title="Reactivate this Brand Ambassador?"
        message={
          pendingReactivate
            ? `${pendingReactivate.name} will be able to log in and their referral link/code will resume attributing new landlord signups. Re-enter your admin password to proceed.`
            : ''
        }
        confirmLabel="Yes, reactivate"
        danger={false}
        requirePassword
        busy={statusActionBusyId === pendingReactivate?.id}
        error={reactivateError}
        onConfirm={confirmReactivate}
        onCancel={() => { setPendingReactivate(null); setReactivateError(''); }}
      />

      <ConfirmDialog
        open={!!pendingOffboard}
        title="Offboard this Brand Ambassador?"
        message={
          pendingOffboard
            ? `This marks ${pendingOffboard.name} as inactive. Their referral link keeps working - new landlord signups through it will still be credited to them - but their pending claims will stop qualifying for new payouts going forward. Already-qualified or paid claims are untouched. You can restore them later from here if needed. Re-enter your admin password to proceed.`
            : ''
        }
        confirmLabel="Yes, offboard"
        requirePassword
        busy={statusActionBusyId === pendingOffboard?.id}
        error={offboardError}
        onConfirm={confirmOffboard}
        onCancel={() => { setPendingOffboard(null); setOffboardError(''); }}
      />

      <ConfirmDialog
        open={!!pendingRestore}
        title="Restore this Brand Ambassador?"
        message={
          pendingRestore
            ? `${pendingRestore.name} will be marked active again and will be able to log in and resume earning new payouts. Re-enter your admin password to proceed.`
            : ''
        }
        confirmLabel="Yes, restore"
        danger={false}
        requirePassword
        busy={statusActionBusyId === pendingRestore?.id}
        error={restoreError}
        onConfirm={confirmRestore}
        onCancel={() => { setPendingRestore(null); setRestoreError(''); }}
      />
    </div>
  );
}
