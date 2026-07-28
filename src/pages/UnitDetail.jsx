import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
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
import { MissingPhotosBanner } from '../components/MissingPhotosNudge.jsx';
import { useToast } from '../components/Toast.jsx';
import './UnitDetail.css';
import './TenantPortal.css';

const STATUS_OPTIONS = [
  { value: 'occupied', label: 'Occupied' },
  { value: 'vacant', label: 'Vacant' },
];

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
  const token = sessionStorage.getItem('rentapay_token');
  const role = sessionStorage.getItem('rentapay_role');
  const isCaretaker = role === 'manager' && sessionStorage.getItem('rentapay_role_level') === 'caretaker';

  const [unit, setUnit] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); // success/info banner text

  // Inline-edit state
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editingRent, setEditingRent] = useState(false);
  const [rentDraft, setRentDraft] = useState('');
  const [rentEffectiveOption, setRentEffectiveOption] = useState('immediately'); // 'immediately' | 'next_month' | 'custom'
  const [rentEffectiveDate, setRentEffectiveDate] = useState('');
  const [pendingRentChange, setPendingRentChange] = useState(null);
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [dueDateDraft, setDueDateDraft] = useState('');
  const [chargeDraft, setChargeDraft] = useState({ name: '', amount: '', recurring: true });
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
      setNotice('Unit confirmed as still vacant.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyBusy(false);
    }
  }

  const [listingBusy, setListingBusy] = useState(false);
  // DIRECT REQUEST: landlord/manager/caretaker confirms whether this
  // vacant unit is still active, already booked, or planned for -
  // shown on the public listings page while status stays 'vacant'.
  const [listingStatusBusy, setListingStatusBusy] = useState(false);
  const [depositBusy, setDepositBusy] = useState(false);
  const [depositAmountDraft, setDepositAmountDraft] = useState('');
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
      setNotice(nextValue ? 'This unit is now public — anyone can see it and message the WhatsApp number on file once it\'s vacant.' : 'This unit is now private and will not appear on the public listings page.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setListingBusy(false);
    }
  }

  async function handleStatusChange(newStatus) {
    if (newStatus === unit.status) return;
    setBusy(true);
    setError('');
    try {
      await api.updateUnitStatus(unitId, { status: newStatus }, token);
      setNotice(`Unit marked as ${newStatus}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // DIRECT REQUEST: confirm whether this vacant unit is still active,
  // already booked (someone has committed, but not yet moved in/marked
  // occupied), or planned for (earmarked, not really open right now).
  async function handleListingStatusChange(newListingStatus) {
    if (newListingStatus === unit.listing_status) return;
    setListingStatusBusy(true);
    setError('');
    try {
      await api.updateListingStatus(unitId, newListingStatus, token);
      setNotice(`Listing confirmed as "${newListingStatus}".`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setListingStatusBusy(false);
    }
  }

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

  async function handleSaveName() {
    if (!nameDraft.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.renameUnit(unitId, { newUnitName: nameDraft.trim() }, token);
      setNotice('Unit renamed.');
      setEditingName(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
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

  async function handleAddCharge(e) {
    e.preventDefault();
    if (!chargeDraft.name || !chargeDraft.amount) return;
    setBusy(true);
    setError('');
    try {
      await api.addExtraCharge(unitId, { name: chargeDraft.name, amount: Number(chargeDraft.amount), recurring: chargeDraft.recurring }, token);
      setChargeDraft({ name: '', amount: '', recurring: true });
      setNotice(chargeDraft.recurring ? 'Recurring charge added - will bill every month from next cycle.' : 'One-time charge billed to the current tenant now.');
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

  if (loading) {
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
      <header className="unit-detail-header">
        <Link to="/dashboard" className="unit-detail-back">← Dashboard</Link>
        <div className="unit-detail-title-row">
          {editingName ? (
            <form
              className="unit-name-edit-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveName();
              }}
            >
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus />
              <button type="submit" disabled={busy}>Save</button>
              <button type="button" className="ghost-link" onClick={() => setEditingName(false)}>Cancel</button>
            </form>
          ) : (
            <>
              <h1>Unit {unit.unit_name}</h1>
              <button
                className="ghost-link"
                onClick={() => {
                  setNameDraft(unit.unit_name);
                  setEditingName(true);
                }}
              >
                Rename
              </button>
              {/* FIX ("landlord/manager should be able to edit or
                  delete their apartments/units - but delete should
                  require several confirmations, it's sensitive"):
                  deleting a unit removes its whole history, so this
                  goes through the shared ConfirmDialog with
                  type-to-confirm (typing the exact unit name), not
                  just a single tap. */}
              <button
                className="ghost-link danger-link"
                onClick={() => { setDeleteUnitError(''); setShowDeleteUnitConfirm(true); }}
              >
                Delete unit
              </button>
            </>
          )}
          <span className="unit-detail-code">{unit.unit_payment_code}</span>
        </div>
        <p className="unit-detail-type">{unit.unit_type}</p>
      </header>

      <MissingPhotosBanner units={[unit]} scopeKey={`unit:${unitId}`} />

      <UnitPhotosPanel
        unitId={unitId}
        photoUrls={unit.photo_urls || []}
        token={token}
        canEdit={!isCaretaker}
        onChange={(newUrls) => setUnit((u) => ({ ...u, photo_urls: newUrls }))}
      />

      {notice && <div className="unit-detail-banner unit-detail-banner--ok">{notice}</div>}
      {error && <div className="unit-detail-banner unit-detail-banner--error">{error}</div>}

      <div className="unit-detail-grid">
        {/* Status card */}
        <section className="unit-detail-card">
          <h2>Status</h2>
          <div className="status-options">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`status-option ${unit.status === opt.value ? 'status-option--active' : ''}`}
                disabled={busy || unit.status === 'notice_given'}
                onClick={() => handleStatusChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {unit.status === 'notice_given' && (
            <p className="unit-detail-hint">
              Tenant has given vacating notice for {unit.tenants?.find((t) => t.notice_given)?.notice_date}. Revoke below if this was a mistake.
            </p>
          )}
          {unit.status === 'vacant' && (
            <div className="u-mt-3">
              <Button type="button" variant="secondary" loading={verifyBusy} onClick={handleVerifyUnit}>
                Still vacant — confirm
              </Button>
              {unit.last_verified_at ? (
                <p className="unit-detail-hint u-mt-2">
                  Last confirmed vacant: {new Date(unit.last_verified_at).toLocaleString('en-GB')}
                </p>
              ) : (
                <p className="unit-detail-hint u-mt-2">
                  Not yet confirmed — this will only show as "Updated," not "Verified."
                </p>
              )}

              {/* DIRECT REQUEST: landlord/manager/caretaker confirms
                  whether this vacancy is still open, already booked, or
                  planned for - shown alongside the unit on the public
                  listings page while it stays vacant. */}
              <div className="u-mt-3">
                <p className="unit-detail-hint u-mt-2 u-label-strong">
                  Confirm listing status
                </p>
                <div className="u-flex-row">
                  {[
                    { value: 'active', label: 'Still active' },
                    { value: 'booked', label: 'Already booked' },
                    { value: 'planned', label: 'Planned for' },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={unit.listing_status === opt.value ? 'primary' : 'ghost'}
                      loading={listingStatusBusy}
                      onClick={() => handleListingStatusChange(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                {unit.listing_status_updated_at && (
                  <p className="unit-detail-hint u-mt-2">
                    Confirmed as "{unit.listing_status || 'active'}" on {new Date(unit.listing_status_updated_at).toLocaleString('en-GB')}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* DIRECT REQUEST: show (and let a landlord/manager/caretaker
              set) whether this unit requires a deposit from a future
              tenant - separate from any deposit already collected from
              whoever lives here now. Shown regardless of current
              status, same as the public-listing toggle below, since a
              landlord may want to set expectations ahead of the unit
              actually going vacant. */}
          <div className="unit-detail-hint u-divider-top">
            <label className="u-checkbox-row u-checkbox-row--strong">
              <input
                type="checkbox"
                checked={!!unit.requires_deposit}
                disabled={depositBusy}
                onChange={handleToggleRequiresDeposit}
              />
              This unit requires a deposit from a future tenant
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
            <p className="u-mt-1">
              {unit.requires_deposit
                ? 'Prospective tenants browsing the public listing will see this unit requires a deposit.'
                : 'Prospective tenants browsing the public listing will see this unit does not require a deposit.'}
            </p>
          </div>

          <div className="unit-detail-hint u-divider-top">
            <label className="u-checkbox-row u-checkbox-row--strong">
              <input
                type="checkbox"
                checked={!!unit.is_publicly_listed}
                disabled={listingBusy}
                onChange={handleTogglePublicListing}
              />
              List this unit on the public listings page when vacant
            </label>
            {/* DIRECT REQUEST: make clear, before someone opts in, that
                this isn't just "the unit becomes visible" - it also
                means anyone browsing the page can reach whichever
                WhatsApp number is on file for this unit (manager,
                then caretaker, then the landlord themself - see
                getUnitContact in public.controller.js) with zero
                login or vetting on their end. Shown regardless of the
                checkbox's current state so it reads as something to
                weigh before turning it on, not just an after-the-fact
                description. */}
            <p className="u-mt-1">
              Heads up: anyone browsing RentaPay's free listings page — no account needed — will be able to see this unit and message the WhatsApp number on file for it (your manager/caretaker's number, or yours if none is set) directly. There's no way to screen who reaches out first.
            </p>
            <p className="u-mt-1">
              {unit.is_publicly_listed
                ? "This unit is currently public and will show up there once it's vacant."
                : "This unit is currently private — it will never appear on RentaPay's public listings page, even while vacant."}
            </p>
          </div>
        </section>

        {/* Rent + due date card */}
        <section className="unit-detail-card">
          <h2>Rent & due date</h2>
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

        {/* Payment method override card - item 1: general/default method
            (Settings) stays untouched for every other unit; this lets a
            landlord/manager set a DIFFERENT method just for this one.
            Caretakers can see it, never edit it. */}
        <section className="unit-detail-card">
          <h2>Payment method for this unit</h2>
          <p className="unit-detail-card__hint">
            By default this unit uses the general payment method set in Settings. Turn this on to use a different
            Paybill/Till/STK setup just for this unit - only this unit's tenant will see it.
          </p>
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
                      <>Paybill {unit.payment_override_paybill_number || '—'}{unit.payment_override_paybill_account_number && ` · Acc ${unit.payment_override_paybill_account_number}`}</>
                    )}
                    {unit.payment_override_method === 'till' && <>Till Number {unit.payment_override_till_number || '—'}</>}
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

        {/* Extra charges card */}
        <section className="unit-detail-card">
          <h2>Extra charges</h2>
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
              <button type="submit" disabled={busy}>+ Add</button>
            </form>
          )}
          <div className="charges-total">
            <span>Rent + charges total</span>
            <span>KES {(Number(unit.rent_amount) + chargesTotal).toLocaleString()}</span>
          </div>
        </section>

        {/* Tenant card */}
        <section className="unit-detail-card unit-detail-card--wide">
          <h2>Tenant</h2>
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
            <div className="tenant-panel tenant-panel--empty">
              <p>No tenant in this unit.</p>
              <Button variant="primary" onClick={() => navigate(`/units/${unitId}/add-tenant`)}>+ Add Tenant</Button>
            </div>
          )}
        </section>

        {/* Lease/document storage - landlord/manager can upload a
            lease to the current tenant; the tenant can view but not
            delete it (see DocumentsPanel.jsx / document.controller.js). */}
        {activeTenant && (
          <section className="unit-detail-card unit-detail-card--wide">
            <DocumentsPanel token={token} tenantId={activeTenant.id} canManage={!isCaretaker} />
          </section>
        )}

        {/* Payment history */}
        <section className="unit-detail-card unit-detail-card--wide">
          <div className="tenant-section__header-row">
            <h2>Payment history</h2>
            {payments.length > 0 && (
              <button
                className="ghost-link"
                onClick={() =>
                  downloadCsv(
                    `rentapay-payment-history-${unit.unit_name || unitId}`,
                    ['Date', 'Amount (KES)', 'Method', 'Status'],
                    payments.map((p) => [
                      p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '—',
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
            <p className="unit-detail-hint">No payments recorded yet.</p>
          ) : (
            <div className="payments-table-wrap">
              <table className="payments-table">
                <thead>
                  <tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '—'}</td>
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

function RecordPaymentModal({ tenant, token, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [mpesaReference, setMpesaReference] = useState('');
  const [paidBy, setPaidBy] = useState('self');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!amount || !paymentDate) return;
    setBusy(true);
    try {
      await api.recordManualPayment({ tenantId: tenant.id, amount: Number(amount), paymentDate, mpesaReference, paidBy, note }, token);
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
        <label className="form-field__label">Amount paid (KES)</label>
        <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label className="form-field__label">Date of payment</label>
        <input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        <label className="form-field__label">M-Pesa reference (optional)</label>
        <input value={mpesaReference} onChange={(e) => setMpesaReference(e.target.value)} />
        <label className="form-field__label">Who paid?</label>
        <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          <option value="self">Tenant themselves</option>
          <option value="third_party">Third party</option>
        </select>
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
  const [email, setEmail] = useState(tenant.email || '');
  const [emergencyContactName, setEmergencyContactName] = useState(tenant.emergency_contact_name || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(tenant.emergency_contact_phone || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.editTenantDetails(
        tenant.id,
        { fullName, secondaryPhone, email, emergencyContactName, emergencyContactPhone },
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
        <label className="form-field__label">Email (optional)</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
                <option key={u.id} value={u.id}>{u.unit_name} — KES {Number(u.rent_amount).toLocaleString()}</option>
              ))}
            </select>
            <Button type="submit" variant="primary" loading={busy}>Transfer tenant</Button>
          </>
        )}
      </form>
    </ModalShell>
  );
}
