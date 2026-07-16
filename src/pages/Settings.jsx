import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import BiometricSettingsPanel from '../components/BiometricSettingsPanel.jsx';
import { api, ApiError } from '../api/client.js';
import './Settings.css';

/**
 * Settings hub - shared by landlords and property managers (a manager
 * sees the same page, scoped to their landlord's data, with the
 * handful of actions locked to the landlord themself hidden rather
 * than shown-then-rejected). Sections:
 *
 * 1. Caretaker contacts - a plain, no-login contact per property,
 *    editable any time by either the landlord or a manager.
 * 2. Property Managers (landlord view only) - add a real login
 *    account for a second party, assign which properties they can
 *    access, edit their contact info, or remove them.
 * 3. Contact Details - each of landlord/manager edits their OWN
 *    contact info here; the landlord additionally picks who is "the
 *    contact" tenants see for each property (themself or one of
 *    their managers) - that choice updates live in the tenant portal
 *    whenever either person edits their own phone number.
 * 4. Payment method (landlord only - how rent reaches the landlord).
 */
export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = sessionStorage.getItem('rentapay_token');
  const role = sessionStorage.getItem('rentapay_role');
  const isManager = role === 'manager';
  // A caretaker is stored as role='manager' + a role_level of
  // 'caretaker' (see Login.jsx / auth.controller.js) - persisted at
  // login so we can tell full Property Managers and Caretakers apart
  // here without an extra round trip before first paint.
  const roleLevel = sessionStorage.getItem('rentapay_role_level');
  const isCaretaker = isManager && roleLevel === 'caretaker';
  // A full property manager shares the landlord's access, including
  // seeing (read-only) who else has been given access - only a
  // caretaker is fully blocked from the "Property Managers" section.
  const canViewTeamSection = !isCaretaker;

  const [properties, setProperties] = useState([]);
  const [managers, setManagers] = useState([]);
  const [myAccess, setMyAccess] = useState(null); // manager's own record, when role === 'manager'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // --- Caretaker (per-property, no-login) contact editing state ---
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [caretakerDraft, setCaretakerDraft] = useState({ caretakerName: '', caretakerPhone: '' });
  const [savingCaretaker, setSavingCaretaker] = useState(false);

  // --- Property manager add/edit state (landlord only) ---
  const [showAddManager, setShowAddManager] = useState(false);
  const [addManagerForm, setAddManagerForm] = useState({ fullName: '', phone: '', email: '', propertyIds: [], roleLevel: 'manager' });
  const [addingManager, setAddingManager] = useState(false);
  const [justAddedManager, setJustAddedManager] = useState(null); // { tempCredentials, name } - shown as an unmissable fallback
  const [editingManagerId, setEditingManagerId] = useState(null);
  const [managerEditDraft, setManagerEditDraft] = useState({ fullName: '', phone: '', email: '' });
  const [savingManagerEdit, setSavingManagerEdit] = useState(false);
  const [editingAssignmentsId, setEditingAssignmentsId] = useState(null);
  const [assignmentsDraft, setAssignmentsDraft] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  // --- Contact details (own contact + "who is the contact" picker) ---
  // FIX: this card used to render as an always-open form with nothing
  // pre-filled (and for a landlord, nothing was even fetched from the
  // backend to fill it with) - so every visit, including right after
  // saving and logging back in, looked like contact details had never
  // been entered at all. Now: once a saved name+phone come back from
  // the backend, the card shows a read-only summary with an "Edit"
  // button; tapping Edit reopens the form pre-filled with the current
  // values. `contactHasBeenLoaded` gates this so the very first load
  // (before we know whether anything is saved yet) doesn't flash the
  // wrong state.
  const [myContact, setMyContact] = useState({ fullName: '', phone: '', email: '', gender: '' });
  const [contactHasBeenLoaded, setContactHasBeenLoaded] = useState(false);
  const [editingMyContact, setEditingMyContact] = useState(false);
  const [savingMyContact, setSavingMyContact] = useState(false);
  const [savingContactFor, setSavingContactFor] = useState(null); // propertyId currently saving

  // --- Payment method (landlord only) ---
  // Same "show what's actually saved, with an Edit button" pattern as
  // Contact Details above - THE FIX for "it always comes up as STK
  // Push even when I set Paybill": nothing used to fetch the
  // landlord's actual saved payment method at all, so the form always
  // rendered its hardcoded default instead of reality.
  const [paymentMethod, setPaymentMethod] = useState({ method: 'stk', paybillNumber: '', accountNumber: '', tillNumber: '', stkPhoneNumber: '' });
  const [editingPayment, setEditingPayment] = useState(false);
  // Apartment-scoped payment method (fixes "updating this apartment's
  // payment method also changed my other apartments"). '' means "the
  // account-wide default", which applies to any apartment that hasn't
  // set its own override.
  const [paymentPropertyId, setPaymentPropertyId] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  function load() {
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);

    const propertiesPromise = api.listProperties(token);
    const secondPromise = isManager ? api.getMyManagerAccess(token) : api.listPropertyManagers(token);
    const peersPromise = isManager && canViewTeamSection ? api.listPropertyManagers(token) : Promise.resolve(null);
    const profilePromise = !isManager ? api.getMyLandlordProfile(token) : Promise.resolve(null);
    const paymentPromise = api.getPaymentMethod(token);

    Promise.all([propertiesPromise, secondPromise, peersPromise, profilePromise, paymentPromise])
      .then(([propsRes, secondRes, peersRes, profileRes, paymentRes]) => {
        setProperties(propsRes.properties || []);
        let loadedContact;
        if (isManager) {
          setMyAccess(secondRes.manager);
          loadedContact = { fullName: secondRes.manager?.full_name || '', phone: secondRes.manager?.phone || '', email: secondRes.manager?.email || '', gender: secondRes.manager?.gender || '' };
          if (peersRes) setManagers(peersRes.managers || []);
        } else {
          setManagers(secondRes.managers || []);
          loadedContact = profileRes?.contact || { fullName: '', phone: '', email: '', gender: '' };
        }
        setMyContact(loadedContact);
        if (paymentRes?.paymentMethod) setPaymentMethod(paymentRes.paymentMethod);
        // Only decide the card's initial open/collapsed state the
        // FIRST time we learn what's actually saved - once the person
        // is mid-edit, a background reload (e.g. after saving the
        // caretaker contact elsewhere on the page) must never yank
        // them back out of the form.
        if (!contactHasBeenLoaded) {
          setEditingMyContact(!(loadedContact.fullName && loadedContact.phone));
          setContactHasBeenLoaded(true);
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------
  // Caretaker (per property, no login)
  // -----------------------------------------------------------------
  function startEditingCaretaker(property) {
    setEditingPropertyId(property.id);
    setCaretakerDraft({ caretakerName: property.caretaker_name || '', caretakerPhone: property.caretaker_phone || '' });
  }

  async function saveCaretaker(propertyId) {
    setSavingCaretaker(true);
    setError('');
    try {
      await api.updateProperty(propertyId, caretakerDraft, token);
      setNotice('Caretaker contact updated.');
      setEditingPropertyId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update contact.');
    } finally {
      setSavingCaretaker(false);
    }
  }

  async function removeCaretaker(propertyId) {
    setSavingCaretaker(true);
    setError('');
    try {
      await api.updateProperty(propertyId, { caretakerName: '', caretakerPhone: '' }, token);
      setNotice('Caretaker contact removed.');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove contact.');
    } finally {
      setSavingCaretaker(false);
    }
  }

  // -----------------------------------------------------------------
  // Property managers (landlord only)
  // -----------------------------------------------------------------
  function toggleAddManagerProperty(propertyId) {
    setAddManagerForm((f) => ({
      ...f,
      propertyIds: f.propertyIds.includes(propertyId) ? f.propertyIds.filter((id) => id !== propertyId) : [...f.propertyIds, propertyId],
    }));
  }

  async function submitAddManager(e) {
    e.preventDefault();
    setAddingManager(true);
    setError('');
    try {
      const res = await api.addPropertyManager(addManagerForm, token);
      setNotice(res.message || 'Property manager added. Their login details were sent via SMS.');
      // Fallback so it's never unclear whether this worked: shown right
      // in the form area (not just a banner near the top that's easy to
      // miss), with the temp password/OTP visible in case the SMS/email
      // didn't actually arrive (e.g. sandbox SMS credentials in dev).
      setJustAddedManager({ name: addManagerForm.fullName, ...res.tempCredentials });
      setShowAddManager(false);
      setAddManagerForm({ fullName: '', phone: '', email: '', propertyIds: [], roleLevel: 'manager' });
      load();
      // Make sure the confirmation is actually visible - this is the
      // fix for "I pressed submit and nothing seemed to happen": on a
      // long settings page the top banner can be scrolled out of view.
      requestAnimationFrame(() => {
        document.getElementById('manager-added-confirmation')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add property manager.');
    } finally {
      setAddingManager(false);
    }
  }

  function startEditingManager(manager) {
    setEditingManagerId(manager.id);
    setManagerEditDraft({ fullName: manager.full_name || '', phone: manager.phone || '', email: manager.email || '' });
  }

  async function saveManagerEdit(managerId) {
    setSavingManagerEdit(true);
    setError('');
    try {
      await api.updatePropertyManager(managerId, managerEditDraft, token);
      setNotice('Property manager contact updated.');
      setEditingManagerId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update property manager.');
    } finally {
      setSavingManagerEdit(false);
    }
  }

  function startEditingAssignments(manager) {
    setEditingAssignmentsId(manager.id);
    setAssignmentsDraft((manager.assignedProperties || []).map((p) => p.id));
  }

  function toggleAssignmentProperty(propertyId) {
    setAssignmentsDraft((ids) => (ids.includes(propertyId) ? ids.filter((id) => id !== propertyId) : [...ids, propertyId]));
  }

  async function saveAssignments(managerId) {
    setSavingAssignments(true);
    setError('');
    try {
      await api.updatePropertyManagerAssignments(managerId, { propertyIds: assignmentsDraft }, token);
      setNotice('Property access updated.');
      setEditingAssignmentsId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update property access.');
    } finally {
      setSavingAssignments(false);
    }
  }

  const [confirmingRemoveManagerId, setConfirmingRemoveManagerId] = useState(null);
  const [removeManagerBusy, setRemoveManagerBusy] = useState(false);
  const [removeManagerError, setRemoveManagerError] = useState('');
  const [pendingRemoveManager, setPendingRemoveManager] = useState(null); // { id, name }

  async function removeManagerAccount(managerId, managerName) {
    // Step 1 of 2: tapping "Remove" the first time just reveals an
    // inline warning instead of deleting anything.
    if (confirmingRemoveManagerId !== managerId) {
      setConfirmingRemoveManagerId(managerId);
      return;
    }
    // Step 2 of 2: a second, explicit, unmissable confirmation dialog -
    // removing someone's access is not reversible from the UI, so this
    // needs to be a genuinely deliberate action, not a misclick.
    setRemoveManagerError('');
    setPendingRemoveManager({ id: managerId, name: managerName });
  }

  async function confirmRemoveManager() {
    if (!pendingRemoveManager) return;
    setRemoveManagerBusy(true);
    setRemoveManagerError('');
    try {
      await api.removePropertyManager(pendingRemoveManager.id, token);
      setNotice('Property manager access removed.');
      setConfirmingRemoveManagerId(null);
      setPendingRemoveManager(null);
      load();
    } catch (err) {
      setRemoveManagerError(err instanceof ApiError ? err.message : 'Failed to remove property manager.');
    } finally {
      setRemoveManagerBusy(false);
    }
  }

  // -----------------------------------------------------------------
  // Contact details - own contact, plus "who is the contact" picker
  // -----------------------------------------------------------------
  async function saveMyContact(e) {
    e.preventDefault();
    setSavingMyContact(true);
    setError('');
    try {
      if (isManager) {
        await api.updatePropertyManager(myAccess.id, myContact, token);
      } else {
        await api.updateMyContact(myContact, token);
      }
      setNotice('Your contact details were updated. Tenants will see this reflected immediately.');
      setEditingMyContact(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update contact details.');
    } finally {
      setSavingMyContact(false);
    }
  }

  async function setPropertyContact(propertyId, primaryContactManagerId) {
    setSavingContactFor(propertyId);
    setError('');
    try {
      await api.updateProperty(propertyId, { primaryContactManagerId: primaryContactManagerId || null }, token);
      setNotice('Tenant-facing contact updated for this property.');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update the property contact.');
    } finally {
      setSavingContactFor(null);
    }
  }

  async function savePaymentMethod(e) {
    e.preventDefault();
    setSavingPayment(true);
    setError('');
    try {
      await api.updatePaymentMethod({ ...paymentMethod, propertyId: paymentPropertyId || undefined }, token);
      setNotice(paymentPropertyId ? 'Payment method updated for this apartment.' : 'Account default payment method updated.');
      setEditingPayment(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update payment method.');
    } finally {
      setSavingPayment(false);
    }
  }

  // Re-fetch whenever the person switches which apartment they're
  // viewing/editing the payment method for - each apartment can now
  // carry its own override instead of always showing the account-wide
  // default (see backend/sql/2026-07-property-payment-method.sql).
  useEffect(() => {
    if (!token || loading) return;
    api.getPaymentMethod(token, paymentPropertyId || undefined).then((res) => {
      if (res?.paymentMethod) setPaymentMethod(res.paymentMethod);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentPropertyId]);

  useEffect(() => {
    if (location.hash === '#security' && !loading) {
      document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash, loading]);

  return (
    <div className="settings-page">
      <Link to="/dashboard" className="settings-back">← Back to dashboard</Link>
      <h1>Settings</h1>

      {notice && <div className="settings-banner settings-banner--ok">{notice}</div>}
      {error && <div className="settings-banner settings-banner--error">{error}</div>}

      {/* ---------------- Caretaker contacts ---------------- */}
      <section className="settings-card">
        <h2>Caretaker contacts</h2>
        <p className="settings-card__caption">
          A plain contact per property - no login, just a name and number tenants can reach for day-to-day
          things. Separate from Property Managers below, who get their own login to the portal. Editable any time.
        </p>

        {loading ? (
          <p>Loading…</p>
        ) : properties.length === 0 ? (
          <p className="settings-empty">No properties yet.</p>
        ) : (
          <ul className="settings-manager-list">
            {properties.map((p) => (
              <li key={p.id} className="settings-manager-row">
                <div className="settings-manager-row__name">
                  <strong>{p.name}</strong>
                  {p.location && <span> — {p.location}</span>}
                </div>

                {editingPropertyId === p.id ? (
                  <div className="settings-manager-row__edit">
                    <input
                      placeholder="Caretaker name"
                      value={caretakerDraft.caretakerName}
                      onChange={(e) => setCaretakerDraft((d) => ({ ...d, caretakerName: e.target.value }))}
                    />
                    <input
                      placeholder="Phone (2547XXXXXXXX)"
                      value={caretakerDraft.caretakerPhone}
                      onChange={(e) => setCaretakerDraft((d) => ({ ...d, caretakerPhone: e.target.value }))}
                    />
                    <div className="settings-manager-row__actions">
                      <Button variant="primary" loading={savingCaretaker} onClick={() => saveCaretaker(p.id)}>Save</Button>
                      <button type="button" className="ghost-link" onClick={() => setEditingPropertyId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : p.liveCaretaker ? (
                  // A real caretaker account is assigned to this
                  // property - shows automatically, nothing to edit
                  // here manually since it stays in sync with the
                  // actual account on its own.
                  <div className="settings-manager-row__display">
                    <span>{p.liveCaretaker.name} · {p.liveCaretaker.phone}</span>
                    <span className="tenant-portal-hint" style={{ margin: 0 }}>Assigned caretaker account - manage assignment under Team below.</span>
                  </div>
                ) : (
                  <div className="settings-manager-row__display">
                    {p.caretaker_name || p.caretaker_phone ? (
                      <span>{p.caretaker_name || '—'} {p.caretaker_phone && `· ${p.caretaker_phone}`}</span>
                    ) : (
                      <span className="settings-manager-row__empty">No caretaker set for this property.</span>
                    )}
                    <div className="settings-manager-row__actions">
                      <button type="button" className="ghost-link" onClick={() => startEditingCaretaker(p)}>
                        {p.caretaker_name || p.caretaker_phone ? 'Edit' : 'Add'}
                      </button>
                      {(p.caretaker_name || p.caretaker_phone) && (
                        <button type="button" className="ghost-link danger-link" onClick={() => removeCaretaker(p.id)} disabled={savingCaretaker}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- Property Managers ----------------
          Landlord: full add/edit/assign/remove control.
          Full property manager: read-only view of the team (they
          share the landlord's access, so they can see who else has
          it), but can't add/remove/reassign - that stays landlord-only.
          Caretaker: this section doesn't render at all. */}
      {canViewTeamSection && (
        <section className="settings-card">
          <h2>Property Managers</h2>
          <p className="settings-card__caption">
            {isManager
              ? "Everyone with their own login to this landlord's portal. Adding, removing, or reassigning access is handled by the landlord."
              : "Give someone their own login to the portal - they'll see everything you see, scoped to the properties you assign them, but can't add/remove other managers, change assignments, or touch billing. Caretakers have the same login but are additionally blocked from removing tenants, transferring tenants, changing rent amounts, or adding/removing units."}
          </p>

          {!isManager && justAddedManager && (
            <div id="manager-added-confirmation" className="settings-banner settings-banner--ok" style={{ marginBottom: '1rem' }}>
              <strong>{justAddedManager.name} was added.</strong>
              <p style={{ margin: '0.4rem 0 0' }}>
                Their login details were sent to <strong>{justAddedManager.phone}</strong>. If the SMS/email
                doesn't arrive, share these directly:
              </p>
              <p style={{ margin: '0.4rem 0 0', fontFamily: 'monospace' }}>
                Temp password: <strong>{justAddedManager.tempPassword}</strong> · OTP: <strong>{justAddedManager.otp}</strong>
              </p>
              <button type="button" className="ghost-link" onClick={() => setJustAddedManager(null)} style={{ marginTop: '0.5rem' }}>Dismiss</button>
            </div>
          )}

          {!isManager && (!showAddManager ? (
            <Button variant="ghost" onClick={() => setShowAddManager(true)}>+ Add a property manager</Button>
          ) : (
            <form className="settings-payment-form" onSubmit={submitAddManager}>
              <div className="form-field">
                <label className="form-field__label">Full name</label>
                <input required value={addManagerForm.fullName} onChange={(e) => setAddManagerForm((f) => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-field__label">Role</label>
                <select
                  value={addManagerForm.roleLevel}
                  onChange={(e) => setAddManagerForm((f) => ({ ...f, roleLevel: e.target.value }))}
                >
                  <option value="manager">Property Manager (full access to assigned properties)</option>
                  <option value="caretaker">Caretaker (limited - no tenant removal, no billing/rent changes)</option>
                </select>
              </div>
              <div className="settings-payment-form__grid">
                <div className="form-field">
                  <label className="form-field__label">Phone</label>
                  <input required placeholder="2547XXXXXXXX" value={addManagerForm.phone} onChange={(e) => setAddManagerForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Email (optional)</label>
                  <input type="email" value={addManagerForm.email} onChange={(e) => setAddManagerForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
              </div>

              <div className="form-field">
                <label className="form-field__label">Which properties can they access?</label>
                {properties.length === 0 ? (
                  <p className="settings-empty">No properties yet.</p>
                ) : (
                  <div className="settings-property-picker">
                    <label className="settings-property-picker__item">
                      <input
                        type="checkbox"
                        checked={addManagerForm.propertyIds.length === properties.length}
                        onChange={(e) => setAddManagerForm((f) => ({ ...f, propertyIds: e.target.checked ? properties.map((p) => p.id) : [] }))}
                      />
                      All properties
                    </label>
                    {properties.map((p) => (
                      <label className="settings-property-picker__item" key={p.id}>
                        <input
                          type="checkbox"
                          checked={addManagerForm.propertyIds.includes(p.id)}
                          onChange={() => toggleAddManagerProperty(p.id)}
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="settings-manager-row__actions">
                <Button type="submit" variant="primary" loading={addingManager}>Add manager</Button>
                <button type="button" className="ghost-link" onClick={() => setShowAddManager(false)}>Cancel</button>
              </div>
            </form>
          ))}

          {managers.length > 0 && (
            <ul className="settings-manager-list" style={{ marginTop: 'var(--space-4)' }}>
              {managers.map((m) => (
                <li key={m.id} className="settings-manager-row">
                  <div className="settings-manager-row__name">
                    <strong>{m.full_name}</strong>
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', opacity: 0.7, textTransform: 'capitalize' }}>
                      ({m.role_level === 'caretaker' ? 'Caretaker' : 'Property Manager'})
                    </span>
                    {!m.is_active && <span className="settings-manager-row__empty"> (removed)</span>}
                  </div>

                  {!isManager && editingManagerId === m.id ? (
                    <div className="settings-manager-row__edit">
                      <input placeholder="Full name" value={managerEditDraft.fullName} onChange={(e) => setManagerEditDraft((d) => ({ ...d, fullName: e.target.value }))} />
                      <input placeholder="Phone" value={managerEditDraft.phone} onChange={(e) => setManagerEditDraft((d) => ({ ...d, phone: e.target.value }))} />
                      <input placeholder="Email" value={managerEditDraft.email} onChange={(e) => setManagerEditDraft((d) => ({ ...d, email: e.target.value }))} />
                      <div className="settings-manager-row__actions">
                        <Button variant="primary" loading={savingManagerEdit} onClick={() => saveManagerEdit(m.id)}>Save</Button>
                        <button type="button" className="ghost-link" onClick={() => setEditingManagerId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : !isManager && editingAssignmentsId === m.id ? (
                    <div className="settings-manager-row__edit" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <div className="settings-property-picker">
                        {properties.map((p) => (
                          <label className="settings-property-picker__item" key={p.id}>
                            <input type="checkbox" checked={assignmentsDraft.includes(p.id)} onChange={() => toggleAssignmentProperty(p.id)} />
                            {p.name}
                          </label>
                        ))}
                      </div>
                      <div className="settings-manager-row__actions">
                        <Button variant="primary" loading={savingAssignments} onClick={() => saveAssignments(m.id)}>Save access</Button>
                        <button type="button" className="ghost-link" onClick={() => setEditingAssignmentsId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="settings-manager-row__display">
                      <span>
                        {m.phone} {m.email && `· ${m.email}`}
                        <br />
                        <span className="settings-manager-row__empty">
                          {(m.assignedProperties || []).length === 0
                            ? 'No properties assigned'
                            : `Access: ${m.assignedProperties.map((p) => p.name).join(', ')}`}
                        </span>
                      </span>
                      {!isManager && (
                        <div className="settings-manager-row__actions">
                          <button type="button" className="ghost-link" onClick={() => startEditingManager(m)}>Edit contact</button>
                          <button type="button" className="ghost-link" onClick={() => startEditingAssignments(m)}>Edit access</button>
                          {m.is_active && (
                            confirmingRemoveManagerId === m.id ? (
                              <>
                                <span className="settings-manager-row__empty" style={{ color: '#b91c1c', fontWeight: 600 }}>Remove permanently?</span>
                                <button type="button" className="ghost-link danger-link" onClick={() => removeManagerAccount(m.id, m.full_name)}>Yes, remove</button>
                                <button type="button" className="ghost-link" onClick={() => setConfirmingRemoveManagerId(null)}>Cancel</button>
                              </>
                            ) : (
                              <button type="button" className="ghost-link danger-link" onClick={() => removeManagerAccount(m.id, m.full_name)}>Remove</button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ---------------- Contact Details ---------------- */}
      <section className="settings-card">
        <h2>Contact Details</h2>
        <p className="settings-card__caption">
          {isManager
            ? "Your own contact info - the landlord's stays untouched. Whichever properties you're set as the contact for, tenants there see this number."
            : "Your own contact info. If a property manager is set as the contact for a property instead, tenants there see the manager's number rather than yours."}
        </p>

        {editingMyContact ? (
          <form className="settings-payment-form" onSubmit={saveMyContact}>
            <div className="form-field">
              <label className="form-field__label">Full name</label>
              <input required value={myContact.fullName} onChange={(e) => setMyContact((c) => ({ ...c, fullName: e.target.value }))} />
            </div>
            <div className="settings-payment-form__grid">
              <div className="form-field">
                <label className="form-field__label">Phone</label>
                <input required placeholder="2547XXXXXXXX" value={myContact.phone} onChange={(e) => setMyContact((c) => ({ ...c, phone: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-field__label">Email</label>
                <input type="email" value={myContact.email} onChange={(e) => setMyContact((c) => ({ ...c, email: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-field__label">{isManager && myAccess?.role_level === 'caretaker' ? 'Gender' : 'I am a'} (optional)</label>
                <select value={myContact.gender} onChange={(e) => setMyContact((c) => ({ ...c, gender: e.target.value }))}>
                  <option value="">Prefer not to say</option>
                  <option value="male">{isManager ? 'Male' : 'Landlord (male)'}</option>
                  <option value="female">{isManager ? 'Female' : 'Landlady (female)'}</option>
                </select>
              </div>
            </div>
            <div className="settings-manager-row__actions">
              <Button type="submit" variant="primary" loading={savingMyContact}>Save my contact details</Button>
              {/* Only offer Cancel once something is actually saved to go back to - the very first time, this form has to stay open. */}
              {myContact.fullName && myContact.phone && (
                <button type="button" className="ghost-link" onClick={() => setEditingMyContact(false)}>Cancel</button>
              )}
            </div>
          </form>
        ) : (
          <div className="settings-manager-row__display">
            <span>
              <strong>{myContact.fullName}</strong><br />
              {myContact.phone} {myContact.email && `· ${myContact.email}`}
            </span>
            <div className="settings-manager-row__actions">
              <button type="button" className="ghost-link" onClick={() => setEditingMyContact(true)}>Edit contact details</button>
            </div>
          </div>
        )}

        {!isManager && properties.length > 0 && (
          <div style={{ marginTop: 'var(--space-5)' }}>
            <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-2)' }}>Who tenants see as the contact, per property</h3>
            <ul className="settings-manager-list">
              {properties.map((p) => (
                <li key={p.id} className="settings-manager-row">
                  <div className="settings-manager-row__name"><strong>{p.name}</strong></div>
                  <div className="settings-manager-row__display">
                    <select
                      value={p.primary_contact_manager_id || ''}
                      disabled={savingContactFor === p.id}
                      onChange={(e) => setPropertyContact(p.id, e.target.value || null)}
                    >
                      <option value="">Me (the landlord)</option>
                      {managers
                        .filter((m) => m.is_active && (m.assignedProperties || []).some((ap) => ap.id === p.id))
                        .map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name}</option>
                        ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ---------------- Payment method ----------------
          Landlord: fully editable.
          Manager/caretaker: visible so they know how tenants are
          paying, but read-only - editing stays landlord-only since
          it's the account's actual M-Pesa collection setup. */}
      <section className="settings-card">
        <h2>Payment method (how rent reaches {isManager ? 'the landlord' : 'you'})</h2>
        <p className="settings-card__caption">
          Linked directly to M-Pesa via Safaricom Daraja. Each apartment can use the account default below, or its own
          payment method - changing one apartment&apos;s method never affects any other apartment.
        </p>
        {properties.length > 1 && !isCaretaker && (
          <div className="form-field" style={{ marginBottom: '0.75rem' }}>
            <label className="form-field__label">Apply to</label>
            <select
              value={paymentPropertyId}
              onChange={(e) => { setPaymentPropertyId(e.target.value); setEditingPayment(false); }}
            >
              <option value="">Account default (any apartment without its own)</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        {editingPayment ? (
            <form className="settings-payment-form" onSubmit={savePaymentMethod}>
              <div className="form-field">
                <label className="form-field__label">Method</label>
                <select value={paymentMethod.method} onChange={(e) => setPaymentMethod((p) => ({ ...p, method: e.target.value }))}>
                  <option value="stk">STK Push</option>
                  <option value="paybill">Paybill</option>
                  <option value="till">Till Number</option>
                </select>
              </div>
              {paymentMethod.method === 'paybill' && (
                <div className="settings-payment-form__grid">
                  <div className="form-field">
                    <label className="form-field__label">Paybill number</label>
                    <input value={paymentMethod.paybillNumber} onChange={(e) => setPaymentMethod((p) => ({ ...p, paybillNumber: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">Account number</label>
                    <input value={paymentMethod.accountNumber} onChange={(e) => setPaymentMethod((p) => ({ ...p, accountNumber: e.target.value }))} />
                  </div>
                </div>
              )}
              {paymentMethod.method === 'stk' && (
                <div className="form-field">
                  <label className="form-field__label">STK push phone number</label>
                  <input
                    value={paymentMethod.stkPhoneNumber || ''}
                    onChange={(e) => setPaymentMethod((p) => ({ ...p, stkPhoneNumber: e.target.value }))}
                    placeholder="e.g. 0712345678"
                  />
                  <p className="form-field__hint">The M-Pesa prompt for this {paymentPropertyId ? 'apartment' : 'account'} goes to this number.</p>
                </div>
              )}
              {paymentMethod.method === 'till' && (
                <div className="form-field">
                  <label className="form-field__label">Till number</label>
                  <input value={paymentMethod.tillNumber} onChange={(e) => setPaymentMethod((p) => ({ ...p, tillNumber: e.target.value }))} />
                </div>
              )}
              <div className="settings-manager-row__actions">
                <Button type="submit" variant="primary" loading={savingPayment}>Save payment method</Button>
                {paymentPropertyId && (
                  <button
                    type="button"
                    className="ghost-link"
                    disabled={savingPayment}
                    onClick={async () => {
                      setSavingPayment(true);
                      try {
                        await api.updatePaymentMethod({ useDefault: true, propertyId: paymentPropertyId }, token);
                        setNotice('This apartment now follows the account default again.');
                        setEditingPayment(false);
                        const res = await api.getPaymentMethod(token, paymentPropertyId);
                        if (res?.paymentMethod) setPaymentMethod(res.paymentMethod);
                      } catch (err) {
                        setError(err instanceof ApiError ? err.message : 'Failed to reset payment method.');
                      } finally {
                        setSavingPayment(false);
                      }
                    }}
                  >
                    Use account default instead
                  </button>
                )}
                <button type="button" className="ghost-link" onClick={() => setEditingPayment(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="settings-manager-row__display">
              <span>
                {paymentMethod.method === 'paybill' && (
                  <>Paybill · {paymentMethod.paybillNumber || '—'} {paymentMethod.accountNumber && `· Acc ${paymentMethod.accountNumber}`}</>
                )}
                {paymentMethod.method === 'till' && <>Till Number · {paymentMethod.tillNumber || '—'}</>}
                {paymentMethod.method === 'stk' && (
                  <>STK Push (M-Pesa prompt straight to the tenant's phone){paymentMethod.stkPhoneNumber && <><br />{paymentMethod.stkPhoneNumber}</>}</>
                )}
              </span>
              <div className="settings-manager-row__actions">
                {!isCaretaker && (
                  <button type="button" className="ghost-link" onClick={() => setEditingPayment(true)}>Edit payment method</button>
                )}
              </div>
            </div>
          )}
      </section>

      <BiometricSettingsPanel
        phone={myContact.phone}
        role={role}
        roleLevel={roleLevel}
        token={token}
        label={myContact.fullName}
      />

      <ConfirmDialog
        open={!!pendingRemoveManager}
        title="Remove this account permanently?"
        message={pendingRemoveManager ? `This will permanently remove ${pendingRemoveManager.name}'s login and access. They will be logged out immediately, and this cannot be undone from here.` : ''}
        confirmLabel="Yes, remove permanently"
        busy={removeManagerBusy}
        error={removeManagerError}
        onConfirm={confirmRemoveManager}
        onCancel={() => { setPendingRemoveManager(null); setRemoveManagerError(''); }}
      />
    </div>
  );
}
