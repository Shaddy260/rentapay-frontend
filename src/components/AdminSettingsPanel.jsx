import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import PasswordInput from './PasswordInput.jsx';
import AdminCredentialsPanel from './AdminCredentialsPanel.jsx';
import { getPlatformContacts, setPlatformContacts } from '../utils/platformSettings.js';
import './AdminSettingsPanel.css';

/**
 * Admin Settings.
 *
 * Groups everything that's "configuration admin might need to change
 * without a code deploy" in one tab:
 *   - Help & Contact Details: the WhatsApp/Call/Email numbers shown in
 *     the Help modal on every portal. These used to be hardcoded in
 *     HelpButton.jsx - now editable here, since numbers change and
 *     WhatsApp Business numbers can get suspended.
 *   - Change Password: the admin's own login password (was previously
 *     tucked away under "First-Time Credentials"; still available
 *     there too, just also surfaced here where a "Settings" tab is the
 *     more natural place to look for it).
 *   - First-Time Credentials: admin-generated one-time login
 *     credentials for newly onboarded landlords/BAs - existing feature,
 *     included here since it's account/credentials-related admin
 *     configuration too.
 */
function HelpContactsSettings({ token }) {
  const [whatsapp, setWhatsapp] = useState('');
  const [call, setCall] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .getAdminSettings(token)
      .then((res) => {
        if (cancelled) return;
        setWhatsapp(res.helpWhatsapp || '');
        setCall(res.helpCall || '');
        setEmail(res.helpEmail || '');
      })
      .catch((err) => {
        if (cancelled) return;
        // Fall back to whatever the store already has (defaults or a
        // previously-loaded public value) so the form isn't blank.
        const current = getPlatformContacts();
        setWhatsapp(current.helpWhatsapp);
        setCall(current.helpCall);
        setEmail(current.helpEmail);
        setError(err instanceof ApiError ? err.message : 'Could not load current settings - showing last known values.');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!whatsapp.trim() || !call.trim() || !email.trim()) {
      setError('All three fields are required.');
      return;
    }
    setBusy(true);
    try {
      const payload = { helpWhatsapp: whatsapp.trim(), helpCall: call.trim(), helpEmail: email.trim() };
      await api.updateHelpContactSettings(payload, token);
      setPlatformContacts(payload);
      setSuccess('Saved. The Help button everywhere now shows these details.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save help contact details.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="admin-settings__hint">Loading current settings…</p>;

  return (
    <form className="admin-settings__panel" onSubmit={handleSubmit}>
      <p className="admin-settings__hint" style={{ marginBottom: 14 }}>
        Shown in the Help button/modal across every portal (landlord, tenant, BA, login screen). Update these if a number changes or a WhatsApp Business number gets suspended - no app update
        needed, changes apply immediately.
      </p>

      {error && <p className="admin-settings__error">{error}</p>}
      {success && <p className="admin-settings__success">{success}</p>}

      <div className="admin-settings__field">
        <label htmlFor="settings-whatsapp">WhatsApp number</label>
        <input id="settings-whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+254710888917" required />
        <p className="admin-settings__hint">Include the country code. Used to build the wa.me chat link.</p>
      </div>

      <div className="admin-settings__field">
        <label htmlFor="settings-call">Call phone number</label>
        <input id="settings-call" value={call} onChange={(e) => setCall(e.target.value)} placeholder="254710888917" required />
        <p className="admin-settings__hint">Can be different from the WhatsApp number - used for the "Call" option only.</p>
      </div>

      <div className="admin-settings__field">
        <label htmlFor="settings-email">Support email</label>
        <input id="settings-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="support@rentapay.co.ke" required />
      </div>

      <Button type="submit" variant="primary" loading={busy}>Save changes</Button>

      <div className="admin-settings__preview">
        <strong>Preview</strong>
        WhatsApp: {whatsapp || '—'} · Call: {call || '—'} · Email: {email || '—'}
      </div>
    </form>
  );
}

function ChangePasswordSettings({ token }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.changeAdminPassword({ currentPassword, newPassword }, token);
      setSuccess('Password changed. Use it next time you log in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change admin password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-settings__panel" onSubmit={handleSubmit}>
      {error && <p className="admin-settings__error">{error}</p>}
      {success && <p className="admin-settings__success">{success}</p>}
      <div className="admin-settings__field">
        <label htmlFor="settings-current-pw">Current password</label>
        <PasswordInput id="settings-current-pw" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
      </div>
      <div className="admin-settings__field">
        <label htmlFor="settings-new-pw">New password</label>
        <PasswordInput id="settings-new-pw" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
      </div>
      <div className="admin-settings__field">
        <label htmlFor="settings-confirm-pw">Confirm new password</label>
        <PasswordInput id="settings-confirm-pw" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      </div>
      <Button type="submit" variant="primary" loading={busy}>Save new password</Button>
    </form>
  );
}

const SUBTABS = [
  { key: 'help-contacts', label: 'Help & Contact Details' },
  { key: 'password', label: 'Change Password' },
  { key: 'credentials', label: 'First-Time Credentials' },
];

export default function AdminSettingsPanel({ token }) {
  const [subTab, setSubTab] = useState('help-contacts');

  return (
    <section className="admin-section">
      <h2>Settings</h2>
      <div className="admin-settings__subnav">
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`admin-settings__subnav-btn${subTab === t.key ? ' admin-settings__subnav-btn--active' : ''}`}
            onClick={() => setSubTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'help-contacts' && <HelpContactsSettings token={token} />}
      {subTab === 'password' && <ChangePasswordSettings token={token} />}
      {subTab === 'credentials' && <AdminCredentialsPanel token={token} />}
    </section>
  );
}
