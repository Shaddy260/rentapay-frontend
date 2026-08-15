import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Button from '../components/Button.jsx';
import '../pages/TenantOnboarding.css';
import InfoTip from '../components/InfoTip.jsx';

const EMPTY_FORM = { name: '', email: '', mpesaNumber: '' };

/**
 * BUILD SPEC PHASE 10 - Fix: BA Payout Submission Overwrite Bug.
 *
 * Two distinct entry points into this same page:
 *   /ba-payout-submit?token=...   - the ONE-TIME submission link,
 *      issued once at BA account approval. Non-expiring but
 *      single-use: the moment it's used successfully, it's dead. If
 *      it's used a second time (old tab, bookmark, browser back), the
 *      server rejects it with a clear duplicate error - there is NO
 *      resubmission UI here at all.
 *   /ba-payout-submit?edit=...    - a separate, admin-issued 24h edit
 *      link, the ONLY way to change details after the one-time
 *      submission. Skips the M-Pesa/name lookup-and-prefill dance -
 *      the edit link already identifies the BA.
 */
export default function BaPayoutSubmit() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const editToken = searchParams.get('edit') || '';
  const isEditMode = !!editToken && !token;

  const [step, setStep] = useState('checking'); // checking | expired | duplicate | form | done
  const [expiredMessage, setExpiredMessage] = useState('');
  const [baName, setBaName] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [doneMessage, setDoneMessage] = useState('');
  const [submittedSummary, setSubmittedSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .validateBaPayoutLink(isEditMode ? null : token, isEditMode ? editToken : null)
      .then((res) => {
        if (cancelled) return;
        setBaName(res.baName || '');
        setStep('form');
        // Pre-fill the edit form with whatever's currently on file, so
        // the BA only has to change what's wrong.
        if (isEditMode) {
          api
            .getMyBaPayoutSubmission({ editToken })
            .then((lookup) => {
              if (cancelled || !lookup.found) return;
              setForm({
                name: lookup.submission.submittedName || '',
                email: lookup.submission.submittedEmail || '',
                mpesaNumber: lookup.submission.mpesaNumber || '',
              });
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const isDuplicate = err instanceof ApiError && err.raw?.duplicateSubmission;
        setExpiredMessage(
          err instanceof ApiError
            ? err.message
            : 'This link is no longer valid. Please contact RentaPay.'
        );
        setStep(isDuplicate ? 'duplicate' : 'expired');
      });
    return () => { cancelled = true; };
  }, [token, editToken, isEditMode]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const canSubmit = form.name.trim() && form.mpesaNumber.trim() && (isEditMode || form.email.trim()) && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = isEditMode
        ? await api.editBaPayoutDetails({
            editToken,
            name: form.name.trim(),
            email: form.email.trim() || undefined,
            mpesaNumber: form.mpesaNumber.trim(),
          })
        : await api.submitBaPayoutDetails({
            token,
            name: form.name.trim(),
            email: form.email.trim(),
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
        <h1>RentaPay Brand Ambassador Payout — Payment Details{baName ? ` for ${baName}` : ''}</h1>

        {step === 'checking' && <p className="tenant-onboarding-instruction">Checking your link…</p>}

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
              RentaPay admin for a correction (edit) link — it's the only way to update details already on file.
            </>} />
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="tenant-onboarding-form">
            <p className="tenant-onboarding-instruction">
              {isEditMode
                ? "Update the M-Pesa number, name, or account email we should pay your commission to. This correction link can only be used once."
                : "Enter the M-Pesa number, name, and account email we should pay your commission to. Double-check these — errors here mean you won't get paid. You can only submit this once, so please make sure everything is correct before you continue."}
            </p>

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
            {!isEditMode && (
              <label>
                Account email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="The email on your RentaPay BA account"
                />
                <span className="tenant-onboarding-field-hint">
                  We match this to your existing Brand Ambassador account — it must match exactly.
                </span>
              </label>
            )}

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
                ask RentaPay admin for a correction link.
              </>} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
