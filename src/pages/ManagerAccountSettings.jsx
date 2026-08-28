import React, { useState } from 'react';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Button from '../components/Button.jsx';
import InfoTip from '../components/InfoTip.jsx';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload.jsx';
import { api, ApiError } from '../api/client.js';
import './Settings.css';
import '../components/FormField.css';
import './Login.css';

const MANAGER_PATH = import.meta.env.VITE_MANAGER_PATH || '/manager-account';

/**
 * RentaPay — General Manager Sectioned Build Spec, Section 4.
 *
 * "Settings page design: structured and styled the same way other
 * account settings pages are organized on the platform (same grouping
 * style, field styling, layout conventions) - this is where PIN
 * management lives, presented consistently with how other sensitive
 * settings (like passwords) are already handled elsewhere in the
 * product." Reuses Settings.css's card classes (settings-card,
 * settings-cluster-title) rather than forking new styles, same as
 * every other role's settings page.
 *
 * Deliberately scoped to ONLY what Section 4 needs (PIN management +
 * the login-password change link). The rest of a General Manager's
 * settings page - profile, etc - is out of scope until later sections
 * bring more of the account surface into being.
 */
function onlyDigits(value) {
  return value.replace(/\D/g, '').slice(0, 4);
}

export default function ManagerAccountSettings() {
  const navigate = useNavigate();
  const token = localStorage.getItem('rentapay_token');
  const role = localStorage.getItem('rentapay_role');
  const fullName = localStorage.getItem('rentapay_gm_full_name') || '';
  const [photoUrl, setPhotoUrl] = useState(localStorage.getItem('rentapay_gm_photo_url') || null);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState('');
  const [changeMessage, setChangeMessage] = useState('');

  // Forgot-PIN sub-flow: request a code, then submit it + a new PIN.
  const [forgotStage, setForgotStage] = useState(null); // null | 'otp'
  const [resetOtp, setResetOtp] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [resetConfirmPin, setResetConfirmPin] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  if (!token || role !== 'general_manager') {
    navigate(MANAGER_PATH);
    return null;
  }

  async function handleChangePin(e) {
    e.preventDefault();
    setChangeError('');
    setChangeMessage('');

    if (newPin.length !== 4) {
      setChangeError('New PIN must be exactly 4 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setChangeError('New PIN and confirmation do not match.');
      return;
    }

    setChangeLoading(true);
    try {
      await api.changeOperationsPin({ currentPin, newPin, confirmNewPin }, token);
      setChangeMessage('Operations PIN changed.');
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
    } catch (err) {
      setChangeError(err instanceof ApiError ? err.message : 'Failed to change Operations PIN.');
    } finally {
      setChangeLoading(false);
    }
  }

  async function handleRequestReset() {
    setForgotError('');
    setForgotMessage('');
    setForgotLoading(true);
    try {
      await api.requestOperationsPinReset(token);
      setForgotStage('otp');
    } catch (err) {
      setForgotError(err instanceof ApiError ? err.message : 'Failed to send a reset code.');
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResendReset() {
    setForgotError('');
    setForgotLoading(true);
    try {
      await api.requestOperationsPinReset(token);
      setForgotMessage('A new reset code has been sent.');
    } catch (err) {
      setForgotError(err instanceof ApiError ? err.message : 'Failed to resend the code.');
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResetSubmit(e) {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');

    if (resetPin.length !== 4) {
      setForgotError('New PIN must be exactly 4 digits.');
      return;
    }
    if (resetPin !== resetConfirmPin) {
      setForgotError('New PIN and confirmation do not match.');
      return;
    }

    setForgotLoading(true);
    try {
      await api.resetOperationsPin({ otp: resetOtp, newPin: resetPin, confirmNewPin: resetConfirmPin }, token);
      setForgotStage(null);
      setResetOtp('');
      setResetPin('');
      setResetConfirmPin('');
      setChangeMessage('Operations PIN reset.');
    } catch (err) {
      setForgotError(err instanceof ApiError ? err.message : 'Failed to reset Operations PIN.');
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <h2 className="settings-cluster-title">Profile</h2>
      <section className="settings-card">
        <h2>
          Profile picture
          <InfoTip text="Shown next to your name across the manager portal - same photo format as every other RentaPay account." />
        </h2>
        <ProfilePhotoUpload
          name={fullName}
          photoUrl={photoUrl}
          token={token}
          onChange={(url) => {
            setPhotoUrl(url);
            if (url) localStorage.setItem('rentapay_gm_photo_url', url);
            else localStorage.removeItem('rentapay_gm_photo_url');
          }}
        />
      </section>

      <h2 className="settings-cluster-title">Account &amp; security</h2>

      <section className="settings-card">
        <h2>
          Password
          <InfoTip text="Change the password you use to log in." />
        </h2>
        <Button variant="ghost" onClick={() => navigate('/change-password')}>Change password</Button>
      </section>

      <section className="settings-card">
        <h2>
          Operations PIN
          <InfoTip text="A separate 4-digit PIN used to confirm edits - not your login password. Every PIN-confirmed action also requires a reason and is logged automatically for admin." />
        </h2>

        {changeMessage && (
          <div className="login-page__error login-page__error--success" role="status">
            <p>{changeMessage}</p>
          </div>
        )}
        {changeError && (
          <div className="login-page__error" role="alert">
            <strong>Error</strong>
            <p>{changeError}</p>
          </div>
        )}

        {forgotStage === null && (
          <form onSubmit={handleChangePin}>
            <div className="form-field">
              <label className="form-field__label" htmlFor="currentPinField">Current PIN</label>
              <input id="currentPinField" required inputMode="numeric" maxLength={4} value={currentPin} onChange={(e) => setCurrentPin(onlyDigits(e.target.value))} />
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="newPinField">New PIN</label>
              <input id="newPinField" required inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(onlyDigits(e.target.value))} />
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="confirmNewPinField">Confirm new PIN</label>
              <input id="confirmNewPinField" required inputMode="numeric" maxLength={4} value={confirmNewPin} onChange={(e) => setConfirmNewPin(onlyDigits(e.target.value))} />
            </div>
            <Button type="submit" variant="primary" loading={changeLoading}>Change PIN</Button>
            <button
              type="button"
              className="login-page__resend-link"
              onClick={handleRequestReset}
              disabled={forgotLoading}
            >
              Forgot your PIN?
            </button>
          </form>
        )}

        {forgotStage === 'otp' && (
          <form onSubmit={handleResetSubmit}>
            <p className="login-page__intro">
              Enter the code sent to your registered email, then your new PIN. This does not change your login password.
            </p>

            {forgotError && (
              <div className="login-page__error" role="alert">
                <strong>Error</strong>
                <p>{forgotError}</p>
              </div>
            )}
            {forgotMessage && !forgotError && (
              <div className="login-page__error login-page__error--success" role="status">
                <p>{forgotMessage}</p>
              </div>
            )}

            <div className="form-field">
              <label className="form-field__label" htmlFor="pinResetOtp">Reset code</label>
              <input id="pinResetOtp" required autoFocus inputMode="numeric" maxLength={6} value={resetOtp} onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="resetNewPin">New PIN</label>
              <input id="resetNewPin" required inputMode="numeric" maxLength={4} value={resetPin} onChange={(e) => setResetPin(onlyDigits(e.target.value))} />
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="resetConfirmPin">Confirm new PIN</label>
              <input id="resetConfirmPin" required inputMode="numeric" maxLength={4} value={resetConfirmPin} onChange={(e) => setResetConfirmPin(onlyDigits(e.target.value))} />
            </div>
            <Button type="submit" variant="primary" loading={forgotLoading}>Reset PIN</Button>
            <button type="button" className="login-page__resend-link" onClick={handleResendReset} disabled={forgotLoading}>
              {forgotLoading ? 'Resending…' : "Didn't see the code? Resend"}
            </button>
            <button
              type="button"
              className="login-page__resend-link"
              onClick={() => { setForgotStage(null); setForgotError(''); setForgotMessage(''); }}
            >
              Back
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
