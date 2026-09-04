import React, { useEffect, useState, useCallback } from 'react';
import { api, ApiError, getStoredToken } from '../api/client.js';
import Button from './Button.jsx';

// ZERO-TRUST CONTINUOUS RISK ENGINE (backend: riskEngine.service.js /
// evaluateRequestRisk, run on every request via verifyToken).
//
// The session token itself is still valid - this is deliberately NOT
// a logout - but something about the last few minutes of activity
// (a device-fingerprint or IP change mid-session, a burst of
// sensitive-data requests, an unusual hour) crossed the threshold
// where the backend wants a fresh proof of identity before letting
// any more sensitive requests through. api/client.js's request()
// dispatches a 'rentapay:step-up-required' window event the moment
// any API call comes back with stepUpRequired: true; this is mounted
// once, app-wide (see App.jsx), so every screen gets the same modal
// instead of each page needing its own handling.
export default function StepUpChallengeModal() {
  const [visible, setVisible] = useState(false);
  const [channel, setChannel] = useState('email'); // 'email' | 'totp'
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(false);

  const startChallenge = useCallback(async () => {
    setVisible(true);
    setError('');
    setCode('');
    setRequesting(true);
    try {
      const token = getStoredToken();
      const res = await api.requestStepUp(token);
      setChannel(res.channel || 'email');
    } catch (err) {
      // If even requesting the challenge fails, leave the modal up
      // with a generic message - the person can still retry, and
      // every other API call remains blocked until this clears.
      setError(err instanceof ApiError ? err.message : 'Could not start verification. Please try again.');
    } finally {
      setRequesting(false);
    }
  }, []);

  useEffect(() => {
    function handleStepUpRequired() {
      if (visible) return; // already showing - don't re-trigger on every blocked request
      startChallenge();
    }
    window.addEventListener('rentapay:step-up-required', handleStepUpRequired);
    return () => window.removeEventListener('rentapay:step-up-required', handleStepUpRequired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = getStoredToken();
      await api.confirmStepUp({ code }, token);
      setVisible(false);
      setCode('');
      // The request that originally triggered this was already
      // rejected with a 403 rather than queued/retried automatically
      // (mutating requests shouldn't silently auto-replay) - the
      // person just re-does whatever they were doing, and it will now
      // go through normally.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <div style={{ background: 'var(--surface, #fff)', borderRadius: 12, padding: '1.5rem', maxWidth: 380, width: '100%' }}>
        <h2 style={{ marginTop: 0 }}>Verify it&rsquo;s you</h2>
        <p style={{ color: 'var(--text-secondary, #555)' }}>
          {requesting
            ? 'Sending a verification code...'
            : channel === 'totp'
              ? 'For your security, enter the code from your authenticator app to continue.'
              : "For your security, enter the code we just emailed you to continue."}
        </p>

        {error && (
          <div role="alert" style={{ color: '#b3261e', marginBottom: '0.75rem' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            required
            autoFocus
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={requesting}
            style={{ width: '100%', padding: '0.6rem', fontSize: '1.1rem', marginBottom: '0.75rem', boxSizing: 'border-box' }}
          />
          <Button type="submit" variant="primary" loading={loading} disabled={requesting || !code}>
            Verify
          </Button>
          {channel !== 'totp' && (
            <button
              type="button"
              onClick={startChallenge}
              disabled={requesting}
              style={{ display: 'block', marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--primary, #0a5)', cursor: 'pointer' }}
            >
              Resend code
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
