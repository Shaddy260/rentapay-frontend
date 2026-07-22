import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StepRail from '../components/StepRail.jsx';
import Button from '../components/Button.jsx';
import PaymentDetailsCard from '../components/PaymentDetailsCard.jsx';
import { api } from '../api/client.js';
import { KENYA_COUNTIES } from '../constants/kenyaCounties.js';
import { KENYA_CONSTITUENCIES } from '../constants/kenyaConstituencies.js';
import './RegisterFlow.css';

// Pricing mirrors backend src/utils/pricing.js exactly.
// Kept here only for instant on-screen cost preview; the backend is
// the source of truth and recalculates server-side before charging.
// NOTE: 50 (not the blueprint's stated 150) per direct instruction.
const BASE_RATE = 50;
const PERIOD_DISCOUNTS = { 1: 0, 3: 0.05, 6: 0.10, 12: 0.15 };

function previewCost(unitsCount, periodMonths) {
  const discount = PERIOD_DISCOUNTS[periodMonths] ?? 0;
  const rate = Math.round(BASE_RATE * (1 - discount) * 100) / 100;
  const total = Math.round(rate * unitsCount * periodMonths * 100) / 100;
  return { rate, discount, total };
}

const STEPS = [
  { key: 'details', title: 'Your details', subtitle: 'Name, phone, plan' },
  { key: 'payment', title: 'M-Pesa payment', subtitle: 'Activate subscription' },
  { key: 'property', title: 'Your property', subtitle: 'Estate & location' },
  { key: 'method', title: 'Payment method', subtitle: 'How rent reaches you' },
  { key: 'units', title: 'Add your units', subtitle: 'Rent per unit' },
  { key: 'charges', title: 'Extra charges', subtitle: 'Water, garbage, etc' },
  { key: 'done', title: 'All set', subtitle: 'Dashboard unlocked' },
];

// Everything captured here survives a page refresh mid-registration.
// Without this, refreshing on the M-Pesa-pending or OTP step loses
// landlordId/checkoutRequestId entirely - the account already exists
// server-side with a pending payment, but the frontend would have no
// way to resume, leaving the person stuck. sessionStorage (not
// localStorage) is used deliberately: it clears when the tab closes,
// which is the right lifetime for a half-finished signup.
const STORAGE_KEY = 'rentapay_register_progress';

function loadPersistedProgress() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // corrupted/blocked storage - just start fresh
  }
}

function persistProgress(snapshot) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // sessionStorage can throw in private-browsing/storage-full edge
    // cases - registration still works, the person just loses resume
    // capability on refresh, which is a reasonable degradation.
  }
}

