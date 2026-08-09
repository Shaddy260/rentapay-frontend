import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import './AdminBaPayoutRules.css';

/**
 * BUILD SPEC PHASE 10 - Payout Rules Engine, Qualification & Commission
 * Tiers. Backend (payoutRules.controller.js) already had full CRUD for
 * this - global payout rule, global commission ladder, and an optional
 * per-BA override of each - but no admin UI existed to drive it. This
 * is that UI, rendered as the "Pricing & Commission" view inside
 * AdminBrandAmbassadors.jsx.
 *
 * Two independent things, each with a global default and an optional
 * per-BA override:
 *  - Payout rule: flat KES amount owed per qualifying landlord, plus
 *    the conditions that make a landlord "qualify" (consecutive months
 *    paid, minimum units).
 *  - Commission tiers: once a BA crosses a configured count of
 *    qualified landlords, a % bonus kicks in on top of the flat
 *    payout for that BA's qualifying landlords going forward.
 */
export default function AdminBaPayoutRules({ token }) {
  const [roster, setRoster] = useState(null);
  const [rosterError, setRosterError] = useState('');
  const [selectedBaId, setSelectedBaId] = useState(''); // '' = editing the global defaults

  const [rules, setRules] = useState(null); // { global, override }
  const [tiers, setTiers] = useState(null); // { global, override }
  const [loadError, setLoadError] = useState('');

  const [ruleForm, setRuleForm] = useState({ amount: '', requiredConsecutiveMonths: '', minUnits: '' });
  const [tierRows, setTierRows] = useState([]); // [{ targetQualifiedLandlords, commissionPercent }]

  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleError, setRuleError] = useState('');
  const [ruleSaved, setRuleSaved] = useState(false);

  const [tiersSaving, setTiersSaving] = useState(false);
  const [tiersError, setTiersError] = useState('');
  const [tiersSaved, setTiersSaved] = useState(false);

  const [clearingRule, setClearingRule] = useState(false);
  const [clearingTiers, setClearingTiers] = useState(false);

  const isOverride = !!selectedBaId;

  // Full active/suspended roster, for the "apply a custom override to
  // one BA" picker - inactive/rejected BAs can't earn new payouts so
  // there's nothing useful to override for them.
  useEffect(() => {
    api
      .listBrandAmbassadors('', token)
      .then((res) => setRoster((res.brandAmbassadors || []).filter((b) => b.status === 'active' || b.status === 'suspended')))
      .catch((err) => setRosterError(err instanceof ApiError ? err.message : 'Failed to load Brand Ambassadors.'));
  }, [token]);

  const loadAll = useCallback(() => {
    setRules(null);
    setTiers(null);
    setLoadError('');
    Promise.all([api.getBaPayoutRules(selectedBaId || undefined, token), api.getBaCommissionTiers(selectedBaId || undefined, token)])
      .then(([rulesRes, tiersRes]) => {
        setRules(rulesRes);
        setTiers(tiersRes);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load payout rules.'));
  }, [selectedBaId, token]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Populate the editable forms whenever loaded data changes: an
  // override view edits the override if one exists, otherwise starts
  // blank (falls back to global at read time until admin sets one);
  // the global view always edits the global row.
  useEffect(() => {
    if (!rules) return;
    const source = isOverride ? rules.override : rules.global;
    setRuleForm({
      amount: source?.amount ?? '',
      requiredConsecutiveMonths: source?.required_consecutive_months ?? '',
      minUnits: source?.min_units ?? '',
    });
  }, [rules, isOverride]);

  useEffect(() => {
    if (!tiers) return;
    const source = isOverride ? tiers.override : tiers.global;
    const rows = (source || []).map((t) => ({
      targetQualifiedLandlords: t.target_qualified_landlords,
      commissionPercent: t.commission_percent,
    }));
    setTierRows(rows.length ? rows : [{ targetQualifiedLandlords: '', commissionPercent: '' }]);
  }, [tiers, isOverride]);

  async function saveRule() {
    setRuleSaving(true);
    setRuleError('');
    setRuleSaved(false);
    try {
      const payload = {
        amount: ruleForm.amount,
        requiredConsecutiveMonths: ruleForm.requiredConsecutiveMonths,
        minUnits: ruleForm.minUnits,
      };
      if (isOverride) await api.setBaPayoutOverride(selectedBaId, payload, token);
      else await api.updateGlobalBaPayoutRule(payload, token);
      setRuleSaved(true);
      setTimeout(() => setRuleSaved(false), 2000);
      loadAll();
    } catch (err) {
      setRuleError(err instanceof ApiError ? err.message : 'Failed to save the payout rule.');
    } finally {
      setRuleSaving(false);
    }
  }

  async function clearRuleOverride() {
    setClearingRule(true);
    setRuleError('');
    try {
      await api.setBaPayoutOverride(selectedBaId, { clear: true }, token);
      loadAll();
    } catch (err) {
      setRuleError(err instanceof ApiError ? err.message : 'Failed to clear the override.');
    } finally {
      setClearingRule(false);
    }
  }

  function updateTierRow(index, field, value) {
    setTierRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addTierRow() {
    setTierRows((prev) => [...prev, { targetQualifiedLandlords: '', commissionPercent: '' }]);
  }

  function removeTierRow(index) {
    setTierRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveTiers() {
    setTiersSaving(true);
    setTiersError('');
    setTiersSaved(false);
    try {
      const cleanRows = tierRows.filter((r) => r.targetQualifiedLandlords !== '' && r.commissionPercent !== '');
      if (!cleanRows.length) {
        setTiersError('At least one tier is required.');
        setTiersSaving(false);
        return;
      }
      if (isOverride) await api.setBaCommissionTierOverride(selectedBaId, { tiers: cleanRows }, token);
      else await api.updateGlobalBaCommissionTiers(cleanRows, token);
      setTiersSaved(true);
      setTimeout(() => setTiersSaved(false), 2000);
      loadAll();
    } catch (err) {
      setTiersError(err instanceof ApiError ? err.message : 'Failed to save commission tiers.');
    } finally {
      setTiersSaving(false);
    }
  }

  async function clearTiersOverride() {
    setClearingTiers(true);
    setTiersError('');
    try {
      await api.setBaCommissionTierOverride(selectedBaId, { clear: true }, token);
      loadAll();
    } catch (err) {
      setTiersError(err instanceof ApiError ? err.message : 'Failed to clear the override.');
    } finally {
      setClearingTiers(false);
    }
  }

  return (
    <div className="admin-ba-rules">
      <p className="admin-ba-rules__intro">
        Set what RentaPay pays a Brand Ambassador per qualifying landlord, what makes a landlord "qualify," and the
        commission tiers that boost payouts once a BA hits certain milestones. These apply to every BA by default —
        pick a specific BA below to give them a custom override instead.
      </p>

      <div className="admin-ba-rules__scope">
        <label htmlFor="ba-rules-scope">Editing:</label>
        <select id="ba-rules-scope" value={selectedBaId} onChange={(e) => setSelectedBaId(e.target.value)}>
          <option value="">Global defaults (all BAs)</option>
          {(roster || []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.full_name} ({b.ba_code || 'no code yet'})
            </option>
          ))}
        </select>
      </div>
      {rosterError && <p className="admin-ba-rules__error">{rosterError}</p>}
      {loadError && <p className="admin-ba-rules__error">{loadError}</p>}

      {!rules || !tiers ? (
        <Skeleton rows={4} />
      ) : (
        <>
          {isOverride && !rules.override && (
            <p className="admin-ba-rules__note">
              This BA has no custom payout rule yet — currently using the global default. Fill in and save below to
              set one just for them.
            </p>
          )}

          <section className="admin-ba-rules__card">
            <h3>Per-Landlord Payout {isOverride ? '(override)' : '(global default)'}</h3>
            <div className="admin-ba-rules__form-row">
              <label>
                Amount (KES)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ruleForm.amount}
                  onChange={(e) => setRuleForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </label>
              <label>
                Consecutive months paid required
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={ruleForm.requiredConsecutiveMonths}
                  onChange={(e) => setRuleForm((f) => ({ ...f, requiredConsecutiveMonths: e.target.value }))}
                />
              </label>
              <label>
                Minimum units on the property
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={ruleForm.minUnits}
                  onChange={(e) => setRuleForm((f) => ({ ...f, minUnits: e.target.value }))}
                />
              </label>
            </div>
            {ruleError && <p className="admin-ba-rules__error">{ruleError}</p>}
            <div className="admin-ba-rules__actions">
              <Button onClick={saveRule} loading={ruleSaving}>
                {ruleSaved ? 'Saved!' : isOverride ? 'Save Override' : 'Save Global Default'}
              </Button>
              {isOverride && rules.override && (
                <Button variant="ghost" onClick={clearRuleOverride} loading={clearingRule}>
                  Revert to Global Default
                </Button>
              )}
            </div>
          </section>

          <section className="admin-ba-rules__card">
            <h3>Commission Tiers {isOverride ? '(override)' : '(global default)'}</h3>
            <p className="admin-ba-rules__meta">
              Once a BA's cumulative qualified-landlord count reaches a target below, that commission percent applies
              on top of the flat payout for their qualifying landlords going forward.
            </p>
            <div className="admin-ba-rules__tiers">
              {tierRows.map((row, i) => (
                <div className="admin-ba-rules__tier-row" key={i}>
                  <label>
                    At
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.targetQualifiedLandlords}
                      onChange={(e) => updateTierRow(i, 'targetQualifiedLandlords', e.target.value)}
                    />
                    qualified landlords
                  </label>
                  <label>
                    commission
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={row.commissionPercent}
                      onChange={(e) => updateTierRow(i, 'commissionPercent', e.target.value)}
                    />
                    %
                  </label>
                  <Button variant="ghost" onClick={() => removeTierRow(i)} disabled={tierRows.length === 1}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="ghost" onClick={addTierRow}>+ Add Tier</Button>
            {tiersError && <p className="admin-ba-rules__error">{tiersError}</p>}
            <div className="admin-ba-rules__actions">
              <Button onClick={saveTiers} loading={tiersSaving}>
                {tiersSaved ? 'Saved!' : isOverride ? 'Save Override' : 'Save Global Default'}
              </Button>
              {isOverride && tiers.override && (
                <Button variant="ghost" onClick={clearTiersOverride} loading={clearingTiers}>
                  Revert to Global Default
                </Button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
