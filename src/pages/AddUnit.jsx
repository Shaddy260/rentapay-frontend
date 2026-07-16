import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, ApiError } from '../api/client.js';
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
  const [unitLimit, setUnitLimit] = useState(null);
  const [currentCount, setCurrentCount] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    Promise.all([api.getSubscriptionStatus(token), api.listUnits(token), api.listProperties(token)])
      .then(([sub, unitsRes, propsRes]) => {
        setUnitLimit(sub.unit_limit);
        setCurrentCount((unitsRes.units || []).length);
        setProperties(propsRes.properties || []);
      })
      .catch((err) => setError(err.message));
  }, [token, navigate]);

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
        { unitName, unitType: unitType === 'Custom' ? customUnitType.trim() : unitType, rentAmount: Number(rentAmount), dueDayOfMonth: Number(dueDayOfMonth), propertyId: propertyId || undefined },
        token
      );
      navigate(`/units/${res.unit.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create unit.');
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
          <div style={{ marginTop: '1rem' }}>
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
        </form>
      )}
    </div>
  );
}
