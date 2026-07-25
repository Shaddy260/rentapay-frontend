import { useState } from 'react';
import { api } from '../api/client.js';
import Button from './Button.jsx';
import './BulkRentChangeModal.css';

// Direct request: "bulk actions are largely absent - a landlord with
// many units raising rent 10% across the board currently has to
// repeat the same action once per unit." Same underlying logic and
// notifications as the single-unit rent change - this just applies it
// to every unit in a property (or every unit the caller can manage)
// in one submit instead of one-at-a-time.
export default function BulkRentChangeModal({ token, properties, onClose, onDone }) {
  const [propertyId, setPropertyId] = useState(properties?.[0]?.id || '');
  const [mode, setMode] = useState('percent'); // 'percent' | 'flat'
  const [percent, setPercent] = useState('');
  const [flatAmount, setFlatAmount] = useState('');
  const [effectiveOption, setEffectiveOption] = useState('immediately');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.bulkUpdateRent(
        {
          propertyId: propertyId || undefined,
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
      <div className="modal-content bulk-rent-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Bulk rent change</h2>
        {result ? (
          <>
            <p className="bulk-rent-modal__result">{result.message}</p>
            <Button variant="primary" onClick={() => { onDone(); onClose(); }}>Done</Button>
          </>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="api-error-banner" role="alert">{error}</div>}
            <label className="form-field__label">Apply to</label>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="">All properties I manage</option>
            </select>

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
