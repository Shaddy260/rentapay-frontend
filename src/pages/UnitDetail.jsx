import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { api, ApiError } from '../api/client.js';
import { downloadCsv } from '../utils/downloadCsv.js';
import DocumentsPanel from '../components/DocumentsPanel.jsx';
import TenantContactCard from '../components/TenantContactCard.jsx';
import TenantRatingPanel from '../components/TenantRatingPanel.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ModalShell from '../components/ModalShell.jsx';
import UnitPhotosPanel from '../components/UnitPhotosPanel.jsx';
import { useToast } from '../components/Toast.jsx';
import InfoTip from '../components/InfoTip.jsx';
import { openWhatsAppReminder } from '../utils/whatsapp.js';
import './UnitDetail.css';
import './TenantPortal.css';

// Mirrors backend src/utils/prepayment.js buildPrepaymentSummary exactly,
// so the unit detail page can show "paid ahead" status without a
// separate API round-trip.
//
// FIX: this used to read tenant.paid_through_date, a column the
// backend stopped writing to a while ago (single-ledger balance_due
// is now the only source of truth - see prepayment.js) - so this was
// silently dead code, always showing "no balance due" for a paid-
// ahead tenant instead of "paid ahead." Now computed from
// balance_due directly, same as the tenant portal, using the real
// due_day_of_month rather than a derived/projected date.
function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, date.getDate());
}

function getPrepaymentSummary(balanceDue, monthlyRent, dueDayOfMonth) {
  const credit = -Number(balanceDue || 0);
  if (credit <= 0 || monthlyRent <= 0) return { isAhead: false };
  const monthsCovered = credit / monthlyRent;
  const fullMonthsCovered = Math.floor(monthsCovered + 1e-9);
  const fractionCovered = Math.max(0, monthsCovered - fullMonthsCovered);
  const nextPaymentAmount = Math.round(monthlyRent * (1 - fractionCovered) * 100) / 100;
  const today = new Date();
  const nextCycleDueDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDayOfMonth || 1);
  const nextPaymentDueDate = addMonths(nextCycleDueDate, fullMonthsCovered);
  return {
    isAhead: true,
    creditAmount: Math.round(credit * 100) / 100,
    monthsCovered: Math.round(monthsCovered * 10) / 10,
    fullMonthsCovered,
    nextPaymentAmount,
    nextPaymentDueDate,
  };
}

