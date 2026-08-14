import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';
import './AdminSubscriptionPricing.css';
import InfoTip from './InfoTip.jsx';

/**
 * Lets an admin change the subscription fee landlords pay: the base
 * rate per unit per month, and the discount tiers for longer
 * commitment periods (e.g. 6 months = 10% off). A change here affects
 * every place the fee is calculated - signup, adding a property,
 * adding units mid-period, and renewing/managing a subscription - all
 * of which read from this same setting (see utils/pricing.js on the
 * backend). Same append-only-history pattern as the BA commission
 * rate: saving never overwrites the current rate, it schedules a new
 * one from a chosen effective date.
 */
export default function AdminSubscriptionPricing({ token }) {
  const [data, setData] = useState(null); // { current, upcoming, history }
  const [loadError, setLoadError] = useState('');

  const [baseRate, setBaseRate] = useState('');
  const [tiers, setTiers] = useState([]); // [{ months, discountPercent }]
  const [effectiveMode, setEffectiveMode] = useState('now');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setData(null);
    setLoadError('');
    api
      .getSubscriptionPricing(token)
      .then((res) => setData(res))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load subscription pricing.'));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Seed the edit form from the current rate whenever it loads.
  useEffect(() => {
    if (!data?.current) return;
    setBaseRate(String(Number(data.current.base_rate_per_unit_per_month)));
    const entries = Object.entries(data.current.period_discounts || {})
      .map(([months, discount]) => ({ months: Number(months), discountPercent: Number(discount) * 100 }))
      .sort((a, b) => a.months - b.months);
    setTiers(entries);
  }, [data]);

  function updateTier(index, field, value) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  function addTier() {
    setTiers((prev) => [...prev, { months: '', discountPercent: '' }]);
  }

  function removeTier(index) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const rate = Number(baseRate);
      if (baseRate === '' || Number.isNaN(rate) || rate < 0) {
        setSaveError('Enter a valid base rate (0 or more).');
        setSaving(false);
        return;
      }

      const periodDiscounts = {};
      for (const tier of tiers) {
        const months = Number(tier.months);
        const pct = Number(tier.discountPercent);
        if (!Number.isFinite(months) || months < 1) {
          setSaveError('Every tier needs a whole number of months (1 or more).');
          setSaving(false);
          return;
        }
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
          setSaveError('Every tier discount must be between 0 and 100%.');
          setSaving(false);
          return;
        }
        periodDiscounts[months] = pct / 100;
      }

      await api.updateSubscriptionPricing(
        {
          baseRatePerUnitPerMonth: rate,
          periodDiscounts,
          effectiveFrom: effectiveMode === 'future' ? new Date(effectiveDate).toISOString() : undefined,
        },
        token
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEffectiveMode('now');
      load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save subscription pricing.');
    } finally {
      setSaving(false);
    }
  }

  const current = data?.current || null;
  const upcoming = data?.upcoming || [];
  const history = data?.history || [];

  return (
    <div className="admin-sub-pricing">
      <InfoTip text={<>
        This is the fee every landlord pays: a base rate per unit per month, discounted for longer commitment
        periods. It applies everywhere a subscription is charged — signup, adding a property, adding units
        mid-period, and renewals. Saving never overwrites the current rate — it schedules a new one from a chosen
        effective date, so past rates are always kept for reference.
      </>} />

      {loadError && <p className="admin-sub-pricing__error">{loadError}</p>}

      {!data ? (
        <Skeleton rows={4} />
      ) : (
        <>
          <section className="admin-sub-pricing__card">
            <h3>Base subscription fee</h3>
            <div className="admin-sub-pricing__current-rate">
              {current ? (
                <>
                  <span className="admin-sub-pricing__current-rate-value">
                    KES {Number(current.base_rate_per_unit_per_month)}
                  </span>
                  <span className="admin-sub-pricing__current-rate-label">
                    per unit / month, effective since {new Date(current.effective_from).toLocaleDateString('en-GB')}
                  </span>
                </>
              ) : (
                <span className="admin-sub-pricing__current-rate-label">No rate set yet.</span>
              )}
            </div>

            {upcoming.length > 0 && (
              <div className="admin-sub-pricing__upcoming">
                {upcoming.map((row) => (
                  <p key={row.id} className="admin-sub-pricing__upcoming-row">
                    Scheduled: <strong>KES {Number(row.base_rate_per_unit_per_month)}</strong>/unit/month from{' '}
                    {new Date(row.effective_from).toLocaleDateString('en-GB')}
                  </p>
                ))}
              </div>
            )}

            <div className="admin-sub-pricing__form-row">
              <label>
                New base rate (KES / unit / month)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={baseRate}
                  onChange={(e) => setBaseRate(e.target.value)}
                  placeholder={current ? String(Number(current.base_rate_per_unit_per_month)) : 'e.g. 50'}
                />
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

            <h4 className="admin-sub-pricing__tiers-heading">Discount tiers for longer commitments</h4>
            <InfoTip text={<>
              A landlord subscribing for at least this many months gets this % off the base rate. The highest tier
              they qualify for applies.
            </>} />
            <div className="admin-sub-pricing__tiers">
              {tiers.map((tier, i) => (
                <div className="admin-sub-pricing__tier-row" key={i}>
                  <label>
                    Min. months
                    <input
                      type="number"
                      min="1"
                      value={tier.months}
                      onChange={(e) => updateTier(i, 'months', e.target.value)}
                    />
                  </label>
                  <label>
                    Discount %
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={tier.discountPercent}
                      onChange={(e) => updateTier(i, 'discountPercent', e.target.value)}
                    />
                  </label>
                  <Button variant="ghost" onClick={() => removeTier(i)}>Remove</Button>
                </div>
              ))}
              <Button variant="ghost" onClick={addTier}>+ Add tier</Button>
            </div>

            {saveError && <p className="admin-sub-pricing__error">{saveError}</p>}
            <div className="admin-sub-pricing__actions">
              <Button onClick={save} loading={saving}>{saved ? 'Saved!' : 'Save Subscription Fee'}</Button>
            </div>
          </section>

          <section className="admin-sub-pricing__card">
            <h3>Rate history</h3>
            {history.length === 0 ? (
              <p className="admin-sub-pricing__meta">No rate has ever been set.</p>
            ) : (
              <table className="admin-sub-pricing__history-table">
                <thead>
                  <tr>
                    <th>Base rate</th>
                    <th>Tiers</th>
                    <th>Effective from</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className={current && row.id === current.id ? 'admin-sub-pricing__history-row--current' : ''}>
                      <td>KES {Number(row.base_rate_per_unit_per_month)}</td>
                      <td>
                        {Object.entries(row.period_discounts || {})
                          .sort((a, b) => Number(a[0]) - Number(b[0]))
                          .map(([m, d]) => `${m}mo: ${Math.round(Number(d) * 100)}%`)
                          .join(', ') || '—'}
                      </td>
                      <td>{new Date(row.effective_from).toLocaleString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
