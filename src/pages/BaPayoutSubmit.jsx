import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Button from '../components/Button.jsx';
import '../pages/TenantOnboarding.css';
import InfoTip from '../components/InfoTip.jsx';

const EMPTY_FORM = { name: '', mpesaNumber: '' };

/**
 * BUILD SPEC PHASE 10 (v2) - Universal BA Payout Links + Email/OTP Gate.
 *
 * Two distinct routes render this same page:
 *   /ba-payout-submit          - the ONE static, non-expiring, truly
 *      universal submission link. Every BA gets the exact same URL.
 *      Identity is established here, not by anything in the URL: the
 *      BA types their registered email, gets a one-time code, and only
 *      once that's confirmed does the form (and the one-time submit)
 *      unlock - scoped strictly to that BA's own record.
 *   /ba-payout-edit?token=...  - the ONE universal, admin-issued, 24h
 *      correction link. Same email + OTP identity check, gated
 *      additionally on the link itself still being live (not expired,
 *      not superseded by a newer regenerated link).
 *
 * Steps: email -> otp -> form -> done. No resubmission UI anywhere -
 * once a submission succeeds the channel is permanently closed server
 * side, and edits only ever happen through the separate 24h link.
 */
export default function BaPayoutSubmit() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isEditMode = location.pathname.startsWith('/ba-payout-edit');
  const editLinkToken = isEditMode ? searchParams.get('token') || '' : '';

  const [step, setStep] = useState(isEditMode ? 'checkingLink' : 'email'); // checkingLink|email|otp|form|done|expired|duplicate
  const [expiredMessage, setExpiredMessage] = useState('');

  const [email, setEmail] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [otpMessage, setOtpMessage] = useState('');

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verificationToken, setVerificationToken] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [doneMessage, setDoneMessage] = useState('');
  const [submittedSummary, setSubmittedSummary] = useState(null);

  // Edit mode only: confirm the ?token= edit link is still live before
  // letting the BA even get to the email step.
  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;
    api
      .validateBaPayoutEditLink(editLinkToken)
      .then(() => { if (!cancelled) setStep('email'); })
      .catch((err) => {
        if (cancelled) return;
        setExpiredMessage(err instanceof ApiError ? err.message : 'This correction link is no longer valid. Please contact RentaPay.');
        setStep('expired');
      });
    return () => { cancelled = true; };
  }, [isEditMode, editLinkToken]);

  async function handleRequestOtp(e) {
    e.preventDefault();
    setRequesting(true);
    setRequestError('');
    try {
      const res = isEditMode
        ? await api.requestBaPayoutEditOtp(editLinkToken, email.trim())
        : await api.requestBaPayoutSubmitOtp(email.trim());
      setOtpMessage(res.message || 'If eligible, a code has been sent to that email.');
      setStep('otp');
    } catch (err) {
      if (err instanceof ApiError && err.raw?.linkExpired) {
        setExpiredMessage(err.message);
        setStep('expired');
        return;
      }
      setRequestError(err instanceof ApiError ? err.message : 'Failed to send a verification code. Please try again.');
    } finally {
      setRequesting(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setVerifying(true);
    setVerifyError('');
    try {
      const res = isEditMode
        ? await api.verifyBaPayoutEditOtp(email.trim(), code.trim())
        : await api.verifyBaPayoutSubmitOtp(email.trim(), code.trim());
      setVerificationToken(res.verificationToken);

      if (isEditMode) {
        // Prefill with whatever's currently on file, so the BA only
        // has to change what's wrong.
        try {
          const lookup = await api.getMyBaPayoutSubmission(res.verificationToken, 'edit');
          if (lookup.found) {
            setForm({
              name: lookup.submission.submittedName || '',
              mpesaNumber: lookup.submission.mpesaNumber || '',
            });
          }
        } catch {
          // Non-fatal - the BA can still type fresh details.
        }
      }
      setStep('form');
    } catch (err) {
      if (err instanceof ApiError && err.raw?.linkExpired) {
        setExpiredMessage(err.message);
        setStep('expired');
        return;
      }
      setVerifyError(err instanceof ApiError ? err.message : 'Failed to verify the code. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const canSubmit = form.name.trim() && form.mpesaNumber.trim() && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = isEditMode
        ? await api.editBaPayoutDetails({
            verificationToken,
            name: form.name.trim(),
            mpesaNumber: form.mpesaNumber.trim(),
          })
        : await api.submitBaPayoutDetails({
            verificationToken,
            name: form.name.trim(),
            mpesaNumber: form.mpesaNumber.trim(),
          });
      setDoneMessage(res.message || 'Your payment details have been saved. Thank you!');
      setSubmittedSummary(res.submission || null);
      setStep('done');
    } catch (err) {
      if (err instanceof ApiError && err.raw?.linkExpired) {
        setExpiredMessage(err.message);
        setStep(err.raw?.duplicateSubmission ? 'duplicate' : 'expired');
        return;
      }
      if (err instanceof ApiError && err.raw?.duplicateSubmission) {
        setExpiredMessage(err.message);
        setStep('duplicate');
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
        <h1>RentaPay Brand Ambassador Payout — {isEditMode ? 'Correct Your Details' : 'Payment Details'}</h1>

        {step === 'checkingLink' && <p className="tenant-onboarding-instruction">Checking this link…</p>}

        {step === 'expired' && (
          <div className="tenant-onboarding-done">
            <div className="tenant-onboarding-done__icon" aria-hidden="true">⏰</div>
            <p>{expiredMessage}</p>
            <InfoTip text={<>
              {isEditMode
                ? 'Correction links are valid for 24 hours from when RentaPay generates them. Ask admin for a fresh one.'
                : 'Ask RentaPay for a new link.'}
            </>} />
          </div>
        )}

        {step === 'duplicate' && (
          <div className="tenant-onboarding-done">
            <div className="tenant-onboarding-done__icon" aria-hidden="true">🔒</div>
            <p>{expiredMessage}</p>
            <InfoTip text={<>
              Each Brand Ambassador can only submit payment details once. If something needs to change, ask
              RentaPay admin for the correction link — it's the only way to update details already on file.
            </>} />
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleRequestOtp} className="tenant-onboarding-form">
<<<<<<< HEAD
            <div className="u-flex-row" style={{ alignItems: 'center', gap: '6px' }}>
              <span>Verify your account</span>
              <InfoTip text={<>
                {isEditMode
                  ? "Enter the email on your RentaPay Brand Ambassador account. We'll send a one-time code to confirm it's you before letting you correct your on-file payout details."
                  : "Enter the email on your RentaPay Brand Ambassador account. We'll send a one-time code to confirm it's you before letting you submit your payout details."}
              </>} />
            </div>
=======
            <p className="tenant-onboarding-instruction">
              {isEditMode
                ? "Enter the email on your RentaPay Brand Ambassador account. We'll send a one-time code to confirm it's you before letting you correct your on-file payout details."
                : "Enter the email on your RentaPay Brand Ambassador account. We'll send a one-time code to confirm it's you before letting you submit your payout details."}
            </p>
>>>>>>> origin/main
            {requestError && <p className="tenant-onboarding-error">{requestError}</p>}
            <label>
              Account email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="The email on your RentaPay BA account"
              />
            </label>
            <Button type="submit" variant="primary" loading={requesting} disabled={!email.trim() || requesting}>
              Send verification code
            </Button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="tenant-onboarding-form">
            <p className="tenant-onboarding-instruction">{otpMessage}</p>
            {verifyError && <p className="tenant-onboarding-error">{verifyError}</p>}
            <label>
              Verification code
              <input
                required
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
              />
              <span className="tenant-onboarding-field-hint">Check your email — the code expires in 10 minutes.</span>
            </label>
            <Button type="submit" variant="primary" loading={verifying} disabled={!code.trim() || verifying}>
              Verify code
            </Button>
            <button
              type="button"
              className="tenant-onboarding-link-btn"
              onClick={(e) => handleRequestOtp(e)}
              disabled={requesting}
            >
              Didn't get a code? Resend
            </button>
          </form>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="tenant-onboarding-form">
            <label>
              Verified account email
              <input type="email" value={email} disabled readOnly className="tenant-onboarding-locked-field" />
              <span className="tenant-onboarding-field-hint">
                Confirmed for this session — everything you submit below only ever affects this account. To edit a
                different account, exit and start verification again with that account's email.
              </span>
            </label>

            <InfoTip text={<>
              {isEditMode
                ? "Update the M-Pesa number or name we should pay your commission to. This correction link stays live until it expires, but each verification code can only be used once."
                : "Enter the M-Pesa number and name we should pay your commission to. Double-check these — errors here mean you won't get paid. You can only submit this once, so please make sure everything is correct before you continue."}
<<<<<<< HEAD
            </>} />
=======
            </p>
>>>>>>> origin/main

            {submitError && <p className="tenant-onboarding-error">{submitError}</p>}

            <label>
              M-Pesa number
              <input
                required
                value={form.mpesaNumber}
                onChange={(e) => update('mpesaNumber', e.target.value)}
                placeholder="e.g. 0712345678"
              />
              <span className="tenant-onboarding-field-hint">The number to be paid — double-check it's correct.</span>
            </label>
            <label>
              Name on M-Pesa
              <input
                required
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Name registered on that M-Pesa number"
              />
            </label>

            <Button type="submit" variant="primary" loading={submitting} disabled={!canSubmit}>
              {isEditMode ? 'Save corrected details' : 'Submit payment details'}
            </Button>
          </form>
        )}

        {step === 'done' && (
          <div className="tenant-onboarding-done">
            <div className="tenant-onboarding-done__icon" aria-hidden="true">✅</div>
            <p>{doneMessage}</p>
            {submittedSummary && (
              <p className="tenant-onboarding-field-hint">
                {submittedSummary.mpesaNumber} — {submittedSummary.submittedName} ({submittedSummary.submittedEmail})
              </p>
            )}
            {!isEditMode && (
              <InfoTip text={<>
                This link has now been used and can't be submitted again. If anything needs correcting later,
                ask RentaPay admin for the correction link.
              </>} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
