import React, { useState } from 'react';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Button from '../components/Button.jsx';
import { api, ApiError } from '../api/client.js';
import '../components/FormField.css';
import './Login.css';

const MANAGER_PATH = import.meta.env.VITE_MANAGER_PATH || '/manager-account';

/**
 * RentaPay - General Manager Sectioned Build Spec, Section 4.
 *
 * "At account onboarding (first login / initial setup), the General
 * Manager sets their Operations PIN." Reached right after the forced
 * password change (see ChangePassword.jsx's destinationForRole) or
 * directly after login if the password was already changed but no
 * PIN exists yet - there is deliberately no way to skip this screen
 * and reach the dashboard without a PIN set (see the loop-back to
 * this same page below, and Section 6's server-side enforcement that
 * every PIN-confirmed action requires operations_pin_hash to be
 * non-null).
 */
export default function ManagerAccountPinSetup() {
  const navigate = useNavigate();
  const token = localStorage.getItem('rentapay_token');
  const role = localStorage.getItem('rentapay_role');

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!token || role !== 'general_manager') {
    navigate(MANAGER_PATH);
    return null;
  }

  function onlyDigits(value) {
    return value.replace(/\D/g, '').slice(0, 4);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (pin.length !== 4) {
      setError('PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PIN and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.setOperationsPin({ pin, confirmPin }, token);
      localStorage.setItem('rentapay_gm_pin_set', '1');
      setDone(true);
      setTimeout(() => navigate('/manager-account/dashboard'), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to set Operations PIN.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="login-page">
        <div className="login-page__panel">
          <div className="login-page__brand">RentaPay Manager</div>
          <h1>Operations PIN set</h1>
          <p className="login-page__intro">Taking you to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__brand">RentaPay Manager</div>
        <h1>Set your Operations PIN</h1>
        <p className="login-page__intro">
          This 4-digit PIN is separate from your login password. You'll be asked for it whenever you confirm
          an edit, along with a short reason - every action is logged for admin. Choose something you won't forget.
        </p>

        {error && (
          <div className="login-page__error" role="alert">
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-field__label" htmlFor="gmNewPin">Operations PIN</label>
            <input
              id="gmNewPin"
              required
              autoFocus
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(onlyDigits(e.target.value))}
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="gmConfirmPin">Confirm PIN</label>
            <input
              id="gmConfirmPin"
              required
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(onlyDigits(e.target.value))}
            />
          </div>
          <Button type="submit" variant="primary" loading={loading}>Set PIN</Button>
        </form>
      </div>
    </div>
  );
}
