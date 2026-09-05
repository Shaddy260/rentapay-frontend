import React, { useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from '../components/Button.jsx';
import './TenantOnboarding.css';

const EMPTY_FORM = { fullName: '', phone: '', houseName: '', location: '' };

/**
 * BUILD SPEC PHASE 9 - Marketing Self-Fill Landlord Link.
 *
 * Public, no-login lead-capture form at /partner-with-us, sent out by
 * the marketing team (distinct from Phase 4's BA-claim flow - this
 * lead stays unverified until it's separately matched/converted; see
 * landlordLead.controller.js). Styled with the same public-page shell
 * (tenant-onboarding-page/-card) already used by BaOnboarding.jsx /
 * TenantOnboarding.jsx for this app's other no-login forms.
 */
export default function LandlordLeadForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState('form'); // 'form' | 'done'
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.submitLandlordLead(form);
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
        <h1>Partner with RentaPay</h1>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="tenant-onboarding-form">
            <p className="tenant-onboarding-instruction">
              Own rental units? Leave your details and our team will reach out to help you get set up on RentaPay.
            </p>

            {submitError && <p className="tenant-onboarding-error">{submitError}</p>}

            <label>
              Full name
              <input required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="Jane Wanjiru" />
            </label>
            <label>
              Phone number
              <input required value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="e.g. 0712345678" />
            </label>
            <label>
              House / estate name
              <input value={form.houseName} onChange={(e) => update('houseName', e.target.value)} placeholder="Optional" />
            </label>
            <label>
              Location
              <input value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Kileleshwa, Nairobi" />
            </label>

            <Button type="submit" variant="primary" loading={submitting} disabled={submitting || !form.fullName || !form.phone}>
              Submit
            </Button>
          </form>
        )}

        {step === 'done' && (
          <div className="tenant-onboarding-done">
            <div className="tenant-onboarding-done__icon" aria-hidden="true">✅</div>
            <p>Thanks! We've received your details and our team will reach out shortly.</p>
          </div>
        )}
      </div>
    </div>
  );
}
