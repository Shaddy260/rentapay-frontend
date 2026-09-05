import React, { useState, useEffect } from 'react';
import Button from './Button.jsx';
import InfoTip from './InfoTip.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
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
export default function BiometricSettingsPanel({ phone, email, role, roleLevel, token, refreshToken, label }) {
  const [entries, setEntries] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingRemoveId, setPendingRemoveId] = useState(null);
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
      await enrollBiometric({ phone, email, role, roleLevel, token, refreshToken, label });
      setEntries(listBiometricEntries());
      setNotice('Fingerprint login is set up on this device.');
    } catch (err) {
      setError(err.message || 'Could not set up fingerprint login on this device.');
    } finally {
      setBusy(false);
    }
  }

  function handleRemove(credentialId) {
    // Settings/Financial Statistics spec, section 2.5: "Add a
    // confirmation step... before removing device trust" - this is a
    // security-relevant action (you'll need to log in with a password
    // again on this device afterward), so it no longer removes on the
    // very first tap.
    setPendingRemoveId(credentialId);
  }

  function confirmRemove() {
    if (!pendingRemoveId) return;
    removeBiometricEntry(pendingRemoveId);
    setEntries(listBiometricEntries());
    setNotice('Removed from this device.');
    setPendingRemoveId(null);
  }

  return (
    <section className="settings-card" id="security">
      <h2>Fingerprint / device login</h2>
      <InfoTip
        label="What does this do?"
        text="Once set up, this device can log you back in with your fingerprint or Face ID instead of retyping your password. This only affects this specific device/browser - it doesn't change your account password anywhere else."
      />

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
                    <div className="settings-manager-row__empty">{e.email || e.phone} · {e.role === 'manager' && e.roleLevel === 'caretaker' ? 'caretaker' : e.role}</div>
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

      <ConfirmDialog
        open={!!pendingRemoveId}
        title="Remove this device?"
        message="You'll need to log in again with your password on this device the next time - fingerprint/Face ID login here will stop working until you set it up again."
        confirmLabel="Yes, remove"
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemoveId(null)}
      />
    </section>
  );
}
