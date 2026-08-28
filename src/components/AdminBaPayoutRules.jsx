import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import './AdminBaPayoutRules.css';
import InfoTip from './InfoTip.jsx';

/**
 * Consolidated Change Instructions - Section E (percentage commission,
 * hard cutover). Replaces the old fixed-price / commission-tiers /
 * unit-pricing-tiers panel entirely.
 *
 * A BA earns a percentage of the landlord's actual subscription fee,
 * recurring on every payment cycle for as long as the landlord stays
 * subscribed. One global rate applies to every BA by default; an
 * optional per-BA override fully replaces it for that one BA.
 *
 * Setting a rate never overwrites the current one - it inserts a new
 * history row with its own effective date, so past rates (and which
 * payments they applied to) are never lost. Every save asks WHEN the
 * new rate takes effect: immediately, or from a chosen future date.
 */
export default function AdminBaPayoutRules({ token }) {
  const [roster, setRoster] = useState(null);
  const [rosterError, setRosterError] = useState('');
  const [selectedBaId, setSelectedBaId] = useState(''); // '' = editing the global default

  const [rules, setRules] = useState(null); // { global: {current, upcoming, history}, override: {...} | null }
  const [loadError, setLoadError] = useState('');

  const [percentage, setPercentage] = useState('');
  const [effectiveMode, setEffectiveMode] = useState('now'); // 'now' | 'future'
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);

  const isOverride = !!selectedBaId;

  // Full active/suspended roster, for the "apply a custom override to
  // one BA" picker - inactive/rejected BAs can't earn new commission
  // so there's nothing useful to override for them.
  useEffect(() => {
    api
      .listBrandAmbassadors('', token)
      .then((res) => setRoster((res.brandAmbassadors || []).filter((b) => b.status === 'active' || b.status === 'suspended')))
      .catch((err) => setRosterError(err instanceof ApiError ? err.message : 'Failed to load Brand Ambassadors.'));
  }, [token]);

  const loadAll = useCallback(() => {
    setRules(null);
    setLoadError('');
    api
      .getBaPayoutRules(selectedBaId || undefined, token)
      .then((res) => setRules(res))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load the commission rate.'));
  }, [selectedBaId, token]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Reset the entry form whenever the editing scope changes - always
  // starts blank (this is always ADDING a new rate/history row, never
  // editing an existing one in place).
  useEffect(() => {
    setPercentage('');
    setEffectiveMode('now');
    setEffectiveDate(new Date().toISOString().slice(0, 10));
    setSaveError('');
    setSaved(false);
  }, [selectedBaId]);

  async function saveRate() {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const pct = Number(percentage);
      if (percentage === '' || Number.isNaN(pct) || pct < 0 || pct > 100) {
        setSaveError('Enter a commission percentage between 0 and 100.');
        setSaving(false);
        return;
      }
      const payload = {
        percentage: pct,
        effectiveFrom: effectiveMode === 'future' ? new Date(effectiveDate).toISOString() : undefined,
      };
      if (isOverride) await api.setBaPayoutOverride(selectedBaId, payload, token);
      else await api.updateGlobalBaPayoutRule(payload, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setPercentage('');
      setEffectiveMode('now');
      loadAll();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save the commission rate.');
    } finally {
      setSaving(false);
    }
  }

  async function clearOverride() {
    setClearing(true);
    setSaveError('');
    try {
      await api.setBaPayoutOverride(selectedBaId, { clear: true }, token);
      loadAll();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to clear the override.');
    } finally {
      setClearing(false);
    }
  }

  const scopeData = isOverride ? rules?.override : rules?.global;
  const current = scopeData?.current || null;
  const upcoming = scopeData?.upcoming || [];
  const history = scopeData?.history || [];

  return (
    <div className="admin-ba-rules">
      <InfoTip text={<>
        BAs earn a percentage of what each qualifying landlord actually pays RentaPay, recurring on every payment
        cycle for as long as that landlord stays subscribed — not a one-off amount. This rate applies to every BA by
        default; pick a specific BA below to give them a custom override instead. Setting a new rate never
        overwrites the current one — it's recorded as of a chosen effective date, so past rates (and exactly which
        payments they applied to) are always preserved.
      </>} />

      <div className="admin-ba-rules__scope">
        <label htmlFor="ba-rules-scope">Editing:</label>
        <select id="ba-rules-scope" value={selectedBaId} onChange={(e) => setSelectedBaId(e.target.value)}>
          <option value="">Global default (all BAs)</option>
          {(roster || []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.full_name} ({b.ba_code || 'no code yet'})
            </option>
          ))}
        </select>
      </div>
      {rosterError && <p className="admin-ba-rules__error">{rosterError}</p>}
      {loadError && <p className="admin-ba-rules__error">{loadError}</p>}

      {!rules ? (
        <Skeleton rows={4} />
      ) : (
        <>
          {isOverride && !current && (
            <p className="admin-ba-rules__note">
              This BA has no custom rate yet — currently using the global default. Set one below to give them a
              custom rate.
            </p>
          )}

          <section className="admin-ba-rules__card">
            <h3>Commission rate {isOverride ? '(override)' : '(global default)'}</h3>

            <div className="admin-ba-rules__current-rate">
              {current ? (
                <>
                  <span className="admin-ba-rules__current-rate-value">{Number(current.percentage)}%</span>
                  <span className="admin-ba-rules__current-rate-label">
                    current rate, effective since {new Date(current.effective_from).toLocaleDateString('en-GB')}
                  </span>
                </>
              ) : (
                <span className="admin-ba-rules__current-rate-label">No rate set yet.</span>
              )}
            </div>

            {upcoming.length > 0 && (
              <div className="admin-ba-rules__upcoming">
                {upcoming.map((row) => (
                  <p key={row.id} className="admin-ba-rules__upcoming-row">
                    Scheduled: <strong>{Number(row.percentage)}%</strong> from {new Date(row.effective_from).toLocaleDateString('en-GB')}
                  </p>
                ))}
              </div>
            )}

            <p className="admin-ba-rules__meta">
              Setting a new rate immediately notifies {isOverride ? 'this BA' : 'every affected BA'} — in-app and
              push — with the old rate, new rate, and effective date.
            </p>

            <div className="admin-ba-rules__form-row">
              <label>
                New commission percent
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder={current ? String(Number(current.percentage)) : 'e.g. 5'}
                />
                %
              </label>
              <label>
                Takes effect
                <select value={effectiveMode} onChange={(e) => setEffectiveMode(e.target.value)}>
                  <option value="now">Immediately</option>
                  <option value="future">From a specific date</option>
                </select>
              </label>
              {effectiveMode === 'future' && (
                <label>
                  Effective date
                  <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                </label>
              )}
            </div>
            {saveError && <p className="admin-ba-rules__error">{saveError}</p>}
            <div className="admin-ba-rules__actions">
              <Button onClick={saveRate} loading={saving}>
                {saved ? 'Saved!' : isOverride ? 'Set Override Rate' : 'Set Global Rate'}
              </Button>
              {isOverride && current && (
                <Button variant="ghost" onClick={clearOverride} loading={clearing}>
                  Revert to Global Default
                </Button>
              )}
            </div>
          </section>

          <section className="admin-ba-rules__card">
            <h3>Rate history {isOverride ? '(override)' : '(global default)'}</h3>
            {history.length === 0 ? (
              <p className="admin-ba-rules__meta">No rate has ever been set for this scope.</p>
            ) : (
              <div className="admin-ba-rules__table-scroll">
              <table className="admin-ba-rules__history-table">
                <thead>
                  <tr>
                    <th>Rate</th>
                    <th>Effective from</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className={current && row.id === current.id ? 'admin-ba-rules__history-row--current' : ''}>
                      <td>{Number(row.percentage)}%</td>
                      <td>{new Date(row.effective_from).toLocaleString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
