import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, ApiError } from '../api/client.js';
import CommentReveal from '../components/CommentReveal.jsx';
import './AddTenant.css'; // reuses the same simple form-page styling

/**
 * Standalone "add a unit anytime" page (blueprint 7.3: "Add new units
 * - Built more rooms anytime"), distinct from the setup-wizard's
 * one-time bulk unit entry. Enforces the same subscription unit_limit
 * as the wizard does, fetched fresh here rather than trusted from
 * stale client state.
 */
export default function AddUnit() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('rentapay_token');

  const [unitName, setUnitName] = useState('');
  const [unitType, setUnitType] = useState('Bedsitter');
  const [customUnitType, setCustomUnitType] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [dueDayOfMonth, setDueDayOfMonth] = useState(1);
  // DIRECT REQUEST: whether this unit requires a deposit from a future
  // tenant, set at creation time (also editable later from the unit's
  // own page) - shown on the public vacant-unit listing.
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [depositAmountExpected, setDepositAmountExpected] = useState('');
  const [unitLimit, setUnitLimit] = useState(null);
  const [currentCount, setCurrentCount] = useState(null);
  const [properties, setProperties] = useState([]);
  // FIX (direct request: "every apartment be solely independent... I
  // need these things to be independent"): this page used to always
  // start from an empty/"Unassigned" selection and check the
  // landlord-WIDE unit count/limit regardless of which property the
  // landlord actually had open. That meant a property with its own
  // 10-unit subscription could get blocked by a completely different
  // property's units, because the check never knew which property was
  // actually in view. Defaulting to (and re-checking against) whichever
  // property is currently active in the dashboard switcher - the same
  // sessionStorage key the dashboard itself uses - keeps this page
  // consistent with whatever the landlord was just looking at.
  const [propertyId, setPropertyId] = useState(() => sessionStorage.getItem('rentapay_active_property_id') || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Same bulk-duplicate feature as the setup wizard's unit step
  // (direct request) - added here too since landlords/managers/
  // caretakers add units one-at-a-time through THIS page just as
  // often as through initial setup.
  const [duplicateCount, setDuplicateCount] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    Promise.all([api.getSubscriptionStatus(token, propertyId || undefined), api.listUnits(token, propertyId || undefined), api.listProperties(token)])
      .then(([sub, unitsRes, propsRes]) => {
        setUnitLimit(sub.unit_limit);
        setCurrentCount((unitsRes.units || []).length);
        setProperties(propsRes.properties || []);
      })
      .catch((err) => setError(err.message));
  }, [token, navigate, propertyId]);

  const atLimit = unitLimit != null && currentCount != null && currentCount >= unitLimit;

  async function handleSubmit(e) {
    e.preventDefault();
    if (atLimit) return;
    if (unitType === 'Custom' && !customUnitType.trim()) {
      setError('Enter a custom unit type, or pick one of the preset types.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await api.createUnit(
        {
          unitName,
          unitType: unitType === 'Custom' ? customUnitType.trim() : unitType,
          rentAmount: Number(rentAmount),
          dueDayOfMonth: Number(dueDayOfMonth),
          propertyId: propertyId || undefined,
          requiresDeposit,
          depositAmountExpected: requiresDeposit && depositAmountExpected ? Number(depositAmountExpected) : undefined,
        },
        token
      );
      navigate(`/units/${res.unit.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create unit.');
    } finally {
      setSubmitting(false);
    }
  }

  // "Duplicate" - same idea as the setup wizard: fill in one unit's
  // details, generate several more numbered onward from its name.
  //
  // DIRECT REQUEST FIX ("when he taps duplicate it is slow as
  // hell... it should be as fast as during the sign up one"): this
  // used to call api.createUnit sequentially, one full round trip per
  // unit - the comment that used to sit here explained that as a
  // deliberate trade-off against a subscription-quota race, exactly
  // the same problem the setup wizard hit and already solved by
  // switching to POST /units/bulk (see RegisterFlow.jsx's
  // doHandleUnitsSubmit - "should only take a few seconds... should
  // add the units not just reproduce and say failed to add units").
  // That endpoint does the same race-free work (existing names, next
  // payment code, subscription limit) but only ONCE for the whole
  // batch in a single insert - this page just never got the same fix
  // applied. Now identical: one request no matter how many units are
  // being duplicated.
  async function handleDuplicateSubmit(e) {
    e.preventDefault();
    if (unitType === 'Custom' && !customUnitType.trim()) {
      setError('Enter a custom unit type, or pick one of the preset types.');
      return;
    }
    const count = Number(duplicateCount);
    if (!Number.isInteger(count) || count < 1) {
      setError('Enter how many units to create (a whole number of 1 or more).');
      return;
    }

    const match = unitName.match(/^(.*?)(\d+)$/);
    const prefix = match ? match[1] : `${unitName} `;
    const startNum = match ? Number(match[2]) : 1;
    const padLength = match ? match[2].length : 0;
    const resolvedUnitType = unitType === 'Custom' ? customUnitType.trim() : unitType;

    const namesToCreate = Array.from({ length: count }, (_, i) => `${prefix}${String(startNum + i).padStart(padLength, '0')}`);

    setError('');
    setSubmitting(true);
    try {
      const res = await api.createUnitsBulk(
        {
          units: namesToCreate.map((name) => ({ unitName: name, unitType: resolvedUnitType, rentAmount: Number(rentAmount) })),
          propertyId: propertyId || undefined,
          dueDayOfMonth: Number(dueDayOfMonth),
          requiresDeposit,
          depositAmountExpected: requiresDeposit && depositAmountExpected ? Number(depositAmountExpected) : undefined,
        },
        token
      );
      if (res.units?.length) {
        navigate('/dashboard');
        return;
      }
      // Nothing got created (e.g. every generated name collided with
      // an existing unit) - `skipped` explains why, per-name.
      const reasons = (res.skipped || []).map((s) => `${s.unitName}: ${s.reason}`).join(' ');
      setError(reasons || 'No units were created - the names may already exist.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create units.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="add-tenant-page">
      <Link to="/dashboard" className="add-tenant-back">← Back to dashboard</Link>
      <h1>Add a new unit</h1>
      {unitLimit != null && (
        <p className="add-tenant-subtitle">{currentCount} of {unitLimit} units used on your current subscription.</p>
      )}

      {error && <div className="add-tenant-error">{error}</div>}

      {atLimit ? (
        <div className="add-tenant-error">
          You've reached your subscription's unit limit ({unitLimit}). Increase your unit count on your subscription to add more.
          <div className="u-mt-4">
            <Button variant="primary" onClick={() => navigate('/subscription')}>Manage subscription</Button>
          </div>
        </div>
      ) : (
        <form className="add-tenant-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-field__label">Unit name *</label>
            <input required value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="C1" />
          </div>
          <div className="form-field">
            <label className="form-field__label">Type</label>
            <select value={unitType} onChange={(e) => setUnitType(e.target.value)}>
              <option>Bedsitter</option>
              <option>1 Bedroom</option>
              <option>2 Bedroom</option>
              <option>3 Bedroom</option>
              <option value="Custom">Custom…</option>
            </select>
          </div>
          {unitType === 'Custom' && (
            <div className="form-field">
              <label className="form-field__label">Custom type *</label>
              <input required value={customUnitType} onChange={(e) => setCustomUnitType(e.target.value)} placeholder="e.g. Studio, Servant Quarter, Shop" />
            </div>
          )}
          <div className="form-field">
            <label className="form-field__label">Monthly rent (KES) *</label>
            <input type="number" required value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Due day of month</label>
            <input type="number" min="1" max="28" value={dueDayOfMonth} onChange={(e) => setDueDayOfMonth(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="u-checkbox-row">
              <input type="checkbox" checked={requiresDeposit} onChange={(e) => setRequiresDeposit(e.target.checked)} />
              This unit requires a deposit from a future tenant
            </label>
            {requiresDeposit && (
              <input
                type="number"
                min="0"
                placeholder="Expected deposit amount (optional, KES)"
                value={depositAmountExpected}
                onChange={(e) => setDepositAmountExpected(e.target.value)}
                className="u-mt-2"
              />
            )}
          </div>
          {properties.length > 1 && (
            <div className="form-field">
              <label className="form-field__label">Property</label>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">Unassigned</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.location ? ` — ${p.location}` : ''}</option>
                ))}
              </select>
            </div>
          )}
          <Button type="submit" variant="primary" loading={submitting}>Create unit</Button>

          <div className="form-field u-divider-top-dashed">
            <label className="form-field__label">
              Or create several units like this one at once
            </label>
            <CommentReveal
              label="How does this work?"
              text={`Uses the name, type, and rent typed above (e.g. "${unitName || '…'}"), and numbers the rest onward automatically.`}
            />
            <div className="u-flex-row u-flex-row--end">
              <input
                type="number"
                min="1"
                value={duplicateCount}
                onChange={(e) => setDuplicateCount(e.target.value)}
                placeholder="How many?"
                className="u-max-140"
              />
              <Button type="button" variant="ghost" loading={submitting} onClick={handleDuplicateSubmit}>
                Duplicate &amp; create
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
