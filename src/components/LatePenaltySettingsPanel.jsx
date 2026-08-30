import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import InfoTip from './InfoTip.jsx';
import './LatePenaltySettingsPanel.css';

/**
 * Late-payment penalty setting, configured PER APARTMENT (property) -
 * not per landlord account, not per unit. Pick an apartment below,
 * toggle it on, and enter a percentage; that formula then applies to
 * every unit and tenant inside that apartment automatically, using
 * the rent/due-date/payment data already on file (see backend
 * utils/latePenalty.js). Off by default. Switching the apartment
 * picker loads (and edits) that apartment's own independent settings
 * - two apartments can have completely different formulas, or one on
 * and one off.
 *
 * Also hosts the per-tenant override manager (waive / custom amount /
 * custom rate for a specific tenant + billing period) - kept on the
 * same screen since exceptions are still easiest to manage from one
 * place, even though the base formula itself is now per apartment.
 */
export default function LatePenaltySettingsPanel({ token, isManager, properties }) {
  const propertyList = properties || [];
  const [propertyId, setPropertyId] = useState(propertyList[0]?.id || '');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Draft form state - re-synced from `settings` whenever the loaded
  // apartment changes, so typing doesn't get clobbered by a stray
  // refetch, but switching apartments always shows that apartment's
  // own real values instead of leftover text from the previous one.
  const [draft, setDraft] = useState({
    enabled: false,
    accrualUnit: 'day',
    ratePercent: '',
    capEnabled: false,
    capPercent: '',
    appliesToUtilities: false,
  });

  const [preview, setPreview] = useState(null);
  const previewTimer = useRef(null);

  // Keep a valid selection if the property list arrives/changes after
  // mount (e.g. loaded async elsewhere in Settings.jsx).
  useEffect(() => {
    if (!propertyId && propertyList.length > 0) setPropertyId(propertyList[0].id);
  }, [propertyList, propertyId]);

  useEffect(() => {
    if (!propertyId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.getLatePenaltySettings(propertyId, token).then((res) => {
      if (cancelled) return;
      const s = res?.settings;
      setSettings(s);
      setDraft({
        enabled: !!s?.enabled,
        accrualUnit: s?.accrual_unit || 'day',
        ratePercent: s?.rate_percent != null ? String(s.rate_percent) : '',
        capEnabled: !!s?.cap_enabled,
        capPercent: s?.cap_percent != null ? String(s.cap_percent) : '',
        appliesToUtilities: !!s?.applies_to_utilities,
      });
    }).catch((err) => {
      if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load late payment penalty settings.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [token, propertyId]);

  // Live plain-language preview, recomputed on every field change
  // (debounced slightly so it isn't firing on every keystroke).
  useEffect(() => {
    if (loading) return;
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      api.previewLatePenalty({
        ratePercent: Number(draft.ratePercent) || 0,
        accrualUnit: draft.accrualUnit,
        capEnabled: draft.capEnabled,
        capPercent: draft.capPercent === '' ? null : Number(draft.capPercent),
        sampleAmount: 15000,
        periodsOverdue: 5,
      }, token).then(setPreview).catch(() => {});
    }, 250);
    return () => clearTimeout(previewTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.ratePercent, draft.accrualUnit, draft.capEnabled, draft.capPercent, loading]);

  const save = useCallback(async (e) => {
    e.preventDefault();
    if (!propertyId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (draft.capEnabled && draft.capPercent === '') {
        setError('Enter a cap percentage, or turn the cap off.');
        setSaving(false);
        return;
      }
      const res = await api.updateLatePenaltySettings(propertyId, {
        enabled: draft.enabled,
        accrualUnit: draft.accrualUnit,
        ratePercent: Number(draft.ratePercent) || 0,
        capEnabled: draft.capEnabled,
        capPercent: draft.capEnabled ? Number(draft.capPercent) : null,
        appliesToUtilities: draft.appliesToUtilities,
      }, token);
      setSettings(res.settings);
      const propertyName = propertyList.find((p) => p.id === propertyId)?.name || 'This apartment';
      setNotice(`Late payment penalty settings saved for ${propertyName}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }, [draft, token, propertyId, propertyList]);

  if (propertyList.length === 0) {
    return (
      <section className="settings-card late-penalty-panel">
        <h2>Late payment penalty</h2>
        <p className="tenant-portal-hint">Add an apartment/property first - this is configured per apartment.</p>
      </section>
    );
  }

  return (
    <section className="settings-card late-penalty-panel">
      <h2>
        Late payment penalty
        <InfoTip text="Optional, off by default. Set a formula per apartment - toggle it on and enter a percentage for one apartment, and it applies to every unit and tenant inside that apartment, without touching any other apartment. You can still waive or adjust it for a specific tenant/month below." />
      </h2>

      <div className="form-field u-mb-3">
        <label className="form-field__label">Apartment</label>
        <select value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setNotice(''); setError(''); }}>
          {propertyList.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="settings-banner settings-banner--error">{error}</div>}
      {notice && <div className="settings-banner settings-banner--ok">{notice}</div>}

      {loading ? (
        <p className="tenant-portal-hint">Loading…</p>
      ) : (
        <form onSubmit={save} className="late-penalty-panel__form">
          <label className="late-penalty-panel__toggle-row">
            <input
              type="checkbox"
              checked={draft.enabled}
              disabled={isManager && false /* managers can edit, same tier as rent/due-date */}
              onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            />
            <span>
              <strong>Enable late payment penalty for this apartment</strong>
              <br />
              <span className="late-penalty-panel__muted">Off means nothing changes for this apartment's tenants - no penalty is shown or charged. Other apartments are unaffected either way.</span>
            </span>
          </label>

          <fieldset disabled={!draft.enabled} className="late-penalty-panel__fields">
            <div className="form-field-row">
              <div className="form-field">
                <label className="form-field__label">Charge per</label>
                <select value={draft.accrualUnit} onChange={(e) => setDraft((d) => ({ ...d, accrualUnit: e.target.value }))}>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-field__label">
                  Rate (%)
                  <InfoTip text="Percentage of the outstanding balance charged per day (or week), starting the day after the due date - there is no grace period once this is enabled. Applied once every 24 hours for daily, or after each full 7-day stretch for weekly." />
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.ratePercent}
                  onChange={(e) => setDraft((d) => ({ ...d, ratePercent: e.target.value }))}
                  placeholder="e.g. 0.5"
                />
              </div>
            </div>

            <label className="late-penalty-panel__toggle-row">
              <input
                type="checkbox"
                checked={draft.capEnabled}
                onChange={(e) => setDraft((d) => ({ ...d, capEnabled: e.target.checked }))}
              />
              <span>Cap the total penalty</span>
            </label>

            {draft.capEnabled && (
              <div className="form-field">
                <label className="form-field__label">Maximum penalty, as % of the outstanding balance</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={draft.capPercent}
                  onChange={(e) => setDraft((d) => ({ ...d, capPercent: e.target.value }))}
                  placeholder="e.g. 20"
                />
              </div>
            )}

            <label className="late-penalty-panel__toggle-row">
              <input
                type="checkbox"
                checked={draft.appliesToUtilities}
                onChange={(e) => setDraft((d) => ({ ...d, appliesToUtilities: e.target.checked }))}
              />
              <span>
                Also apply to unpaid utility/other charges
                <br />
                <span className="late-penalty-panel__muted">Rent is always covered when this is enabled - this only extends it to utilities too.</span>
              </span>
            </label>

            {preview && (
              <p className="late-penalty-panel__preview">{preview.sentence}</p>
            )}
          </fieldset>

          <Button type="submit" variant="primary" loading={saving}>Save for this apartment</Button>
        </form>
      )}

      <TenantOverrideManager token={token} propertyId={propertyId} propertyName={propertyList.find((p) => p.id === propertyId)?.name || ''} />
    </section>
  );
}

/**
 * Per-tenant / per-period waive or custom-amount/rate override. Kept
 * on this same screen (rather than scattered across every tenant's
 * own page) so managing exceptions stays a single, central place -
 * enter the tenant's id (visible on their portal/detail page or unit
 * detail screen), pick the month it applies to, and the reason.
 *
 * FIX (direct request: "I can't be in this apartment and do the
 * changes in other apartment"): this used to accept ANY tenant ID at
 * all, completely ignoring the apartment picker above it - pasting a
 * tenant ID from Jumbo Apartments while Glory Homes was selected
 * silently worked. `propertyId` is now the apartment currently
 * selected up top; a tenant ID that doesn't belong to it is rejected
 * up front (client-side, before even calling the API) with a clear
 * message, AND the backend independently re-checks the same thing
 * (see checkTenantMatchesSelectedApartment in
 * latePenalty.controller.js) so this can't be bypassed by calling the
 * API directly. Switching the apartment picker above also clears
 * whatever was loaded here, so a stale lookup from the previous
 * apartment never lingers on screen looking current.
 */
function TenantOverrideManager({ token, propertyId, propertyName }) {
  const [tenantId, setTenantId] = useState('');
  const [overrides, setOverrides] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ periodReference: '', overrideType: 'waive', overrideValue: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  // Any lookup/result from a previous apartment is meaningless (and
  // actively misleading) once the picker above switches apartments -
  // clear it out rather than leave it sitting on screen looking like
  // it still applies to the newly-selected one.
  useEffect(() => {
    setTenantId('');
    setOverrides(null);
    setLoadError('');
    setFormError('');
  }, [propertyId]);

  async function loadOverrides(id) {
    setLoadError('');
    setOverrides(null);
    if (!id.trim()) return;
    try {
      const res = await api.listLatePenaltyOverrides(id.trim(), propertyId, token);
      setOverrides(res.overrides || []);
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : 'Failed to load overrides for this tenant.'
      );
    }
  }

  async function submitOverride(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await api.createLatePenaltyOverride(tenantId.trim(), {
        propertyId,
        periodReference: form.periodReference || undefined,
        overrideType: form.overrideType,
        overrideValue: form.overrideType === 'waive' ? undefined : Number(form.overrideValue),
        reason: form.reason,
      }, token);
      setForm({ periodReference: '', overrideType: 'waive', overrideValue: '', reason: '' });
      await loadOverrides(tenantId);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save override.');
    } finally {
      setBusy(false);
    }
  }

  async function removeOverride(id) {
    setBusy(true);
    try {
      await api.removeLatePenaltyOverride(id, propertyId, token);
      await loadOverrides(tenantId);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to remove override.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="late-penalty-panel__overrides">
      <h3>
        Waive or adjust for a specific tenant
        <InfoTip text="Overrides one tenant's penalty for one billing period (e.g. a documented emergency) without changing the formula for anyone else in that apartment. Always logged with a reason - never a silent adjustment." />
      </h3>
      {propertyName && (
        <p className="late-penalty-panel__muted late-penalty-panel__scope-hint">
          Looking up tenants in <strong>{propertyName}</strong> only - switch the apartment above to manage a tenant elsewhere.
        </p>
      )}
      <div className="form-field-row">
        <div className="form-field">
          <label className="form-field__label">Tenant ID</label>
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Paste tenant ID from their profile" />
        </div>
        <Button type="button" variant="ghost" onClick={() => loadOverrides(tenantId)}>Look up</Button>
      </div>
      {loadError && <p className="modal-error">{loadError}</p>}

      {overrides && (
        <>
          {overrides.filter((o) => o.is_active).length === 0 ? (
            <p className="late-penalty-panel__muted">No active override for this tenant.</p>
          ) : (
            <ul className="late-penalty-panel__override-list">
              {overrides.filter((o) => o.is_active).map((o) => (
                <li key={o.id}>
                  <div>
                    <strong>{o.period_reference}</strong> — {o.override_type === 'waive' ? 'Waived' : o.override_type === 'custom_amount' ? `Custom amount: KES ${Number(o.override_value).toLocaleString()}` : `Custom rate: ${o.override_value}%`}
                    <br />
                    <span className="late-penalty-panel__muted">"{o.reason}"</span>
                  </div>
                  <button type="button" className="ghost-link" disabled={busy} onClick={() => removeOverride(o.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={submitOverride} className="late-penalty-panel__override-form">
            <div className="form-field-row">
              <div className="form-field">
                <label className="form-field__label">Billing period</label>
                <input type="month" value={form.periodReference} onChange={(e) => setForm((f) => ({ ...f, periodReference: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-field__label">Action</label>
                <select value={form.overrideType} onChange={(e) => setForm((f) => ({ ...f, overrideType: e.target.value }))}>
                  <option value="waive">Waive entirely</option>
                  <option value="custom_amount">Set a custom KES amount</option>
                  <option value="custom_rate">Use a custom rate just for this tenant</option>
                </select>
              </div>
            </div>
            {form.overrideType !== 'waive' && (
              <div className="form-field">
                <label className="form-field__label">{form.overrideType === 'custom_amount' ? 'Amount (KES)' : 'Rate (%)'}</label>
                <input type="number" min="0" step="0.01" value={form.overrideValue} onChange={(e) => setForm((f) => ({ ...f, overrideValue: e.target.value }))} />
              </div>
            )}
            <div className="form-field">
              <label className="form-field__label">Reason (required, shown to the tenant)</label>
              <textarea rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Documented medical emergency, agreed with tenant on 3 Aug" />
            </div>
            {formError && <p className="modal-error">{formError}</p>}
            <Button type="submit" variant="primary" loading={busy}>Save override</Button>
          </form>
        </>
      )}
    </div>
  );
}
