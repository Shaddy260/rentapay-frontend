import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Button from '../components/Button.jsx';
import '../pages/TenantOnboarding.css';
import InfoTip from '../components/InfoTip.jsx';

const EMPTY_FORM = { fullName: '', phone: '', email: '', nationalId: '', gender: '' };

/**
 * Prompt 7 — self-service General Manager onboarding, replacing the
 * old "admin types in the details" flow. Mirrors BaOnboarding.jsx's
 * shape exactly: admin generates+sends this link privately
 * (/onboard-general-manager?token=...), the invitee fills in their
 * own details and verifies their own email before submitting.
 * Unlike BA there's no pending-approval queue - admin already chose
 * this exact person by generating and sending them the link, so
 * submission creates the account right away and emails login details.
 */
export default function GmOnboarding() {
  const [searchParams] = useSearchParams();
  const onboardingToken = searchParams.get('token') || '';

  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState('checking'); // checking | expired | form | done
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [doneMessage, setDoneMessage] = useState('');
  const [expiredMessage, setExpiredMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .validateGmOnboardingLink(onboardingToken)
      .then(() => { if (!cancelled) setStep('form'); })
      .catch((err) => {
        if (cancelled) return;
        setExpiredMessage(
          err instanceof ApiError ? err.message : 'This onboarding link has expired. Please request a new one from RentaPay.'
        );
        setStep('expired');
      });
    return () => { cancelled = true; };
  }, [onboardingToken]);

  const [emailOtpStatus, setEmailOtpStatus] = useState('idle'); // idle | sending | sent | verifying | verified
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpError, setEmailOtpError] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [emailVerificationToken, setEmailVerificationToken] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'email' && emailOtpStatus !== 'idle') {
      setEmailOtpStatus('idle');
      setEmailOtpCode('');
      setEmailOtpError('');
      setVerifiedEmail('');
      setEmailVerificationToken('');
    }
  }

  async function handleSendEmailOtp() {
    setEmailOtpError('');
    if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) {
      setEmailOtpError('Enter a valid email address first.');
      return;
    }
    setEmailOtpStatus('sending');
    try {
      await api.requestGmEmailOtp(form.email, onboardingToken);
      setEmailOtpStatus('sent');
    } catch (err) {
      if (err instanceof ApiError && err.raw?.linkExpired) {
        setExpiredMessage(err.message);
        setStep('expired');
        return;
      }
      setEmailOtpError(err instanceof ApiError ? err.message : 'Failed to send verification code.');
      setEmailOtpStatus('idle');
    }
  }

  async function handleVerifyEmailOtp() {
    setEmailOtpError('');
    if (!emailOtpCode.trim()) {
      setEmailOtpError('Enter the code sent to your email.');
      return;
    }
    setEmailOtpStatus('verifying');
    try {
      const res = await api.confirmGmEmailOtp(form.email, emailOtpCode.trim());
      setEmailOtpStatus('verified');
      setVerifiedEmail(form.email);
      setEmailVerificationToken(res.emailVerification);
    } catch (err) {
      setEmailOtpError(err instanceof ApiError ? err.message : 'Failed to verify code.');
      setEmailOtpStatus('sent');
    }
  }

  const emailIsVerified = emailOtpStatus === 'verified' && verifiedEmail === form.email && !!emailVerificationToken;
  const canSubmit =
    emailIsVerified && form.fullName && form.phone && form.email && form.nationalId && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!emailIsVerified) {
      setSubmitError('Please verify your email address first.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.submitGmOnboarding({
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        nationalId: form.nationalId,
        gender: form.gender || undefined,
        emailVerification: emailVerificationToken,
        onboardingToken,
      });
      setDoneMessage(res.message || 'Your account has been created. Check your email for your login details.');
      setStep('done');
    } catch (err) {
      if (err instanceof ApiError && err.raw?.linkExpired) {
        setExpiredMessage(err.message);
        setStep('expired');
        return;
      }
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tenant-onboarding-page">
      <div className="tenant-onboarding-card">
        <h1>RentaPay General Manager Onboarding</h1>

        {step === 'checking' && <p className="tenant-onboarding-instruction">Checking your link…</p>}

        {step === 'expired' && (
          <div className="tenant-onboarding-done">
            <div className="tenant-onboarding-done__icon" aria-hidden="true">⏰</div>
            <p>{expiredMessage}</p>
            <InfoTip text={<>Ask the RentaPay admin who invited you for a fresh link — the current one only stays valid for 24 hours.</>} />
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="tenant-onboarding-form">
            <p className="tenant-onboarding-instruction">
              Fill in your details below to set up your General Manager account. You'll need to verify your email
              before you can submit.
            </p>

            {submitError && <p className="tenant-onboarding-error">{submitError}</p>}

            <label>
              Full name
              <input required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
            </label>
            <label>
              Phone number
              <input required value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="e.g. 0712345678" />
            </label>
            <label>
              Email address
              <input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
              <span className="tenant-onboarding-field-hint">Enter an active email address — your login details will be sent here.</span>
            </label>
            <label>
              National ID number
              <input required value={form.nationalId} onChange={(e) => update('nationalId', e.target.value)} placeholder="e.g. 12345678" />
            </label>
            <label>
              Gender
              <select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>

            <div className="tenant-onboarding-email-verify">
              {emailIsVerified ? (
                <p className="tenant-onboarding-email-verify__done">✓ Email verified</p>
              ) : (
                <>
                  {(emailOtpStatus === 'idle' || emailOtpStatus === 'sending') && (
                    <button type="button" className="tenant-onboarding-email-verify__btn" onClick={handleSendEmailOtp} disabled={emailOtpStatus === 'sending' || !form.email}>
                      {emailOtpStatus === 'sending' ? 'Sending code…' : 'Verify email'}
                    </button>
                  )}
                  {(emailOtpStatus === 'sent' || emailOtpStatus === 'verifying') && (
                    <div className="tenant-onboarding-email-verify__code-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6-digit code"
                        value={emailOtpCode}
                        onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ''))}
                      />
                      <button type="button" className="tenant-onboarding-email-verify__btn" onClick={handleVerifyEmailOtp} disabled={emailOtpStatus === 'verifying'}>
                        {emailOtpStatus === 'verifying' ? 'Verifying…' : 'Confirm code'}
                      </button>
                      <button type="button" className="tenant-onboarding-email-verify__resend" onClick={handleSendEmailOtp} disabled={emailOtpStatus === 'verifying'}>
                        Resend code
                      </button>
                    </div>
                  )}
                  {emailOtpError && <p className="tenant-onboarding-error">{emailOtpError}</p>}
                </>
              )}
            </div>

            {!emailIsVerified && <p className="tenant-onboarding-field-hint">Verify your email above before you can submit.</p>}
            <Button type="submit" variant="primary" loading={submitting} disabled={!canSubmit}>
              Create my account
            </Button>
          </form>
        )}

        {step === 'done' && (
          <div className="tenant-onboarding-done">
            <div className="tenant-onboarding-done__icon" aria-hidden="true">✅</div>
            <p>{doneMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
