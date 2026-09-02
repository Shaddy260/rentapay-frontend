import React, { useEffect, useState, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import InfoTip from './InfoTip.jsx';
import './AutoRentCollectionWizard.css';

// Automatic Rent Collection (landlord-owned STK push) setup wizard.
// One question/action per screen (spec Section 5), progress persisted
// server-side (see api.saveDarajaWizardStep) so a landlord who leaves
// mid-wizard - realistically waiting days on Safaricom for a Till -
// resumes exactly where they left off. Verification is fully
// automated; there is no RentaPay staff review step anywhere here.
//
// Screens: 'eligibility' -> (a "No" branch's static instructions) ->
// 'credentials' -> 'verifying' -> 'active' | 'failed'.
//
// DIRECT REQUEST: this whole section is password-locked behind the
// landlord's own login password every time it's opened, to prevent
// accidental editing or deleting - the same password used to log in,
// re-confirmed here, not a separate PIN. Nothing about the wizard
// below (loading current status, the credential form, disabling
// collection) runs until that password is confirmed against the
// backend (see confirm-password endpoint). This is enforced only on
// the frontend gate here; the backend routes underneath are already
// landlord-only/no-caretaker (see routes file), so a caretaker or
// manager account can never reach this at all regardless of this
// lock screen.
export default function AutoRentCollectionWizard({ token }) {
  const [unlocked, setUnlocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // backend credentials row (masked)
  const [screen, setScreen] = useState('eligibility');
  const [noBranch, setNoBranch] = useState(null); // which "No" answer, for branch-specific copy
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ shortcode: '', consumerKey: '', consumerSecret: '', passkey: '', environment: 'production' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getDarajaCredentialsStatus(token);
      setStatus(res?.credentials || null);
      const step = res?.credentials?.wizardStep;
      const st = res?.credentials?.status;
      if (st === 'active') setScreen('active');
      else if (st === 'failed') setScreen('failed');
      else if (step === 'verify' || st === 'pending_verification') setScreen('credentials');
      else if (step && step !== 'eligibility') setScreen(step);
      else setScreen('eligibility');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load automatic rent collection status.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (unlocked) load(); }, [unlocked, load]);

  async function handleUnlock(e) {
    e.preventDefault();
    if (!unlockPassword) return;
    setUnlockError('');
    setUnlocking(true);
    try {
      await api.confirmDarajaPassword(unlockPassword, token);
      setUnlocked(true);
      setUnlockPassword('');
    } catch (err) {
      setUnlockError(err instanceof ApiError ? err.message : 'Failed to verify your password. Please try again.');
    } finally {
      setUnlocking(false);
    }
  }

  const goTo = useCallback(async (nextScreen, persistedStep) => {
    setScreen(nextScreen);
    if (persistedStep) {
      try { await api.saveDarajaWizardStep(persistedStep, token); } catch { /* non-fatal - progress just won't resume exactly */ }
    }
  }, [token]);

  async function handleEligibility(answer) {
    if (answer === 'yes') {
      goTo('credentials', 'credentials');
    } else {
      setNoBranch(answer);
      goTo('not_eligible', 'not_eligible');
    }
  }

  async function saveAndVerify(e) {
    e.preventDefault();
    setError('');
    if (!form.shortcode || !form.consumerKey || !form.consumerSecret || !form.passkey) {
      setError('Please fill in all four fields.');
      return;
    }
    setSaving(true);
    try {
      await api.saveDarajaCredentials(form, token);
      setScreen('verifying');
      const verifyRes = await api.verifyDarajaCredentials(token);
      const cred = verifyRes?.credentials;
      setStatus(cred);
      setScreen(cred?.status === 'active' ? 'active' : 'failed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setScreen('credentials');
    } finally {
      setSaving(false);
    }
  }

  async function retryVerification() {
    setSaving(true);
    setError('');
    try {
      setScreen('verifying');
      const verifyRes = await api.verifyDarajaCredentials(token);
      const cred = verifyRes?.credentials;
      setStatus(cred);
      setScreen(cred?.status === 'active' ? 'active' : 'failed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setScreen('failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    if (!window.confirm('Turn off automatic rent collection? Tenants will immediately see the manual payment flow again. Your payment history is not affected.')) return;
    setSaving(true);
    try {
      const res = await api.disableDarajaCredentials(token);
      setStatus(res?.credentials || null);
      setScreen('eligibility');
      setForm({ shortcode: '', consumerKey: '', consumerSecret: '', passkey: '', environment: 'production' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to disable automatic rent collection.');
    } finally {
      setSaving(false);
    }
  }

  if (!unlocked) {
    return (
      <section className="settings-card arc-wizard">
        <h2>
          Automatic rent collection
          <InfoTip text="This section holds your own Daraja/banking credentials, so it stays locked behind your login password every time you open it - even within the same session - to prevent accidental edits or deletion." />
        </h2>
        <form className="arc-wizard__step arc-wizard__lock" onSubmit={handleUnlock}>
          <p className="arc-wizard__question">Enter your password to view or manage automatic rent collection</p>
          {unlockError && <p className="modal-error">{unlockError}</p>}
          <div className="form-field">
            <label className="form-field__label">Password</label>
            <input
              type="password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              autoComplete="current-password"
              required
              autoFocus
            />
          </div>
          <div className="arc-wizard__actions">
            <Button type="submit" variant="primary" loading={unlocking}>Unlock</Button>
          </div>
        </form>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="settings-card arc-wizard">
        <h2>Automatic rent collection</h2>
        <p className="arc-wizard__muted">Loading…</p>
      </section>
    );
  }

  return (
    <section className="settings-card arc-wizard">
      <h2>
        Automatic rent collection
        <InfoTip text="RentaPay never holds, touches, or custodies your rent money at any point - even with this on. We only trigger the M-Pesa prompt using your own Daraja credentials, straight to your own Till/Paybill. This is fully optional and reversible at any time." />
      </h2>

      {error && <p className="modal-error">{error}</p>}

      {screen === 'active' && status && (
        <div className="arc-wizard__status arc-wizard__status--active">
          <p className="arc-wizard__status-line">
            <span className="arc-wizard__dot arc-wizard__dot--active" /> Active - Paybill/Till <strong>{status.shortcodeMasked}</strong>
          </p>
          <p className="arc-wizard__muted">
            Tenants tapping "Pay Rent" get a real M-Pesa prompt straight to their phone. Balances update automatically the moment M-Pesa confirms - no manual review step.
          </p>
          <Button variant="ghost" onClick={handleDisable} loading={saving}>Turn off (switch back to manual)</Button>
        </div>
      )}

      {screen === 'failed' && status && (
        <div className="arc-wizard__status arc-wizard__status--failed">
          <p className="arc-wizard__status-line">
            <span className="arc-wizard__dot arc-wizard__dot--failed" /> Verification failed
          </p>
          <p className="arc-wizard__muted">{status.lastFailureReason || 'We could not verify your credentials.'}</p>
          <div className="arc-wizard__actions">
            <Button variant="primary" className="arc-wizard__glow-cta" onClick={() => setScreen('credentials')} disabled={saving}>Fix credentials</Button>
            <Button variant="ghost" onClick={retryVerification} loading={saving}>Retry verification</Button>
          </div>
        </div>
      )}

      {screen === 'eligibility' && (
        <EligibilityStep onAnswer={handleEligibility} />
      )}

      {screen === 'not_eligible' && (
        <NotEligibleStep branch={noBranch} onBack={() => goTo('eligibility', 'eligibility')} onHaveTill={() => goTo('credentials', 'credentials')} />
      )}

      {screen === 'credentials' && (
        <CredentialsStep
          form={form}
          setForm={setForm}
          onBack={() => goTo('eligibility', 'eligibility')}
          onSubmit={saveAndVerify}
          saving={saving}
        />
      )}

      {screen === 'verifying' && (
        <div className="arc-wizard__verifying">
          <span className="arc-wizard__spinner" aria-hidden="true" />
          <p>Sending a small verification prompt to your own phone…</p>
        </div>
      )}
    </section>
  );
}

function EligibilityStep({ onAnswer }) {
  return (
    <div className="arc-wizard__step">
      <p className="arc-wizard__question">
        Is this a Safaricom-issued Paybill or Buy Goods Till Number - and when you registered it, did Safaricom register it as a <strong>Business account</strong> (not Pochi la Biashara / a personal number)?
      </p>
      <div className="arc-wizard__answers">
        <button type="button" className="arc-wizard__answer" onClick={() => onAnswer('yes')}>
          Yes - it's my own registered Business Paybill/Till
        </button>
        <button type="button" className="arc-wizard__answer" onClick={() => onAnswer('pochi')}>
          No - I use Pochi la Biashara
        </button>
        <button type="button" className="arc-wizard__answer" onClick={() => onAnswer('bank')}>
          No - I use a bank paybill (KCB, Equity, Co-op, etc.)
        </button>
        <button type="button" className="arc-wizard__answer" onClick={() => onAnswer('personal')}>
          No - tenants just send money to my personal number
        </button>
        <button type="button" className="arc-wizard__answer" onClick={() => onAnswer('unsure')}>
          Not sure
        </button>
      </div>
    </div>
  );
}

// Section 1a of the addendum: whenever the wizard tells a landlord
// what to go and apply for, it says "Paybill," never "Till" - a
// Paybill takes an account number (the same pattern RentaPay's own
// Paybill already uses via unit_payment_code), which is what lets
// hundreds of tenants be told apart cleanly through one number. A
// Till has no such field. There's no downside to a Paybill even for
// a landlord with a single unit today.
const APPLY_STEPS = (
  <>
    <ol className="arc-wizard__steps">
      <li>Go to m-pesaforbusiness.co.ke and click "Apply Now."</li>
      <li>Choose <strong>Paybill</strong> (not Till, not Pochi).</li>
      <li>Pick your ownership type - sole proprietor, partnership, or registered company. This decides exactly which documents you'll need.</li>
      <li>Fill in the application: business name, KRA PIN, physical address, the bank account you want funds settled into, and an admin phone number.</li>
      <li>Upload documents: scanned ID, KRA PIN certificate, business permit/registration certificate, and proof of the bank account (a cancelled cheque or bank confirmation letter).</li>
      <li>Sign digitally and submit - you'll get an application reference immediately.</li>
      <li>Safaricom verifies and assigns your Paybill - typically 24-72 hours for a complete application. You'll be notified by SMS and email.</li>
    </ol>
    <p className="arc-wizard__muted arc-wizard__sequencing-note">
      Note: getting the Paybill itself (above, ~1-3 days) happens <em>before</em> applying for Daraja API access, which is a separate step that can take another 2-10 days. Worth knowing up front so the full timeline doesn't come as a surprise partway through.
    </p>
  </>
);

function NotEligibleStep({ branch, onBack, onHaveTill }) {
  let heading = '';
  let body = null;

  if (branch === 'pochi') {
    heading = 'Pochi la Biashara can\u2019t be used for this';
    body = <p>Pochi la Biashara shares your personal M-Pesa number and can't get its own API access. You'll need a real Business Paybill instead - this only takes your ID and KRA PIN.</p>;
  } else if (branch === 'bank') {
    heading = 'That paybill belongs to the bank, not you';
    body = <p>Safaricom can't issue API access for a bank's own paybill. You'll need your own dedicated Paybill - your existing bank account can still be where the money settles.</p>;
  } else if (branch === 'personal') {
    heading = 'You\u2019ll need a registered business Paybill first';
    body = <p>You'll need a registered business and your own Business Paybill before this can work. Register a business (via eCitizen, usually same-day or next-day) if you don't have one yet, then apply for the Paybill below.</p>;
  } else {
    heading = 'Let\u2019s check what you have';
    body = (
      <p>
        Open your M-Pesa menu or the M-Pesa for Business app - if it shows a Paybill or Till screen with a business name (even your own name) and no mention of "Pochi," it's a real Business account. Still not sure? Contact our support team and we'll help you check.
      </p>
    );
  }

  return (
    <div className="arc-wizard__step">
      <h3 className="arc-wizard__branch-heading">{heading}</h3>
      {body}
      {(branch === 'pochi' || branch === 'bank' || branch === 'personal') && (
        <>
          {APPLY_STEPS}
          <p className="arc-wizard__why-paybill">
            Why a Paybill, not a Till?
            <InfoTip text="A Till is a flat payment with no account-number field, so there's no built-in way to tell which tenant or unit a payment belongs to. A Paybill has every capability a Till has, plus the account number field - which is exactly how RentaPay's own Paybill already separates hundreds of tenants through one number. There's no downside to a Paybill even if you only have one unit today." />
          </p>
        </>
      )}
      <p className="arc-wizard__muted">Come back to this page once you have your Business Paybill - you'll pick up right where you left off.</p>
      <div className="arc-wizard__actions">
        <Button variant="primary" className="arc-wizard__glow-cta" onClick={onHaveTill}>I've got my Business Paybill now</Button>
        <button type="button" className="ghost-link" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

function CredentialsStep({ form, setForm, onBack, onSubmit, saving }) {
  return (
    <form className="arc-wizard__step" onSubmit={onSubmit}>
      <p className="arc-wizard__question">Enter your Till/Paybill and Daraja app details</p>
      <p className="arc-wizard__fee-note">No extra fees from us or anyone else for this - it's your own Till, direct to your own bank.</p>

      <div className="form-field">
        <label className="form-field__label">
          Paybill / Till number (shortcode)
          <InfoTip text="This is your Business Paybill's shortcode - the same number M-Pesa shows on your Paybill screen. (If you're using a Till instead, that shortcode works too, but we always recommend a Paybill - see the note in the previous step.)" />
        </label>
        <input value={form.shortcode} onChange={(e) => setForm((f) => ({ ...f, shortcode: e.target.value }))} placeholder="e.g. 987654" required />
      </div>
      <div className="form-field">
        <label className="form-field__label">
          Consumer Key
          <InfoTip text="Found on your app inside the Daraja portal (developer.safaricom.co.ke), under 'Keys'." />
        </label>
        <input value={form.consumerKey} onChange={(e) => setForm((f) => ({ ...f, consumerKey: e.target.value }))} required />
      </div>
      <div className="form-field">
        <label className="form-field__label">Consumer Secret</label>
        <input type="password" value={form.consumerSecret} onChange={(e) => setForm((f) => ({ ...f, consumerSecret: e.target.value }))} required />
      </div>
      <div className="form-field">
        <label className="form-field__label">
          Passkey
          <InfoTip text="Your Lipa na M-Pesa Online passkey, issued by Safaricom once your Till is go-live ready." />
        </label>
        <input type="password" value={form.passkey} onChange={(e) => setForm((f) => ({ ...f, passkey: e.target.value }))} required />
      </div>
      <div className="form-field">
        <label className="form-field__label">Environment</label>
        <select value={form.environment} onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}>
          <option value="production">Production (real money - use this for a live Till)</option>
          <option value="sandbox">Sandbox (testing only)</option>
        </select>
      </div>

      <div className="arc-wizard__actions">
        <Button type="submit" variant="primary" className="arc-wizard__glow-cta" loading={saving}>Save and verify</Button>
        <button type="button" className="ghost-link" onClick={onBack} disabled={saving}>Back</button>
      </div>
    </form>
  );
}
