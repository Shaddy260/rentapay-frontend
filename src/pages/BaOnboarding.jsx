import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Button from '../components/Button.jsx';
import '../pages/TenantOnboarding.css';

const EMPTY_FORM = { fullName: '', phone: '', email: '', termsAccepted: false };

/**
 * BUILD SPEC PHASE 2 - the ONE generic, always-live public link admin
 * shares with anyone they want to become a Brand Ambassador
 * (/become-a-ba - no token in the URL, unlike tenant onboarding).
 * The applicant fills in their own name/phone/email, must confirm
 * email ownership with a one-time code before Submit is even
 * reachable, and the submission then sits in a pending-approval
 * queue - nothing here is auto-activated.
 */
export default function BaOnboarding() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState('form'); // form | done
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [doneMessage, setDoneMessage] = useState('');

  // Same 'idle' | 'sending' | 'sent' | 'verifying' | 'verified' shape
  // as TenantOnboarding.jsx's email verification - resets to 'idle'
  // any time the email is edited after a code was sent/verified,
  // since a verification only ever proves ownership of the exact
  // address it was sent to.
  const [emailOtpStatus, setEmailOtpStatus] = useState('idle');
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
      await api.requestBaEmailOtp(form.email);
      setEmailOtpStatus('sent');
    } catch (err) {
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
      const res = await api.confirmBaEmailOtp(form.email, emailOtpCode.trim());
      setEmailOtpStatus('verified');
      setVerifiedEmail(form.email);
      setEmailVerificationToken(res.emailVerification);
    } catch (err) {
      setEmailOtpError(err instanceof ApiError ? err.message : 'Failed to verify code.');
      setEmailOtpStatus('sent');
    }
  }

  const emailIsVerified = emailOtpStatus === 'verified' && verifiedEmail === form.email && !!emailVerificationToken;
  const canSubmit = emailIsVerified && form.termsAccepted && form.fullName && form.phone && form.email && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!emailIsVerified) {
      setSubmitError('Please verify your email address first.');
      return;
    }
    if (!form.termsAccepted) {
      setSubmitError('Please agree to the Brand Ambassador Terms of Engagement.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.submitBaOnboarding({
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        emailVerification: emailVerificationToken,
        termsAccepted: true,
      });
      setDoneMessage(res.message || 'Your application has been received and is pending review.');
      setStep('done');
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tenant-onboarding-page">
      <div className="tenant-onboarding-card">
        <h1>Become a RentaPay Brand Ambassador</h1>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="tenant-onboarding-form">
            <p className="tenant-onboarding-instruction">
              Fill in your details below. You'll need to verify your email before you can submit, and your
              application will be reviewed by our team before you're approved.
            </p>

            {submitError && <p className="tenant-onboarding-error">{submitError}</p>}

            <label>
              Full name
              <input required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
            </label>
            <label>
              Phone number
              <input
                required
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="e.g. 0712345678"
              />
            </label>
            <label>
              Email address
              <input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
              <span className="tenant-onboarding-field-hint">Enter an active email address — this will be used to reach you.</span>
            </label>

            <div className="tenant-onboarding-email-verify">
              {emailIsVerified ? (
                <p className="tenant-onboarding-email-verify__done">✓ Email verified</p>
              ) : (
                <>
                  {(emailOtpStatus === 'idle' || emailOtpStatus === 'sending') && (
                    <button
                      type="button"
                      className="tenant-onboarding-email-verify__btn"
                      onClick={handleSendEmailOtp}
                      disabled={emailOtpStatus === 'sending' || !form.email}
                    >
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
                      <button
                        type="button"
                        className="tenant-onboarding-email-verify__btn"
                        onClick={handleVerifyEmailOtp}
                        disabled={emailOtpStatus === 'verifying'}
                      >
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

            <label className="tenant-onboarding-checkbox">
              <input
                type="checkbox"
                checked={form.termsAccepted}
                onChange={(e) => update('termsAccepted', e.target.checked)}
              />
              <span>
                I agree to RentaPay's{' '}
                <Link to="/ba-terms" target="_blank" rel="noopener noreferrer">
                  Brand Ambassador Terms of Engagement
                </Link>
              </span>
            </label>

            {!emailIsVerified && <p className="tenant-onboarding-field-hint">Verify your email above before you can submit.</p>}
            <Button type="submit" variant="primary" loading={submitting} disabled={!canSubmit}>
              Submit application
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
