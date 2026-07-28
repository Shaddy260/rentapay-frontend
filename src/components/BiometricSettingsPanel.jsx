import React, { useState, useEffect } from 'react';
import Button from './Button.jsx';
import {
  isBiometricSupported,
  listBiometricEntries,
  removeBiometricEntry,
  enrollBiometric,
} from '../utils/biometricAuth.js';
import { isStandalone } from '../utils/useInstallPrompt.js';

/**
 * "Set and use fingerprints to log in" (menu → Security). Lets the
 * person register this specific device's fingerprint/Face ID reader
 * against their current session, and see/remove any devices they've
 * already registered. Shared by every role - landlord, manager,
 * caretaker, and tenant - since the menu item lives in AccountMenu,
 * which every portal uses.
 */
export default function BiometricSettingsPanel({ phone, role, roleLevel, token, label }) {
  const [entries, setEntries] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const supported = isBiometricSupported();
  // DIRECT REQUEST: fingerprint login is only ever usable at the
  // login screen when RentaPay is running as the installed app (see
  // Login.jsx) - enrolling from a plain browser tab would create a
  // credential that could never actually be used to sign in, which is
  // worse than just not offering it. See useInstallPrompt.js.
  const installed = isStandalone();

  useEffect(() => {
    setEntries(listBiometricEntries());
  }, []);

  async function handleEnroll() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await enrollBiometric({ phone, role, roleLevel, token, label });
      setEntries(listBiometricEntries());
      setNotice('Fingerprint login is set up on this device.');
    } catch (err) {
      setError(err.message || 'Could not set up fingerprint login on this device.');
    } finally {
      setBusy(false);
    }
  }

  function handleRemove(credentialId) {
    removeBiometricEntry(credentialId);
    setEntries(listBiometricEntries());
    setNotice('Removed from this device.');
  }

  return (
    <section className="settings-card" id="security">
      <h2>Fingerprint / device login</h2>
      <p className="settings-card__caption">
        Once set up, this device can log you back in with your fingerprint or Face ID instead of retyping your password.
        This only affects this specific device/browser - it doesn't change your account password anywhere else.
      </p>

      {!supported && (
        <p className="settings-banner settings-banner--error">This browser or device doesn't support fingerprint/device login.</p>
      )}

      {supported && !installed && (
        <p className="settings-banner">
          Fingerprint login is only available in the installed RentaPay app, not in a regular browser tab.
          Install the app first, then come back here to set it up.
        </p>
      )}

      {supported && installed && (
        <>
          {entries.length === 0 ? (
            <Button variant="secondary" onClick={handleEnroll} loading={busy} disabled={busy}>
              Set up fingerprint login on this device
            </Button>
          ) : (
            <ul className="settings-manager-list">
              {entries.map((e) => (
                <li key={e.credentialId} className="settings-manager-row">
                  <div className="settings-manager-row__name">
                    <strong>This device</strong>
                    <div className="settings-manager-row__empty">{e.phone} · {e.role === 'manager' && e.roleLevel === 'caretaker' ? 'caretaker' : e.role}</div>
                  </div>
                  <div className="settings-manager-row__actions">
                    <button type="button" className="ghost-link" onClick={() => handleRemove(e.credentialId)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error && <div className="settings-banner settings-banner--error">{error}</div>}
          {notice && <div className="settings-banner settings-banner--ok">{notice}</div>}
        </>
      )}
    </section>
  );
}
