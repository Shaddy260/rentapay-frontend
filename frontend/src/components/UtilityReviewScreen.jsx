import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';
import './FormField.css';
import './UtilityMetersPanel.css';

/**
 * FEATURE: Utility Sub-Metering, Sections 6-7 - see
 * RentaPay-Utility-Submetering-Spec.pdf. Shows the proposed billing
 * outcome for a submitted reading (one row for an individual meter,
 * one row per occupied unit for a shared meter), lets the submitter
 * override a unit's occupied-days or final amount (mandatory reason,
 * live recalculation), and only actually bills/notifies tenants once
 * "Finalize & send" is tapped. Nothing here touches a tenant's
 * invoice until that final action.
 */
export default function UtilityReviewScreen({ token, readingId, onClose, onFinalized }) {
  const [reading, setReading] = useState(null);
  const [meter, setMeter] = useState(null);
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overridingUnit, setOverridingUnit] = useState(null); // run_unit row being edited
  const [finalizing, setFinalizing] = useState(false);
  const [finalizedMessage, setFinalizedMessage] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api.getUtilityReview(readingId, token)
      .then((res) => {
        setReading(res.reading);
        setMeter(res.meter);
        setRun(res.run);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the review screen.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingId, token]);

  async function handleFinalize() {
    setError('');
    setFinalizing(true);
    try {
      const res = await api.finalizeUtilityRun(run.id, token);
      setFinalizedMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to finalize.');
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) return <section className="statistics-panel"><Skeleton rows={4} /></section>;

  if (finalizedMessage) {
    // THE FIX (direct request: "i finalized and reviewed and
    // submitted to the tenant... but nothing arrived"): when a unit
    // gets skipped (no active tenant matched at that exact moment),
    // finalize still succeeds for the run overall - the skip was only
    // ever mentioned as one line of plain, same-colored text, which
    // reads identically to ordinary success and is easy to skim past.
    // Detecting "0 tenants notified" or "unit(s) skipped" in the
    // message and rendering it as a clear warning, not neutral text,
    // makes it obvious that this specific reading did NOT reach a
    // tenant and still needs a fix (usually: assign an active tenant
    // to that unit, then finalize again).
    const hadSkip = /skipped/i.test(finalizedMessage) || /^Finalized\. 0 tenant/i.test(finalizedMessage);
    return (
      <section className="statistics-panel utility-meters-panel">
        <h2>{hadSkip ? '⚠️ Finalized, but not fully billed' : '✅ Finalized'}</h2>
        <p className={hadSkip ? 'form-error' : 'tenant-portal-hint'} style={hadSkip ? { background: 'rgba(255,193,7,0.12)', borderColor: '#ffc107', color: '#8a6100' } : undefined}>
          {finalizedMessage}
        </p>
        {hadSkip && (
          <p className="tenant-portal-hint">
            The skipped unit's tenant was not billed and got no notification. Make sure that unit has an
            active tenant assigned, then submit and finalize this reading again.
          </p>
        )}
        <Button variant="primary" onClick={onFinalized}>Back to meters</Button>
      </section>
    );
  }

  if (!run) {
    return (
      <section className="statistics-panel utility-meters-panel">
        {error && <p className="modal-error">{error}</p>}
        <button type="button" className="ghost-link" onClick={onClose}>Back</button>
      </section>
    );
  }

  const runUnits = run.utility_billing_run_units || [];
  const totalAmount = runUnits.reduce((sum, u) => sum + Number(u.final_amount), 0);
  const isFinalized = run.status === 'finalized';

  return (
    <section className="statistics-panel utility-meters-panel">
      <div className="tenant-section__header-row">
        <h2>Review - {meter?.label} · {reading?.month_key}</h2>
        <button type="button" className="ghost-link" onClick={onClose}>Back</button>
      </div>

      {reading?.anomaly_flag && (
        <p className="form-error" style={{ background: 'rgba(255,193,7,0.12)', borderColor: '#ffc107', color: '#8a6100' }}>
          ⚠️ {reading.anomaly_reason}
        </p>
      )}

      <p className="tenant-portal-hint">
        Total usage this month: {Number(run.total_usage).toLocaleString()} units.
        <InfoTip label="About this screen" text="This is a working draft. Nothing is sent to any tenant until you finalize below - override any unit's occupied-days or amount as many times as you need first." />
      </p>

      {error && <p className="modal-error">{error}</p>}

      <div className="payments-table-wrap">
        <table className="payments-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Occupied days</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {runUnits.map((u) => (
              <tr key={u.id}>
                <td>{u.units?.unit_name || u.unit_id}</td>
                <td>
                  {u.occupied_days}
                  {u.occupied_days_overridden && <span title={u.occupied_days_override_reason} style={{ marginLeft: 6 }}>✏️</span>}
                </td>
                <td>
                  KES {Number(u.final_amount).toLocaleString()}
                  {u.amount_overridden && <span title={u.amount_override_reason} style={{ marginLeft: 6 }}>✏️</span>}
                </td>
                <td>
                  {!isFinalized && (
                    <button type="button" className="ghost-link" onClick={() => setOverridingUnit(u)}>Override</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ fontWeight: 700 }}>Total</td>
              <td style={{ fontWeight: 700 }}>KES {totalAmount.toLocaleString()}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!isFinalized && (
        <div className="confirm-dialog__actions" style={{ marginTop: 16 }}>
          <Button variant="primary" loading={finalizing} onClick={handleFinalize}>
            Finalize &amp; send to tenant{runUnits.length === 1 ? '' : 's'}
          </Button>
        </div>
      )}

      {overridingUnit && (
        <OverrideModal
          token={token}
          runId={run.id}
          runUnit={overridingUnit}
          isShared={meter?.is_shared}
          onClose={() => setOverridingUnit(null)}
          onApplied={(updatedRun) => {
            setRun(updatedRun);
            setOverridingUnit(null);
          }}
        />
      )}
    </section>
  );
}

