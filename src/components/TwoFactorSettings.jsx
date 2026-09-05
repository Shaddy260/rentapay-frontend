import React, { useEffect, useState } from 'react';
import Button from './Button.jsx';
import PasswordInput from './PasswordInput.jsx';
import { api, ApiError } from '../api/client.js';

/**
 * Self-service 2FA (authenticator app / TOTP) toggle - for the roles
 * where it's OPTIONAL (landlord, tenant, manager, brand_ambassador).
 * Admin and general_manager have it mandatory instead, handled
 * entirely on their own login screens (AdminPortalAccess.jsx /
 * ManagerAccountAccess.jsx) - this component is never used for them.
 *
 * Drop this into any settings page for those roles, e.g.:
 *   <TwoFactorSettings token={localStorage.getItem('rentapay_token')} />
 */
export default function TwoFactorSettings({ token }) {
  const [status, setStatus] = useState(null); // { available, enabled }
  const [stage, setStage] = useState('idle'); // 'idle' | 'setup' | 'recoveryCodes' | 'disable'
  const [setupInfo, setSetupInfo] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [password, setPassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get2faStatus(token).then(setStatus).catch(() => setStatus({ available: false, enabled: false }));
  }, [token]);

  async function handleStartEnable() {
    setError('');
    setLoading(true);
    try {
      const res = await api.start2faEnable(token);
      setSetupInfo(res);
      setStage('setup');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start setup.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmEnable(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.confirm2faEnable({ code }, token);
      setRecoveryCodes(res.recoveryCodes);
      setStage('recoveryCodes');
      setStatus({ available: true, enabled: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.disable2fa({ password, code: disableCode }, token);
      setStatus({ available: true, enabled: false });
      setStage('idle');
      setPassword('');
      setDisableCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to disable 2FA.');
    } finally {
      setLoading(false);
    }
  }

  if (!status || !status.available) return null;

  return (
    <div className="settings-section">
      <h3>Two-factor authentication</h3>
      {error && <p className="settings-error">{error}</p>}

      {stage === 'idle' && status.enabled && (
        <>
          <p>Two-factor authentication is currently <strong>on</strong> for your account.</p>
          <Button variant="secondary" onClick={() => setStage('disable')}>Turn off</Button>
        </>
      )}

      {stage === 'idle' && !status.enabled && (
        <>
          <p>Add an extra layer of security using an authenticator app (Google Authenticator, Authy, 1Password, etc). Optional, but recommended.</p>
          <Button variant="primary" loading={loading} onClick={handleStartEnable}>Turn on 2FA</Button>
        </>
      )}

      {stage === 'setup' && setupInfo && (
        <form onSubmit={handleConfirmEnable}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <img
              alt="Scan in your authenticator app"
              width={200}
              height={200}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupInfo.otpauthUrl)}`}
            />
            <p style={{ fontSize: '0.85rem', wordBreak: 'break-all', textAlign: 'center' }}>
              Can't scan? Enter this key manually: <code>{setupInfo.secret}</code>
            </p>
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="tfaConfirmCode">6-digit code</label>
            <input id="tfaConfirmCode" required autoFocus inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <Button type="submit" variant="primary" loading={loading}>Confirm and turn on</Button>
          <button type="button" onClick={() => setStage('idle')} style={{ marginLeft: '0.75rem' }}>Cancel</button>
        </form>
      )}

      {stage === 'recoveryCodes' && (
        <div>
          <p>Save these recovery codes somewhere safe - each works once, and they won't be shown again.</p>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {(recoveryCodes || []).map((rc) => (
              <li key={rc} style={{ background: 'var(--color-surface-subtle)', border: '1px solid var(--color-hairline)', borderRadius: 6, padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                <code>{rc}</code>
              </li>
            ))}
          </ul>
          <Button variant="primary" onClick={() => setStage('idle')}>Done</Button>
        </div>
      )}

      {stage === 'disable' && (
        <form onSubmit={handleDisable}>
          <p>Confirm your password and a current authenticator code (or a recovery code) to turn 2FA off.</p>
          <div className="form-field">
            <label className="form-field__label" htmlFor="tfaDisablePassword">Password</label>
            <PasswordInput id="tfaDisablePassword" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="tfaDisableCode">Authenticator or recovery code</label>
            <input id="tfaDisableCode" required autoFocus value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />
          </div>
          <Button type="submit" variant="secondary" loading={loading}>Turn off 2FA</Button>
          <button type="button" onClick={() => setStage('idle')} style={{ marginLeft: '0.75rem' }}>Cancel</button>
        </form>
      )}
    </div>
  );
}
