import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import './TenantOnboarding.css';

const TODAY = new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  unitId: '',
  fullName: '',
  primaryPhone: '',
  secondaryPhone: '',
  email: '',
  idNumber: '',
  moveInDate: TODAY,
  emergencyContactName: '',
  emergencyContactPhone: '',
  depositAmountPaid: '',
};

/**
 * Public, no-login tenant self-onboarding form (blueprint section 2).
 * Reached via a shared link (/onboard/:token) a landlord/manager/
 * caretaker copied and sent to a tenant, e.g. over WhatsApp.
 *
 * Flow: pick your unit -> fill in your details -> review -> submit.
 * The submission is a pending request; nothing lands in the system as
 * a real tenant until a landlord/manager/caretaker confirms it.
 */
export default function TenantOnboarding() {
  const { token: linkToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [units, setUnits] = useState([]);
  const [unitSearch, setUnitSearch] = useState('');
  const [step, setStep] = useState('select-unit'); // select-unit | form | review | done
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [doneMessage, setDoneMessage] = useState('');

  // DIRECT REQUEST: "there should be a way a tenant verifies the
  // entered email... under the email once he enters it there should
  // appear a box to verify the email... once verified is when he can
  // submit that form... if not verified, throw an error for them to
  // verify the email first". emailOtpStatus: 'idle' | 'sending' |
  // 'sent' | 'verifying' | 'verified' - resets back to 'idle' any
  // time the email is edited after a code was sent/verified, since a
  // verification only ever proves ownership of the EXACT address it
  // was sent to.
  const [emailOtpStatus, setEmailOtpStatus] = useState('idle');
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpError, setEmailOtpError] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');

  // SECTION 9 - duplicate phone/email detection. Checked on the
  // tenant's side, before submission, so a likely duplicate is caught
  // early instead of landing on whoever reviews the request
  // afterward. The warning is deliberately generic - it never says
  // which of the two fields matched, and never hints at anything
  // about the existing account.
  const DUPLICATE_WARNING = 'This email or phone number may already be registered. Please check your details before submitting.';
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const duplicateCheckTimer = useRef(null);

  function scheduleDuplicateCheck(nextPhone, nextEmail) {
    if (duplicateCheckTimer.current) clearTimeout(duplicateCheckTimer.current);
    duplicateCheckTimer.current = setTimeout(() => {
      const phone = (nextPhone ?? form.primaryPhone ?? '').trim();
      const email = (nextEmail ?? form.email ?? '').trim();
      if (!phone && !email) {
        setDuplicateWarning(false);
        return;
      }
      api
        .checkOnboardingDuplicate(linkToken, { phone: phone || undefined, email: email || undefined })
        .then((res) => setDuplicateWarning(!!res?.possibleDuplicate))
        .catch(() => {
          // Non-blocking - a failed check just means no warning shown;
          // it never stops the tenant from continuing.
        });
    }, 400);
  }

  useEffect(() => {
    api
      .getPublicOnboardingForm(linkToken)
      .then((res) => {
        setPropertyName(res.propertyName);
        setUnits(res.units || []);
      })
      .catch((err) => setLoadError(err.message || 'This onboarding link could not be loaded.'))
      .finally(() => setLoading(false));
  }, [linkToken]);

  const visibleUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    if (!q) return units;
    return units.filter((u) => u.unit_name?.toLowerCase().includes(q) || u.unit_type?.toLowerCase().includes(q));
  }, [units, unitSearch]);

  const selectedUnit = units.find((u) => u.id === form.unitId);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'primaryPhone' || field === 'email') {
      // Value changed since the last check ran - stop showing a
      // warning based on stale input until it's re-checked on blur.
      setDuplicateWarning(false);
    }
    if (field === 'email') {
      // Editing the email after it was sent/verified invalidates that
      // verification - it only ever proved ownership of the exact
      // address it was sent to, not whatever's typed in now.
      if (emailOtpStatus !== 'idle') {
        setEmailOtpStatus('idle');
        setEmailOtpCode('');
        setEmailOtpError('');
        setVerifiedEmail('');
      }
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
      await api.sendOnboardingEmailOtp(linkToken, form.email);
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
      await api.verifyOnboardingEmailOtp(linkToken, form.email, emailOtpCode.trim());
      setEmailOtpStatus('verified');
      setVerifiedEmail(form.email);
    } catch (err) {
      setEmailOtpError(err instanceof ApiError ? err.message : 'Failed to verify code.');
      setEmailOtpStatus('sent');
    }
  }

  const emailIsVerified = emailOtpStatus === 'verified' && verifiedEmail === form.email;

  function chooseUnit(unit) {
    update('unitId', unit.id);
    setStep('form');
  }

  function handleContinueToReview(e) {
    e.preventDefault();
    if (!emailIsVerified) {
      setSubmitError('Please verify your email address first.');
      return;
    }
    setSubmitError('');
    setStep('review');
  }

  async function handleFinalSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.submitPublicOnboarding(linkToken, {
        unitId: form.unitId,
        fullName: form.fullName,
        primaryPhone: form.primaryPhone,
        secondaryPhone: form.secondaryPhone || undefined,
        email: form.email,
        idNumber: form.idNumber,
        moveInDate: form.moveInDate,
        emergencyContactName: form.emergencyContactName,
        emergencyContactPhone: form.emergencyContactPhone,
        // DIRECT REQUEST: optional - left empty when the tenant hasn't
        // paid a deposit (or hasn't yet). The server fills in 0 itself
        // when this unit requires a deposit and nothing was entered -
        // never guessed or defaulted here on the client.
        depositAmountPaid: form.depositAmountPaid !== '' ? form.depositAmountPaid : undefined,
      });
      setDoneMessage(res.message || "Submitted. You'll be contacted once it's confirmed.");
      setStep('done');
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to submit. Please try again.');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="tenant-onboarding-page">
        <Skeleton height={220} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="tenant-onboarding-page">
        <div className="tenant-onboarding-card">
          <h1>Onboarding link unavailable</h1>
          <p>{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tenant-onboarding-page">
      <div className="tenant-onboarding-card">
        <h1>{propertyName}</h1>

        {step === 'select-unit' && (
          <>
            <p className="tenant-onboarding-instruction">
              Tap your unit below. Double-check before continuing.
            </p>
            {units.length > 4 && (
              <input
                type="search"
                className="tenant-onboarding-search"
                placeholder="Search by unit name or number…"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
              />
            )}
            {visibleUnits.length === 0 ? (
              <p className="tenant-onboarding-empty">No vacant units match your search right now.</p>
            ) : (
              <div className="tenant-onboarding-unit-grid">
                {visibleUnits.map((u) => (
                  <button type="button" key={u.id} className="tenant-onboarding-unit-btn" onClick={() => chooseUnit(u)}>
                    <strong>{u.unit_name}</strong>
                    {u.unit_type && <span>{u.unit_type}</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'form' && (
          <form onSubmit={handleContinueToReview} className="tenant-onboarding-form">
            <button type="button" className="tenant-onboarding-back" onClick={() => setStep('select-unit')}>
              ← Change unit ({selectedUnit?.unit_name})
            </button>

            {submitError && <p className="tenant-onboarding-error">{submitError}</p>}

            <label>
              Full name
              <input required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
            </label>
            <label>
              Phone number
              <input
                required
                value={form.primaryPhone}
                onChange={(e) => update('primaryPhone', e.target.value)}
                onBlur={(e) => scheduleDuplicateCheck(e.target.value, undefined)}
                placeholder="e.g. 0712345678"
              />
            </label>
            <label>
              Secondary phone (optional)
              <input value={form.secondaryPhone} onChange={(e) => update('secondaryPhone', e.target.value)} />
            </label>
            <label>
              Email address
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                onBlur={(e) => scheduleDuplicateCheck(undefined, e.target.value)}
              />
              <span className="tenant-onboarding-field-hint">Enter an active email address — this will be used to reach you.</span>
            </label>

            {duplicateWarning && <p className="tenant-onboarding-warning">{DUPLICATE_WARNING}</p>}

            {/* DIRECT REQUEST: verification box right under the email
                field - send a code, enter it, only then is the email
                considered verified. Submission is blocked (both here
                and server-side in submitOnboardingRequest) until it is. */}
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
            <label>
              ID number
              <input required value={form.idNumber} onChange={(e) => update('idNumber', e.target.value)} />
            </label>
            <label>
              Move-in date
              <input required type="date" value={form.moveInDate} onChange={(e) => update('moveInDate', e.target.value)} />
            </label>
            <label>
              Emergency contact name
              <input required value={form.emergencyContactName} onChange={(e) => update('emergencyContactName', e.target.value)} />
            </label>
            <label>
              Emergency contact phone
              <input required value={form.emergencyContactPhone} onChange={(e) => update('emergencyContactPhone', e.target.value)} />
            </label>

            {/* DIRECT REQUEST: "add the deposit aspect - ask them to
                fill in the deposit amount they paid, if none then they
                leave it empty". Always shown (every tenant might have
                paid something, even on a unit not flagged as
                deposit-required) - the hint below just adapts to
                whether this specific unit's landlord requires one. */}
            <label>
              Deposit amount paid (KES) — optional
              <input
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="Leave empty if you haven't paid a deposit"
                value={form.depositAmountPaid}
                onChange={(e) => update('depositAmountPaid', e.target.value)}
              />
              <span className="tenant-onboarding-field-hint">
                {selectedUnit?.requiresDeposit
                  ? `This unit requires a deposit${selectedUnit.depositAmountExpected != null ? ` of KES ${Number(selectedUnit.depositAmountExpected).toLocaleString()}` : ''}. Enter what you've actually paid so far — leave empty if you haven't paid anything yet.`
                  : "Only fill this in if you've already paid a deposit to the landlord/manager/caretaker directly."}
              </span>
            </label>

            {!emailIsVerified && <p className="tenant-onboarding-field-hint">Verify your email above before continuing.</p>}
            <Button type="submit" variant="primary" disabled={!emailIsVerified}>Review my details</Button>
          </form>
        )}

        {step === 'review' && (
          <div className="tenant-onboarding-review">
            <h2>Review your details</h2>
            <p className="tenant-onboarding-instruction">Make sure everything is correct before submitting.</p>
            <dl className="tenant-onboarding-review-list">
              <dt>Unit</dt><dd>{selectedUnit?.unit_name}</dd>
              <dt>Full name</dt><dd>{form.fullName}</dd>
              <dt>Phone</dt><dd>{form.primaryPhone}</dd>
              {form.secondaryPhone && (<><dt>Secondary phone</dt><dd>{form.secondaryPhone}</dd></>)}
              <dt>Email</dt><dd>{form.email}</dd>
              <dt>ID number</dt><dd>{form.idNumber}</dd>
              <dt>Move-in date</dt><dd>{form.moveInDate}</dd>
              <dt>Emergency contact</dt><dd>{form.emergencyContactName} — {form.emergencyContactPhone}</dd>
              <dt>Deposit amount paid</dt>
              <dd>{form.depositAmountPaid !== '' ? `KES ${Number(form.depositAmountPaid).toLocaleString()}` : 'None entered'}</dd>
            </dl>
            {duplicateWarning && <p className="tenant-onboarding-warning">{DUPLICATE_WARNING}</p>}
            {submitError && <p className="tenant-onboarding-error">{submitError}</p>}
            <div className="tenant-onboarding-review-actions">
              <Button variant="ghost" onClick={() => setStep('form')} disabled={submitting}>Edit</Button>
              <Button variant="primary" loading={submitting} onClick={handleFinalSubmit}>Confirm & Submit</Button>
            </div>
          </div>
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