// Section 6 - override occupied-days or final amount for one unit in
// the run. Mandatory reason. Occupied-days changes trigger a live
// recalculation server-side of every row in the run; the response's
// full run replaces local state so every row reflects the new split.
function OverrideModal({ token, runId, runUnit, isShared, onClose, onApplied }) {
  const [field, setField] = useState(isShared ? 'occupiedDays' : 'finalAmount');
  const [occupiedDays, setOccupiedDays] = useState(runUnit.occupied_days);
  const [finalAmount, setFinalAmount] = useState(runUnit.final_amount);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setError('');
    if (!reason.trim()) return setError('A reason is required for any override.');
    const payload = { reason: reason.trim() };
    if (field === 'occupiedDays') {
      if (occupiedDays === '' || Number.isNaN(Number(occupiedDays)) || Number(occupiedDays) < 0) return setError('Enter a valid number of days.');
      payload.occupiedDays = Number(occupiedDays);
    } else {
      if (finalAmount === '' || Number.isNaN(Number(finalAmount)) || Number(finalAmount) < 0) return setError('Enter a valid amount.');
      payload.finalAmount = Number(finalAmount);
    }

    setSaving(true);
    try {
      const res = await api.overrideUtilityRunUnit(runId, runUnit.id, payload, token);
      onApplied(res.run);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to apply override.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
        <h2>Override - {runUnit.units?.unit_name || 'Unit'}</h2>

        <div className="form-field">
          <label className="form-field__label">What are you overriding?</label>
          <select value={field} onChange={(e) => setField(e.target.value)} disabled={!isShared}>
            {isShared && <option value="occupiedDays">Occupied days (recalculates every unit's share)</option>}
            <option value="finalAmount">Final amount for this unit only</option>
          </select>
        </div>

        {field === 'occupiedDays' ? (
          <div className="form-field">
            <label className="form-field__label">Occupied days</label>
            <input type="number" min="0" value={occupiedDays} onChange={(e) => setOccupiedDays(e.target.value)} />
          </div>
        ) : (
          <div className="form-field">
            <label className="form-field__label">Final amount (KES)</label>
            <input type="number" min="0" step="0.01" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} />
          </div>
        )}

        <div className="form-field">
          <label className="form-field__label">Reason (required)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Tenant's actual move-in date differs from the record on file." />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="confirm-dialog__actions">
          <Button variant="primary" loading={saving} onClick={handleSave}>Apply override</Button>
          <button type="button" className="ghost-link" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
