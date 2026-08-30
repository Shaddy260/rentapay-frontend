import { useState } from 'react';
import ModalShell from './ModalShell.jsx';
import { api, ApiError } from '../api/client.js';
import './TenantQuickActions.css';

/**
 * FEATURE (direct request): clicking a tenant in Global Search used to
 * just deep-link to their unit with no way to act on the account
 * itself - unlike a landlord result, which lands on a row with
 * Suspend/Activate buttons right there. This gives tenants the same
 * "found it, now act on it" flow, reusing the moderation endpoints
 * that already exist (warn / suspend permanently / suspend for N days
 * / unsuspend) - the same ones behind the "Reported accounts" screen.
 *
 * Two modes:
 *  - mode="admin": calls the moderation API directly (admin writes on
 *    this router don't require extra confirmation - same as
 *    AdminReportedAccounts.jsx).
 *  - mode="gm": routes every action through the caller's existing
 *    Operations PIN + reason confirmation flow (requestGmConfirm),
 *    since the backend requires that for every General Manager write.
 */
export default function TenantQuickActions({ token, tenant, mode = 'admin', requestGmConfirm, onClose, onChanged }) {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Local copy of the tenant's moderation state, so the buttons flip
  // (Suspend -> Activate) and the status line updates right after a
  // successful action - the `tenant` prop is just a snapshot from the
  // search result at the moment it was clicked and never refetches.
  const [status, setStatus] = useState({
    isSuspended: tenant?.isSuspended || tenant?.suspendedPermanently || !!tenant?.suspendedUntil,
    suspendedPermanently: !!tenant?.suspendedPermanently,
    suspendedUntil: tenant?.suspendedUntil || null,
    warningCount: tenant?.warningCount || 0,
  });

  if (!tenant) return null;

  async function run(label, description, call, optimisticStatus) {
    if (mode === 'gm') {
      // The GM's Operations PIN + reason are collected in a separate
      // modal the caller already owns (GmActionConfirmModal via
      // requestGmConfirm) - this one has nothing left to do here but
      // hand off and close, so it doesn't sit on top of that modal.
      requestGmConfirm?.({ label, description, run: (operationsPin, gmReason) => call(gmReason, operationsPin) });
      onClose?.();
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await call(reason || undefined);
      setNotice(res?.message || 'Done.');
      if (optimisticStatus) setStatus((prev) => ({ ...prev, ...optimisticStatus }));
      // Let the caller know the underlying data changed (e.g. so a
      // background tenant list refreshes) WITHOUT closing this modal -
      // the admin should get to see the confirmation message and,
      // if they suspended by mistake, immediately hit Activate.
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  function warn() {
    run('Warn tenant', `Send a warning to ${tenant.name}?`, (r, pin) =>
      api.warnAccount('tenant', tenant.id, { reason: r, operationsPin: pin }, token),
      { warningCount: status.warningCount + 1 }
    );
  }

  function suspendTemporary() {
    if (mode === 'admin' && !window.confirm(`Suspend ${tenant.name} for ${days} day(s)?`)) return;
    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + days);
    run('Suspend tenant (temporary)', `Suspend ${tenant.name} for ${days} day(s)? They won't be able to log in until it lifts.`, (r, pin) =>
      api.suspendAccountTemporarily('tenant', tenant.id, { days, reason: r, operationsPin: pin }, token),
      { isSuspended: true, suspendedPermanently: false, suspendedUntil: suspendedUntil.toISOString() }
    );
  }

  function suspendPermanent() {
    if (mode === 'admin' && !window.confirm(`Suspend ${tenant.name} indefinitely? They will not be able to log in until unsuspended.`)) return;
    run('Suspend tenant (indefinite)', `Suspend ${tenant.name} indefinitely? They will not be able to log in until unsuspended.`, (r, pin) =>
      api.suspendAccountPermanently('tenant', tenant.id, { reason: r, operationsPin: pin }, token),
      { isSuspended: true, suspendedPermanently: true, suspendedUntil: null }
    );
  }

  function unsuspend() {
    run('Reactivate tenant', `Lift the suspension on ${tenant.name}'s account?`, (r, pin) =>
      api.unsuspendAccount('tenant', tenant.id, token, { reason: r, operationsPin: pin }),
      { isSuspended: false, suspendedPermanently: false, suspendedUntil: null }
    );
  }

  const { isSuspended } = status;

  return (
    <ModalShell title={`Account actions — ${tenant.name}`} onClose={onClose}>
      <div className="tenant-quick-actions">
        <p className="tenant-quick-actions__meta">
          {[tenant.email, tenant.phone].filter(Boolean).join(' · ')}
          {tenant.estateName || tenant.unitName ? (
            <><br />{[tenant.estateName, tenant.unitName].filter(Boolean).join(' · ')}</>
          ) : null}
        </p>

        <p className={`tenant-quick-actions__status tenant-quick-actions__status--${isSuspended ? 'suspended' : 'active'}`}>
          {isSuspended
            ? status.suspendedPermanently
              ? 'Suspended indefinitely'
              : `Suspended until ${status.suspendedUntil ? new Date(status.suspendedUntil).toLocaleString() : '—'}`
            : 'Active'}
          {status.warningCount ? ` · ${status.warningCount} warning(s)` : ''}
        </p>

        {mode === 'admin' && (
          <label className="tenant-quick-actions__field">
            <span>Reason (optional, shown in the audit log)</span>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Repeated late payment abuse" />
          </label>
        )}

        {error && <p className="tenant-quick-actions__error">{error}</p>}
        {notice && <p className="tenant-quick-actions__notice">{notice}</p>}

        <div className="tenant-quick-actions__buttons">
          <button type="button" className="tenant-quick-actions__btn" onClick={warn} disabled={busy}>
            Warn
          </button>

          {!isSuspended && (
            <>
              <span className="tenant-quick-actions__days">
                for
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                />
                day(s)
              </span>
              <button type="button" className="tenant-quick-actions__btn tenant-quick-actions__btn--warn" onClick={suspendTemporary} disabled={busy}>
                Suspend (temporary)
              </button>
              <button type="button" className="tenant-quick-actions__btn tenant-quick-actions__btn--danger" onClick={suspendPermanent} disabled={busy}>
                Deactivate (suspend indefinitely)
              </button>
            </>
          )}

          {isSuspended && (
            <button type="button" className="tenant-quick-actions__btn tenant-quick-actions__btn--primary" onClick={unsuspend} disabled={busy}>
              Activate (lift suspension)
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
