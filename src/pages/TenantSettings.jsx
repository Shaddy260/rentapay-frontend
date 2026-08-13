import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/Button.jsx';
import BiometricSettingsPanel from '../components/BiometricSettingsPanel.jsx';

import InfoTip from '../components/InfoTip.jsx';
import { api, ApiError } from '../api/client.js';
import './Settings.css';

/**
 * FEATURE (spec section 3): a dedicated Tenant Settings page, mirroring
 * the section-cluster pattern already used on the landlord-side
 * Settings page (Settings.jsx) - grouped clusters with headers,
 * scoped to what's actually relevant for a tenant:
 *
 * 1. Account & security - change password, manage fingerprint/device
 *    login (BiometricSettingsPanel is already shared across every
 *    role, so it's reused as-is here rather than rebuilt).
 * 2. Contact details - phone/secondary phone/email/emergency contact
 *    are already editable inline on the tenant portal's "Your
 *    details" section (TenantPortal.jsx, Contact & Notice tab) - this
 *    links there rather than duplicating that form, so there's a
 *    single source of truth for the actual editing UI.
 * 3. Notification preferences - deferred (see open question in the
 *    spec: per-channel push/SMS/email toggles aren't backed by
 *    anything server-side yet). Shown as a labeled placeholder so the
 *    page's structure already has room for it once that lands.
 * 4. Language/display preferences - skipped per spec (the app doesn't
 *    support more than one language/display setting yet).
 * 5. Data & account - self-service data export (same underlying
 *    /data-export/me endpoint the landlord "Export your data" section
 *    uses, now scoped server-side to the tenant's own data - see
 *    dataExport.controller.js's exportTenantData) and a request-
 *    account-deletion action. There's no self-service deletion
 *    endpoint anywhere in the app yet (even landlords don't have one -
 *    account deletion is admin-triggered) - routed through the
 *    existing help-desk (help_requests) so it lands as a real,
 *    trackable request rather than a dead mailto link.
 *
 * Deliberately does NOT include "Fix notifications on this device"
 * (spec item 13: that feature is being removed entirely, not
 * relocated here).
 */
export default function TenantSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = sessionStorage.getItem('rentapay_token');

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [exportingData, setExportingData] = useState(false);
  const [exportError, setExportError] = useState('');

  const [requestingDeletion, setRequestingDeletion] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [deletionError, setDeletionError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    api.getProfile(token)
      .then((res) => setProfile(res.profile))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your details.'))
      .finally(() => setLoading(false));
  }, [token, navigate]);

  useEffect(() => {
    if (location.hash === '#security' && !loading) {
      document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash, loading]);

  async function handleExportData() {
    setExportingData(true);
    setExportError('');
    try {
      await api.exportMyData(token);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Failed to export your data.');
    } finally {
      setExportingData(false);
    }
  }

  async function handleRequestDeletion() {
    setRequestingDeletion(true);
    setDeletionError('');
    try {
      await api.submitHelpRequest({
        name: profile?.full_name || 'Tenant',
        message: 'I would like to request that my RentaPay account and data be deleted.',
      }, token);
      setDeletionRequested(true);
    } catch (err) {
      setDeletionError(err instanceof ApiError ? err.message : 'Failed to submit your request. Please try again.');
    } finally {
      setRequestingDeletion(false);
    }
  }

  if (loading) {
    return (
      <div className="settings-page">
        <Link to="/portal" className="settings-back">← Back to portal</Link>
        <h1>Settings</h1>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <Link to="/portal" className="settings-back">← Back to portal</Link>
      <h1>Settings</h1>

      {notice && <div className="settings-banner settings-banner--ok">{notice}</div>}
      {error && <div className="settings-banner settings-banner--error">{error}</div>}

      <h2 className="settings-cluster-title">Account &amp; security</h2>

      <section className="settings-card">
        <h2>Password</h2>
        <p className="settings-card__hint">Change the password you use to log in.</p>
        <Button variant="ghost" onClick={() => navigate('/change-password')}>Change password</Button>
      </section>

      <BiometricSettingsPanel
        phone={profile?.primary_phone}
        role="tenant"
        token={token}
        label={profile?.full_name}
      />

      <h2 className="settings-cluster-title u-mt-6">Contact details</h2>

      <section className="settings-card">
        <h2>Phone, email &amp; emergency contact</h2>
        <p className="settings-card__hint">
          Your phone, secondary phone, email, and emergency contact are edited from the Contact &amp; Notice tab in your portal.
        </p>
        <Button variant="ghost" onClick={() => navigate('/portal?tab=contact')}>Go to contact details</Button>
      </section>

      <h2 className="settings-cluster-title u-mt-6">Notification preferences</h2>

      <section className="settings-card">
        <h2>
          Push, SMS &amp; email
          <InfoTip text="Per-channel toggles for payment reminders, maintenance updates, and announcements are planned but not available yet." />
        </h2>
        <p className="settings-card__hint">
          Choosing exactly which notifications you get, and over which channel, isn't available yet - it's on the way.
        </p>
      </section>

      <h2 className="settings-cluster-title u-mt-6">Data &amp; account</h2>

      <section className="settings-card">
        <h2>Export your data</h2>
        <InfoTip
          label="What's included?"
          text="Download everything RentaPay holds about your account - your profile, payment history, maintenance requests, document records, and reputation ratings - as a single file you can keep."
        />
        <Button onClick={handleExportData} disabled={exportingData} variant="ghost">
          {exportingData ? 'Preparing your export…' : '⬇ Export my data'}
        </Button>
        {exportError && <p className="modal-error">{exportError}</p>}
      </section>

      <section className="settings-card">
        <h2>Delete my account</h2>
        <p className="settings-card__hint">
          This sends a request to the RentaPay team to close your account and remove your data. It isn't instant - someone will follow up with you to confirm.
        </p>
        {deletionRequested ? (
          <p className="settings-card__hint" style={{ color: 'var(--color-primary-dark)' }}>
            Your request has been sent. The RentaPay team will follow up with you.
          </p>
        ) : (
          <Button onClick={handleRequestDeletion} disabled={requestingDeletion} variant="ghost">
            {requestingDeletion ? 'Sending request…' : 'Request account deletion'}
          </Button>
        )}
        {deletionError && <p className="modal-error">{deletionError}</p>}
      </section>
    </div>
  );
}
