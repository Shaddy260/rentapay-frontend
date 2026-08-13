import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import Button from './Button.jsx';
import './BulkRentChangeModal.css';
import TapToReveal from './TapToReveal.jsx';

// DIRECT REQUEST: setting the rent due date "one by one" per unit is
// hectic for a landlord/manager with hundreds of units. Mirrors
// BulkRentChangeModal's approach exactly, including the "all units"
// vs "select specific units" choice - reuses the modal's own CSS
// since the layout is identical.
export default function BulkDueDateChangeModal({ token, properties, onClose, onDone }) {
  const [propertyId, setPropertyId] = useState(properties?.[0]?.id || '');
  const [scope, setScope] = useState('all'); // 'all' | 'select'
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [selectedUnitIds, setSelectedUnitIds] = useState([]);
  const [dueDay, setDueDay] = useState('1');
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
      const res = await api.bulkUpdateDueDate(
        {
          propertyId: scope === 'all' ? (propertyId || undefined) : undefined,
          unitIds: scope === 'select' ? selectedUnitIds : undefined,
          newDueDayOfMonth: Number(dueDay),
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
        <h2>Bulk due date change</h2>
        {result ? (
          <>
            <p className="bulk-rent-modal__result">{result.message}</p>
            <Button variant="primary" onClick={() => { onDone(); onClose(); }}>Done</Button>
          </>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="api-error-banner" role="alert">{error}</div>}

            <label className="form-field__label">Property</label>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="">All properties I manage</option>
            </select>

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
                            <span className="bulk-rent-modal__unit-meta">Due day {u.due_day_of_month ?? '—'}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <p className="bulk-rent-modal__unit-count">{selectedUnitIds.length} of {units.length} selected</p>
                  </>
                )}
              </div>
            )}

            <label className="form-field__label">Default due date (day of the month, 1-28)</label>
            <input
              type="number"
              required
              min="1"
              max="28"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            />

            <TapToReveal className="bulk-rent-modal__hint">
              Applies to every selected unit that isn&rsquo;t already set to this day. Every affected tenant is notified individually, same as a single due-date change.
            </TapToReveal>
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
