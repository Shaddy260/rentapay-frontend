import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import './ApplyPhotosToUnitsModal.css';
import InfoTip from './InfoTip.jsx';

// FEATURE (direct request: "most units look similar... a way for him
// to choose whether it should be similar to other units... a popup
// shows asking him to choose units, either all or one by one"). Only
// offers units in the SAME property as the source unit - see the
// matching comment in upload.controller.js's applyUnitPhotosToOthers
// for why that boundary is deliberate, not a limitation to fix later.
export default function ApplyPhotosToUnitsModal({ unitId, propertyId, token, onClose, onApplied }) {
  const [siblings, setSiblings] = useState(null);
  const [mode, setMode] = useState('all'); // 'all' | 'pick'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listUnits(token, propertyId)
      .then((res) => setSiblings((res.units || []).filter((u) => u.id !== unitId)))
      .catch(() => setSiblings([]));
  }, [token, propertyId, unitId]);

  function toggle(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleApply() {
    setError('');
    setSubmitting(true);
    try {
      const res = await api.applyUnitPhotosToOthers(
        unitId,
        mode === 'all' ? { applyToAll: true } : { targetUnitIds: Array.from(selectedIds) },
        token
      );
      onApplied(res.appliedCount);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to apply photos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="apply-photos-modal__backdrop" onClick={onClose}>
      <div className="apply-photos-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Use these photos for other units too?</h3>
        <InfoTip text={<>
          Only units in this same property are shown - photos don't carry across properties.
        </>} />

        {siblings === null && <p>Loading units…</p>}

        {siblings && siblings.length === 0 && (
          <p className="apply-photos-modal__hint">There are no other units in this property yet.</p>
        )}

        {siblings && siblings.length > 0 && (
          <>
            <div className="apply-photos-modal__mode">
              <label className="u-checkbox-row">
                <input type="radio" name="apply-mode" checked={mode === 'all'} onChange={() => setMode('all')} />
                All {siblings.length} other unit{siblings.length === 1 ? '' : 's'} in this property
              </label>
              <label className="u-checkbox-row">
                <input type="radio" name="apply-mode" checked={mode === 'pick'} onChange={() => setMode('pick')} />
                Choose units one by one
              </label>
            </div>

            {mode === 'pick' && (
              <div className="apply-photos-modal__list">
                {siblings.map((u) => (
                  <label key={u.id} className="u-checkbox-row apply-photos-modal__list-item">
                    <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggle(u.id)} />
                    {u.unit_name} <span className="apply-photos-modal__list-type">({u.unit_type})</span>
                  </label>
                ))}
              </div>
            )}

            {error && <p className="modal-error">{error}</p>}

            <div className="apply-photos-modal__actions">
              <Button variant="ghost" onClick={onClose} disabled={submitting}>Skip</Button>
              <Button
                variant="primary"
                loading={submitting}
                disabled={mode === 'pick' && selectedIds.size === 0}
                onClick={handleApply}
              >
                Apply photos
              </Button>
            </div>
          </>
        )}

        {siblings && siblings.length === 0 && (
          <div className="apply-photos-modal__actions">
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        )}
      </div>
    </div>
  );
}
