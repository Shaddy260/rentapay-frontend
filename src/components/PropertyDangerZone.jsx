import React, { useEffect, useState } from 'react';
import Button from './Button.jsx';
import PasswordInput from './PasswordInput.jsx';
import { api, ApiError } from '../api/client.js';

/**
 * Settings > Danger Zone - delete one apartment/property (soft delete
 * with a 7-day recovery grace period).
 *
 * Every step is something the person can walk away from - each stage
 * below has its own Cancel, and nothing happens until the very last
 * button on the very last screen:
 *
 *   'idle'    - pick the apartment, enter your OWN password
 *   'otp'     - enter the code emailed to the property owner
 *   'confirm' - final review of exactly what will happen, with its
 *               own explicit "Yes, delete" - not the OTP step
 *   'done'    - result
 *
 * A manager may start this with their OWN password, but the code
 * always goes to the landlord's email - the owner sees and approves
 * every deletion, whether or not they started it. Deleting hides the
 * apartment immediately but keeps it for 7 days; only an admin or a
 * manager (never the landlord themself) can restore it in that
 * window - see RecentlyDeletedProperties below.
 */
export default function PropertyDangerZone({ properties, token, isManager, onDeleted }) {
  // Recovery (the "Recently deleted" list + Restore) is manager-only
  // here - a landlord never sees it, on purpose: the whole point of
  // the grace period is to catch a deletion even the landlord
  // themself rushed through. Admin has the same restore capability
  // from the admin panel instead.
  const canRecover = !!isManager;
  const [propertyId, setPropertyId] = useState('');
  const [stage, setStage] = useState('idle'); // 'idle' | 'otp' | 'confirm' | 'done'
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmToken, setConfirmToken] = useState(null);
  const [summary, setSummary] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resultMessage, setResultMessage] = useState('');

  const selectedProperty = (properties || []).find((p) => p.id === propertyId) || null;

  function resetToIdle({ keepPropertyPicked = true } = {}) {
    setStage('idle');
    setPassword('');
    setOtp('');
    setConfirmToken(null);
    setSummary(null);
    setActions([]);
    setError('');
    setNotice('');
    if (!keepPropertyPicked) setPropertyId('');
  }

  async function cancelServerSide() {
    if (!propertyId) return;
    try {
      await api.cancelDeletePropertyDeletion(propertyId, token);
    } catch {
      // best-effort - the pending code/token expire on their own regardless
    }
  }

  async function handleCancel() {
    setLoading(true);
    await cancelServerSide();
    setLoading(false);
    resetToIdle();
  }

  async function handleRequestOtp(e) {
    e.preventDefault();
    if (!propertyId) return setError('Choose which apartment to delete first.');
    if (!password) return setError('Enter your password.');
    setError('');
    setLoading(true);
    try {
      const res = await api.requestDeletePropertyOtp(propertyId, { password }, token);
      setNotice(res.message || '');
      setPassword('');
      setStage('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start deletion.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (!otp) return setError('Enter the code that was emailed to the property owner.');
    setError('');
    setLoading(true);
    try {
      const res = await api.verifyDeletePropertyOtp(propertyId, { otp }, token);
      setConfirmToken(res.confirmToken);
      setSummary(res.summary || null);
      setActions(res.actions || []);
      setOtp('');
      setStage('confirm');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to verify the code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalDelete() {
    setError('');
    setLoading(true);
    try {
      const res = await api.confirmDeletePropertyDeletion(propertyId, { confirmToken }, token);
      setResultMessage(res.message || 'The apartment has been deleted.');
      setStage('done');
      if (onDeleted) onDeleted(propertyId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete the apartment.');
    } finally {
      setLoading(false);
    }
  }

  if ((!properties || properties.length === 0) && !canRecover) return null;

  return (
    <div className="danger-zone">
      {properties && properties.length > 0 && (
        <div className="settings-section">
          <h3>Danger Zone</h3>
          <p style={{ color: '#7a1f1f' }}>
            Delete an apartment. It's kept for 7 days in case this is a mistake before it's gone for good.
          </p>
          {error && <p className="settings-error">{error}</p>}

          {stage === 'idle' && (
            <form onSubmit={handleRequestOtp}>
              <div className="form-field">
                <label className="form-field__label" htmlFor="dzProperty">Apartment to delete</label>
                <select id="dzProperty" required value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                  <option value="">Select an apartment…</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="dzPassword">
                  {isManager ? 'Your (manager) password' : 'Your password'}
                </label>
                <PasswordInput id="dzPassword" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                {isManager && (
                  <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                    A confirmation code will be emailed to the property owner - not to you - so they see and approve this before anything is deleted.
                  </p>
                )}
              </div>
              <Button type="submit" variant="secondary" loading={loading} disabled={!propertyId}>
                Continue to delete apartment
              </Button>
            </form>
          )}

          {stage === 'otp' && (
            <form onSubmit={handleVerifyOtp}>
              {notice && <p>{notice}</p>}
              <p>
                Enter the code emailed to the property owner to delete <strong>{selectedProperty?.name}</strong>.
              </p>
              <div className="form-field">
                <label className="form-field__label" htmlFor="dzOtp">6-digit code</label>
                <input id="dzOtp" required autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} />
              </div>
              <Button type="submit" variant="secondary" loading={loading}>Verify code</Button>
              <button type="button" onClick={handleCancel} disabled={loading} style={{ marginLeft: '0.75rem' }}>Cancel</button>
            </form>
          )}

          {stage === 'confirm' && summary && (
            <div>
              <p style={{ fontWeight: 600 }}>
                Final check - "{summary.propertyName}" will be removed from everyday use immediately.
              </p>
              <ul>
                {actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
              {summary.occupiedUnitCount > 0 && (
                <p style={{ color: '#7a1f1f' }}>
                  {summary.occupiedUnitCount} unit(s) here currently have tenants. Deleting hides their records for this apartment too.
                </p>
              )}
              <p style={{ fontSize: '0.85rem', color: '#666' }}>
                It's kept for 7 days in case this is a mistake. Only a RentaPay admin or one of your property managers can restore it in that time - you will not be able to undo this yourself. After 7 days it's gone for good.
              </p>
              <Button type="button" variant="secondary" loading={loading} onClick={handleFinalDelete}>
                Yes, delete this apartment
              </Button>
              <button type="button" onClick={handleCancel} disabled={loading} style={{ marginLeft: '0.75rem' }}>Cancel</button>
            </div>
          )}

          {stage === 'done' && (
            <div>
              <p>{resultMessage}</p>
              <Button type="button" variant="primary" onClick={() => resetToIdle({ keepPropertyPicked: false })}>Done</Button>
            </div>
          )}
        </div>
      )}

      {canRecover && <RecentlyDeletedProperties token={token} />}
    </div>
  );
}

/**
 * Settings > Danger Zone > Recently deleted - lets a property manager
 * (never the landlord - see PropertyDangerZone above) restore an
 * apartment within its 7-day grace period. An admin has the same
 * capability from the admin panel, via the same /properties/deleted
 * and /danger-zone/restore endpoints.
 */
function RecentlyDeletedProperties({ token }) {
  const [items, setItems] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.listDeletedProperties(token)
      .then((res) => { if (!cancelled) setItems(res.properties || []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [token]);

  async function handleRestore(propertyId) {
    setError('');
    setNotice('');
    setRestoringId(propertyId);
    try {
      const res = await api.restoreProperty(propertyId, token);
      setNotice(res.message || 'Restored.');
      setItems((prev) => (prev || []).filter((p) => p.id !== propertyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to restore.');
    } finally {
      setRestoringId(null);
    }
  }

  if (items === null || items.length === 0) return null;

  return (
    <div className="settings-section" style={{ marginTop: '1.5rem' }}>
      <h3>Recently deleted</h3>
      <p style={{ fontSize: '0.85rem', color: '#666' }}>
        Apartments deleted in the last 7 days. Restoring puts one back into normal use immediately.
      </p>
      {error && <p className="settings-error">{error}</p>}
      {notice && <p>{notice}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((p) => {
          const daysLeft = Math.max(0, Math.ceil((new Date(p.delete_grace_expires_at) - new Date()) / (1000 * 60 * 60 * 24)));
          return (
            <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
              <span>
                <strong>{p.name}</strong>{p.location ? ` - ${p.location}` : ''}
                <br />
                <span style={{ fontSize: '0.8rem', color: '#666' }}>{daysLeft} day(s) left to restore</span>
              </span>
              <Button variant="ghost" loading={restoringId === p.id} onClick={() => handleRestore(p.id)}>Restore</Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