export default function UnitDetail() {
  const navigate = useNavigate();
  const { unitId } = useParams();
  const token = localStorage.getItem('rentapay_token');
  const role = localStorage.getItem('rentapay_role');
  const isCaretaker = role === 'manager' && localStorage.getItem('rentapay_role_level') === 'caretaker';

  // FIX (direct request: "tapping unit gh1... gives a white screen
  // with ...loading... it should transition so fast and give the
  // data as fast as possible such that loading only occurs in the
  // background"). Each unit gets its own cache entry (keyed by
  // unitId) so jumping between two different units never shows one
  // unit's stale data under the other's page, but re-opening the SAME
  // unit (including via the back button, or a hard refresh while on
  // it) has its last-known content ready immediately instead of a
  // blank skeleton every single time.
  const unitCache = (() => {
    try {
      const raw = localStorage.getItem('rentapay_unit_cache_' + unitId);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const [unit, setUnit] = useState(() => unitCache?.unit || null);
  const [payments, setPayments] = useState(() => unitCache?.payments || []);
  const [loading, setLoading] = useState(() => !unitCache?.unit);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); // success/info banner text

  // Inline-edit state
  const [editingRent, setEditingRent] = useState(false);
  const [rentDraft, setRentDraft] = useState('');
  const [rentEffectiveOption, setRentEffectiveOption] = useState('immediately'); // 'immediately' | 'next_month' | 'custom'
  const [rentEffectiveDate, setRentEffectiveDate] = useState('');
  const [pendingRentChange, setPendingRentChange] = useState(null);
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [dueDateDraft, setDueDateDraft] = useState('');
  const [chargeDraft, setChargeDraft] = useState({ name: '', amount: '', recurring: true });
  // FEATURE (spec item 12): scope selection for extra charges - apply
  // to just this unit (default, unchanged), every unit on this
  // property, or a hand-picked set of this property's units.
  const [chargeScope, setChargeScope] = useState('unit'); // 'unit' | 'property' | 'units'
  const [propertyUnits, setPropertyUnits] = useState(null); // lazy-loaded once scope needs it
  const [propertyUnitsLoading, setPropertyUnitsLoading] = useState(false);
  const [selectedChargeUnitIds, setSelectedChargeUnitIds] = useState([]);
  const [editingPaymentOverride, setEditingPaymentOverride] = useState(false);
  const [paymentOverrideDraft, setPaymentOverrideDraft] = useState({ enabled: false, method: 'stk', paybillNumber: '', accountNumber: '', tillNumber: '' });
  const [busy, setBusy] = useState(false);

  // Modals
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditTenantModal, setShowEditTenantModal] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteUnitConfirm, setShowDeleteUnitConfirm] = useState(false);
  const toast = useToast();
  const [deleteUnitBusy, setDeleteUnitBusy] = useState(false);
  const [deleteUnitError, setDeleteUnitError] = useState('');
  const [availableUnits, setAvailableUnits] = useState([]);

  function load() {
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    api
      .getUnit(unitId, token)
      .then((res) => {
        setUnit(res.unit);
        setPayments(res.payments || []);
        setRentDraft(res.unit.rent_amount);
        setDueDateDraft(res.unit.due_day_of_month);
        setPendingRentChange(res.pendingRentChange || null);
        setPaymentOverrideDraft({
          enabled: !!res.unit.payment_override_enabled,
          method: res.unit.payment_override_method || 'stk',
          paybillNumber: res.unit.payment_override_paybill_number || '',
          accountNumber: res.unit.payment_override_paybill_account_number || '',
          tillNumber: res.unit.payment_override_till_number || '',
        });
        try {
          localStorage.setItem('rentapay_unit_cache_' + unitId, JSON.stringify({ unit: res.unit, payments: res.payments || [] }));
        } catch {
          // non-fatal
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login');
          return;
        }
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // The component stays mounted across a unitId change (tapping
    // from one unit straight into another) rather than remounting, so
    // the useState initializers above only ran once for the FIRST
    // unit ever viewed - reseed here from the newly-navigated-to
    // unit's own cache before kicking off its fetch, so switching
    // between two already-visited units is instant both ways too.
    let seeded = null;
    try {
      const raw = localStorage.getItem('rentapay_unit_cache_' + unitId);
      seeded = raw ? JSON.parse(raw) : null;
    } catch {
      seeded = null;
    }
    setUnit(seeded?.unit || null);
    setPayments(seeded?.payments || []);
    setLoading(!seeded?.unit);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  const activeTenant = (unit?.tenants || []).find((t) => t.is_active);

  const [verifyBusy, setVerifyBusy] = useState(false);
  async function handleVerifyUnit() {
    setVerifyBusy(true);
    setError('');
    try {
      await api.verifyUnit(unitId, token);
      setNotice('Listing refreshed.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyBusy(false);
    }
  }

  const [listingBusy, setListingBusy] = useState(false);
  const [depositBusy, setDepositBusy] = useState(false);
  const [depositAmountDraft, setDepositAmountDraft] = useState('');
  // FEATURE (Landlord Bulk Deposit Assignment): scope selection for
  // deposit settings, same shape as chargeScope above - apply to just
  // this unit (default, unchanged instant-toggle behavior), every unit
  // in the landlord's whole portfolio, or a hand-picked set of units.
  // "all" is deliberately portfolio-wide (not just this property) per
  // the spec ("across the landlord's entire portfolio in one go").
  const [depositScope, setDepositScope] = useState('unit'); // 'unit' | 'all' | 'selected'
  const [portfolioUnits, setPortfolioUnits] = useState(null); // lazy-loaded once scope needs it
  const [portfolioUnitsLoading, setPortfolioUnitsLoading] = useState(false);
  const [selectedDepositUnitIds, setSelectedDepositUnitIds] = useState([]);
  // FEATURE (direct request - "it should tell whether it has already
  // been applied... do away with the confusion"): tracks what the
  // last successful bulk-apply on THIS page visit actually did, so
  // the confirmation stays visible as a permanent note instead of the
  // form silently snapping back to "Just this unit" with zero trace
  // of what was just done (which read as if it hadn't worked, or had
  // been forgotten).
  const [lastDepositApplied, setLastDepositApplied] = useState(null); // { scope, count, requiresDeposit, amount } | null
  const [bulkDepositRequires, setBulkDepositRequires] = useState(true);
  const [bulkDepositAmount, setBulkDepositAmount] = useState('');
  // DIRECT REQUEST: "add an option in the landlord/manager portal that
  // they choose whether their vacant units should be listed public or
  // not." Toggle-able regardless of the unit's current status - a
  // landlord filling a unit privately (waiting list, agent, word of
  // mouth) can decide that ahead of the unit actually going vacant,
  // rather than racing to flip it the moment a tenant moves out.
  async function handleTogglePublicListing() {
    setListingBusy(true);
    setError('');
    try {
      const nextValue = !unit.is_publicly_listed;
      await api.updatePublicListing(unitId, nextValue, token);
      setNotice(nextValue ? 'This unit is now public. Anyone can see it and message the WhatsApp number on file once it\'s vacant.' : 'This unit is now private and will not appear on the public listings page.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setListingBusy(false);
    }
  }

  // SPEC (unit detail redesign): occupancy is now fully auto-detected
  // from whether an active tenant record exists (see `isOccupied`
  // below, computed from `activeTenant`) - there's no manual
  // Occupied/Vacant toggle to wire up anymore, and the old "confirm
  // still active / already booked / planned for" 3-button group is
  // gone too (an added tenant record already covers "booked"
  // automatically, the moment it happens). What's left of that old
  // flow is just the listing-freshness "refresh listing" action - see
  // handleVerifyUnit above, which still does exactly the job it
  // always did (stamps last_verified_at), just relabeled and no
  // longer bundled with occupancy itself.

  // DIRECT REQUEST: whether this unit requires a deposit from a future
  // tenant - shown on the public vacant-unit listing, independent of
  // any deposit already collected from a tenant currently living there.
  async function handleToggleRequiresDeposit() {
    const nextValue = !unit.requires_deposit;
    setDepositBusy(true);
    setError('');
    try {
      await api.updateDepositSettings(
        unitId,
        { requiresDeposit: nextValue, depositAmountExpected: nextValue && depositAmountDraft ? Number(depositAmountDraft) : undefined },
        token
      );
      setNotice(nextValue ? 'This unit now shows as requiring a deposit.' : 'This unit now shows as not requiring a deposit.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDepositBusy(false);
    }
  }

  async function handleSaveDepositAmount() {
    setDepositBusy(true);
    setError('');
    try {
      await api.updateDepositSettings(
        unitId,
        { requiresDeposit: true, depositAmountExpected: depositAmountDraft ? Number(depositAmountDraft) : undefined },
        token
      );
      setNotice('Expected deposit amount saved.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDepositBusy(false);
    }
  }

  async function loadPortfolioUnitsForDepositScope() {
    if (portfolioUnits || portfolioUnitsLoading) return;
    setPortfolioUnitsLoading(true);
    try {
      // No propertyId filter here on purpose - "all units" means the
      // landlord's entire portfolio, not just this unit's property, and
      // "selected units" should let a landlord pick across properties.
      const res = await api.listUnits(token);
      setPortfolioUnits((res.units || []).filter((u) => u.id !== unitId));
    } catch (err) {
      setError(err.message);
    } finally {
      setPortfolioUnitsLoading(false);
    }
  }

  function handleDepositScopeChange(nextScope) {
    setDepositScope(nextScope);
    setSelectedDepositUnitIds([]);
    setLastDepositApplied(null);
    if (nextScope !== 'unit') {
      setBulkDepositRequires(!!unit.requires_deposit);
      setBulkDepositAmount(unit.deposit_amount_expected ?? '');
      loadPortfolioUnitsForDepositScope();
    }
  }

  function toggleDepositUnitSelection(id) {
    setSelectedDepositUnitIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function handleApplyBulkDeposit(e) {
    e.preventDefault();
    if (depositScope === 'selected' && selectedDepositUnitIds.length === 0) {
      setError('Select at least one unit to apply this deposit setting to.');
      return;
    }
    setDepositBusy(true);
    setError('');
    try {
      const payload = {
        scope: depositScope,
        requiresDeposit: bulkDepositRequires,
        depositAmountExpected: bulkDepositRequires && bulkDepositAmount ? Number(bulkDepositAmount) : undefined,
      };
      if (depositScope === 'selected') {
        // Same "always include the unit this page is on" behavior as
        // the extra-charges scope picker below.
        payload.unitIds = Array.from(new Set([unitId, ...selectedDepositUnitIds]));
      }
      const res = await api.bulkUpdateDepositSettings(payload, token);
      setNotice(res.message || `Deposit setting applied to ${res.updated} unit(s).`);
      setLastDepositApplied({
        scope: depositScope,
        count: res.updated,
        requiresDeposit: bulkDepositRequires,
        amount: bulkDepositRequires ? bulkDepositAmount : null,
      });
      setDepositScope('unit');
      setSelectedDepositUnitIds([]);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDepositBusy(false);
    }
  }

  async function handleSaveRent() {
    if (rentEffectiveOption === 'custom' && !rentEffectiveDate) {
      setError('Pick a date for the rent change, or choose Immediately / Next month instead.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.updateRent(
        unitId,
        {
          newRentAmount: Number(rentDraft),
          effectiveOption: rentEffectiveOption,
          effectiveDate: rentEffectiveOption === 'custom' ? rentEffectiveDate : undefined,
        },
        token
      );
      setNotice(res.message || (res.tenantNotified ? 'Rent updated and tenant notified.' : 'Rent updated.'));
      setEditingRent(false);
      setRentEffectiveOption('immediately');
      setRentEffectiveDate('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDueDate() {
    setBusy(true);
    setError('');
    try {
      const res = await api.updateDueDate(unitId, { newDueDayOfMonth: Number(dueDateDraft) }, token);
      setNotice(res.tenantNotified ? 'Due date updated and tenant notified.' : 'Due date updated.');
      setEditingDueDate(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePaymentOverride() {
    setBusy(true);
    setError('');
    try {
      const res = await api.updateUnitPaymentOverride(
        unitId,
        {
          enabled: paymentOverrideDraft.enabled,
          method: paymentOverrideDraft.method,
          paybillNumber: paymentOverrideDraft.paybillNumber,
          accountNumber: paymentOverrideDraft.accountNumber,
          tillNumber: paymentOverrideDraft.tillNumber,
        },
        token
      );
      setNotice(res.message || 'Payment method saved for this unit.');
      setEditingPaymentOverride(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadPropertyUnitsForScope() {
    if (propertyUnits || propertyUnitsLoading || !unit?.property_id) return;
    setPropertyUnitsLoading(true);
    try {
      const res = await api.listUnits(token, unit.property_id);
      setPropertyUnits((res.units || []).filter((u) => u.id !== unitId));
    } catch (err) {
      setError(err.message);
    } finally {
      setPropertyUnitsLoading(false);
    }
  }

  function handleChargeScopeChange(nextScope) {
    setChargeScope(nextScope);
    setSelectedChargeUnitIds([]);
    if (nextScope !== 'unit') loadPropertyUnitsForScope();
  }

  function toggleChargeUnitSelection(id) {
    setSelectedChargeUnitIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function handleAddCharge(e) {
    e.preventDefault();
    if (!chargeDraft.name || !chargeDraft.amount) return;
    if (chargeScope === 'units' && selectedChargeUnitIds.length === 0) {
      setError('Select at least one unit to apply this charge to.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = { name: chargeDraft.name, amount: Number(chargeDraft.amount), recurring: chargeDraft.recurring, scope: chargeScope };
      if (chargeScope === 'units') {
        // The current unit is the one this page is already on - always
        // include it, so "specific units" means "this one plus whichever
        // others were picked", not "only the others".
        payload.unitIds = Array.from(new Set([unitId, ...selectedChargeUnitIds]));
      }
      const res = await api.addExtraCharge(unitId, payload, token);
      setChargeDraft({ name: '', amount: '', recurring: true });
      setChargeScope('unit');
      setSelectedChargeUnitIds([]);
      // BUG FIX (item 12 review): the backend already reports which
      // selected units were skipped for being frozen, and - for
      // one-time charges - which affected units had no active tenant
      // to actually bill. The UI was silently dropping both, so a
      // landlord charging several units at once had no way to tell
      // fewer units were charged than they picked, or why.
      let notice = res.message || (chargeDraft.recurring ? 'Recurring charge added - will bill every month from next cycle.' : 'One-time charge billed to the current tenant now.');
      const extraNotes = [];
      if (res.skippedFrozenUnits?.length) {
        extraNotes.push(`Skipped (frozen): ${res.skippedFrozenUnits.join(', ')}.`);
      }
      if (res.unitsWithNoTenant?.length) {
        extraNotes.push(`No active tenant to bill: ${res.unitsWithNoTenant.join(', ')}.`);
      }
      if (extraNotes.length) notice = `${notice} ${extraNotes.join(' ')}`;
      setNotice(notice);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemind() {
    setBusy(true);
    setError('');
    try {
      const res = await api.remindTenant(activeTenant.id, token);
      // Backend short-circuits (skipped: true) instead of texting a
      // tenant who's already paid ahead - surface that explanation
      // instead of the generic "Reminder sent" success message.
      setNotice(res.skipped ? res.message : `Reminder sent to ${activeTenant.full_name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Section 5: WhatsApp channel for the same "Remind" button - opens a
  // wa.me deep link on the landlord's own device with the reminder
  // pre-filled, instead of sending an SMS.
  async function handleWhatsAppRemind() {
    setBusy(true);
    setError('');
    try {
      const res = await api.getWhatsAppReminderInfo(activeTenant.id, token);
      if (res.skipped) {
        setNotice(res.message);
      } else {
        openWhatsAppReminder(res.phone, res.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openTransferModal() {
    try {
      const res = await api.listUnits(token);
      setAvailableUnits((res.units || []).filter((u) => u.status === 'vacant' && u.id !== unitId));
      setShowTransferModal(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleArchiveTenant() {
    setBusy(true);
    setError('');
    try {
      await api.deleteTenant(activeTenant.id, token);
      setShowArchiveConfirm(false);
      toast.success('Tenant archived and unit marked vacant.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteUnit() {
    setDeleteUnitBusy(true);
    setDeleteUnitError('');
    try {
      const unitName = unit?.unit_name;
      await api.removeUnit(unitId, token);
      toast.success(unitName ? `Unit ${unitName} deleted.` : 'Unit deleted.');
      navigate('/dashboard');
    } catch (err) {
      setDeleteUnitError(err.message);
    } finally {
      setDeleteUnitBusy(false);
    }
  }

  if (loading && !unit) {
    return (
      <div className="unit-detail-page unit-detail-page--center">
        <Skeleton variant="card" count={1} />
        <Skeleton rows={5} />
      </div>
    );
  }
  if (error && !unit) {
    return (
      <div className="unit-detail-page unit-detail-page--center">
        <p>{error}</p>
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
      </div>
    );
  }

  const chargesTotal = (unit.extra_charges || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);

  return (
    <div className="unit-detail-page">
      <div className="unit-detail-back-row">
        <Link to="/dashboard" className="unit-detail-back">← Dashboard</Link>
      </div>

      {notice && <div className="unit-detail-banner unit-detail-banner--ok">{notice}</div>}
      {error && <div className="unit-detail-banner unit-detail-banner--error">{error}</div>}

      <div className="unit-detail-grid">
        {/* Card 1: Unit Info (redesign spec section 3, card order #1) */}
        <section className="unit-detail-card">
          <h2 className="unit-detail-card__header">Unit info</h2>
          <div className="unit-info-name-row">
            <h1 className="unit-info-name">Unit {unit.unit_name}</h1>
          </div>
          <p className="unit-detail-type">{unit.unit_type}</p>
          <span className="unit-detail-code">{unit.unit_payment_code}</span>
        </section>

        {/* Card 2: Photos (redesign spec card order #2) - the separate
            yellow "no photos" banner is gone; UnitPhotosPanel already
            shows its own empty state (an upload dropzone when
            canEdit, or "No photos added yet." otherwise), so there's
            no longer a duplicate banner living above this card. */}
        <section className="unit-detail-card">
          <h2 className="unit-detail-card__header">Photos</h2>
          <UnitPhotosPanel
            unitId={unitId}
            propertyId={unit.property_id}
            photoUrls={unit.photo_urls || []}
            token={token}
            canEdit={!isCaretaker}
            onChange={(newUrls) => setUnit((u) => ({ ...u, photo_urls: newUrls }))}
          />
        </section>

        {/* Card 3: Listing Status (redesign spec card order #3) -
            combines the auto-detected occupancy badge (section 1) and
            the listing-freshness refresh prompt (section 2). Occupancy
            is derived purely from whether an active tenant record
            exists - not from the raw unit.status column, which can
            also be 'maintenance' or 'notice_given' independent of
            tenancy. A unit with no active tenant reads as "Vacant"
            here regardless of which of those the backend has it set
            to, matching the spec's binary Occupied/Vacant model; a
            unit on notice_given still has an active (outgoing) tenant
            so it correctly still reads as Occupied. */}
        <section className="unit-detail-card">
          <h2 className="unit-detail-card__header">Listing status</h2>
          <span className={`occupancy-badge ${activeTenant ? 'occupancy-badge--occupied' : 'occupancy-badge--vacant'}`}>
            {activeTenant ? '🟢 Occupied' : '⚪ Vacant'}
          </span>
          {unit.status === 'notice_given' && (
            <p className="unit-detail-hint">
              Tenant has given vacating notice for {unit.tenants?.find((t) => t.notice_given)?.notice_date}. Revoke below if this was a mistake.
            </p>
          )}
          {!activeTenant && (
            <div className="listing-freshness">
              {(() => {
                const referenceDate = unit.updated_at || unit.created_at;
                const days = referenceDate ? Math.max(0, Math.floor((Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24))) : null;
                return days !== null ? (
                  <p className="unit-detail-hint listing-freshness__label">Listed {days} day{days === 1 ? '' : 's'} ago</p>
                ) : null;
              })()}
              <Button type="button" variant="secondary" loading={verifyBusy} onClick={handleVerifyUnit}>
                Still looking for tenant - refresh listing
              </Button>
            </div>
          )}

          {/* Existing per-unit listing settings (deposit requirement,
              description, public-listing opt-in) - unchanged behavior,
              grouped into this same card since they're all about how
              this unit appears on the public listings page. */}
          <div className="unit-detail-hint u-divider-top">
            {/* FEATURE (Landlord Bulk Deposit Assignment): scope
                selector - who this deposit setting applies to. Kept
                separate from the unit-picker area below so "this unit"
                keeps its original instant toggle-on-click behavior
                unchanged. */}
            {!isCaretaker && (
              <div className="add-charge-form__scope u-mb-2">
                <label className="add-charge-form__scope-label">Apply deposit setting to</label>
                <select value={depositScope} onChange={(e) => handleDepositScopeChange(e.target.value)}>
                  <option value="unit">Just this unit ({unit.unit_name})</option>
                  <option value="all">All units (entire portfolio)</option>
                  <option value="selected">Selected units…</option>
                </select>
              </div>
            )}

            {lastDepositApplied && (
              <p className="bulk-deposit-form__applied-note">
                ✓ Applied to {lastDepositApplied.scope === 'all' ? 'all units in your portfolio' : `${lastDepositApplied.count} selected unit(s)`}
                {lastDepositApplied.requiresDeposit
                  ? ` - now requires a deposit${lastDepositApplied.amount ? ` of KES ${Number(lastDepositApplied.amount).toLocaleString()}` : ''}.`
                  : ' - no longer requires a deposit.'}
              </p>
            )}

            {depositScope === 'unit' && (
              <>
                <label className="u-checkbox-row u-checkbox-row--strong u-checkbox-row--wrap">
                  <input
                    type="checkbox"
                    checked={!!unit.requires_deposit}
                    disabled={depositBusy}
                    onChange={handleToggleRequiresDeposit}
                  />
                  <span>
                    This unit requires a deposit from a future tenant
                    <InfoTip
                      text={
                        unit.requires_deposit
                          ? 'Prospective tenants browsing the public listing will see this unit requires a deposit.'
                          : 'Prospective tenants browsing the public listing will see this unit does not require a deposit.'
                      }
                    />
                  </span>
                </label>
                {unit.requires_deposit && (
                  <div className="u-flex-row u-mt-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Expected deposit amount (optional, KES)"
                      defaultValue={unit.deposit_amount_expected ?? ''}
                      onChange={(e) => setDepositAmountDraft(e.target.value)}
                      className="u-max-240"
                    />
                    <Button type="button" variant="ghost" loading={depositBusy} onClick={handleSaveDepositAmount}>
                      Save amount
                    </Button>
                  </div>
                )}
              </>
            )}

            {(depositScope === 'all' || depositScope === 'selected') && (
              <form className="bulk-deposit-form" onSubmit={handleApplyBulkDeposit}>
                <label className="u-checkbox-row u-checkbox-row--strong u-checkbox-row--wrap">
                  <input
                    type="checkbox"
                    checked={bulkDepositRequires}
                    onChange={(e) => setBulkDepositRequires(e.target.checked)}
                  />
                  <span>Requires a deposit from a future tenant</span>
                </label>
                {bulkDepositRequires && (
                  <input
                    type="number"
                    min="0"
                    placeholder="Expected deposit amount (optional, KES)"
                    value={bulkDepositAmount}
                    onChange={(e) => setBulkDepositAmount(e.target.value)}
                    className="u-max-240"
                  />
                )}

                {depositScope === 'selected' && (
                  <div className="add-charge-form__unit-picker u-mt-2">
                    {portfolioUnitsLoading && <p className="add-charge-form__hint">Loading units…</p>}
                    {!portfolioUnitsLoading && portfolioUnits?.length === 0 && (
                      <p className="add-charge-form__hint">No other units in your portfolio.</p>
                    )}
                    {!portfolioUnitsLoading && portfolioUnits?.length > 0 && (
                      <>
                        <p className="add-charge-form__hint">{unit.unit_name} is included automatically - pick any others to add:</p>
                        <div className="add-charge-form__unit-list">
                          {portfolioUnits.map((u) => (
                            <label key={u.id} className="add-charge-form__unit-option">
                              <input
                                type="checkbox"
                                checked={selectedDepositUnitIds.includes(u.id)}
                                onChange={() => toggleDepositUnitSelection(u.id)}
                              />
                              {u.unit_name}
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button type="submit" className="bulk-deposit-form__submit" disabled={depositBusy}>
                  {depositBusy ? 'Applying…' : `Apply to ${depositScope === 'all' ? 'all units' : 'selected units'}`}
                </button>
              </form>
            )}
          </div>

          <div className="unit-detail-hint u-divider-top">
            <label className="u-checkbox-row u-checkbox-row--strong u-checkbox-row--wrap">
              {/* FIX (direct request): a unit should be listed on the
                  public listings page by default when vacant - only
                  a landlord who has actually unticked this should be
                  private. is_publicly_listed defaults to true in the
                  database, but !!unit.is_publicly_listed treated any
                  missing/not-yet-loaded value as false (unchecked).
                  Only an explicit false should show as unchecked. */}
              <input
                type="checkbox"
                checked={unit.is_publicly_listed !== false}
                disabled={listingBusy}
                onChange={handleTogglePublicListing}
              />
              <span>
                List this unit on the public listings page when vacant
                <InfoTip
                  text={
                    `Heads up: anyone browsing RentaPay's free listings page - no account needed - will be able to see this unit and message the WhatsApp number on file for it (your manager/caretaker's number, or yours if none is set) directly. There's no way to screen who reaches out first. ${
                      unit.is_publicly_listed
                        ? "This unit is currently public and will show up there once it's vacant."
                        : "This unit is currently private - it will never appear on RentaPay's public listings page, even while vacant."
                    }`
                  }
                />
              </span>
            </label>
          </div>
        </section>

        {/* Card 4: Rent & Due Date (redesign spec card order #4) */}
        <section className="unit-detail-card">
          <h2 className="unit-detail-card__header">Rent &amp; due date</h2>
          {pendingRentChange && (
            <p className="unit-detail-hint unit-detail-hint--scheduled">
              Change to KES {Number(pendingRentChange.new_amount).toLocaleString()} takes effect on{' '}
              {new Date(pendingRentChange.effective_date).toLocaleDateString('en-GB')}.
            </p>
          )}
          <div className="edit-row">
            <span className="edit-row__label">Monthly rent</span>
            {editingRent ? (
              <div className="edit-row__editing edit-row__editing--stacked">
                <input type="number" value={rentDraft} onChange={(e) => setRentDraft(e.target.value)} />
                <div className="rent-effective-picker" role="radiogroup" aria-label="When should this take effect?">
                  <label>
                    <input
                      type="radio"
                      name="rentEffective"
                      checked={rentEffectiveOption === 'immediately'}
                      onChange={() => setRentEffectiveOption('immediately')}
                    />
                    Immediately
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="rentEffective"
                      checked={rentEffectiveOption === 'next_month'}
                      onChange={() => setRentEffectiveOption('next_month')}
                    />
                    Next month
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="rentEffective"
                      checked={rentEffectiveOption === 'custom'}
                      onChange={() => setRentEffectiveOption('custom')}
                    />
                    On a specific date
                  </label>
                  {rentEffectiveOption === 'custom' && (
                    <input
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={rentEffectiveDate}
                      onChange={(e) => setRentEffectiveDate(e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <button onClick={handleSaveRent} disabled={busy}>Save</button>
                  <button onClick={() => { setEditingRent(false); setRentEffectiveOption('immediately'); setRentEffectiveDate(''); }} className="ghost-link">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="edit-row__display">
                <span>KES {Number(unit.rent_amount).toLocaleString()}</span>
                {!isCaretaker && <button className="ghost-link" onClick={() => setEditingRent(true)}>Change</button>}
              </div>
            )}
          </div>
          <div className="edit-row">
            <span className="edit-row__label">Due day of month</span>
            {editingDueDate ? (
              <div className="edit-row__editing">
                <input type="number" min="1" max="28" value={dueDateDraft} onChange={(e) => setDueDateDraft(e.target.value)} />
                <button onClick={handleSaveDueDate} disabled={busy}>Save</button>
                <button onClick={() => setEditingDueDate(false)} className="ghost-link">Cancel</button>
              </div>
            ) : (
              <div className="edit-row__display">
                <span>Day {unit.due_day_of_month}</span>
                <button className="ghost-link" onClick={() => setEditingDueDate(true)}>Change</button>
              </div>
            )}
          </div>
        </section>

        {/* Card 5: Payment Method (redesign spec card order #5) */}
        <section className="unit-detail-card">
          <h2 className="unit-detail-card__header">
            Payment method
            <InfoTip text="By default this unit uses the general payment method set in Settings. Turn this on to use a different Paybill/Till/STK setup just for this unit - only this unit's tenant will see it." />
          </h2>
          {editingPaymentOverride ? (
            <div className="edit-row__editing edit-row__editing--stacked">
              <label className="u-flex-row">
                <input
                  type="checkbox"
                  checked={paymentOverrideDraft.enabled}
                  onChange={(e) => setPaymentOverrideDraft((d) => ({ ...d, enabled: e.target.checked }))}
                />
                Use a different payment method for this unit
              </label>
              {paymentOverrideDraft.enabled && (
                <>
                  <select
                    value={paymentOverrideDraft.method}
                    onChange={(e) => setPaymentOverrideDraft((d) => ({ ...d, method: e.target.value }))}
                  >
                    <option value="stk">STK Push</option>
                    <option value="paybill">Paybill</option>
                    <option value="till">Till Number</option>
                  </select>
                  {paymentOverrideDraft.method === 'paybill' && (
                    <>
                      <input
                        placeholder="Paybill number"
                        value={paymentOverrideDraft.paybillNumber}
                        onChange={(e) => setPaymentOverrideDraft((d) => ({ ...d, paybillNumber: e.target.value }))}
                      />
                      <input
                        placeholder="Account number"
                        value={paymentOverrideDraft.accountNumber}
                        onChange={(e) => setPaymentOverrideDraft((d) => ({ ...d, accountNumber: e.target.value }))}
                      />
                    </>
                  )}
                  {paymentOverrideDraft.method === 'till' && (
                    <input
                      placeholder="Till number"
                      value={paymentOverrideDraft.tillNumber}
                      onChange={(e) => setPaymentOverrideDraft((d) => ({ ...d, tillNumber: e.target.value }))}
                    />
                  )}
                </>
              )}
              <div>
                <button onClick={handleSavePaymentOverride} disabled={busy}>Save</button>
                <button onClick={() => setEditingPaymentOverride(false)} className="ghost-link">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="edit-row__display">
              <span>
                {unit.payment_override_enabled ? (
                  <>
                    Override active - {unit.payment_override_method === 'paybill' && (
                      <>Paybill {unit.payment_override_paybill_number || '-'}{unit.payment_override_paybill_account_number && ` · Acc ${unit.payment_override_paybill_account_number}`}</>
                    )}
                    {unit.payment_override_method === 'till' && <>Till Number {unit.payment_override_till_number || '-'}</>}
                    {unit.payment_override_method === 'stk' && <>STK Push</>}
                  </>
                ) : (
                  'Using the general default payment method'
                )}
              </span>
              {!isCaretaker && (
                <button className="ghost-link" onClick={() => setEditingPaymentOverride(true)}>
                  {unit.payment_override_enabled ? 'Change' : 'Set override'}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Card 6: Extra Charges (redesign spec card order #6) */}
        <section className="unit-detail-card">
          <h2 className="unit-detail-card__header">Extra charges</h2>
          {(unit.extra_charges || []).length > 0 && (
            <ul className="charges-list">
              {unit.extra_charges.map((c, i) => (
                <li key={i}>
                  <span>{c.name}</span>
                  <span>KES {Number(c.amount).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
          {!isCaretaker && (
            <form className="add-charge-form" onSubmit={handleAddCharge}>
              <input placeholder="Name (e.g. Water)" value={chargeDraft.name} onChange={(e) => setChargeDraft((d) => ({ ...d, name: e.target.value }))} />
              <input type="number" placeholder="KES" value={chargeDraft.amount} onChange={(e) => setChargeDraft((d) => ({ ...d, amount: e.target.value }))} />
              <select value={chargeDraft.recurring ? 'recurring' : 'once'} onChange={(e) => setChargeDraft((d) => ({ ...d, recurring: e.target.value === 'recurring' }))}>
                <option value="recurring">Every month</option>
                <option value="once">One-time only</option>
              </select>

              {/* FEATURE (spec item 12): scope selection - who this
                  charge applies to. Only shown when the unit belongs
                  to a property (an ungrouped/standalone unit has
                  nothing to scope beyond itself). */}
              {unit.property_id && (
                <div className="add-charge-form__scope">
                  <label className="add-charge-form__scope-label">Apply to</label>
                  <select value={chargeScope} onChange={(e) => handleChargeScopeChange(e.target.value)}>
                    <option value="unit">Just this unit ({unit.unit_name})</option>
                    <option value="property">All units in this property</option>
                    <option value="units">Specific units…</option>
                  </select>

                  {chargeScope === 'units' && (
                    <div className="add-charge-form__unit-picker">
                      {propertyUnitsLoading && <p className="add-charge-form__hint">Loading units…</p>}
                      {!propertyUnitsLoading && propertyUnits?.length === 0 && (
                        <p className="add-charge-form__hint">No other units in this property.</p>
                      )}
                      {!propertyUnitsLoading && propertyUnits?.length > 0 && (
                        <>
                          <p className="add-charge-form__hint">{unit.unit_name} is included automatically - pick any others to add:</p>
                          <div className="add-charge-form__unit-list">
                            {propertyUnits.map((u) => (
                              <label
                                key={u.id}
                                className="add-charge-form__unit-option"
                                title={u.is_frozen ? 'This unit is frozen (subscription covers fewer units than you have) - selecting it will have no effect until you upgrade.' : undefined}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedChargeUnitIds.includes(u.id)}
                                  onChange={() => toggleChargeUnitSelection(u.id)}
                                  disabled={u.is_frozen}
                                />
                                {u.unit_name}
                                {u.is_frozen && <span className="add-charge-form__unit-frozen-tag"> (frozen)</span>}
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={busy}>+ Add</button>
            </form>
          )}
          <div className="charges-total">
            <span>Rent + charges total</span>
            <span>KES {(Number(unit.rent_amount) + chargesTotal).toLocaleString()}</span>
          </div>
        </section>

        {/* Card 7: Tenant (redesign spec card order #7) */}
        <section className="unit-detail-card unit-detail-card--wide">
          <h2 className="unit-detail-card__header">Tenant</h2>
          {activeTenant ? (
            <div className="tenant-panel">
              <div className="tenant-panel__info">
                <span className="tenant-panel__name u-flex-row">
                  {activeTenant.full_name}
                  <TenantContactCard tenant={{ ...activeTenant, unit_name: unit.unit_name }} size={26} token={token} canRate />
                </span>
                <span className="tenant-panel__phone">{activeTenant.primary_phone}</span>
                {(() => {
                  const rentAmount = activeTenant.rent_override || unit.rent_amount;
                  const dueDay = activeTenant.due_day_of_month || unit.due_day_of_month;
                  const prepayment = getPrepaymentSummary(activeTenant.balance_due, rentAmount, dueDay);
                  if (prepayment.isAhead) {
                    return (
                      <span className="tenant-panel__balance tenant-panel__balance--ahead">
                        Paid ahead by KES {prepayment.creditAmount.toLocaleString()}
                        <br />
                        Covers the next {prepayment.monthsCovered} month{prepayment.monthsCovered === 1 ? '' : 's'}. Next payment: KES{' '}
                        {prepayment.nextPaymentAmount.toLocaleString()}, due on {prepayment.nextPaymentDueDate.toLocaleDateString('en-GB')}.
                      </span>
                    );
                  }
                  return (
                    <span className={`tenant-panel__balance ${Number(activeTenant.balance_due) > 0 ? 'tenant-panel__balance--owing' : ''}`}>
                      {Number(activeTenant.balance_due) > 0 ? `Owes KES ${Number(activeTenant.balance_due).toLocaleString()}` : 'No outstanding balance'}
                    </span>
                  );
                })()}
                {activeTenant.deposit_amount ? (
                  <span className="tenant-panel__deposit">
                    Deposit: KES {Number(activeTenant.deposit_amount).toLocaleString()}
                    {activeTenant.deposit_status === 'held' && ' (held)'}
                    {activeTenant.deposit_status === 'refunded' && ' - fully refunded'}
                    {activeTenant.deposit_status === 'partially_refunded' && ` - KES ${Number(activeTenant.deposit_refunded_amount || 0).toLocaleString()} refunded`}
                    {activeTenant.deposit_status === 'forfeited' && ' - withheld'}
                  </span>
                ) : null}
              </div>
              <div className="tenant-panel__actions">
                <button onClick={() => setShowEditTenantModal(true)}>Edit details</button>
                <button onClick={handleRemind} disabled={busy}>Remind</button>
                <button onClick={handleWhatsAppRemind} disabled={busy} title="Send this reminder via WhatsApp">WhatsApp</button>
                {!isCaretaker && <button onClick={() => setShowPaymentModal(true)}>Record payment</button>}
                {!isCaretaker && <button onClick={() => setShowBalanceModal(true)}>Edit balance</button>}
                <TenantRatingPanel tenantId={activeTenant.id} token={token} />
                {!isCaretaker && activeTenant.deposit_amount && activeTenant.deposit_status === 'held' && (
                  <button onClick={() => setShowDepositModal(true)}>Settle deposit</button>
                )}
                {!isCaretaker && <button onClick={openTransferModal}>Transfer</button>}
                {activeTenant.notice_given && (
                  <button onClick={() => setShowRevokeModal(true)} className="danger-link">Revoke notice</button>
                )}
                {!isCaretaker && (
                  <button onClick={() => setShowArchiveConfirm(true)} className="danger-link">Archive tenant</button>
                )}
              </div>
            </div>
          ) : (
            <div className="unit-detail-empty-state">
              <p>No tenant in this unit.</p>
              {unit?.tenantLocked ? (
                <>
                  <Button variant="primary" disabled title="Available once you subscribe">+ Add Tenant</Button>
                  <p className="unit-detail-trial-lock-note">
                    This unit opens up for tenants once you subscribe. Your free trial covers tenants on your first {unit?.trialTenantUnitLimit} units only.
                  </p>
                </>
              ) : (
                <Button variant="primary" onClick={() => navigate(`/units/${unitId}/add-tenant`)}>+ Add Tenant</Button>
              )}
            </div>
          )}
        </section>

        {/* Lease/document storage - not one of the redesign spec's 8
            numbered cards, but existing functionality kept as-is
            (just restyled to match), not removed - the spec only
            describes a visual/structural redesign plus one bug fix,
            not a feature removal. Landlord/manager can upload a
            lease to the current tenant; the tenant can view but not
            delete it (see DocumentsPanel.jsx / document.controller.js).
            DocumentsPanel renders its own "Documents" heading. */}
        {activeTenant && (
          <section className="unit-detail-card unit-detail-card--wide">
            <DocumentsPanel token={token} tenantId={activeTenant.id} canManage={!isCaretaker} />
          </section>
        )}

        {/* Card 8: Payment History (redesign spec card order #8) */}
        <section className="unit-detail-card unit-detail-card--wide">
          <div className="tenant-section__header-row">
            <h2 className="unit-detail-card__header">Payment history</h2>
            {payments.length > 0 && (
              <button
                className="ghost-link"
                onClick={() =>
                  downloadCsv(
                    `rentapay-payment-history-${unit.unit_name || unitId}`,
                    ['Date', 'Amount (KES)', 'Method', 'Status'],
                    payments.map((p) => [
                      p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '-',
                      p.amount,
                      p.payment_method.replace('_', ' '),
                      p.status,
                    ])
                  )
                }
              >
                Download
              </button>
            )}
          </div>
          {payments.length === 0 ? (
            <div className="unit-detail-empty-state">
              <p>No payments recorded yet.</p>
            </div>
          ) : (
            <div className="payments-table-wrap">
              <table className="payments-table">
                <thead>
                  <tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '-'}</td>
                      <td>KES {Number(p.amount).toLocaleString()}</td>
                      <td>{p.payment_method.replace('_', ' ')}</td>
                      <td><span className={`payment-status payment-status--${p.status}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Destructive action (redesign spec section 4): moved away
          from routine actions (it used to sit right beside Rename
          with equal visual weight), now a lower-emphasis plain-red
          text link at the very bottom of the page. Still requires a
          confirmation step - the existing type-the-unit-name
          ConfirmDialog below, which is a stronger safeguard than the
          spec's minimum bar of "a confirmation step". */}
      <div className="unit-detail-danger-zone">
        <button
          type="button"
          className="unit-detail-delete-link"
          onClick={() => { setDeleteUnitError(''); setShowDeleteUnitConfirm(true); }}
        >
          Delete unit
        </button>
      </div>

      {showBalanceModal && activeTenant && (
        <EditBalanceModal tenant={activeTenant} token={token} onClose={() => setShowBalanceModal(false)} onDone={() => { setShowBalanceModal(false); setNotice('Balance updated.'); load(); }} />
      )}
      {showDepositModal && activeTenant && (
        <SettleDepositModal tenant={activeTenant} token={token} onClose={() => setShowDepositModal(false)} onDone={() => { setShowDepositModal(false); setNotice('Deposit settled.'); load(); }} />
      )}
      {showRevokeModal && activeTenant && (
        <RevokeNoticeModal tenant={activeTenant} token={token} onClose={() => setShowRevokeModal(false)} onDone={() => { setShowRevokeModal(false); setNotice('Notice revoked.'); load(); }} />
      )}
      {showPaymentModal && activeTenant && (
        <RecordPaymentModal tenant={activeTenant} token={token} onClose={() => setShowPaymentModal(false)} onDone={() => { setShowPaymentModal(false); setNotice('Payment recorded.'); load(); }} />
      )}
      {showTransferModal && activeTenant && (
        <TransferModal tenant={activeTenant} availableUnits={availableUnits} token={token} onClose={() => setShowTransferModal(false)} onDone={() => { setShowTransferModal(false); navigate('/dashboard'); }} />
      )}
      {showEditTenantModal && activeTenant && (
        <EditTenantModal tenant={activeTenant} token={token} onClose={() => setShowEditTenantModal(false)} onDone={() => { setShowEditTenantModal(false); setNotice('Tenant details updated.'); load(); }} />
      )}
      {showArchiveConfirm && activeTenant && (
        <ModalShell title={`Archive ${activeTenant.full_name}?`} onClose={() => setShowArchiveConfirm(false)}>
          <div className="modal-form">
            {error && <p className="modal-error">{error}</p>}
            <p className="unit-detail-hint">
              This removes {activeTenant.full_name} as the active tenant and marks this unit vacant. Their payment history is kept, and you can add a new tenant to this unit right away.
            </p>
            <div className="u-flex-end">
              <button type="button" className="ghost-link" onClick={() => setShowArchiveConfirm(false)}>Cancel</button>
              <Button variant="primary" onClick={handleArchiveTenant} loading={busy}>Archive tenant</Button>
            </div>
          </div>
        </ModalShell>
      )}

      <ConfirmDialog
        open={showDeleteUnitConfirm}
        title="Delete this unit permanently?"
        message={`This permanently deletes Unit ${unit.unit_name} and all of its history. Tenants currently assigned to it must be removed or transferred first. This cannot be undone.`}
        confirmLabel="Delete unit permanently"
        typeToConfirm={unit.unit_name}
        busy={deleteUnitBusy}
        error={deleteUnitError}
        onConfirm={handleDeleteUnit}
        onCancel={() => { setShowDeleteUnitConfirm(false); setDeleteUnitError(''); }}
      />
    </div>
  );
}

// -----------------------------------------------------------------
// Small inline modals - kept in this file since each is only used
// here and is short; not worth splitting into separate files yet.
// ModalShell itself now lives in components/ModalShell.jsx since
// TenantRatingPanel needs it too.
// -----------------------------------------------------------------

function EditBalanceModal({ tenant, token, onClose, onDone }) {
  const [newBalance, setNewBalance] = useState(tenant.balance_due || 0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    try {
      await api.editTenantBalance(tenant.id, { newBalance: Number(newBalance), reason }, token);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Edit balance for ${tenant.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        {error && <p className="modal-error">{error}</p>}
        <label className="form-field__label">New balance (KES)</label>
        <input type="number" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} />
        <label className="form-field__label">Reason (required)</label>
        <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        <Button type="submit" variant="primary" loading={busy}>Save</Button>
      </form>
    </ModalShell>
  );
}

function SettleDepositModal({ tenant, token, onClose, onDone }) {
  const [status, setStatus] = useState('refunded');
  const [refundedAmount, setRefundedAmount] = useState(tenant.deposit_amount || 0);
  const [deductionReason, setDeductionReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (status !== 'refunded' && !deductionReason) {
      setError('A reason is required whenever any part of the deposit is withheld.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.settleTenantDeposit(
        tenant.id,
        { status, refundedAmount: status === 'forfeited' ? 0 : Number(refundedAmount), deductionReason: deductionReason || undefined },
        token
      );
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Settle deposit for ${tenant.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        {error && <p className="modal-error">{error}</p>}
        <p className="unit-detail-hint">
          Deposit collected: KES {Number(tenant.deposit_amount).toLocaleString()}. This never affects rent balance - it's a separate, refundable record.
        </p>
        <label className="form-field__label">Outcome</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="refunded">Full refund</option>
          <option value="partially_refunded">Partial refund (damages/arrears deducted)</option>
          <option value="forfeited">Fully withheld</option>
        </select>
        {status !== 'forfeited' && (
          <>
            <label className="form-field__label">Amount refunded (KES)</label>
            <input type="number" min="0" max={tenant.deposit_amount} value={refundedAmount} onChange={(e) => setRefundedAmount(e.target.value)} />
          </>
        )}
        {status !== 'refunded' && (
          <>
            <label className="form-field__label">Reason for withholding (required)</label>
            <textarea required value={deductionReason} onChange={(e) => setDeductionReason(e.target.value)} rows={3} placeholder="e.g. broken window, unpaid final month, cleaning" />
          </>
        )}
        <Button type="submit" variant="primary" loading={busy}>Save settlement</Button>
      </form>
    </ModalShell>
  );
}

function RevokeNoticeModal({ tenant, token, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    try {
      await api.revokeVacatingNotice(tenant.id, { reason }, token);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Revoke vacating notice for ${tenant.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        {error && <p className="modal-error">{error}</p>}
        <p className="unit-detail-hint">This puts the unit back to Occupied and notifies the tenant by email.</p>
        <label className="form-field__label">Reason (required)</label>
        <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        <Button type="submit" variant="primary" loading={busy}>Revoke notice</Button>
      </form>
    </ModalShell>
  );
}

// DIRECT REQUEST: "when a tenant submits a payment it should land as
// usual where payments are, not needing to manually record - the
// manual recording aspect can be covered under the normal record
// payment under tenant/unit... the bills should be included, only if
// the landlord or manager has included the meters." Tenant-submitted
// utility payments (STK or paybill-proof) already flow into the same
// place rent does automatically - see initiateUtilityStkPush and
// submitPaybillTransaction in payment.controller.js - so nothing
// changes there. This is the OTHER case: the landlord/manager
// recording a payment themselves (paid in person, bank transfer, one
// lump M-Pesa payment, etc.). That used to only exist for rent here,
// with a second, separate "Record a payment" entry point for utility
// bills tucked away in the Utility Meters panel. Now it's one place:
// this modal offers a target (Rent, or one of this tenant's own open
// water/electricity bills, fetched below), so there's nothing extra
// to go find. A tenant whose unit has no meter set up simply never
// gets any utility bills to see here - the picker only ever shows
// what actually applies to them.
function RecordPaymentModal({ tenant, token, onClose, onDone }) {
  const [target, setTarget] = useState('rent'); // 'rent' | a utility_invoices id
  const [openBills, setOpenBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [mpesaReference, setMpesaReference] = useState('');
  const [paidBy, setPaidBy] = useState('self');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listUtilityInvoicesForTenant(token, tenant.id)
      .then((res) => setOpenBills(res.invoices || []))
      .catch(() => setOpenBills([])) // no meters set up for this unit, or a load hiccup - either way, just fall back to Rent only
      .finally(() => setLoadingBills(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  const selectedBill = target !== 'rent' ? openBills.find((b) => b.id === target) : null;

  async function submit(e) {
    e.preventDefault();
    if (!amount || !paymentDate) return;
    setBusy(true);
    setError('');
    try {
      if (selectedBill) {
        await api.recordManualUtilityPayment({ invoiceId: selectedBill.id, amount: Number(amount), paymentDate, mpesaReference, note }, token);
      } else {
        await api.recordManualPayment({ tenantId: tenant.id, amount: Number(amount), paymentDate, mpesaReference, paidBy, note }, token);
      }
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Record payment for ${tenant.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        {error && <p className="modal-error">{error}</p>}

        {/* Only shown once loaded, and only offers bills that exist -
            for most tenants (no meter on their unit) this stays
            invisible and the form behaves exactly as it always has. */}
        {!loadingBills && openBills.length > 0 && (
          <>
            <label className="form-field__label">What is this payment for?</label>
            <select value={target} onChange={(e) => { setTarget(e.target.value); setAmount(''); }}>
              <option value="rent">Rent</option>
              {openBills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.utility_type === 'water' ? '💧' : '⚡'} {b.utility_type} bill - {b.month_key} (KES {(Number(b.amount) - Number(b.amount_paid || 0)).toLocaleString()} owed)
                </option>
              ))}
            </select>
          </>
        )}

        <label className="form-field__label">Amount paid (KES)</label>
        <input
          type="number"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={selectedBill ? `Owed: ${(Number(selectedBill.amount) - Number(selectedBill.amount_paid || 0)).toLocaleString()}` : undefined}
        />
        <label className="form-field__label">Date of payment</label>
        <input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        <label className="form-field__label">M-Pesa reference (optional)</label>
        <input value={mpesaReference} onChange={(e) => setMpesaReference(e.target.value)} />
        {!selectedBill && (
          <>
            <label className="form-field__label">Who paid?</label>
            <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              <option value="self">Tenant themselves</option>
              <option value="third_party">Third party</option>
            </select>
          </>
        )}
        <label className="form-field__label">Notes (optional)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <Button type="submit" variant="mpesa" loading={busy}>Record payment</Button>
      </form>
    </ModalShell>
  );
}

function EditTenantModal({ tenant, token, onClose, onDone }) {
  const [fullName, setFullName] = useState(tenant.full_name || '');
  const [secondaryPhone, setSecondaryPhone] = useState(tenant.secondary_phone || '');
  const [emergencyContactName, setEmergencyContactName] = useState(tenant.emergency_contact_name || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(tenant.emergency_contact_phone || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      // FIX (direct request: "a landlord or manager or caretaker
      // should not be able to edit a tenant's email... same as
      // tenants themselves"): email is intentionally left out of this
      // payload - it's a tenant's login identifier and the anchor for
      // their portable reputation, and the backend now rejects any
      // attempt to change it here too (see editTenantDetails).
      await api.editTenantDetails(
        tenant.id,
        { fullName, secondaryPhone, emergencyContactName, emergencyContactPhone },
        token
      );
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Edit ${tenant.full_name}'s details`} onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        {error && <p className="modal-error">{error}</p>}
        <label className="form-field__label">Full name</label>
        <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <label className="form-field__label">Secondary phone (optional)</label>
        <input value={secondaryPhone} onChange={(e) => setSecondaryPhone(e.target.value)} placeholder="07XXXXXXXX or 2547XXXXXXXX" />
        <label className="form-field__label">Email</label>
        <input type="email" value={tenant.email || ''} disabled title="A tenant's email cannot be changed after they are added - it's their login identifier and anchors their portable reputation." />
        <label className="form-field__label">Emergency contact name</label>
        <input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} />
        <label className="form-field__label">Emergency contact phone</label>
        <input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="07XXXXXXXX or 2547XXXXXXXX" />
        <Button type="submit" variant="primary" loading={busy}>Save changes</Button>
      </form>
    </ModalShell>
  );
}

function TransferModal({ tenant, availableUnits, token, onClose, onDone }) {
  const [newUnitId, setNewUnitId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!newUnitId) return;
    setBusy(true);
    try {
      await api.transferTenant(tenant.id, { newUnitId }, token);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Transfer ${tenant.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        {error && <p className="modal-error">{error}</p>}
        {availableUnits.length === 0 ? (
          <p className="unit-detail-hint">No vacant units available to transfer into.</p>
        ) : (
          <>
            <label className="form-field__label">Move to unit</label>
            <select required value={newUnitId} onChange={(e) => setNewUnitId(e.target.value)}>
              <option value="">Select a unit…</option>
              {availableUnits.map((u) => (
                <option key={u.id} value={u.id}>{u.unit_name} - KES {Number(u.rent_amount).toLocaleString()}</option>
              ))}
            </select>
            <Button type="submit" variant="primary" loading={busy}>Transfer tenant</Button>
          </>
        )}
      </form>
    </ModalShell>
  );
}
