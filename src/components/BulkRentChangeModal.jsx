import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import Button from './Button.jsx';
import './BulkRentChangeModal.css';

// Direct request: "bulk actions are largely absent - a landlord with
// many units raising rent 10% across the board currently has to
// repeat the same action once per unit." Same underlying logic and
// notifications as the single-unit rent change - this just applies it
// to every unit in a property (or a hand-picked subset of units) in
// one submit instead of one-at-a-time.
//
// FIX (direct request): the caller (landlord/manager, never a
// caretaker - the route already blocks caretakers server-side) now
// explicitly chooses "all units" vs "select specific units" instead
// of only being able to target a whole property. The specific-unit
// picker is a checkbox list, same look-and-feel as the tenant
// onboarding request list, just multi-select.
//
// FIX (direct request: "every apartment should be independent...
// nothing should be shared across - like when applying a setting it
// asks one to choose the apartment, no, it should be individual"):
// this used to offer a "Property" dropdown with an "All properties I
// manage" option, so a bulk rent change could silently span every
// property the landlord runs. It's now hard-scoped to whichever
// property is currently open in the dashboard - no cross-property
// option at all.
export default function BulkRentChangeModal({ token, propertyId, propertyName, onClose, onDone }) {
  const [scope, setScope] = useState('all'); // 'all' | 'select'
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [selectedUnitIds, setSelectedUnitIds] = useState([]);
  const [mode, setMode] = useState('percent'); // 'percent' | 'flat'
  const [percent, setPercent] = useState('');
  const [flatAmount, setFlatAmount] = useState('');
  const [effectiveOption, setEffectiveOption] = useState('immediately');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (scope !== 'select') return;
    setUnitsLoading(true);
    setSelectedUnitIds([]);
    api
      .listUnits(token, propertyId || undefined)
      .then((res) => setUnits(res.units || []))
      .catch((err) => setError(err.message))
      .finally(() => setUnitsLoading(false));
  }, [scope, propertyId, token]);

  function toggleUnit(unitId) {
    setSelectedUnitIds((prev) => (prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]));
  }

  function toggleAllUnits() {
    setSelectedUnitIds((prev) => (prev.length === units.length ? [] : units.map((u) => u.id)));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (scope === 'select' && selectedUnitIds.length === 0) {
      setError('Select at least one unit.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.bulkUpdateRent(
        {
          propertyId: scope === 'all' ? propertyId : undefined,
          unitIds: scope === 'select' ? selectedUnitIds : undefined,
          percentIncrease: mode === 'percent' ? Number(percent) : undefined,
          flatNewAmount: mode === 'flat' ? Number(flatAmount) : undefined,
          effectiveOption,
          effectiveDate: effectiveOption === 'custom' ? effectiveDate : undefined,
        },
        token
      );
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-shell bulk-rent-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Bulk rent change</h2>
        {result ? (
          <>
            <p className="bulk-rent-modal__result">{result.message}</p>
            <Button variant="primary" onClick={() => { onDone(); onClose(); }}>Done</Button>
          </>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="api-error-banner" role="alert">{error}</div>}

            <p className="bulk-rent-modal__hint">Applies to {propertyName ? <strong>{propertyName}</strong> : 'this property'} only. Switch properties from the dashboard first if you meant a different one.</p>

            <label className="form-field__label">Apply to</label>
            <div className="bulk-rent-modal__mode-toggle">
              <button type="button" className={scope === 'all' ? 'is-active' : ''} onClick={() => setScope('all')}>All units</button>
              <button type="button" className={scope === 'select' ? 'is-active' : ''} onClick={() => setScope('select')}>Select specific units</button>
            </div>

            {scope === 'select' && (
              <div className="bulk-rent-modal__unit-picker">
                {unitsLoading ? (
                  <p className="bulk-rent-modal__unit-loading">Loading units…</p>
                ) : units.length === 0 ? (
                  <p className="bulk-rent-modal__unit-loading">No units found.</p>
                ) : (
                  <>
                    <button type="button" className="ghost-link bulk-rent-modal__select-all" onClick={toggleAllUnits}>
                      {selectedUnitIds.length === units.length ? 'Unselect all' : 'Select all'}
                    </button>
                    <ul className="bulk-rent-modal__unit-list">
                      {units.map((u) => (
                        <li key={u.id} className="bulk-rent-modal__unit-row">
                          <label>
                            <input
                              type="checkbox"
                              checked={selectedUnitIds.includes(u.id)}
                              onChange={() => toggleUnit(u.id)}
                            />
                            <span className="bulk-rent-modal__unit-name">{u.unit_name}</span>
                            <span className="bulk-rent-modal__unit-meta">KES {Number(u.rent_amount || 0).toLocaleString()}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <p className="bulk-rent-modal__unit-count">{selectedUnitIds.length} of {units.length} selected</p>
                  </>
                )}
              </div>
            )}

            <label className="form-field__label">Change type</label>
            <div className="bulk-rent-modal__mode-toggle">
              <button type="button" className={mode === 'percent' ? 'is-active' : ''} onClick={() => setMode('percent')}>Percentage</button>
              <button type="button" className={mode === 'flat' ? 'is-active' : ''} onClick={() => setMode('flat')}>Flat new amount</button>
            </div>

            {mode === 'percent' ? (
              <>
                <label className="form-field__label">Percent change (e.g. 10 for +10%, -5 for -5%)</label>
                <input type="number" required value={percent} onChange={(e) => setPercent(e.target.value)} />
              </>
            ) : (
              <>
                <label className="form-field__label">New rent amount (KES) - applies to every selected unit</label>
                <input type="number" required min="1" value={flatAmount} onChange={(e) => setFlatAmount(e.target.value)} />
              </>
            )}

            <label className="form-field__label">When</label>
            <select value={effectiveOption} onChange={(e) => setEffectiveOption(e.target.value)}>
              <option value="immediately">Immediately</option>
              <option value="next_month">Start of next month</option>
              <option value="custom">Custom date</option>
            </select>
            {effectiveOption === 'custom' && (
              <input type="date" required value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            )}

            <p className="bulk-rent-modal__hint">Every affected tenant is notified individually, same as a single rent change.</p>
            <div className="modal-actions">
              <button type="button" className="ghost-link" onClick={onClose}>Cancel</button>
              <Button type="submit" variant="primary" loading={busy}>Apply</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