export default function RegisterFlow() {
  const navigate = useNavigate();
  const persisted = loadPersistedProgress();

  // If there's no in-progress registration session (persisted === null)
  // but there IS a valid login token in sessionStorage, this person
  // arrived here via Login.jsx's "resume setup wizard" redirect - they
  // already have a verified, active account and just haven't finished
  // the property/units/payment-method steps yet. Starting them at step
  // 0 would walk them through account creation again, which would
  // immediately fail with "Account already exists" since the phone
  // number is already registered. Jump straight to the Setup Wizard
  // (step index 3 = "Your property") instead.
  //
  // This only fires once on initial mount (computed before any state
  // exists), not on every render - a fresh registration in the same
  // tab still works normally because `persisted` will be non-null by
  // the time this check would otherwise matter.
  const resumingLoggedInLandlord =
    !persisted && typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('rentapay_token') && sessionStorage.getItem('rentapay_role') === 'landlord';

  // Set by Login.jsx when it redirects here because the landlord's
  // subscription payment was never confirmed (see the paymentPending
  // handling there). This session has no password in memory - it
  // arrived via Login, not via step 0 of this wizard - so once payment
  // is confirmed below we can't silently auto-login like a fresh
  // registration does; the person needs to log in again normally.
  const resumedFromLogin = persisted?.resumedFromLogin === true;

  const [stepIndex, setStepIndex] = useState(persisted?.stepIndex ?? (resumingLoggedInLandlord ? 2 : 0));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- Step 1: registration details ---
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    gender: '',
    unitsCount: 5,
    periodMonths: 1,
    ...(persisted?.form || {}),
  });

  // --- Server state captured across steps ---
  const [landlordId, setLandlordId] = useState(persisted?.landlordId ?? null);
  const [checkoutRequestId, setCheckoutRequestId] = useState(persisted?.checkoutRequestId ?? null);
  const [amountDue, setAmountDue] = useState(persisted?.amountDue ?? null);

  // --- Setup wizard state (steps 4-7) ---
  const [property, setProperty] = useState({
    estateName: '', location: '', county: '', constituency: '', description: '',
    // Caretaker contact - a plain, no-login contact record shown to
    // tenants alongside the landlord's own contact (TenantPortal.jsx).
    // Separate from the property MANAGER, who is a real login account
    // added later from Settings. Optional: many landlords are their
    // own caretaker.
    caretakerName: '', caretakerPhone: '',
  });
  const [defaultPropertyId, setDefaultPropertyId] = useState(persisted?.defaultPropertyId ?? null);
  const [paymentMethod, setPaymentMethod] = useState({ method: 'stk', paybillNumber: '', accountNumber: '', tillNumber: '' });
  const [units, setUnits] = useState([]);
  // FIX (direct request: "entering data one by one for many units
  // could be so hectic while almost all units could be having the
  // same rent... a UI for duplicate... asks how many units... name
  // the units from the first one to the last one"): lets a landlord
  // fill in ONE unit's details (name, type, rent) and generate several
  // more just like it in one go, auto-numbered onward from that first
  // unit's name, instead of retyping the same rent 8+ times.
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState('');
  const [newUnit, setNewUnit] = useState({ unitName: '', unitType: 'Bedsitter', customUnitType: '', rentAmount: '' });

  // Draft input values for the extra-charges step, keyed by unit
  // index, so each unit's "add a charge" form has independent
  // in-progress text without needing one useState per unit.
  const [chargeDrafts, setChargeDrafts] = useState({});

  function updateChargeDraft(unitIndex, draft) {
    setChargeDrafts((d) => ({ ...d, [unitIndex]: draft }));
  }

  async function handleAddCharge(e, unitIndex) {
    e.preventDefault();
    const draft = chargeDrafts[unitIndex];
    if (!draft || !draft.name || !draft.amount) return;

    const unit = units[unitIndex];
    const token = sessionStorage.getItem('rentapay_token');

    if (token && unit.id) {
      // Real unit exists in the database (created in handleUnitsSubmit)
      // - persist the charge for real instead of only updating local
      // state, which is what silently happened before this fix.
      try {
        await api.addExtraCharge(unit.id, { name: draft.name, amount: Number(draft.amount) }, token);
      } catch (err) {
        setError(`Could not save charge: ${err.message}`);
        return; // don't update local state if the save failed - keeps UI honest
      }
    }

    setUnits((prevUnits) =>
      prevUnits.map((u, i) =>
        i === unitIndex
          ? { ...u, extraCharges: [...(u.extraCharges || []), { name: draft.name, amount: Number(draft.amount) }] }
          : u
      )
    );
    setChargeDrafts((d) => ({ ...d, [unitIndex]: { name: '', amount: '' } }));
  }

  function handleRemoveCharge(unitIndex, chargeIndex) {
    // NOTE: there is currently no backend endpoint to remove a single
    // extra charge (only to add one - see unit.controller.js
    // addExtraCharge). This removes it from local display only; if the
    // charge was already saved via handleAddCharge above, it will
    // still exist in the database until a delete-charge endpoint is
    // added. Flagging this honestly rather than pretending it's fully
    // wired - same standard as everything else in this file.
    setUnits((prevUnits) =>
      prevUnits.map((u, i) => (i === unitIndex ? { ...u, extraCharges: u.extraCharges.filter((_, ci) => ci !== chargeIndex) } : u))
    );
  }

  // Direct request: "the extra charges should also have a duplicate
  // button that will duplicate" - mirrors the units-step duplicate
  // feature (handleDuplicateUnits above), but for a single charge:
  // copies one unit's charge (e.g. "Water KES 300") onto every OTHER
  // unit in the wizard in one tap, instead of retyping the same
  // charge name/amount for each unit individually. Units that already
  // have a charge with this exact name are skipped rather than given
  // a second, duplicate entry.
  const [duplicatingCharge, setDuplicatingCharge] = useState(null); // { unitIndex, chargeIndex } while a duplicate-to-all is in flight

  async function handleDuplicateChargeToAll(unitIndex, chargeIndex) {
    const source = units[unitIndex];
    const charge = source?.extraCharges?.[chargeIndex];
    if (!charge) return;

    setDuplicatingCharge({ unitIndex, chargeIndex });
    setError('');
    const token = sessionStorage.getItem('rentapay_token');

    try {
      const targets = units
        .map((u, i) => ({ u, i }))
        .filter(({ u, i }) => i !== unitIndex && !(u.extraCharges || []).some((c) => c.name.trim().toLowerCase() === charge.name.trim().toLowerCase()));

      if (token) {
        await Promise.all(
          targets
            .filter(({ u }) => u.id) // only units already saved to the backend
            .map(({ u }) => api.addExtraCharge(u.id, { name: charge.name, amount: Number(charge.amount) }, token))
        );
      }

      setUnits((prevUnits) =>
        prevUnits.map((u, i) =>
          targets.some((t) => t.i === i) ? { ...u, extraCharges: [...(u.extraCharges || []), { name: charge.name, amount: Number(charge.amount) }] } : u
        )
      );
    } catch (err) {
      setError(`Could not duplicate charge to all units: ${err.message}`);
    } finally {
      setDuplicatingCharge(null);
    }
  }

  // The real, authoritative unit quota the landlord paid for. We do
  // NOT trust form.unitsCount for this - that value only reflects
  // whatever was typed on step 0 during THIS browser session, which is
  // meaningless for a landlord resuming an existing account (it just
  // sits at the default of 5 regardless of what they actually paid
  // for). Fetched once from the backend, the actual source of truth,
  // as soon as we have a token to ask with.
  const [unitLimit, setUnitLimit] = useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem('rentapay_token');
    if (!token) return; // no token yet (brand-new registration, hasn't logged in) - nothing to fetch

    api
      .getSubscriptionStatus(token)
      .then((status) => setUnitLimit(status.unit_limit))
      .catch((err) => {
        // Non-fatal: if this fails, handleAddUnit below falls back to
        // form.unitsCount as a best-effort guess rather than blocking
        // the person entirely on a network hiccup.
        console.warn('Could not fetch real unit limit, falling back to form.unitsCount:', err.message);
      });
  }, []);

  // Persist the values that actually matter for resuming after a
  // refresh. NOT persisting `password` in plaintext past step 1 would
  // be ideal, but it's needed again nowhere downstream once
  // registerLandlord() has fired, so we simply don't include it here -
  // only the fields a resumed session actually needs are stored.
  React.useEffect(() => {
    persistProgress({
      stepIndex,
      landlordId,
      checkoutRequestId,
      amountDue,
      defaultPropertyId,
      form: { fullName: form.fullName, phone: form.phone, email: form.email, unitsCount: form.unitsCount, periodMonths: form.periodMonths },
    });
  }, [stepIndex, landlordId, checkoutRequestId, amountDue, defaultPropertyId, form.fullName, form.phone, form.email, form.unitsCount, form.periodMonths]);

  // FIX (direct request: "after manual confirmation by admin the page
  // does not automatically proceed... even after reloading several
  // times"): the STK poll (handlePaymentConfirmed) and the manual-
  // payment poll (pollManualPaymentStatus) below only run as a live
  // in-memory loop kicked off by tapping a button - a page reload
  // (or just closing the tab and coming back, which sessionStorage-
  // based resume is explicitly meant to support) kills that loop
  // completely with no replacement. Landing back on this exact step
  // via the persisted stepIndex/landlordId used to just show the same
  // static "waiting" screen forever, even if an admin had already
  // confirmed the payment minutes ago - nothing on mount ever asked
  // the backend again. This checks once, silently, the moment this
  // step is (re)loaded with a landlordId, and moves straight into the
  // account if it turns out to already be confirmed - reloading (or
  // coming back later) now actually has a chance of unsticking things
  // instead of just re-displaying the same dead end.
  useEffect(() => {
    if (stepIndex !== 1 || !landlordId) return;
    let cancelled = false;
    (async () => {
      try {
        if (checkoutRequestId) {
          const res = await api.checkSubscriptionPaymentStatus(checkoutRequestId);
          if (cancelled) return;
          if (res.status === 'completed') {
            await proceedAfterVerification();
            return;
          }
        }
        const manualRes = await api.checkRegistrationManualPaymentStatus(landlordId);
        if (cancelled) return;
        if (manualRes.status === 'completed') {
          await proceedAfterVerification();
          return;
        }
        if (manualRes.status === 'rejected') {
          setManualSubmitted(false);
          setManualPollError('Your submitted payment could not be verified. Please double-check the transaction code and try again, or contact support.');
        } else if (manualRes.status === 'pending') {
          // A manual payment IS on file and still pending admin review
          // - resume the same visible "waiting for confirmation" state
          // and background poll a fresh reload would otherwise have
          // silently dropped, instead of leaving the page looking like
          // nothing was ever submitted.
          setManualSubmitted(true);
          pollManualPaymentStatus();
        }
      } catch (err) {
        console.warn('Resume payment-status check failed (non-fatal):', err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally only on mount / when landing on this step - not on
    // every keystroke of the manual-payment form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, landlordId]);

  const cost = previewCost(Number(form.unitsCount) || 1, Number(form.periodMonths));

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // -----------------------------------------------------------------
  // STEP 1 -> 2 : submit registration, triggers backend STK push
  // -----------------------------------------------------------------
  async function handleSubmitDetails(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.registerLandlord({
        fullName: form.fullName,
        phone: form.phone,
        email: form.email || undefined,
        password: form.password,
        gender: form.gender || undefined,
        unitsCount: Number(form.unitsCount),
        periodMonths: Number(form.periodMonths),
      });
      setLandlordId(res.landlordId);
      setCheckoutRequestId(res.checkoutRequestId);
      setAmountDue(res.amountDue);
      setStepIndex(1);
    } catch (err) {
      // err.details is an ARRAY only for the password-strength
      // validator (utils/password.js) - join it into one readable
      // line. Anything else (a plain string, or nothing) falls back
      // to itself/err.message - checking Array.isArray here matters:
      // calling .join on a non-array string used to throw INSIDE this
      // catch block itself, before setError ever ran, which is what
      // made a duplicate-email error look like a silent no-op.
      setError(Array.isArray(err.details) ? err.details.join(' ') : (err.details || err.message));
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------------------------------------------
  // STEP 1 -> 2 : "I've paid" - DIRECT REQUEST FIX ("a landlord cannot
  // proceed to the next step unless payment has been confirmed by
  // either Daraja or manual confirmation by admin - OTP should not
  // have authority to confirm/verify the account"): this used to
  // advance to a separate OTP-entry step once payment was confirmed,
  // and typing that OTP in was what actually flipped the account to
  // verified. That made the OTP the real gate, not the payment. There
  // is no OTP step anymore - this polls the backend (which self-heals
  // by asking Safaricom directly if needed - see
  // checkSubscriptionPaymentStatus in payment.controller.js) until the
  // payment is confirmed one way or the other, and payment
  // confirmation itself is what verifies the account server-side
  // (activateLandlordAfterPayment). Once confirmed, this proceeds
  // straight into the account - no code to enter.
  // -----------------------------------------------------------------
  const [paymentPolling, setPaymentPolling] = useState(false);
  const [paymentPollError, setPaymentPollError] = useState('');

  async function handlePaymentConfirmed() {
    setPaymentPollError('');
    setPaymentPolling(true);

    const MAX_ATTEMPTS = 20; // ~60s at 3s intervals - enough for a real STK prompt + PIN entry
    const INTERVAL_MS = 3000;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const res = await api.checkSubscriptionPaymentStatus(checkoutRequestId);
        if (res.status === 'completed') {
          setPaymentPolling(false);
          await proceedAfterVerification();
          return;
        }
        if (res.status === 'failed') {
          setPaymentPolling(false);
          setPaymentPollError(
            res.reason
              ? `Payment was not completed: ${res.reason}. You can pay manually below instead.`
              : 'Payment was not completed (cancelled or insufficient funds). You can pay manually below instead.'
          );
          // THE FIX (direct request: "when a person has insufficient
          // funds or cancels, it doesn't cease, and the pay-manually
          // option isn't visible"): a failed/cancelled STK attempt used
          // to just sit there with the manual-pay link buried below as
          // a small text toggle nobody noticed. Automatically opening
          // the manual form the moment we know STK failed means the
          // person isn't left guessing what to do next.
          setShowManualPayment(true);
          return;
        }
        // 'pending' - keep polling
      } catch (err) {
        // A single failed poll shouldn't abort the whole thing - the
        // backend itself might just be briefly slow. Keep trying until
        // MAX_ATTEMPTS is exhausted.
        console.warn('Payment status poll failed, retrying:', err.message);
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }

    setPaymentPolling(false);
    setPaymentPollError(
      "We couldn't confirm your payment yet. If the M-Pesa prompt failed, was cancelled, or you had insufficient funds, you can pay manually below instead."
    );
    setShowManualPayment(true);
  }

  // THE FIX (direct request: "it doesn't cease when the transaction is
  // cancelled... and then I can't see pay manually"): previously
  // handlePaymentConfirmed only ran when the user tapped "I've
  // completed the payment" - if the STK prompt was cancelled or failed
  // silently (insufficient funds, wrong PIN, timeout), the screen just
  // sat on "Check your phone" forever with no indication anything went
  // wrong, and the manual-pay fallback stayed hidden below a small text
  // link. Auto-starting the same poll the instant this step mounts
  // means a failure is detected and the manual form is surfaced
  // automatically, without the person needing to know to click
  // anything first.
  useEffect(() => {
    if (stepIndex !== 1 || !checkoutRequestId || manualSubmitted) return;
    handlePaymentConfirmed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, checkoutRequestId]);

  // -----------------------------------------------------------------
  // Registration-time manual payment fallback (direct request: "there
  // should be a UI for manual payment that when opened meanwhile gives
  // instructions to pay on paybill 522522 acct 1341657388, the exact
  // amount they were to pay - at the moment there is no that manual
  // entering of payment"). Same idea as the STK poll above, but for
  // when the prompt never arrives at all - a landlord can pay directly
  // to RentaPay's paybill and submit the M-Pesa transaction code
  // instead of waiting on a popup that might not come.
  // -----------------------------------------------------------------
  // FIX (direct request: "there is not that manual payment option...
  // its not visible or persistent at all"): this used to start
  // collapsed behind a small ghost-styled toggle button, only
  // revealed on a click - easy to miss entirely, which is exactly
  // what was reported. Now it's open by default the moment the STK
  // step loads, right alongside "I've completed the payment" - still
  // collapsible for anyone who doesn't want it taking up space, but
  // no longer something you have to know to go looking for.
  const [showManualPayment, setShowManualPayment] = useState(true);
  const [manualForm, setManualForm] = useState({ transactionCode: '', mpesaPayerName: '', mpesaPayerPhone: '' });
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualSubmitted, setManualSubmitted] = useState(false);
  const [manualPolling, setManualPolling] = useState(false);
  const [manualPollError, setManualPollError] = useState('');

  async function handleSubmitManualPayment(e) {
    e.preventDefault();
    setManualError('');
    setManualSubmitting(true);
    try {
      await api.submitRegistrationManualPayment({
        landlordId,
        transactionCode: manualForm.transactionCode,
        amountPaid: amountDue,
        mpesaPayerName: manualForm.mpesaPayerName,
        mpesaPayerPhone: manualForm.mpesaPayerPhone,
      });
      setManualSubmitted(true);
      pollManualPaymentStatus();
    } catch (err) {
      setManualError(Array.isArray(err.details) ? err.details.join(' ') : (err.details || err.message));
    } finally {
      setManualSubmitting(false);
    }
  }

  async function pollManualPaymentStatus() {
    setManualPollError('');
    setManualPolling(true);
    // Unlike the STK poll (which waits on Safaricom, seconds away),
    // this is waiting on an admin to review the submission - could be
    // minutes, not seconds. Polls less aggressively and for longer.
    const MAX_ATTEMPTS = 40;
    const INTERVAL_MS = 15000;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const res = await api.checkRegistrationManualPaymentStatus(landlordId);
        if (res.status === 'completed') {
          setManualPolling(false);
          await proceedAfterVerification();
          return;
        }
        if (res.status === 'rejected') {
          setManualPolling(false);
          setManualPollError('Your submitted payment could not be verified. Please double-check the transaction code and try again, or contact support.');
          setManualSubmitted(false);
          return;
        }
      } catch (err) {
        console.warn('Manual payment status poll failed, retrying:', err.message);
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }

    setManualPolling(false);
    setManualPollError("Still waiting on confirmation - this can take a little while. Feel free to close this page and check back by logging in once it's approved.");
  }

  // -----------------------------------------------------------------
  // Payment confirmed -> account verified server-side already (see
  // activateLandlordAfterPayment). Nothing left to prove here - just
  // get a session token and move into the setup wizard.
  // -----------------------------------------------------------------
  async function proceedAfterVerification() {
    setError('');

    if (resumedFromLogin) {
      // No password in memory for this session (it was typed into
      // Login.jsx, on a previous page load) - can't auto-login here.
      // Payment is confirmed, so a normal login will succeed and land
      // them back on this exact step via the resumingLoggedInLandlord
      // shortcut above.
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.setItem('rentapay_info_message', 'Payment confirmed! Please log in to continue setting up your account.');
      navigate('/login');
      return;
    }

    // Without this, a FRESH registration would have no token at all
    // for the rest of the wizard - login() was previously only ever
    // called from the separate Login.jsx page, which meant every
    // wizard step after this had no way to authenticate its requests.
    // form.password is still in memory at this point (we deliberately
    // never persist it to sessionStorage - see the progress-persist
    // effect above - but it hasn't been cleared from state yet either).
    try {
      const loginRes = await api.login({ accountType: 'landlord', phone: form.phone, password: form.password });
      sessionStorage.setItem('rentapay_token', loginRes.token);
      sessionStorage.setItem('rentapay_role', 'landlord');
    } catch (loginErr) {
      // Don't hard-fail progress over this - worst case the wizard's
      // later steps silently skip their backend calls (each checks
      // for a token before calling) and the person can just log in
      // normally afterward to finish setup.
      console.warn('Auto-login after payment confirmation failed, continuing without a token:', loginErr.message);
    }

    setStepIndex(2);
  }

  // -----------------------------------------------------------------
  // STEP 4 -> 5 : property details (Setup Wizard step 1)
  // -----------------------------------------------------------------
  async function handlePropertySubmit(e) {
    e.preventDefault();
    // Guard against double-submit (e.g. a fast double-click before the
    // button above re-renders as disabled): without this, two overlapping
    // calls could both read defaultPropertyId as still-null and each
    // create their own property row, leaving the landlord with two
    // apartments for one signup.
    if (loading) return;
    setError('');

    const token = sessionStorage.getItem('rentapay_token');
    if (token) {
      setLoading(true);
      try {
        await api.updatePropertyDetails(
          { estateName: property.estateName, location: property.location, county: property.county, constituency: property.constituency, description: property.description },
          token
        );

        // Also create/update a Property row so this shows up in the
        // property switcher and so the manager/caretaker contact can be
        // shown to tenants (TenantPortal.jsx reads unit.properties.manager_*).
        // Units created later in this wizard get assigned to it.
        if (!defaultPropertyId) {
          const res = await api.createProperty(
            {
              name: property.estateName,
              location: property.location,
              county: property.county,
              constituency: property.constituency,
              description: property.description,
              caretakerName: property.caretakerName || undefined,
              caretakerPhone: property.caretakerPhone || undefined,
            },
            token
          );
          setDefaultPropertyId(res.property.id);
        } else {
          await api.updateProperty(
            defaultPropertyId,
            {
              name: property.estateName,
              location: property.location,
              county: property.county,
              constituency: property.constituency,
              description: property.description,
              caretakerName: property.caretakerName || '',
              caretakerPhone: property.caretakerPhone || '',
            },
            token
          );
        }
      } catch (err) {
        // Surface it, but don't block progress - the person can still
        // continue and the data just won't have saved; better than
        // trapping them on this step if the backend hiccups.
        console.warn('Could not save property details:', err.message);
        setError(`Could not save property details: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    setStepIndex(3);
  }

  // -----------------------------------------------------------------
  // STEP 5 -> 6 : payment method (Setup Wizard step 2)
  // -----------------------------------------------------------------
  async function handlePaymentMethodSubmit(e) {
    e.preventDefault();
    setError('');

    const token = sessionStorage.getItem('rentapay_token');
    if (token) {
      setLoading(true);
      try {
        await api.updatePaymentMethod(
          { method: paymentMethod.method, paybillNumber: paymentMethod.paybillNumber, accountNumber: paymentMethod.accountNumber, tillNumber: paymentMethod.tillNumber },
          token
        );
      } catch (err) {
        console.warn('Could not save payment method:', err.message);
        setError(`Could not save payment method: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    setStepIndex(4);
  }

  // -----------------------------------------------------------------
  // STEP 6 : add units, live ledger preview (signature element)
  // -----------------------------------------------------------------
  function handleAddUnit(e) {
    e.preventDefault();
    if (!newUnit.unitName || !newUnit.rentAmount) return;
    if (newUnit.unitType === 'Custom' && !newUnit.customUnitType.trim()) {
      setError('Enter a custom unit type, or pick one of the preset types.');
      return;
    }

    // Enforce the subscription's unit quota. Prefer the real value
    // fetched from the backend; fall back to form.unitsCount only if
    // that fetch hasn't resolved yet or failed outright - better to
    // guess using something than to enforce nothing at all.
    const effectiveLimit = unitLimit ?? Number(form.unitsCount) ?? null;
    if (effectiveLimit != null && units.length >= effectiveLimit) {
      setError(
        `You've reached your subscription limit of ${effectiveLimit} unit${effectiveLimit === 1 ? '' : 's'}. ` +
          `To add more, increase your unit count on your subscription first.`
      );
      return;
    }

    setError('');
    const resolvedUnitType = newUnit.unitType === 'Custom' ? newUnit.customUnitType.trim() : newUnit.unitType;
    const code = `RPA-${newUnit.unitName.replace(/\s+/g, '').toUpperCase()}-${String(units.length + 1).padStart(3, '0')}`;
    setUnits((u) => [...u, { ...newUnit, unitType: resolvedUnitType, rentAmount: Number(newUnit.rentAmount), code, extraCharges: [] }]);
    setNewUnit({ unitName: '', unitType: 'Bedsitter', customUnitType: '', rentAmount: '' });
  }

  // "Duplicate" - generates `duplicateCount` units from the currently
  // filled-in unit form (name/type/rent), auto-numbered onward from
  // the typed unit name. "A1" with a count of 8 produces A1..A8;
  // "House" (no trailing number) produces "House 1".."House 8". Every
  // generated unit shares the same type and rent as the typed one -
  // that's the whole point, since most units in a building usually do.
  function handleDuplicateUnits(e) {
    e.preventDefault();
    setError('');

    if (!newUnit.unitName || !newUnit.rentAmount) {
      setError('Fill in the unit name and rent first - duplication clones those details onto the rest.');
      return;
    }
    if (newUnit.unitType === 'Custom' && !newUnit.customUnitType.trim()) {
      setError('Enter a custom unit type, or pick one of the preset types.');
      return;
    }

    const count = Number(duplicateCount);
    if (!Number.isInteger(count) || count < 1) {
      setError('Enter how many units to create (a whole number of 1 or more).');
      return;
    }

    // Same subscription-quota check as adding one unit, but against
    // the WHOLE batch - a landlord shouldn't find out unit 6 of 8
    // silently failed partway through.
    const effectiveLimit = unitLimit ?? Number(form.unitsCount) ?? null;
    if (effectiveLimit != null && units.length + count > effectiveLimit) {
      const slotsLeft = Math.max(0, effectiveLimit - units.length);
      setError(
        `That would add ${count} units, but your subscription only has ${slotsLeft} unit slot${slotsLeft === 1 ? '' : 's'} left ` +
          `(limit ${effectiveLimit}, ${units.length} already added). Lower the number, or increase your unit count on your subscription first.`
      );
      return;
    }

    const resolvedUnitType = newUnit.unitType === 'Custom' ? newUnit.customUnitType.trim() : newUnit.unitType;
    const rentAmount = Number(newUnit.rentAmount);

    // Split the typed name into a non-numeric prefix and a trailing
    // number, preserving zero-padding (e.g. "A01" -> "A01", "A02", ...
    // not "A01", "A2"). No trailing number ("House") just appends
    // " 1", " 2", ... instead.
    const match = newUnit.unitName.match(/^(.*?)(\d+)$/);
    const prefix = match ? match[1] : `${newUnit.unitName} `;
    const startNum = match ? Number(match[2]) : 1;
    const padLength = match ? match[2].length : 0;

    const generated = [];
    for (let i = 0; i < count; i += 1) {
      const name = `${prefix}${String(startNum + i).padStart(padLength, '0')}`;
      const code = `RPA-${name.replace(/\s+/g, '').toUpperCase()}-${String(units.length + generated.length + 1).padStart(3, '0')}`;
      generated.push({ unitName: name, unitType: resolvedUnitType, customUnitType: newUnit.customUnitType, rentAmount, code, extraCharges: [] });
    }

    setUnits((u) => [...u, ...generated]);
    setNewUnit({ unitName: '', unitType: 'Bedsitter', customUnitType: '', rentAmount: '' });
    setDuplicateCount('');
    setDuplicateOpen(false);
  }

  // BUG FIX ("Saved 0 of 22 units... unit named GE1 already exists"
  // even though the table below already shows all 22 saved with real
  // codes): the Continue button below only disables via the `loading`
  // STATE variable, and React state updates aren't synchronous - there
  // is a real window, right after the first click, before the
  // re-render that disables the button lands. A fast double-click (or
  // an impatient second tap while the first request is still
  // in-flight) fires handleUnitsSubmit a second time inside that
  // window. Both invocations then read the SAME stale `units` array
  // (neither one has seen the other's progress yet) and both start
  // creating from unit #1 - one wins and creates everything
  // successfully (which is what the table beneath the error was
  // showing), the other loses that race on unit #1 and gets a 409,
  // reporting "saved 0" from its own stale point of view even though
  // the sibling call already saved everything.
  //
  // A `loading` state check at the top of the function doesn't close
  // this gap (same async-update problem); a ref does, because writing
  // to it takes effect immediately, in the same tick as the click.
  const unitsSubmitInFlight = useRef(false);

  async function handleUnitsSubmit() {
    if (unitsSubmitInFlight.current) return;
    unitsSubmitInFlight.current = true;
    try {
      await doHandleUnitsSubmit();
    } finally {
      unitsSubmitInFlight.current = false;
    }
  }

  async function doHandleUnitsSubmit() {
    setError('');
    const token = sessionStorage.getItem('rentapay_token');

    if (!token) {
      // No token (e.g. auto-login after OTP failed) - nothing we can
      // persist. Let the person continue with local-only data rather
      // than trap them; they can finish setup and add units properly
      // once logged in normally.
      setStepIndex(5);
      return;
    }

    setLoading(true);
    // FIX (huge signup bug: "failed to fetch units" / "could not save
    // unit - unit name exists" even though it clearly did save, unit
    // count exceeding the subscription, duplicate names showing up in
    // the scout portal): this used to fire every unit's createUnit
    // call at once with Promise.all. Each call independently reads the
    // current active-unit count (to enforce the subscription limit)
    // and the highest existing payment-code number (to pick the next
    // one) - neither read waits for other in-flight requests to
    // finish inserting first. Fired in parallel, every request sees
    // the same stale "before" numbers, so several units land on the
    // same payment code (one insert wins, the rest fail a unique-
    // constraint check with a generic error) and the subscription
    // limit can be exceeded. Worse, Promise.all rejects the WHOLE
    // batch the moment any single one fails, so units already inserted
    // successfully never got their real id written back into local
    // state - the next "Finish setup" retry then resubmitted them too,
    // creating true duplicate rows.
    //
    // Creating them one at a time, and saving each unit's real id into
    // state as soon as it succeeds (not only at the very end), closes
    // both holes: every request now sees the previous one already
    // committed, and a retry after a partial failure only resubmits
    // units that don't have a real id yet.
    const updatedUnits = [...units];
    let failure = null;
    for (let i = 0; i < updatedUnits.length; i += 1) {
      const u = updatedUnits[i];
      if (u.id) continue; // already created in an earlier attempt
      try {
        const res = await api.createUnit(
          { unitName: u.unitName, unitType: u.unitType, rentAmount: u.rentAmount, propertyId: defaultPropertyId || undefined },
          token
        );
        updatedUnits[i] = { ...u, id: res.unit.id, code: res.unit.unit_payment_code };
        setUnits([...updatedUnits]); // persist progress immediately, not just on full success
      } catch (err) {
        failure = err;
        break;
      }
    }
    setLoading(false);
    if (failure) {
      const savedSoFar = updatedUnits.filter((u) => u.id).length;
      setError(
        `Saved ${savedSoFar} of ${updatedUnits.length} units before hitting a problem: ${failure.message}. ` +
          `The ones already saved won't be re-created - tap "Continue" again to retry just the rest.`
      );
      return;
    }
    setStepIndex(5);
  }

  const finishSetupInFlight = useRef(false);

  async function handleFinishSetup() {
    if (finishSetupInFlight.current) return;
    finishSetupInFlight.current = true;
    try {
      await doHandleFinishSetup();
    } finally {
      finishSetupInFlight.current = false;
    }
  }

  async function doHandleFinishSetup() {
    setError('');
    const token = sessionStorage.getItem('rentapay_token');

    if (token) {
      // Real completion path: this person is logged in (either they
      // just finished OTP verification moments ago in THIS session, or
      // they arrived here via Login.jsx's resume redirect after
      // logging in separately). Tell the backend so
      // setup_wizard_complete flips to true and future logins stop
      // sending them back into this wizard - closing the loop that
      // existed before this endpoint was added.
      setLoading(true);
      try {
        await api.completeSetupWizard({}, token);
      } catch (err) {
        // THE FIX for "shows success, sends me to login, then the
        // wizard just starts again": this used to only console.warn
        // and quietly show the 'done' screen anyway, so a failed
        // completeSetupWizard call (e.g. the must_change_password /
        // setup_wizard_complete schema-cache bug - see
        // sql/2026-07-fixes.sql) looked exactly like success right up
        // until the next login bounced the landlord straight back
        // into this wizard, with no explanation of why. Now the
        // person actually sees that it failed and can retry, instead
        // of the wizard silently lying about having finished.
        setError(
          `Could not save your setup as complete: ${err.message}. ` +
            `Your units and property details ARE saved - tap "Finish setup" again to retry, ` +
            `or you'll be brought back here automatically next time you log in.`
        );
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    // No token (e.g. testing wizard UI in isolation without ever
    // having logged in) - nothing to call, just show the done screen.
    setStepIndex(6);
  }

  const totalExpectedRent = units.reduce((sum, u) => sum + u.rentAmount, 0);

  return (
    <div className="register-page">
      <aside className="register-page__rail">
        <div className="register-page__brand">
          RentaPay <span>Setup</span>
        </div>
        <StepRail steps={STEPS} currentIndex={stepIndex} />
      </aside>

      <main className="register-page__main">
        <div className="register-page__panel">
          {error && <div className="api-error-banner">{error}</div>}

          {/* STEP 0: Registration details */}
          {stepIndex === 0 && (
            <>
              <h1>Let's get you set up</h1>
              <p className="register-page__intro">
                Tell us about you and how many units you're managing. We'll calculate your subscription cost instantly.
              </p>
              <form onSubmit={handleSubmitDetails}>
                <div className="register-page__form-grid">
                  <div className="form-field form-field--full">
                    <label className="form-field__label" htmlFor="fullName">Full name</label>
                    <input id="fullName" required value={form.fullName} onChange={(e) => updateForm('fullName', e.target.value)} placeholder="Jane Wanjiru" />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="phone">Phone number</label>
                    <input id="phone" required value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} placeholder="07XXXXXXXX or 2547XXXXXXXX" />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="email">Email (optional)</label>
                    <input id="email" type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} placeholder="jane@example.com" />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="gender">I am a (optional)</label>
                    <select id="gender" value={form.gender} onChange={(e) => updateForm('gender', e.target.value)}>
                      <option value="">Prefer not to say</option>
                      <option value="male">Landlord (male)</option>
                      <option value="female">Landlady (female)</option>
                    </select>
                    <p className="form-field__hint">Just so the portal addresses you correctly - never shown to tenants.</p>
                  </div>
                  <div className="form-field form-field--full">
                    <label className="form-field__label" htmlFor="password">Password</label>
                    <input id="password" type="password" required value={form.password} onChange={(e) => updateForm('password', e.target.value)} placeholder="Min 8 characters, 1 uppercase, 1 number, 1 symbol" />
                    <p className="form-field__hint">Can't be your phone number or your name.</p>
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="unitsCount">Number of units</label>
                    <input id="unitsCount" type="number" min="1" required value={form.unitsCount} onChange={(e) => updateForm('unitsCount', e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="periodMonths">Subscription period (months)</label>
                    <input
                      id="periodMonths"
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={form.periodMonths}
                      onChange={(e) => updateForm('periodMonths', e.target.value)}
                    />
                    <p className="form-field__hint">Any length you want - discounts apply automatically at 3, 6, and 12 months.</p>
                  </div>
                </div>

                <div className="cost-summary">
                  <div className="cost-summary__row">
                    <span>KES {cost.rate.toFixed(2)} / unit / month</span>
                    <span>{form.unitsCount} units × {form.periodMonths} mo</span>
                  </div>
                  {cost.discount > 0 && (
                    <div className="cost-summary__row">
                      <span>Discount applied</span>
                      <span>{Math.round(cost.discount * 100)}% off</span>
                    </div>
                  )}
                  <div className="cost-summary__row cost-summary__row--total">
                    <span>Total due today</span>
                    <span className="cost-summary__total-value">KES {cost.total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="register-page__actions">
                  <Button type="submit" variant="mpesa" loading={loading}>
                    Continue to M-Pesa payment
                  </Button>
                </div>
              </form>
            </>
          )}

          {/* STEP 1: M-Pesa payment pending */}
          {stepIndex === 1 && (
            <div className="mpesa-pending">
              <button
                type="button"
                className="add-tenant-back"
                style={{ marginBottom: '1rem', display: 'inline-block' }}
                onClick={() => setStepIndex(0)}
              >
                ← Back
              </button>
              <div className="mpesa-pending__pulse">📲</div>
              <h2>Check your phone</h2>
              <p>
                We sent an M-Pesa prompt to <strong>{form.phone}</strong> for KES {amountDue?.toLocaleString()}.
                Enter your PIN to activate your RentaPay account.
              </p>
              {paymentPollError && <div className="api-error-banner" role="alert">{paymentPollError}</div>}
              <div style={{ marginTop: '2rem' }}>
                <Button variant="primary" loading={paymentPolling} onClick={handlePaymentConfirmed}>
                  {paymentPolling ? 'Confirming your payment…' : "I've completed the payment"}
                </Button>
              </div>
              {paymentPolling && (
                <p className="register-page__intro" style={{ marginTop: '1rem' }}>
                  Checking with M-Pesa - this can take up to a minute. Don't close this page.
                </p>
              )}

              {!manualSubmitted ? (
                <div style={{ marginTop: '2rem', borderTop: '1px solid var(--color-border, #e5e1d8)', paddingTop: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <h3 style={{ fontSize: 'var(--text-md, 1rem)', margin: 0 }}>Or pay manually</h3>
                    <button
                      type="button"
                      className="ghost-link"
                      onClick={() => setShowManualPayment((v) => !v)}
                    >
                      {showManualPayment ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p className="register-page__intro" style={{ marginTop: '0.25rem' }}>
                    If the M-Pesa prompt fails, gets cancelled, or never arrives - or you'd simply rather pay this way -
                    send the amount yourself and enter the confirmation details below.
                  </p>
                  {showManualPayment && (
                    <form onSubmit={handleSubmitManualPayment} style={{ marginTop: '1rem', textAlign: 'left' }}>
                      <PaymentDetailsCard amount={amountDue} note="Enter the M-Pesa confirmation details below - your account will be activated once an admin verifies it (usually within a few minutes)." />
                      {manualError && <div className="api-error-banner" role="alert">{manualError}</div>}
                      <div className="form-field">
                        <label className="form-field__label">M-Pesa transaction code</label>
                        <input required value={manualForm.transactionCode} onChange={(e) => setManualForm((f) => ({ ...f, transactionCode: e.target.value }))} placeholder="e.g. QGH7XXXXX" />
                      </div>
                      <div className="form-field">
                        <label className="form-field__label">Name on the M-Pesa message</label>
                        <input required value={manualForm.mpesaPayerName} onChange={(e) => setManualForm((f) => ({ ...f, mpesaPayerName: e.target.value }))} />
                      </div>
                      <div className="form-field">
                        <label className="form-field__label">Phone number that paid</label>
                        <input required value={manualForm.mpesaPayerPhone} onChange={(e) => setManualForm((f) => ({ ...f, mpesaPayerPhone: e.target.value }))} placeholder="07XXXXXXXX" />
                      </div>
                      <Button type="submit" variant="primary" loading={manualSubmitting}>Submit payment</Button>
                    </form>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: '2rem', borderTop: '1px solid var(--color-border, #e5e1d8)', paddingTop: '1.5rem' }}>
                  <p className="register-page__intro">
                    {manualPolling ? 'Waiting for your payment to be verified - this page will move on automatically once it is.' : 'Submitted. Waiting for verification.'}
                  </p>
                  {manualPollError && <div className="api-error-banner" role="alert">{manualPollError}</div>}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Setup Wizard Step 1 — Property */}
          {stepIndex === 2 && (
            <>
              <span className="success-badge">✓ Payment confirmed</span>
              <h1>Tell us about your property</h1>
              <p className="register-page__intro">Setup Wizard — Step 1 of 5</p>
              <form onSubmit={handlePropertySubmit}>
                <div className="form-field">
                  <label className="form-field__label" htmlFor="estateName">Estate name</label>
                  <input id="estateName" required value={property.estateName} onChange={(e) => setProperty((p) => ({ ...p, estateName: e.target.value }))} placeholder="Sunrise Apartments" />
                </div>
                <div className="register-page__form-grid">
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="location">Location</label>
                    <input id="location" required value={property.location} onChange={(e) => setProperty((p) => ({ ...p, location: e.target.value }))} placeholder="Kilimani" />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="county">County</label>
                    <select
                      id="county"
                      required
                      value={property.county}
                      onChange={(e) => setProperty((p) => ({ ...p, county: e.target.value, constituency: '' }))}
                    >
                      <option value="" disabled>Select a county…</option>
                      {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="constituency">Constituency</label>
                    <select
                      id="constituency"
                      required
                      disabled={!property.county}
                      value={property.constituency}
                      onChange={(e) => setProperty((p) => ({ ...p, constituency: e.target.value }))}
                    >
                      <option value="" disabled>{property.county ? 'Select a constituency…' : 'Select a county first…'}</option>
                      {(KENYA_CONSTITUENCIES[property.county] || []).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-field__label" htmlFor="description">Description (optional)</label>
                  <input id="description" value={property.description} onChange={(e) => setProperty((p) => ({ ...p, description: e.target.value }))} placeholder="3-storey block, 12 units" />
                </div>

                {/* Caretaker / property manager contact - optional. If
                    set, tenants will see this contact alongside the
                    landlord's own on their portal, for when the
                    landlord isn't the first point of contact day-to-day. */}
                <div className="register-page__form-grid">
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="caretakerName">Caretaker name (optional)</label>
                    <input id="caretakerName" value={property.caretakerName} onChange={(e) => setProperty((p) => ({ ...p, caretakerName: e.target.value }))} placeholder="e.g. John Mwangi" />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="caretakerPhone">Their phone number (optional)</label>
                    <input id="caretakerPhone" value={property.caretakerPhone} onChange={(e) => setProperty((p) => ({ ...p, caretakerPhone: e.target.value }))} placeholder="07XXXXXXXX or 2547XXXXXXXX" />
                  </div>
                </div>
                <p className="register-page__hint">
                  If you have a caretaker who handles the property day-to-day, tenants will see their contact details alongside yours. Leave blank if you handle it yourself. You can add
                  and edit this any time later from Settings - and if you want to give someone their own login to the portal, add them as a Property Manager from Settings instead.
                </p>

                <div className="register-page__actions">
                  <Button type="submit" variant="primary" loading={loading}>Continue</Button>
                </div>
              </form>
            </>
          )}

          {/* STEP 4: Setup Wizard Step 2 — Payment method */}
          {stepIndex === 3 && (
            <>
              <h1>How will rent reach you?</h1>
              <p className="register-page__intro">Setup Wizard — Step 2 of 5</p>
              <form onSubmit={handlePaymentMethodSubmit}>
                <div className="form-field">
                  <label className="form-field__label" htmlFor="method">Method</label>
                  <select id="method" value={paymentMethod.method} onChange={(e) => setPaymentMethod((p) => ({ ...p, method: e.target.value }))}>
                    <option value="stk">STK Push (recommended)</option>
                    <option value="paybill">Paybill</option>
                    <option value="till">Till Number</option>
                  </select>
                </div>
                {paymentMethod.method === 'paybill' && (
                  <div className="register-page__form-grid">
                    <div className="form-field">
                      <label className="form-field__label" htmlFor="paybillNumber">Paybill number</label>
                      <input id="paybillNumber" value={paymentMethod.paybillNumber} onChange={(e) => setPaymentMethod((p) => ({ ...p, paybillNumber: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label className="form-field__label" htmlFor="accountNumber">Account number</label>
                      <input id="accountNumber" value={paymentMethod.accountNumber} onChange={(e) => setPaymentMethod((p) => ({ ...p, accountNumber: e.target.value }))} />
                    </div>
                  </div>
                )}
                {paymentMethod.method === 'till' && (
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="tillNumber">Till number</label>
                    <input id="tillNumber" value={paymentMethod.tillNumber} onChange={(e) => setPaymentMethod((p) => ({ ...p, tillNumber: e.target.value }))} />
                  </div>
                )}
                <div className="register-page__actions">
                  <Button type="button" variant="ghost" onClick={() => setStepIndex(2)}>Back</Button>
                  <Button type="submit" variant="primary">Continue</Button>
                </div>
              </form>
            </>
          )}

          {/* STEP 5: Setup Wizard Step 3 — Units (signature ledger element) */}
          {stepIndex === 4 && (
            <>
              <h1>Add your units</h1>
              <p className="register-page__intro">
                Setup Wizard — Step 3 of 5. Each unit gets a permanent payment code automatically.
                {' '}
                {(unitLimit ?? form.unitsCount) != null && (
                  <strong>
                    {units.length} of {unitLimit ?? form.unitsCount} units added.
                  </strong>
                )}
              </p>

              <form onSubmit={handleAddUnit} className="add-unit-row">
                <div className="form-field">
                  <label className="form-field__label" htmlFor="unitName">Unit name</label>
                  <input id="unitName" value={newUnit.unitName} onChange={(e) => setNewUnit((u) => ({ ...u, unitName: e.target.value }))} placeholder="A1" />
                </div>
                <div className="form-field">
                  <label className="form-field__label" htmlFor="unitType">Type</label>
                  <select id="unitType" value={newUnit.unitType} onChange={(e) => setNewUnit((u) => ({ ...u, unitType: e.target.value }))}>
                    <option>Bedsitter</option>
                    <option>1 Bedroom</option>
                    <option>2 Bedroom</option>
                    <option>3 Bedroom</option>
                    <option value="Custom">Custom…</option>
                  </select>
                </div>
                {newUnit.unitType === 'Custom' && (
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="customUnitType">Custom type</label>
                    <input
                      id="customUnitType"
                      value={newUnit.customUnitType}
                      onChange={(e) => setNewUnit((u) => ({ ...u, customUnitType: e.target.value }))}
                      placeholder="e.g. Studio, Servant Quarter"
                    />
                  </div>
                )}
                <div className="form-field">
                  <label className="form-field__label" htmlFor="rentAmount">Rent (KES)</label>
                  <input id="rentAmount" type="number" value={newUnit.rentAmount} onChange={(e) => setNewUnit((u) => ({ ...u, rentAmount: e.target.value }))} placeholder="8000" />
                </div>
                <Button
                  type="submit"
                  variant="ghost"
                  className="add-unit-row__btn"
                  disabled={(unitLimit ?? form.unitsCount) != null && units.length >= (unitLimit ?? form.unitsCount)}
                >
                  + Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="add-unit-row__btn"
                  onClick={() => setDuplicateOpen((open) => !open)}
                  disabled={(unitLimit ?? form.unitsCount) != null && units.length >= (unitLimit ?? form.unitsCount)}
                >
                  Duplicate…
                </Button>
              </form>

              {duplicateOpen && (
                <form onSubmit={handleDuplicateUnits} className="add-unit-row duplicate-units-row">
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="duplicateCount">
                      How many units like this one? (including "{newUnit.unitName || '…'}")
                    </label>
                    <input
                      id="duplicateCount"
                      type="number"
                      min="1"
                      value={duplicateCount}
                      onChange={(e) => setDuplicateCount(e.target.value)}
                      placeholder="e.g. 8"
                      autoFocus
                    />
                  </div>
                  <p className="tenant-portal-hint duplicate-units-row__hint">
                    Uses the name, type, and rent typed above, and numbers the rest onward automatically
                    (e.g. "A1" \u2192 A1, A2, A3…).
                  </p>
                  <div className="add-unit-row__actions">
                    <Button type="submit" variant="primary" className="add-unit-row__btn">Create units</Button>
                    <Button type="button" variant="ghost" className="add-unit-row__btn" onClick={() => { setDuplicateOpen(false); setDuplicateCount(''); }}>Cancel</Button>
                  </div>
                </form>
              )}

              <div className="unit-ledger">
                <div className="unit-ledger__header">
                  <span>Unit</span>
                  <span>Monthly rent</span>
                </div>
                {units.length === 0 ? (
                  <div className="unit-ledger__empty">No units added yet — add your first one above.</div>
                ) : (
                  units.map((u, i) => (
                    <div className="unit-ledger__row" key={i}>
                      <span className="unit-ledger__row-name">
                        {u.unitName} <span className="unit-ledger__code">{u.code}</span>
                      </span>
                      <span className="unit-ledger__row-amount">KES {u.rentAmount.toLocaleString()}</span>
                    </div>
                  ))
                )}
                {units.length > 0 && (
                  <div className="unit-ledger__footer">
                    <span>Expected monthly revenue</span>
                    <span>KES {totalExpectedRent.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="register-page__actions">
                <Button type="button" variant="ghost" onClick={() => setStepIndex(3)}>Back</Button>
                <Button type="button" variant="primary" loading={loading} disabled={units.length === 0} onClick={handleUnitsSubmit}>
                  Continue with {units.length} unit{units.length === 1 ? '' : 's'}
                </Button>
              </div>
            </>
          )}

          {/* STEP 6: Setup Wizard Step 4 — Extra charges (real per-unit entry) */}
          {stepIndex === 5 && (
            <>
              <h1>Add extra charges</h1>
              <p className="register-page__intro">
                Setup Wizard — Step 4 of 5. Optional — water, garbage, security, or electricity, per unit. Skip any unit and add charges later from the dashboard.
              </p>

              {units.map((u, unitIndex) => {
                const unitCharges = u.extraCharges || [];
                const chargesTotal = unitCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
                const draft = chargeDrafts[unitIndex] || { name: '', amount: '' };

                return (
                  <div className="charge-unit-card" key={unitIndex}>
                    <div className="charge-unit-card__header">
                      <span className="charge-unit-card__name">{u.unitName}</span>
                      <span className="charge-unit-card__rent">Rent KES {u.rentAmount.toLocaleString()}</span>
                    </div>

                    {unitCharges.length > 0 && (
                      <div className="charge-unit-card__list">
                        {unitCharges.map((c, chargeIndex) => (
                          <div className="charge-unit-card__row" key={chargeIndex}>
                            <span>{c.name}</span>
                            <span>KES {Number(c.amount).toLocaleString()}</span>
                            <button
                              type="button"
                              className="charge-unit-card__duplicate"
                              disabled={units.length < 2 || (duplicatingCharge?.unitIndex === unitIndex && duplicatingCharge?.chargeIndex === chargeIndex)}
                              title="Copy this charge onto every other unit"
                              onClick={() => handleDuplicateChargeToAll(unitIndex, chargeIndex)}
                            >
                              {duplicatingCharge?.unitIndex === unitIndex && duplicatingCharge?.chargeIndex === chargeIndex ? 'Duplicating…' : 'Duplicate to all units'}
                            </button>
                            <button
                              type="button"
                              className="charge-unit-card__remove"
                              aria-label={`Remove ${c.name} from ${u.unitName}`}
                              onClick={() => handleRemoveCharge(unitIndex, chargeIndex)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <form className="charge-unit-card__add-row" onSubmit={(e) => handleAddCharge(e, unitIndex)}>
                      <input
                        placeholder="Charge name (e.g. Water)"
                        value={draft.name}
                        onChange={(e) => updateChargeDraft(unitIndex, { ...draft, name: e.target.value })}
                      />
                      <input
                        type="number"
                        placeholder="Amount (KES)"
                        value={draft.amount}
                        onChange={(e) => updateChargeDraft(unitIndex, { ...draft, amount: e.target.value })}
                      />
                      <Button type="submit" variant="ghost" className="add-unit-row__btn">+ Add</Button>
                    </form>

                    <div className="charge-unit-card__total">
                      <span>Total due per month</span>
                      <span>KES {(u.rentAmount + chargesTotal).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}

              <div className="register-page__actions">
                <Button type="button" variant="ghost" onClick={() => setStepIndex(4)}>Back</Button>
                <Button type="button" variant="primary" loading={loading} onClick={handleFinishSetup}>Finish setup</Button>
              </div>
            </>
          )}

          {/* STEP 7: Setup Wizard Step 5 — Done */}
          {stepIndex === 6 && (
            <div className="mpesa-pending">
              <div className="mpesa-pending__icon">🎉</div>
              <h2>Your dashboard is ready</h2>
              <p>
                {units.length} unit{units.length === 1 ? '' : 's'} added, expected monthly revenue KES {totalExpectedRent.toLocaleString()}.
                Log in to start adding tenants.
              </p>
              <div style={{ marginTop: '2rem' }}>
                <Button variant="primary" onClick={() => { sessionStorage.removeItem(STORAGE_KEY); navigate('/login'); }}>
                  Go to login
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
