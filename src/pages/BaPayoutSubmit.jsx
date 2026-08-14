import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Button from '../components/Button.jsx';
import '../pages/TenantOnboarding.css';
import InfoTip from '../components/InfoTip.jsx';

const EMPTY_FORM = { name: '', email: '', mpesaNumber: '' };

/**
 * BA Monthly Payment Details & Payout Workflow - Phase 2.
 *
 * The public, token-carrying link admin shares each month
 * (/ba-payout-submit?token=...). Unlike /become-a-ba this token does
 * NOT rotate every 24h - per the build plan it stays valid for the
 * whole calendar month it belongs to, and simply stops matching once
 * the month rolls over and a new cycle's token takes its place (see
 * Phase 1's validateSubmissionToken). No email OTP step here - this
 * form matches the BA by their existing account email, it isn't
 * creating a new identity the way /become-a-ba is.
 */
export default function BaPayoutSubmit() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [step, setStep] = useState('checking'); // checking | expired | form | done
  const [expiredMessage, setExpiredMessage] = useState('');
  const [periodKey, setPeriodKey] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [doneMessage, setDoneMessage] = useState('');
  const [submittedSummary, setSubmittedSummary] = useState(null);

  // "see/edit their submission again later in the same month" -
  // lookup-by-email state, kept separate from the main form's
  // submitting/error state so the two flows don't stomp each other.
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupStatus, setLookupStatus] = useState('idle'); // idle | loading | found | not-found | error
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .validateBaPayoutLink(token)
      .then((res) => {
        if (cancelled) return;
        setPeriodKey(res.periodKey || '');
        setStep('form');
      })
      .catch((err) => {
        if (cancelled) return;
        setExpiredMessage(
          err instanceof ApiError
            ? err.message
            : 'This payment details link is no longer active. Please ask RentaPay for the current link.'
        );
        setStep('expired');
      });
    return () => { cancelled = true; };
  }, [token]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const canSubmit = form.name.trim() && form.email.trim() && form.mpesaNumber.trim() && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.submitBaPayoutDetails({
        token,
        name: form.name.trim(),
        email: form.email.trim(),
        mpesaNumber: form.mpesaNumber.trim(),
      });
      setDoneMessage(res.message || 'Your payment details have been received. Thank you!');
      setSubmittedSummary(res.submission || null);
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

  // Lets a BA who already submitted this month re-open the
  // confirmation view and see (and then edit + resubmit) what's on
  // file, without having to remember whether they already did this.
  async function handleLookup(e) {
    e.preventDefault();
    setLookupError('');
    if (!lookupEmail.trim()) {
      setLookupError('Enter the email address you submitted with.');
      return;
    }
    setLookupStatus('loading');
    try {
      const res = await api.getMyBaPayoutSubmission(token, lookupEmail.trim());
      if (res.found) {
        setForm({
          name: res.submission.submittedName,
          email: res.submission.submittedEmail,
          mpesaNumber: res.submission.mpesaNumber,
        });
        setLookupStatus('found');
      } else {
        setLookupStatus('not-found');
      }
    } catch (err) {
      if (err instanceof ApiError && err.raw?.linkExpired) {
        setExpiredMessage(err.message);
        setStep('expired');
        return;
      }
      setLookupStatus('error');
      setLookupError(err instanceof ApiError ? err.message : 'Failed to look up your submission.');
    }
  }

  return (
    <div className="tenant-onboarding-page">
      <div className="tenant-onboarding-card">
        <h1>RentaPay Brand Ambassador Payout — Payment Details{periodKey ? ` (${periodKey})` : ''}</h1>

        {step === 'checking' && <p className="tenant-onboarding-instruction">Checking your link…</p>}

        {step === 'expired' && (
          <div className="tenant-onboarding-done">
            <div className="tenant-onboarding-done__icon" aria-hidden="true">⏰</div>
            <p>{expiredMessage}</p>
            <InfoTip text={<>
              This link is only valid for the calendar month it was shared for. Ask RentaPay for the current
              month's link.
            </>} />
          </div>
        )}

        {step === 'form' && (
          <>
            <form onSubmit={handleSubmit} className="tenant-onboarding-form">
              <p className="tenant-onboarding-instruction">
                Enter the M-Pesa number, name, and account email we should pay this month's commission to.
                Double-check these — errors here mean you won't get paid.
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

              <Button type="submit" variant="primary" loading={submitting} disabled={!canSubmit}>
                Submit payment details
              </Button>
            </form>

            <div className="tenant-onboarding-email-verify" style={{ marginTop: '1.5rem' }}>
              <p className="tenant-onboarding-instruction">Already submitted this month and want to check or edit it?</p>
              <form onSubmit={handleLookup} className="tenant-onboarding-email-verify__code-row">
                <input
                  type="email"
                  placeholder="Your account email"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                />
                <button type="submit" className="tenant-onboarding-email-verify__btn" disabled={lookupStatus === 'loading'}>
                  {lookupStatus === 'loading' ? 'Looking up…' : 'Look up my submission'}
                </button>
              </form>
              {lookupStatus === 'found' && (
                <p className="tenant-onboarding-email-verify__done">✓ Found it — loaded into the form above. Edit and resubmit if anything's wrong.</p>
              )}
              {lookupStatus === 'not-found' && <p className="tenant-onboarding-field-hint">No submission found yet for that email this month.</p>}
              {lookupError && <p className="tenant-onboarding-error">{lookupError}</p>}
            </div>
          </>
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
            <InfoTip text={<>
              Submitted the wrong details? Come back to this same link any time this month to resubmit — your
              latest submission replaces the earlier one.
            </>} />
          </div>
        )}
      </div>
    </div>
  );
}
