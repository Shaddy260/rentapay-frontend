import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';
import UtilityReviewScreen from './UtilityReviewScreen.jsx';
import RecordUtilityPaymentModal from './RecordUtilityPaymentModal.jsx';
import { useToast } from './Toast.jsx';
import './FormField.css';
import './UtilityMetersPanel.css';

/**
 * FEATURE: Utility Sub-Metering - see RentaPay-Utility-Submetering-Spec.pdf.
 * Sections 1-4 live here (meter setup, reading submission with photo
 * proof, baseline handling, correction history). Section 5-7 (the
 * proportional split, review + overrides, and final submission) live
 * in UtilityReviewScreen, opened from here once a non-baseline
 * reading has been submitted.
 *
 * Available to caretaker, manager, and landlord alike, per spec.
 */
export default function UtilityMetersPanel({ token, propertyId, propertyName }) {
  const toast = useToast();
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [readingMeter, setReadingMeter] = useState(null); // meter object -> opens "submit reading" modal
  const [historyMeter, setHistoryMeter] = useState(null); // meter object -> opens reading history/corrections
  const [editingMeter, setEditingMeter] = useState(null); // meter object -> opens edit modal
  const [deletingMeter, setDeletingMeter] = useState(null); // meter object -> opens the row-level "Delete this meter?" confirm
  const [showBulkReadingsModal, setShowBulkReadingsModal] = useState(false);
  const [reviewReadingId, setReviewReadingId] = useState(null); // opens UtilityReviewScreen
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [bothUnitMeters, setBothUnitMeters] = useState(null); // meters[] passed to BulkReadingsModal, pre-filtered to one unit's water+electricity pair
  // DIRECT REQUEST: "when a landlord submits it nothing arrives to the
  // tenant dashboard." Submitting a reading only creates a draft -
  // nothing bills or notifies a tenant until Review -> Finalize is
  // completed (see finalizeRun on the backend). This list surfaces
  // anything still sitting in that state, front and center, so it
  // can't be silently forgotten.
  const [pendingReviews, setPendingReviews] = useState([]);

  function loadPendingReviews() {
    api.listPendingUtilityReviews(token, propertyId)
      .then((res) => setPendingReviews(res.pending || []))
      .catch(() => {}); // non-critical - the banner just won't show if this fails
  }

  function load() {
    setLoading(true);
    setError('');
    api
      .listUtilityMeters(token, propertyId)
      .then((res) => setMeters(res.meters || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load meters.'))
      .finally(() => setLoading(false));
    loadPendingReviews();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, propertyId]);

  if (reviewReadingId) {
    return (
      <UtilityReviewScreen
        token={token}
        readingId={reviewReadingId}
        onClose={() => setReviewReadingId(null)}
        onFinalized={() => {
          setReviewReadingId(null);
          load();
        }}
      />
    );
  }

  if (loading && meters.length === 0) return <section className="statistics-panel"><Skeleton rows={4} /></section>;

  // THE FIX: split the flat meter list into water/electricity groups
  // for the two-table layout, and build a unitId -> [waterMeter,
  // electricityMeter] map for any unit billed on both, so each row
  // can offer its own "submit both" shortcut inline.
  const waterMeters = meters.filter((m) => m.utility_type === 'water');
  const electricityMeters = meters.filter((m) => m.utility_type === 'electricity');

  // DIRECT REQUEST (screenshot): a unit billed for both utilities used
  // to appear TWICE, two different ways on the same screen - once
  // merged into a shortcut list above the tables, then again split
  // apart in the water/electricity tables below. Same unit, two
  // contradictory representations right next to each other - hence
  // the confusion. Fixed by keeping only ONE representation: each
  // utility still gets its own table (a real, earlier direct request
  // - "arrange them in two tables to avoid confusion" - and still the
  // right call for scanning a long meter list by type), but a unit
  // that has both meters now shows a small "+ Submit both together"
  // link right on its row in each table, instead of a separate
  // section duplicating it.
  const bothMetersByMeterId = (() => {
    const byUnit = {}; // unitId -> { types: Set, meters: [] }
    for (const m of meters) {
      for (const link of m.utility_meter_units || []) {
        const unitId = link.unit_id || link.units?.id;
        if (!unitId) continue;
        if (!byUnit[unitId]) byUnit[unitId] = { types: new Set(), meters: [] };
        byUnit[unitId].types.add(m.utility_type);
        if (!byUnit[unitId].meters.some((mm) => mm.id === m.id)) byUnit[unitId].meters.push(m);
      }
    }
    const map = {};
    for (const { types, meters: unitMeters } of Object.values(byUnit)) {
      if (types.has('water') && types.has('electricity')) {
        for (const m of unitMeters) map[m.id] = unitMeters;
      }
    }
    return map;
  })();

  return (
    <section className="statistics-panel utility-meters-panel">
      <div className="tenant-section__header-row">
        <h2>
          Utility Meters
          <InfoTip
            label="About utility meters"
            text="Submit monthly water/electricity readings, split shared meters automatically across occupied units, and review before anything is billed."
          />
        </h2>
        <div className="u-flex-row">
          {meters.length > 0 && (
            <button type="button" className="ghost-link" onClick={() => setShowBulkReadingsModal(true)}>Add multiple readings</button>
          )}
          <button type="button" className="ghost-link" onClick={() => setShowRecordPaymentModal(true)}>Record a bulk payment</button>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>+ Add meter(s)</Button>
        </div>
      </div>

      {showRecordPaymentModal && (
        <RecordUtilityPaymentModal
          token={token}
          propertyId={propertyId}
          propertyName={propertyName}
          onClose={() => setShowRecordPaymentModal(false)}
          onRecorded={load}
        />
      )}

      {error && <p className="modal-error">{error}</p>}

      {/* DIRECT REQUEST: this is the fix for "landlord submits it,
          nothing arrives to the tenant" - a submitted reading isn't
          billed or sent to anyone until it's reviewed and finalized.
          This can no longer go unnoticed: it's the first thing shown,
          above the meter list, with a Review button right on each
          row - no need to dig through History to find it. */}
      {pendingReviews.length > 0 && (
        <div className="utility-pending-review-banner">
          <div className="utility-pending-review-banner__header">
            ⏳ {pendingReviews.length} reading{pendingReviews.length === 1 ? '' : 's'} submitted but not yet billed
            <InfoTip text="Submitting a reading is the first step only - nothing is charged or sent to a tenant until you review and finalize it here. That's intentional, so an unusual reading can be caught before anyone's billed." />
          </div>
          <div className="utility-pending-review-banner__list">
            {pendingReviews.map((r) => (
              <div key={r.readingId} className="utility-pending-review-banner__row">
                <span>
                  {r.utilityType === 'water' ? '💧' : '⚡'} {r.meterLabel} - {r.monthKey}
                  {r.usage != null && <> · {Number(r.usage).toLocaleString()} units</>}
                  {r.anomalyFlag && <span title={r.anomalyReason} style={{ marginLeft: 6 }}>⚠️</span>}
                </span>
                <Button variant="primary" onClick={() => setReviewReadingId(r.readingId)}>Review & bill</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {meters.length === 0 ? (
        <p className="tenant-portal-hint">No meters set up yet. Add your first meter to get started.</p>
      ) : (
        <div className="utility-meter-columns">
          {waterMeters.length > 0 && (
            <div className="utility-meter-column">
              <h3 className="utility-meter-column__title">💧 Water meters</h3>
              <div className="utility-meter-list">
                {waterMeters.map((m) => (
                  <MeterRow
                    key={m.id}
                    meter={m}
                    onSubmit={() => setReadingMeter(m)}
                    onHistory={() => setHistoryMeter(m)}
                    onEdit={() => setEditingMeter(m)}
                    onDelete={() => setDeletingMeter(m)}
                    bothMeters={bothMetersByMeterId[m.id]}
                    onSubmitBoth={() => setBothUnitMeters(bothMetersByMeterId[m.id])}
                  />
                ))}
              </div>
            </div>
          )}
          {electricityMeters.length > 0 && (
            <div className="utility-meter-column">
              <h3 className="utility-meter-column__title">⚡ Electricity meters</h3>
              <div className="utility-meter-list">
                {electricityMeters.map((m) => (
                  <MeterRow
                    key={m.id}
                    meter={m}
                    onSubmit={() => setReadingMeter(m)}
                    onHistory={() => setHistoryMeter(m)}
                    onEdit={() => setEditingMeter(m)}
                    onDelete={() => setDeletingMeter(m)}
                    bothMeters={bothMetersByMeterId[m.id]}
                    onSubmitBoth={() => setBothUnitMeters(bothMetersByMeterId[m.id])}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateMeterModal
          token={token}
          propertyId={propertyId}
          propertyName={propertyName}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            load();
          }}
        />
      )}

      {editingMeter && (
        <EditMeterModal
          token={token}
          meter={editingMeter}
          onClose={() => setEditingMeter(null)}
          onSaved={() => {
            setEditingMeter(null);
            load();
          }}
        />
      )}

      {showBulkReadingsModal && (
        <BulkReadingsModal
          token={token}
          meters={meters}
          onClose={() => setShowBulkReadingsModal(false)}
          onSubmitted={() => {
            setShowBulkReadingsModal(false);
            load();
          }}
          onOpenReview={(readingId) => {
            setShowBulkReadingsModal(false);
            setReviewReadingId(readingId);
          }}
        />
      )}

      {bothUnitMeters && (
        <BulkReadingsModal
          token={token}
          meters={bothUnitMeters}
          onClose={() => setBothUnitMeters(null)}
          onSubmitted={() => {
            setBothUnitMeters(null);
            load();
          }}
          onOpenReview={(readingId) => {
            setBothUnitMeters(null);
            setReviewReadingId(readingId);
          }}
        />
      )}

      {readingMeter && (
        <SubmitReadingModal
          token={token}
          meter={readingMeter}
          onClose={() => setReadingMeter(null)}
          onSubmitted={(reading, isBaseline) => {
            setReadingMeter(null);
            if (!isBaseline) setReviewReadingId(reading.id);
          }}
        />
      )}

      {historyMeter && (
        <MeterHistoryModal
          token={token}
          meter={historyMeter}
          onClose={() => setHistoryMeter(null)}
          onOpenReview={(readingId) => {
            setHistoryMeter(null);
            setReviewReadingId(readingId);
          }}
        />
      )}

      {deletingMeter && (
        <DeleteMeterConfirm
          token={token}
          meter={deletingMeter}
          onClose={() => setDeletingMeter(null)}
          onDone={(message) => {
            setDeletingMeter(null);
            toast.success(message);
            load();
          }}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// DIRECT REQUEST: "there should be a way for landlords or managers to
// delete a meter" - one click from the row (see MeterRow), one plain
// question, one button. No dead end: a meter with reading history is
// archived server-side (see deleteMeter in the backend controller)
// rather than blocked, so this always succeeds either way - the only
// difference is which confirmation message comes back.
// ---------------------------------------------------------------------
function DeleteMeterConfirm({ token, meter, onClose, onDone }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setDeleting(true);
    setError('');
    try {
      const res = await api.deleteUtilityMeter(meter.id, token);
      onDone(res.message || 'Meter deleted.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete meter.');
      setDeleting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !deleting && onClose()}>
      <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
        <h2>Delete "{meter.label}"?</h2>
        <p className="tenant-portal-hint">
          If this meter has no readings yet, it's removed for good. If it already has readings on file,
          it's archived instead - taken off your active list, with its past readings kept intact for any
          invoices already sent.
        </p>
        {error && <p className="form-error">{error}</p>}
        <div className="confirm-dialog__actions">
          <Button variant="danger" loading={deleting} onClick={handleConfirm}>Yes, delete</Button>
          <button type="button" className="ghost-link" onClick={onClose} disabled={deleting}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// A compact row for the two-table (water / electricity) layout - the
// utility-type badge is no longer repeated per row since the whole
// table it sits in already says which type it is.
// ---------------------------------------------------------------------
function MeterRow({ meter, onSubmit, onHistory, onEdit, onDelete, bothMeters, onSubmitBoth }) {
  // DIRECT REQUEST: "when a unit has no tenant... the meter just gets
  // greyed and nothing should be keyed in." has_active_tenant comes
  // from listMeters (see the backend controller) - computed once,
  // there, instead of every row re-deriving it from a full tenant
  // list it doesn't have anyway.
  const vacant = meter.has_active_tenant === false;
  return (
    <div className={`utility-meter-card utility-meter-card--row${vacant ? ' utility-meter-card--vacant' : ''}`}>
      <div className="utility-meter-card__main">
        <div className="utility-meter-card__title">
          {meter.label}
          {meter.is_shared && <span className="utility-meter-badge utility-meter-badge--shared">Shared</span>}
        </div>
        <div className="utility-meter-card__units">
          {(meter.utility_meter_units || []).map((u) => u.units?.unit_name).filter(Boolean).join(', ') || '-'}
        </div>
        <div className="utility-meter-card__rate">Rate: KES {Number(meter.rate_per_unit).toLocaleString()} / unit</div>
        {vacant && (
          <div className="utility-meter-card__vacant-note">
            No active tenant on this unit right now - nothing can be billed until one is assigned.
          </div>
        )}
        {/* Same "unit billed on both utilities" case, but shown once,
            right on the meter it's about, instead of duplicated in a
            separate section above (see the comment where
            bothMetersByMeterId is built). */}
        {!vacant && bothMeters && (
          <button type="button" className="ghost-link utility-meter-card__both" onClick={onSubmitBoth}>
            + This unit also has {meter.utility_type === 'water' ? 'an electricity' : 'a water'} meter - submit both together
          </button>
        )}
      </div>
      <div className="utility-meter-card__actions">
        <Button variant="primary" onClick={onSubmit} disabled={vacant} title={vacant ? 'No active tenant on this unit' : undefined}>
          Submit reading
        </Button>
        <button type="button" className="ghost-link" onClick={onHistory}>History</button>
        <button type="button" className="ghost-link" onClick={onEdit}>Edit</button>
        {/* DIRECT REQUEST: "there should be a way for landlords or
            managers to delete a meter" - previously this only existed
            as a small link at the bottom of the Edit modal, easy to
            never find. Right on the row now, same place as every
            other action for this meter. */}
        <button type="button" className="ghost-link utility-meter-card__delete" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
function CreateMeterModal({ token, propertyId, propertyName, onClose, onCreated }) {
  const [units, setUnits] = useState([]);
  const [label, setLabel] = useState('');
  const [utilityType, setUtilityType] = useState('water');
  const [isShared, setIsShared] = useState(false);
  const [bulkMode, setBulkMode] = useState(false); // one individual meter per selected unit
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [bulkResult, setBulkResult] = useState(null); // { createdCount, skipped }

  // No property picker here (direct request: a landlord/manager with
  // multiple properties adds a meter to whichever property they're
  // currently viewing on the dashboard - that property is passed down
  // as a prop, not chosen in this form). Each property manages its own
  // meters from its own dashboard.
  useEffect(() => {
    if (!propertyId) {
      setUnits([]);
      return;
    }
    setLoadingUnits(true);
    setSelectedUnitIds([]);
    api.listUnits(token, propertyId).then((res) => setUnits(res.units || [])).catch((err) => {
      // Non-fatal: the unit picker just stays empty, but that looks
      // identical to "this property genuinely has no units" - logged
      // so a broken fetch here isn't mistaken for that.
      console.warn('[UtilityMetersPanel] failed to load units:', err);
    }).finally(() => setLoadingUnits(false));
  }, [propertyId, token]);

  function toggleUnit(unitId) {
    if (isShared || bulkMode) {
      setSelectedUnitIds((prev) => (prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]));
    } else {
      setSelectedUnitIds([unitId]);
    }
  }

  function toggleBulkMode(checked) {
    setBulkMode(checked);
    if (checked) setIsShared(false); // bulk mode always creates individual, non-shared meters
    setSelectedUnitIds([]);
  }

  function toggleShared(checked) {
    setIsShared(checked);
    if (checked) setBulkMode(false); // a shared meter is one meter, not compatible with bulk-per-unit
    setSelectedUnitIds([]);
  }

  async function handleSave() {
    setError('');
    if (!propertyId) return setError('Select a property from the dashboard switcher first.');
    if (!ratePerUnit || Number(ratePerUnit) <= 0) return setError('Enter a valid rate per unit of consumption.');
    if (selectedUnitIds.length === 0) return setError('Select at least one unit.');

    if (bulkMode) {
      setSaving(true);
      try {
        const res = await api.bulkCreateUtilityMeters({
          propertyId,
          utilityType,
          ratePerUnit: Number(ratePerUnit),
          units: selectedUnitIds.map((unitId) => ({ unitId })),
        }, token);
        setBulkResult(res);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to create meters.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!label.trim()) return setError('Give this meter a label, e.g. "Main water meter - Block A".');
    if (!isShared && selectedUnitIds.length !== 1) return setError('An individual meter must cover exactly one unit.');

    setSaving(true);
    try {
      await api.createUtilityMeter({
        propertyId,
        label: label.trim(),
        utilityType,
        isShared,
        ratePerUnit: Number(ratePerUnit),
        unitIds: selectedUnitIds,
      }, token);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create meter.');
    } finally {
      setSaving(false);
    }
  }

  if (bulkResult) {
    return (
      <div className="modal-overlay" onClick={onCreated}>
        <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
          <h2>Meters created</h2>
          <p className="tenant-portal-hint">
            Created {bulkResult.createdCount} individual {utilityType} meter{bulkResult.createdCount === 1 ? '' : 's'}.
          </p>
          {bulkResult.skipped?.length > 0 && (
            <p className="tenant-portal-hint">
              Skipped (already have a {utilityType} meter): {bulkResult.skipped.join(', ')}
            </p>
          )}
          <div className="confirm-dialog__actions">
            <Button variant="primary" onClick={onCreated}>Done</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
        <h2>Add meter{bulkMode ? 's' : ''}</h2>

        <div className="form-field">
          <label className="form-field__label">Property</label>
          <div className="form-field__static">{propertyName || 'This property'}</div>
        </div>

        <div className="form-field">
          <label className="form-field__label">
            <input type="checkbox" checked={bulkMode} onChange={(e) => toggleBulkMode(e.target.checked)} style={{ marginRight: 8 }} />
            Every unit has its own meter - create one for each selected unit at once
            <InfoTip label="About bulk creation" text="Use this when each unit has its own individual meter, instead of creating them one at a time. All the meters created this way share the same rate; you can edit any one of them individually afterwards." />
          </label>
        </div>

        {!bulkMode && (
          <div className="form-field">
            <label className="form-field__label">Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Main water meter - Block A" />
          </div>
        )}

        <div className="form-field">
          <label className="form-field__label">Utility type</label>
          <select value={utilityType} onChange={(e) => setUtilityType(e.target.value)}>
            <option value="water">Water</option>
            <option value="electricity">Electricity</option>
          </select>
        </div>

        {!bulkMode && (
          <div className="form-field">
            <label className="form-field__label">
              <input type="checkbox" checked={isShared} onChange={(e) => toggleShared(e.target.checked)} style={{ marginRight: 8 }} />
              This meter is shared across multiple units
            </label>
          </div>
        )}

        <div className="form-field">
          <label className="form-field__label">Rate per unit of consumption (KES)</label>
          <input type="number" min="0" step="0.01" value={ratePerUnit} onChange={(e) => setRatePerUnit(e.target.value)} placeholder="e.g. 150" />
        </div>

        <div className="form-field">
          <label className="form-field__label">{isShared || bulkMode ? 'Units covered' : 'Unit'}</label>
          {!propertyId ? (
            <p className="tenant-portal-hint">Select a property first.</p>
          ) : loadingUnits ? (
            <Skeleton rows={2} />
          ) : units.length === 0 ? (
            <p className="tenant-portal-hint">No units found on this property.</p>
          ) : (
            <div className="utility-unit-picker">
              {bulkMode && units.length > 1 && (
                <label className="utility-unit-picker__item">
                  <input
                    type="checkbox"
                    checked={selectedUnitIds.length === units.length}
                    onChange={(e) => setSelectedUnitIds(e.target.checked ? units.map((u) => u.id) : [])}
                  />
                  <strong>Select all</strong>
                </label>
              )}
              {units.map((u) => (
                <label key={u.id} className="utility-unit-picker__item">
                  <input
                    type={isShared || bulkMode ? 'checkbox' : 'radio'}
                    name="meter-unit"
                    checked={selectedUnitIds.includes(u.id)}
                    onChange={() => toggleUnit(u.id)}
                  />
                  {u.unit_name}
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="confirm-dialog__actions">
          <Button variant="primary" loading={saving} onClick={handleSave}>
            {bulkMode ? `Create ${selectedUnitIds.length || ''} meter${selectedUnitIds.length === 1 ? '' : 's'}` : 'Create meter'}
          </Button>
          <button type="button" className="ghost-link" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Edit an existing meter: label, rate, utility type, shared flag, and
// which unit(s) it covers. Also offers delete, but only when the
// meter has no readings on file yet (enforced server-side too).
// ---------------------------------------------------------------------
function EditMeterModal({ token, meter, onClose, onSaved }) {
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [label, setLabel] = useState(meter.label);
  const [utilityType, setUtilityType] = useState(meter.utility_type);
  const [isShared, setIsShared] = useState(meter.is_shared);
  const [ratePerUnit, setRatePerUnit] = useState(String(meter.rate_per_unit));
  const [selectedUnitIds, setSelectedUnitIds] = useState((meter.utility_meter_units || []).map((u) => u.unit_id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Direct request: a landlord/manager can give this meter its OWN
  // payment method (e.g. a separate estate Paybill for water) instead
  // of tenants being told to pay water/electricity to the same
  // account as rent. Off by default - unchanged meters keep falling
  // back to the landlord's usual rent payment method exactly as before.
  const [paymentOverrideEnabled, setPaymentOverrideEnabled] = useState(!!meter.payment_override_enabled);
  const [paymentMethod, setPaymentMethod] = useState(meter.payment_override_method || 'paybill');
  const [paybillNumber, setPaybillNumber] = useState(meter.payment_override_paybill_number || '');
  const [paybillAccountNumber, setPaybillAccountNumber] = useState(meter.payment_override_paybill_account_number || '');
  const [tillNumber, setTillNumber] = useState(meter.payment_override_till_number || '');
  const [stkPhoneNumber, setStkPhoneNumber] = useState(meter.payment_override_stk_phone_number || '');
  const [paymentDescription, setPaymentDescription] = useState(meter.payment_override_description || '');

  useEffect(() => {
    if (!meter.property_id) {
      setLoadingUnits(false);
      return;
    }
    api.listUnits(token, meter.property_id).then((res) => setUnits(res.units || [])).catch((err) => {
      console.warn('[UtilityMetersPanel] failed to load units:', err);
    }).finally(() => setLoadingUnits(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meter.property_id, token]);

  function toggleUnit(unitId) {
    if (isShared) {
      setSelectedUnitIds((prev) => (prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]));
    } else {
      setSelectedUnitIds([unitId]);
    }
  }

  async function handleSave() {
    setError('');
    if (!label.trim()) return setError('Give this meter a label.');
    if (!ratePerUnit || Number(ratePerUnit) <= 0) return setError('Enter a valid rate per unit of consumption.');
    if (selectedUnitIds.length === 0) return setError('Select at least one unit.');
    if (!isShared && selectedUnitIds.length !== 1) return setError('An individual meter must cover exactly one unit.');
    if (paymentOverrideEnabled) {
      if (paymentMethod === 'paybill' && !paybillNumber.trim()) return setError('Enter a Paybill number, or turn off the dedicated payment method.');
      if (paymentMethod === 'till' && !tillNumber.trim()) return setError('Enter a Till number, or turn off the dedicated payment method.');
    }

    setSaving(true);
    try {
      await api.updateUtilityMeter(meter.id, {
        label: label.trim(),
        utilityType,
        isShared,
        ratePerUnit: Number(ratePerUnit),
        unitIds: selectedUnitIds,
        paymentOverrideEnabled,
        paymentOverrideMethod: paymentOverrideEnabled ? paymentMethod : undefined,
        paymentOverridePaybillNumber: paymentOverrideEnabled ? paybillNumber.trim() : undefined,
        paymentOverridePaybillAccountNumber: paymentOverrideEnabled ? paybillAccountNumber.trim() : undefined,
        paymentOverrideTillNumber: paymentOverrideEnabled ? tillNumber.trim() : undefined,
        paymentOverrideStkPhoneNumber: paymentOverrideEnabled ? stkPhoneNumber.trim() : undefined,
        paymentOverrideDescription: paymentOverrideEnabled ? paymentDescription.trim() : undefined,
      }, token);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
        <h2>Edit meter</h2>

        <div className="form-field">
          <label className="form-field__label">Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>

        <div className="form-field">
          <label className="form-field__label">Utility type</label>
          <select value={utilityType} onChange={(e) => setUtilityType(e.target.value)}>
            <option value="water">Water</option>
            <option value="electricity">Electricity</option>
          </select>
        </div>

        <div className="form-field">
          <label className="form-field__label">
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} style={{ marginRight: 8 }} />
            This meter is shared across multiple units
          </label>
        </div>

        <div className="form-field">
          <label className="form-field__label">Rate per unit of consumption (KES)</label>
          <input type="number" min="0" step="0.01" value={ratePerUnit} onChange={(e) => setRatePerUnit(e.target.value)} />
        </div>

        <div className="form-field">
          <label className="form-field__label">{isShared ? 'Units covered by this meter' : 'Unit'}</label>
          {loadingUnits ? (
            <Skeleton rows={2} />
          ) : units.length === 0 ? (
            <p className="tenant-portal-hint">No units found on this property.</p>
          ) : (
            <div className="utility-unit-picker">
              {units.map((u) => (
                <label key={u.id} className="utility-unit-picker__item">
                  <input
                    type={isShared ? 'checkbox' : 'radio'}
                    name="edit-meter-unit"
                    checked={selectedUnitIds.includes(u.id)}
                    onChange={() => toggleUnit(u.id)}
                  />
                  {u.unit_name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="form-field" style={{ borderTop: '1px solid var(--border-color, #e2e2e2)', paddingTop: 16, marginTop: 8 }}>
          <label className="form-field__label">
            <input
              type="checkbox"
              checked={paymentOverrideEnabled}
              onChange={(e) => setPaymentOverrideEnabled(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Use a dedicated payment method for this {utilityType === 'water' ? 'water' : 'electricity'} meter
          </label>
          <p className="tenant-portal-hint">
            Off by default - tenants pay {utilityType} the same way they pay rent. Turn this on if {utilityType} should be paid to a
            different Paybill/Till/number (e.g. the estate's own water account).
          </p>
        </div>

        {paymentOverrideEnabled && (
          <>
            <div className="form-field">
              <label className="form-field__label">Payment method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="paybill">M-Pesa Paybill</option>
                <option value="till">M-Pesa Buy Goods (Till)</option>
                <option value="stk">Send Money to a phone number</option>
              </select>
            </div>

            {paymentMethod === 'paybill' && (
              <>
                <div className="form-field">
                  <label className="form-field__label">Paybill number</label>
                  <input value={paybillNumber} onChange={(e) => setPaybillNumber(e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Account number</label>
                  <input
                    value={paybillAccountNumber}
                    onChange={(e) => setPaybillAccountNumber(e.target.value)}
                    placeholder="e.g. WATER-{unit}"
                  />
                  <p className="tenant-portal-hint">Use <code>{'{unit}'}</code> and it's replaced with each tenant's own unit number.</p>
                </div>
              </>
            )}

            {paymentMethod === 'till' && (
              <div className="form-field">
                <label className="form-field__label">Till number</label>
                <input value={tillNumber} onChange={(e) => setTillNumber(e.target.value)} />
              </div>
            )}

            {paymentMethod === 'stk' && (
              <div className="form-field">
                <label className="form-field__label">Phone number to receive payment</label>
                <input value={stkPhoneNumber} onChange={(e) => setStkPhoneNumber(e.target.value)} placeholder="07XXXXXXXX" />
              </div>
            )}

            <div className="form-field">
              <label className="form-field__label">Note shown to tenants (optional)</label>
              <input
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                placeholder="e.g. Water is billed separately from rent"
              />
            </div>
          </>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="confirm-dialog__actions">
          <Button variant="primary" loading={saving} onClick={handleSave}>Save changes</Button>
          <button type="button" className="ghost-link" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
        {/* Deleting this meter now happens from its row on the main
            panel (see MeterRow / DeleteMeterConfirm) - close this and
            use Delete there instead. */}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Submit readings for several meters in one screen (e.g. walking the
// whole property). Each row is independent - a mistake or duplicate
// on one meter doesn't block the others from saving.
// ---------------------------------------------------------------------
function BulkReadingsModal({ token, meters, onClose, onSubmitted, onOpenReview }) {
  const [monthKey, setMonthKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [values, setValues] = useState({}); // meterId -> reading string
  // DIRECT REQUEST: "no way to add a base reading... for units that
  // have both water and electricity meters." This modal is exactly
  // that "both readings" shortcut, and it had no baseline handling at
  // all - only a bare reading number per row. A brand-new meter's
  // first reading needs one more piece of information (what it read
  // before, or "nothing, this is the starting point"), which this
  // never asked for. "First reading" per row reveals exactly that,
  // right where the number goes in - nothing to look up elsewhere.
  const [firstReading, setFirstReading] = useState({}); // meterId -> bool
  const [previousValues, setPreviousValues] = useState({}); // meterId -> previous reading string
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null); // [{ meterId, ok, error?, usage?, isBaseline?, needsPreviousReading? }]

  function setValue(meterId, v) {
    setValues((prev) => ({ ...prev, [meterId]: v }));
  }

  function toggleFirstReading(meterId, checked) {
    setFirstReading((prev) => ({ ...prev, [meterId]: checked }));
    if (!checked) setPreviousValues((prev) => ({ ...prev, [meterId]: '' }));
  }

  function setPreviousValue(meterId, v) {
    setPreviousValues((prev) => ({ ...prev, [meterId]: v }));
  }

  async function handleSave() {
    setError('');
    const entries = Object.entries(values).filter(([, v]) => v !== '' && v != null);
    if (entries.length === 0) return setError('Enter at least one reading.');

    setSaving(true);
    try {
      const res = await api.bulkSubmitUtilityReadings({
        monthKey,
        readings: entries.map(([meterId, v]) => {
          const entry = { meterId, readingValue: Number(v) };
          if (firstReading[meterId]) {
            const prev = previousValues[meterId];
            if (prev !== '' && prev != null) entry.previousReadingValue = Number(prev);
            else entry.isBaseline = true;
          }
          return entry;
        }),
      }, token);
      setResults(res.results || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit readings.');
    } finally {
      setSaving(false);
    }
  }

  function meterLabel(meterId) {
    const m = meters.find((mm) => mm.id === meterId);
    return m ? m.label : meterId;
  }

  if (results) {
    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    // Baseline readings (see the "First reading" toggle above) have
    // nothing to bill yet - only a non-baseline reading needs the
    // review/finalize step to actually reach a tenant.
    const needsReview = succeeded.filter((r) => !r.isBaseline && r.reading?.id);
    return (
      <div className="modal-overlay" onClick={onSubmitted}>
        <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
          <h2>Readings submitted</h2>
          <p className="tenant-portal-hint">{succeeded.length} of {results.length} readings saved.</p>
          {failed.length > 0 && (
            <div className="payments-table-wrap">
              <table className="payments-table">
                <thead><tr><th>Meter</th><th>Issue</th></tr></thead>
                <tbody>
                  {failed.map((r) => (
                    <tr key={r.meterId}>
                      <td>{meterLabel(r.meterId)}</td>
                      <td>
                        {r.error}
                        {r.needsPreviousReading && (
                          <> - tick "First reading" for this meter and try again, either with what it read
                          before, or leave that blank to just set today's number as the starting point.</>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* THE FIX (direct request: "landlord submits it, nothing
              arrives to the tenant"): a saved reading isn't billed or
              sent to anyone yet - that only happens once it's
              reviewed and finalized. This used to be one line of text
              pointing back at History as the only way to find that
              step; now it's a direct button per reading, right where
              you'd actually look right after submitting. */}
          {needsReview.length > 0 && (
            <>
              <p className="tenant-portal-hint" style={{ fontWeight: 600 }}>
                Not billed yet - review each one to send it to the tenant:
              </p>
              <div className="utility-pending-review-banner__list">
                {needsReview.map((r) => (
                  <div key={r.meterId} className="utility-pending-review-banner__row">
                    <span>{meterLabel(r.meterId)}{r.usage != null ? ` · ${Number(r.usage).toLocaleString()} units` : ''}</span>
                    <Button variant="primary" onClick={() => onOpenReview(r.reading.id)}>Review & bill</Button>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="confirm-dialog__actions">
            <Button variant={needsReview.length > 0 ? 'secondary' : 'primary'} onClick={onSubmitted}>
              {needsReview.length > 0 ? "I'll review these later" : 'Done'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal-shell utility-history-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add multiple readings</h2>

        <div className="form-field">
          <label className="form-field__label">Month these readings are for</label>
          <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
        </div>

        {/* THE FIX (direct request): "the other details are beyond
            the screen... so that there's no much scrolling." A wide
            4-column table (Meter / Units / Reading / First reading)
            never fits a phone screen - the last column and the
            Cancel button at the bottom both ran off the edge with no
            visual hint anything was missing (see the screenshot).
            Each meter is its own compact stacked card instead: name
            on top, reading input and the "no previous data" checkbox
            on one line below it - nothing here is ever wider than
            the screen, so there's nothing to scroll sideways for. */}
        <div className="utility-bulk-reading-list">
          {meters.map((m) => {
            // Same rule as the main meter row (see MeterRow): a
            // vacant unit's meter is greyed out and locked, here too -
            // no reason the bulk entry path should be the one place
            // that still lets a reading get keyed in for a unit with
            // nobody to bill it to.
            const vacant = m.has_active_tenant === false;
            return (
              <div key={m.id} className={`utility-bulk-reading-row${vacant ? ' utility-bulk-reading-row--vacant' : ''}`}>
                <div className="utility-bulk-reading-row__meter">
                  {m.label}
                  <span className="utility-bulk-reading-row__unit">
                    {(m.utility_meter_units || []).map((u) => u.units?.unit_name).filter(Boolean).join(', ') || '-'}
                  </span>
                </div>
                {vacant ? (
                  <p className="tenant-portal-hint">No active tenant on this unit - nothing can be billed here right now.</p>
                ) : (
                  <>
                    <div className="utility-bulk-reading-row__inputs">
                      <input
                        type="number"
                        step="0.01"
                        value={values[m.id] ?? ''}
                        onChange={(e) => setValue(m.id, e.target.value)}
                        placeholder="Reading"
                      />
                      <label className="utility-bulk-reading-row__checkbox">
                        <input
                          type="checkbox"
                          checked={!!firstReading[m.id]}
                          onChange={(e) => toggleFirstReading(m.id, e.target.checked)}
                        />
                        No previous data
                      </label>
                    </div>
                    {/* Only shown once "No previous data" is ticked for
                        this meter - keeps the card simple for the
                        normal case (a meter that already has readings)
                        and only asks the extra question when it's
                        actually needed. */}
                    {firstReading[m.id] && (
                      <div className="form-field utility-bulk-reading-row__previous">
                        <label className="form-field__label">
                          What did {m.label} read before this? (leave blank if you don't know)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={previousValues[m.id] ?? ''}
                          onChange={(e) => setPreviousValue(m.id, e.target.value)}
                          placeholder="Previous reading"
                        />
                        <p className="tenant-portal-hint">
                          {previousValues[m.id]
                            ? "Usage will be billed this month, using the number you entered above."
                            : "Left blank: today's number just becomes the starting point - nothing is billed until next month's reading."}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="confirm-dialog__actions">
          <Button variant="primary" loading={saving} onClick={handleSave}>Submit all</Button>
          <button type="button" className="ghost-link" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Section 1/2/3 - submit a reading: month, number, photo proof.
// First-ever reading for a meter is auto-treated as the baseline by
// the backend. Anomaly warnings surface after submission, non-
// blocking.
// ---------------------------------------------------------------------
function SubmitReadingModal({ token, meter, onClose, onSubmitted }) {
  const [monthKey, setMonthKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [readingValue, setReadingValue] = useState('');
  const [previousReadingValue, setPreviousReadingValue] = useState('');
  const [needsPreviousReading, setNeedsPreviousReading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [asBaseline, setAsBaseline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { anomaly, message } after a successful submit
  // Direct request: "they should also be able to edit the previous
  // reading" - not just the new reading they're entering now. This
  // shows whichever reading this meter's usage will be calculated
  // FROM (its most recent one on file), with an inline "Edit" link
  // that opens the same mandatory-reason correction flow used from
  // History - so a wrong previous reading can be fixed right here,
  // before it throws off this month's usage calculation.
  const [latestReading, setLatestReading] = useState(null);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [editingLatest, setEditingLatest] = useState(false);

  function loadLatestReading() {
    setLoadingLatest(true);
    api.listUtilityReadings(meter.id, token)
      .then((res) => {
        const readings = res.readings || [];
        // Most recently submitted reading still on file - not
        // necessarily "baseline", just whatever the next reading will
        // be calculated against.
        const latest = readings[0] || null;
        setLatestReading(latest);
        setNeedsPreviousReading(false); // a reading exists, so the normal flow applies
      })
      .catch(() => setLatestReading(null))
      .finally(() => setLoadingLatest(false));
  }

  useEffect(() => {
    loadLatestReading();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meter.id, token]);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    setError('');
    if (!monthKey) return setError('Select which month this reading is for.');
    if (readingValue === '' || Number.isNaN(Number(readingValue))) return setError('Enter the reading number.');
    if (needsPreviousReading && (previousReadingValue === '' || Number.isNaN(Number(previousReadingValue)))) {
      return setError('Enter what the meter read before this reading, so usage can be calculated.');
    }

    setSaving(true);
    try {
      let photoUrl = null;
      if (photoFile) {
        const formData = new FormData();
        formData.append('photo', photoFile);
        const uploadRes = await api.uploadMeterReadingPhoto(formData, token);
        photoUrl = uploadRes.photoUrl;
      }

      const res = await api.submitUtilityReading(meter.id, {
        monthKey,
        readingValue: Number(readingValue),
        photoUrl,
        isBaseline: asBaseline,
        ...(needsPreviousReading && previousReadingValue !== '' ? { previousReadingValue: Number(previousReadingValue) } : {}),
      }, token);

      // First reading ever on this meter, and we haven't been told
      // what it read before now: don't fail or silently record a
      // zero-usage baseline. Reveal the "previous reading" field
      // inline and let the landlord/caretaker fill it in, then submit
      // again - same screen, no extra trip.
      if (res.needsPreviousReading) {
        setNeedsPreviousReading(true);
        setSaving(false);
        return;
      }

      if (res.isBaseline) {
        onSubmitted(res.reading, true);
      } else {
        setResult(res);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit reading.');
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="modal-overlay" onClick={() => onSubmitted(result.reading, false)}>
        <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
          <h2>Reading submitted</h2>
          {result.anomaly?.flagged && (
            <p className="form-error" style={{ background: 'rgba(255,193,7,0.12)', borderColor: '#ffc107', color: '#8a6100' }}>
              ⚠️ {result.anomaly.reason}
            </p>
          )}
          <p className="tenant-portal-hint">
            Usage this month: {Number(result.usage).toLocaleString()} units.
            <InfoTip label="What happens next" text="This isn't billed yet. On the review screen you can check or override the proposed amount before anything is sent to a tenant." />
          </p>
          <div className="confirm-dialog__actions">
            <Button variant="primary" onClick={() => onSubmitted(result.reading, false)}>Go to review</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
        <h2>Submit reading - {meter.label}</h2>

        <div className="form-field">
          <label className="form-field__label">Month this reading is for</label>
          <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
        </div>

        {!loadingLatest && latestReading && !needsPreviousReading && (
          <div className="form-field">
            <p className="tenant-portal-hint">
              Previous reading on file: <strong>{latestReading.reading_value}</strong>
              {latestReading.month_key ? ` (${latestReading.month_key})` : ''}
              {' '}
              <button type="button" className="ghost-link" onClick={() => setEditingLatest(true)} style={{ display: 'inline' }}>
                Edit
              </button>
            </p>
          </div>
        )}

        <div className="form-field">
          <label className="form-field__label">Reading number</label>
          <input type="number" step="0.01" value={readingValue} onChange={(e) => setReadingValue(e.target.value)} placeholder="Type the number shown on the meter" />
        </div>

        {needsPreviousReading && (
          <div className="form-field">
            <label className="form-field__label">What did the meter read before this?</label>
            <input type="number" step="0.01" value={previousReadingValue} onChange={(e) => setPreviousReadingValue(e.target.value)} placeholder="The reading before this one" />
            <p className="tenant-portal-hint">
              This meter has no reading on file yet. Enter its previous reading so this month's usage can be billed right away instead of waiting until next month.
            </p>
          </div>
        )}

        {!needsPreviousReading && (
          <div className="form-field">
            <label className="form-field__label">
              <input type="checkbox" checked={asBaseline} onChange={(e) => setAsBaseline(e.target.checked)} style={{ marginRight: 8 }} />
              First-ever / baseline reading, with no previous reading to bill from
              <InfoTip label="About baseline readings" text="Check this only for a brand-new meter with nothing before it to compare against. It becomes the reference point for next month's calculation, with nothing billed this month." />
            </label>
          </div>
        )}

        <div className="form-field">
          <label className="form-field__label">Photo of the physical meter (optional)</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
          {photoPreview && <img src={photoPreview} alt="Meter reading" style={{ marginTop: 8, width: 160, height: 120, objectFit: 'cover', borderRadius: 8 }} />}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="confirm-dialog__actions">
          <Button variant="primary" loading={saving} onClick={handleSave}>Submit</Button>
          <button type="button" className="ghost-link" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>

      {editingLatest && latestReading && (
        <CorrectReadingModal
          token={token}
          reading={latestReading}
          onClose={() => setEditingLatest(false)}
          onCorrected={() => {
            setEditingLatest(false);
            loadLatestReading();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Section 2 - reading history for a meter, with mandatory-reason
// corrections and a jump-back-into-review link for anything still
// in_review/submitted.
// ---------------------------------------------------------------------
function MeterHistoryModal({ token, meter, onClose, onOpenReview }) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [correctingReading, setCorrectingReading] = useState(null);

  function load() {
    setLoading(true);
    api.listUtilityReadings(meter.id, token)
      .then((res) => setReadings(res.readings || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load history.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meter.id, token]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-shell utility-history-modal" onClick={(e) => e.stopPropagation()}>
        <h2>History - {meter.label}</h2>
        {error && <p className="modal-error">{error}</p>}
        {loading ? (
          <Skeleton rows={4} />
        ) : readings.length === 0 ? (
          <p className="tenant-portal-hint">No readings submitted yet.</p>
        ) : (
          <div className="payments-table-wrap">
            <table className="payments-table">
              <thead>
                <tr><th>Month</th><th>Reading</th><th>Usage</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {readings.map((r) => (
                  <tr key={r.id}>
                    <td>{r.month_key}{r.is_baseline ? ' (baseline)' : ''}</td>
                    <td>
                      {r.reading_value}
                      {r.photo_url && <> · <a href={r.photo_url} target="_blank" rel="noreferrer">photo</a></>}
                    </td>
                    <td>
                      {r.usage_amount != null ? Number(r.usage_amount).toLocaleString() : '-'}
                      {r.anomaly_flag && <span title={r.anomaly_reason} style={{ marginLeft: 6 }}>⚠️</span>}
                    </td>
                    <td><span className={`payment-status payment-status--${r.status === 'finalized' ? 'completed' : 'pending'}`}>{r.status.replace('_', ' ')}</span></td>
                    <td className="u-flex-row">
                      {!r.is_baseline && r.status !== 'finalized' && (
                        <button type="button" className="ghost-link" onClick={() => onOpenReview(r.id)}>Review</button>
                      )}
                      {r.status !== 'finalized' && (
                        <button type="button" className="ghost-link" onClick={() => setCorrectingReading(r)}>Correct</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="confirm-dialog__actions">
          <button type="button" className="ghost-link" onClick={onClose}>Close</button>
        </div>
      </div>

      {correctingReading && (
        <CorrectReadingModal
          token={token}
          reading={correctingReading}
          onClose={() => setCorrectingReading(null)}
          onCorrected={() => {
            setCorrectingReading(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// Section 2 - mandatory-reason correction, always available even for
// the baseline. Nested on top of the history modal.
function CorrectReadingModal({ token, reading, onClose, onCorrected }) {
  const [newValue, setNewValue] = useState(reading.reading_value);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setError('');
    if (newValue === '' || Number.isNaN(Number(newValue))) return setError('Enter a valid reading number.');
    if (!reason.trim()) return setError('A reason is required to correct a reading.');
    setSaving(true);
    try {
      await api.correctUtilityReading(reading.id, { newValue: Number(newValue), reason: reason.trim() }, token);
      onCorrected();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to correct reading.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
        <h2>Correct reading - {reading.month_key}</h2>
        <p className="tenant-portal-hint">Current value: {reading.reading_value}</p>

        <div className="form-field">
          <label className="form-field__label">New value</label>
          <input type="number" step="0.01" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
        </div>

        <div className="form-field">
          <label className="form-field__label">Reason for this correction (required)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Misread the last digit, corrected after re-checking the photo." />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="confirm-dialog__actions">
          <Button variant="primary" loading={saving} onClick={handleSave}>Save correction</Button>
          <button type="button" className="ghost-link" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
