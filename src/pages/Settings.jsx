import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import BiometricSettingsPanel from '../components/BiometricSettingsPanel.jsx';
import TwoFactorSettings from '../components/TwoFactorSettings.jsx';
import ModalShell from '../components/ModalShell.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { api, ApiError } from '../api/client.js';
import './Settings.css';
import Skeleton from '../components/Skeleton.jsx';
import InfoTip from '../components/InfoTip.jsx';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload.jsx';
import LatePenaltySettingsPanel from '../components/LatePenaltySettingsPanel.jsx';
import PropertyDangerZone from '../components/PropertyDangerZone.jsx';
import AutoRentCollectionWizard from '../components/AutoRentCollectionWizard.jsx';
import DarajaHealthBanner from '../components/DarajaHealthBanner.jsx';
import { readPageCache, writePageCache } from '../utils/pageCache.js';
import { pollExportAndDownload } from '../utils/exportDownload.js';
import { isValidPhone } from '../utils/validators.js';

const SETTINGS_CACHE_KEY = 'rentapay_settings_cache';

// Real UI categories for the settings tab bar (direct request: "arrange
// the settings section to be in categories... in UI, not just
// clustered as it is now"). Order matches the existing top-to-bottom
// order of the clusters already in the JSX below, so no content had
// to be reordered - only wrapped and given a tab to switch on.
const SETTINGS_CATEGORIES = [
  { id: 'profile', label: 'Profile' },
  { id: 'team', label: 'Team & Access' },
  { id: 'security', label: 'Security' },
  { id: 'finances', label: 'Finances' },
  { id: 'danger', label: 'Danger Zone' },
];

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
  const token = localStorage.getItem('rentapay_token');
  const refreshToken = localStorage.getItem('rentapay_refresh_token');
  const role = localStorage.getItem('rentapay_role');
  const isManager = role === 'manager';
  // FEATURE REMOVAL (spec item 13): the "Fix notifications on this
  // device" workaround (re-subscribing push so the OS stops labeling
  // notifications as coming from "Chrome") has been removed entirely
  // from the product - not relocated into Settings, not kept anywhere
  // else. See TenantPortal.jsx for the matching tenant-side removal.
  // A caretaker is stored as role='manager' + a role_level of
  // 'caretaker' (see Login.jsx / auth.controller.js) - persisted at
  // login so we can tell full Property Managers and Caretakers apart
  // here without an extra round trip before first paint.
  const roleLevel = localStorage.getItem('rentapay_role_level');
  const isCaretaker = isManager && roleLevel === 'caretaker';
  // A full property manager shares the landlord's access, including
  // seeing (read-only) who else has been given access - only a
  // caretaker is fully blocked from the "Property Managers" section.
  const canViewTeamSection = !isCaretaker;

  const [properties, setProperties] = useState(() => readPageCache(SETTINGS_CACHE_KEY)?.properties || []);
  const [managers, setManagers] = useState(() => readPageCache(SETTINGS_CACHE_KEY)?.managers || []);
  const [myAccess, setMyAccess] = useState(() => readPageCache(SETTINGS_CACHE_KEY)?.myAccess || null); // manager's own record, when role === 'manager'
  // FIX (direct request - see pageCache.js): only show the full-page
  // skeleton when there's genuinely nothing on screen yet (first ever
  // visit this session). Once a cached copy exists, `load()` below
  // still refetches every time exactly as before - it just does it
  // quietly behind the already-rendered page instead of tearing the
  // whole page down to a skeleton first.
  const [loading, setLoading] = useState(() => !readPageCache(SETTINGS_CACHE_KEY));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeCategory, setActiveCategory] = useState('profile');

  // --- Caretaker (per-property, no-login) contact editing state ---
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [caretakerDraft, setCaretakerDraft] = useState({ caretakerName: '', caretakerPhone: '' });
  // SEO/direct request: "when the landlord enters the location, it
  // should link with the map" - lets a landlord add/edit a Google Maps
  // share link for any EXISTING property (onboarding/AddPropertyModal
  // only cover new properties; this covers ones created before this
  // feature existed). Separate editing/saving state from the caretaker
  // editor above since they're independent, unrelated fields on the
  // same property row.
  const [editingMapsLinkId, setEditingMapsLinkId] = useState(null);
  const [mapsLinkDraft, setMapsLinkDraft] = useState('');
  const [savingMapsLink, setSavingMapsLink] = useState(false);
  // FEATURE (direct request): optional free-text property rules &
  // regulations, entered once per property, visible to every tenant
  // under that property (TenantPortal.jsx PropertyRulesCard). Same
  // edit/save pattern as the maps link above - independent state since
  // it's an unrelated field on the same property row.
  const [editingRulesId, setEditingRulesId] = useState(null);
  const [rulesDraft, setRulesDraft] = useState('');
  const [savingRules, setSavingRules] = useState(false);
  // FEATURE (direct request): per-unit "listing description" was
  // removed - every unit under a property now shows this single
  // general description instead. It could previously only be set once
  // at creation time (AddPropertyModal) with no way to edit it after;
  // this adds that, same edit/save pattern as maps link / rules above.
  const [editingDescriptionId, setEditingDescriptionId] = useState(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [savingCaretaker, setSavingCaretaker] = useState(false);

  // --- Property manager add/edit state (landlord only) ---
  const [showAddManager, setShowAddManager] = useState(false);
  const [addManagerForm, setAddManagerForm] = useState({ fullName: '', phone: '', whatsappNumber: '', email: '', propertyIds: [], roleLevel: 'manager' });
  const [addingManager, setAddingManager] = useState(false);
  const [justAddedManager, setJustAddedManager] = useState(null); // { tempCredentials, name } - shown as an unmissable fallback
  const [editingManagerId, setEditingManagerId] = useState(null);
  const [managerEditDraft, setManagerEditDraft] = useState({ fullName: '', phone: '', whatsappNumber: '', email: '' });
  const [savingManagerEdit, setSavingManagerEdit] = useState(false);
  const [editingAssignmentsId, setEditingAssignmentsId] = useState(null);
  const [assignmentsDraft, setAssignmentsDraft] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  // Settings/Financial Statistics spec, section 2.3: condense the
  // three repeated per-row buttons (Edit contact / Edit access /
  // Remove) into a single "Manage" action that opens a detail sheet
  // containing all three, rather than three same-weight buttons on
  // every single row.
  const [manageManagerId, setManageManagerId] = useState(null);

  function openManageSheet(managerId) {
    setManageManagerId(managerId);
    setEditingManagerId(null);
    setEditingAssignmentsId(null);
    setConfirmingRemoveManagerId(null);
  }

  function closeManageSheet() {
    setManageManagerId(null);
    setEditingManagerId(null);
    setEditingAssignmentsId(null);
    setConfirmingRemoveManagerId(null);
  }

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
  const [myContact, setMyContact] = useState(() => readPageCache(SETTINGS_CACHE_KEY)?.myContact || { fullName: '', phone: '', whatsappNumber: '', email: '', gender: '', notificationStyle: 'ring', kraPin: '' });
  // FIX (follow the BA portal Settings tab's section order - Profile
  // photo is its own cluster at the very top, above Account &
  // security/Team & Access): previously the only place a landlord or
  // manager could change their photo was the AccountMenu dropdown in
  // the header, with no equivalent in Settings itself.
  const [myPhotoUrl, setMyPhotoUrl] = useState(() => readPageCache(SETTINGS_CACHE_KEY)?.myPhotoUrl || null);
  const [exportingData, setExportingData] = useState(false);
  // Phase 14 - landlord-side BA attribution dispute. Only ever tells
  // us whether the prompt should show at all (eligible) and whether
  // it's already been raised (disputed) - never which BA, if any,
  // is attached. See getMyLandlordProfile.
  const [baAttribution, setBaAttribution] = useState(() => readPageCache(SETTINGS_CACHE_KEY)?.baAttribution || { eligible: false, disputed: false });
  const [pendingDisputeBa, setPendingDisputeBa] = useState(false);
  const [disputeBaBusy, setDisputeBaBusy] = useState(false);
  const [disputeBaError, setDisputeBaError] = useState('');
  const [exportError, setExportError] = useState('');
  // Seeded true/pre-filled from cache when we already know from a
  // previous load whether this account has saved contact details -
  // otherwise a returning visit with cached data would still briefly
  // flash the "nothing saved yet, open form" state for one render
  // before load() below corrects it.
  const [contactHasBeenLoaded, setContactHasBeenLoaded] = useState(() => !!readPageCache(SETTINGS_CACHE_KEY)?.myContact);
  const [editingMyContact, setEditingMyContact] = useState(() => {
    const cachedContact = readPageCache(SETTINGS_CACHE_KEY)?.myContact;
    return cachedContact ? !(cachedContact.fullName && cachedContact.phone) : false;
  });
  const [savingMyContact, setSavingMyContact] = useState(false);
  const [savingContactFor, setSavingContactFor] = useState(null); // propertyId currently saving

  // --- Payment method (landlord only) ---
  // Same "show what's actually saved, with an Edit button" pattern as
  // Contact Details above - THE FIX for "it always comes up as STK
  // Push even when I set Paybill": nothing used to fetch the
  // landlord's actual saved payment method at all, so the form always
  // rendered its hardcoded default instead of reality.
  const [paymentMethod, setPaymentMethod] = useState(() => readPageCache(SETTINGS_CACHE_KEY)?.paymentMethod || { method: 'stk', paybillNumber: '', accountNumber: '', tillNumber: '', stkPhoneNumber: '', description: '' });
  const [editingPayment, setEditingPayment] = useState(false);
  // Apartment-scoped payment method (fixes "updating this apartment's
  // payment method also changed my other apartments"). '' means "the
  // account-wide default", which applies to any apartment that hasn't
  // set its own override.
  // FIX (direct request: "when a landlord or manager updates in one
  // apartment it automatically updates the other apartments"): the
  // backend write itself was already correctly scoped (see
  // updatePaymentMethod in auth.controller.js) - properties.
  // payment_override_* vs the landlords row are genuinely separate
  // columns. The actual bug was here: this always STARTED at ''
  // ("account default") no matter which apartment was active in the
  // dashboard switcher, so a landlord who opened Settings from inside
  // "KimCom Apartments" and just edited the form - without noticing or
  // touching the separate "Apply to" dropdown - was actually editing
  // the shared account-wide default the whole time. Every apartment
  // without its OWN override inherits that default, which is exactly
  // what looked like "editing one apartment changed the others".
  // Defaulting this to the currently active property (same
  // sessionStorage key the dashboard/AddUnit/notifications all read)
  // means the form now matches whatever apartment is actually on
  // screen; "Account default" is still one explicit option away for
  // anyone who deliberately wants to change the shared fallback.
  const [paymentPropertyId, setPaymentPropertyId] = useState(() => localStorage.getItem('rentapay_active_property_id') || '');
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
    const paymentPromise = api.getPaymentMethod(token, localStorage.getItem('rentapay_active_property_id') || undefined);

    Promise.all([propertiesPromise, secondPromise, peersPromise, profilePromise, paymentPromise])
      .then(([propsRes, secondRes, peersRes, profileRes, paymentRes]) => {
        setProperties(propsRes.properties || []);
        let loadedContact;
        if (isManager) {
          setMyAccess(secondRes.manager);
          loadedContact = { fullName: secondRes.manager?.full_name || '', phone: secondRes.manager?.phone || '', whatsappNumber: secondRes.manager?.whatsapp_number || '', email: secondRes.manager?.email || '', gender: secondRes.manager?.gender || '', notificationStyle: secondRes.manager?.notification_style || 'ring' };
          setMyPhotoUrl(secondRes.manager?.photo_url || null);
          if (peersRes) setManagers(peersRes.managers || []);
        } else {
          setManagers(secondRes.managers || []);
          loadedContact = profileRes?.contact || { fullName: '', phone: '', whatsappNumber: '', email: '', gender: '', notificationStyle: 'ring' };
          setMyPhotoUrl(profileRes?.photoUrl || null);
          if (profileRes?.baAttribution) setBaAttribution(profileRes.baAttribution);
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
        // Snapshot everything this page shows so the NEXT visit (or a
        // background poll) starts from real data instead of a
        // skeleton - see pageCache.js.
        writePageCache(SETTINGS_CACHE_KEY, {
          properties: propsRes.properties || [],
          managers: isManager ? (peersRes?.managers || []) : (secondRes.managers || []),
          myAccess: isManager ? secondRes.manager : null,
          myContact: loadedContact,
          myPhotoUrl: isManager ? (secondRes.manager?.photo_url || null) : (profileRes?.photoUrl || null),
          baAttribution: !isManager && profileRes?.baAttribution ? profileRes.baAttribution : undefined,
          paymentMethod: paymentRes?.paymentMethod || undefined,
        });
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

  function startEditingMapsLink(property) {
    setEditingMapsLinkId(property.id);
    setMapsLinkDraft(property.maps_link || '');
  }

  function startEditingRules(property) {
    setEditingRulesId(property.id);
    setRulesDraft(property.rules_text || '');
  }

  function startEditingDescription(property) {
    setEditingDescriptionId(property.id);
    setDescriptionDraft(property.description || '');
  }

  async function saveDescription(propertyId) {
    setSavingDescription(true);
    setError('');
    try {
      await api.updateProperty(propertyId, { description: descriptionDraft.trim() }, token);
      setNotice('Property description updated.');
      setEditingDescriptionId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update property description.');
    } finally {
      setSavingDescription(false);
    }
  }

  async function saveRules(propertyId) {
    setSavingRules(true);
    setError('');
    try {
      await api.updateProperty(propertyId, { rulesText: rulesDraft.trim() }, token);
      setNotice('Property rules updated.');
      setEditingRulesId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update property rules.');
    } finally {
      setSavingRules(false);
    }
  }

  async function saveMapsLink(propertyId) {
    setSavingMapsLink(true);
    setError('');
    try {
      await api.updateProperty(propertyId, { mapsLink: mapsLinkDraft.trim() }, token);
      setNotice('Map location updated.');
      setEditingMapsLinkId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update map location.');
    } finally {
      setSavingMapsLink(false);
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
    setError('');
    // BUG FIX (direct request, checked repeatedly - "07... rejected as
    // invalid, 254... accepted, for a manager"): this form had no
    // client-side phone check at all, so a perfectly valid 07... number
    // could only ever fail after a round trip, or worse, look like it
    // silently disagreed with what the backend actually accepts. Same
    // normalizer the backend uses (utils/phone.js).
    if (!isValidPhone(addManagerForm.phone)) {
      setError('Enter a valid Kenyan phone number for the property manager (e.g. 07XXXXXXXX or 2547XXXXXXXX).');
      return;
    }
    if (!isValidPhone(addManagerForm.whatsappNumber)) {
      setError('Enter a valid Kenyan WhatsApp number for the property manager (e.g. 07XXXXXXXX or 2547XXXXXXXX).');
      return;
    }
    setAddingManager(true);
    try {
      const res = await api.addPropertyManager(addManagerForm, token);
      setNotice(res.message || 'Property manager added. Their login details were sent via email.');
      // Fallback so it's never unclear whether this worked: shown right
      // in the form area (not just a banner near the top that's easy to
      // miss), with the temp password/OTP visible in case the email
      // didn't actually arrive (e.g. unverified Resend domain in dev).
      setJustAddedManager({ name: addManagerForm.fullName, email: addManagerForm.email, ...res.tempCredentials });
      setShowAddManager(false);
      setAddManagerForm({ fullName: '', phone: '', whatsappNumber: '', email: '', propertyIds: [], roleLevel: 'manager' });
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
    setManagerEditDraft({ fullName: manager.full_name || '', phone: manager.phone || '', whatsappNumber: manager.whatsapp_number || '', email: manager.email || '' });
  }

  async function saveManagerEdit(managerId) {
    setError('');
    if (managerEditDraft.phone && !isValidPhone(managerEditDraft.phone)) {
      setError('Enter a valid Kenyan phone number (e.g. 07XXXXXXXX or 2547XXXXXXXX).');
      return;
    }
    if (managerEditDraft.whatsappNumber && !isValidPhone(managerEditDraft.whatsappNumber)) {
      setError('Enter a valid Kenyan WhatsApp number (e.g. 07XXXXXXXX or 2547XXXXXXXX).');
      return;
    }
    setSavingManagerEdit(true);
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

  async function confirmDisputeBaAttribution() {
    setDisputeBaBusy(true);
    setDisputeBaError('');
    try {
      await api.disputeBaAttribution(token);
      setBaAttribution((prev) => ({ ...prev, disputed: true }));
      setPendingDisputeBa(false);
      setNotice("Thanks, we'll review this.");
    } catch (err) {
      setDisputeBaError(err instanceof ApiError ? err.message : 'Failed to submit this. Please try again.');
    } finally {
      setDisputeBaBusy(false);
    }
  }

  async function removeManagerAccount(managerId, managerName) {
    // A single, explicit, unmissable confirmation dialog handles "are
    // you sure" - removing someone's access is not reversible from the
    // UI, so this needs to be a genuinely deliberate action, not a
    // misclick, but doesn't need a second inline step on top of that.
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
      closeManageSheet();
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
      // FIX: phone/email are shown here as locked/disabled - display
      // only, never actually editable - but myContact still carries
      // whatever value was loaded into them. Sending those keys at
      // all (even unchanged) trips the server's "primary phone/email
      // can't be changed after registration" guard (see
      // updateMyContact / updateManager), which was rejecting every
      // save of this form - including something as unrelated as just
      // the KRA PIN - with a confusing "cannot be changed" error that
      // had nothing to do with what was actually being edited.
      const { phone, email, ...editablePayload } = myContact;
      if (isManager) {
        await api.updatePropertyManager(myAccess.id, editablePayload, token);
      } else {
        await api.updateMyContact(editablePayload, token);
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

  async function handleExportData() {
    setExportingData(true);
    setExportError('');
    try {
      // Phase 2: data export is a queued background job (worker ->
      // Supabase Storage -> signed URL) instead of a blocking download.
      const created = await api.createDataExportJob({}, token);
      await pollExportAndDownload(created.exportJobId, token);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Failed to export your data.');
    } finally {
      setExportingData(false);
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
      setActiveCategory('security');
      document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash, loading]);

  return (
    <div className="settings-page">
      <Link to="/dashboard" className="settings-back">← Back to dashboard</Link>
      <h1>Settings</h1>

      {notice && <div className="settings-banner settings-banner--ok">{notice}</div>}
      {error && <div className="settings-banner settings-banner--error">{error}</div>}

      {/* FEATURE (direct request): the settings screen used to be one
          long flat scroll of same-weight cards - it's now grouped
          into real UI categories with a tab bar, instead of just
          visual cluster titles running into each other. Switching
          tabs doesn't unmount/refetch anything (all the same data
          loads regardless of which tab is active) - it just shows or
          hides the relevant clusters, so nothing about the existing
          load/save logic below had to change. */}
      <div className="settings-category-tabs" role="tablist" aria-label="Settings categories">
        {SETTINGS_CATEGORIES.filter((cat) => cat.id !== 'danger' || !isCaretaker).map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat.id}
            className={`settings-category-tab${activeCategory === cat.id ? ' settings-category-tab--active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ---------------- Profile ---------------- */}
      <div className={`settings-category${activeCategory === 'profile' ? '' : ' settings-category--hidden'}`}>
      <h2 className="settings-cluster-title">Profile photo</h2>
      <section className="settings-card">
        <ProfilePhotoUpload
          name={myContact.fullName}
          photoUrl={myPhotoUrl}
          token={token}
          onChange={(photoUrl) => setMyPhotoUrl(photoUrl)}
        />
      </section>

      </div>

      {/* ---------------- Team & Access ---------------- */}
      <div className={`settings-category${activeCategory === 'team' ? '' : ' settings-category--hidden'}`}>
      {/* Settings/Financial Statistics spec, section 2.1: light visual
          hierarchy - two clusters instead of one flat scroll of
          same-weight cards. "Team & Access" groups who has access and
          how tenants reach them; "Account" groups the account-level
          settings (payment, data, device security). */}
      <h2 className="settings-cluster-title">Team &amp; Access</h2>

      {/* ---------------- Caretaker contacts ---------------- */}
      <section className="settings-card">
        <h2>
          Caretaker contacts
          <InfoTip text="A plain contact per property, no login, just a name and number tenants can reach for day to day things. Separate from Property Managers below, who get their own login to the portal. Editable any time." />
        </h2>

        {loading ? (
          <Skeleton rows={3} />
        ) : properties.length === 0 ? (
          <EmptyState
            icon="🏢"
            title="No properties yet"
            message="Add your first property from the dashboard, then come back here to set a caretaker contact for it."
            actionLabel="Go to dashboard"
            onAction={() => navigate('/dashboard')}
            compact
          />
        ) : (
          <ul className="settings-manager-list">
            {properties.map((p) => (
              <li key={p.id} className="settings-manager-row">
                <div className="settings-manager-row__name">
                  <strong>{p.name}</strong>
                  {p.location && <span> · {p.location}</span>}
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
                    <span className="tenant-portal-hint u-m-0">Assigned caretaker account. Manage assignment under Team below.</span>
                  </div>
                ) : (
                  <div className="settings-manager-row__display">
                    {p.caretaker_name || p.caretaker_phone ? (
                      <span>{p.caretaker_name || '-'} {p.caretaker_phone && `· ${p.caretaker_phone}`}</span>
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

                {editingMapsLinkId === p.id ? (
                  <div className="settings-manager-row__edit">
                    <input
                      type="url"
                      placeholder="https://maps.app.goo.gl/…"
                      value={mapsLinkDraft}
                      onChange={(e) => setMapsLinkDraft(e.target.value)}
                    />
                    <div className="settings-manager-row__actions">
                      <Button variant="primary" loading={savingMapsLink} onClick={() => saveMapsLink(p.id)}>Save</Button>
                      <button type="button" className="ghost-link" onClick={() => setEditingMapsLinkId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="settings-manager-row__display">
                    {p.maps_link ? (
                      <a href={p.maps_link} target="_blank" rel="noopener noreferrer">📍 View map location</a>
                    ) : (
                      <span className="settings-manager-row__empty">No map location set for this property.</span>
                    )}
                    <div className="settings-manager-row__actions">
                      <button type="button" className="ghost-link" onClick={() => startEditingMapsLink(p)}>
                        {p.maps_link ? 'Edit' : 'Add map location'}
                      </button>
                    </div>
                  </div>
                )}

                {editingDescriptionId === p.id ? (
                  <div className="settings-manager-row__edit">
                    <textarea
                      rows={4}
                      placeholder="e.g. 3-storey block, 12 units, gated compound with 24/7 security and ample parking, 5 min walk to the Kilimani matatu stage."
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                    />
                    <div className="settings-manager-row__actions">
                      <Button variant="primary" loading={savingDescription} onClick={() => saveDescription(p.id)}>Save</Button>
                      <button type="button" className="ghost-link" onClick={() => setEditingDescriptionId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="settings-manager-row__display">
                    {p.description ? (
                      <span className="settings-manager-row__rules-preview">📝 {p.description}</span>
                    ) : (
                      <span className="settings-manager-row__empty">No property description set. Shown on every vacant unit's public listing.</span>
                    )}
                    <div className="settings-manager-row__actions">
                      <button type="button" className="ghost-link" onClick={() => startEditingDescription(p)}>
                        {p.description ? 'Edit description' : 'Add description'}
                      </button>
                    </div>
                  </div>
                )}

                {editingRulesId === p.id ? (
                  <div className="settings-manager-row__edit">
                    <textarea
                      rows={5}
                      placeholder="e.g. No pets without written approval. Quiet hours 10pm-6am. Visitors must sign in with the caretaker…"
                      value={rulesDraft}
                      onChange={(e) => setRulesDraft(e.target.value)}
                    />
                    <div className="settings-manager-row__actions">
                      <Button variant="primary" loading={savingRules} onClick={() => saveRules(p.id)}>Save</Button>
                      <button type="button" className="ghost-link" onClick={() => setEditingRulesId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="settings-manager-row__display">
                    {p.rules_text ? (
                      <span className="settings-manager-row__rules-preview">📋 Rules set, visible to tenants</span>
                    ) : (
                      <span className="settings-manager-row__empty">No property rules set (optional).</span>
                    )}
                    <div className="settings-manager-row__actions">
                      <button type="button" className="ghost-link" onClick={() => startEditingRules(p)}>
                        {p.rules_text ? 'Edit rules' : 'Add property rules'}
                      </button>
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
          <h2>
            Property Managers
            <InfoTip
              text={
                isManager
                  ? "Everyone with their own login to this landlord's portal. Adding, removing, or reassigning access is handled by the landlord."
                  : "Give someone their own login to the portal. They'll see everything you see, scoped to the properties you assign them, but can't add/remove other managers, change assignments, or touch billing. Caretakers have the same login but are additionally blocked from removing tenants, transferring tenants, changing rent amounts, or adding/removing units."
              }
            />
          </h2>

          {!isManager && justAddedManager && (
            <div id="manager-added-confirmation" className="settings-banner settings-banner--ok u-mb-4">
              <strong>{justAddedManager.name} was added.</strong>
              <p className="u-mt-2 u-mb-0">
                Their login details were sent to <strong>{justAddedManager.email}</strong> by email. If it
                doesn't arrive, share these directly:
              </p>
              <p className="u-mt-2 u-mb-0 u-font-mono">
                Temp password: <strong>{justAddedManager.tempPassword}</strong>
              </p>
              <button type="button" className="ghost-link u-mt-2" onClick={() => setJustAddedManager(null)}>Dismiss</button>
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
                  <option value="caretaker">Caretaker (limited: no tenant removal, no billing/rent changes)</option>
                </select>
              </div>
              <div className="settings-payment-form__grid">
                <div className="form-field">
                  <label className="form-field__label">Phone</label>
                  <input required placeholder="07XXXXXXXX or 2547XXXXXXXX" value={addManagerForm.phone} onChange={(e) => setAddManagerForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">WhatsApp number</label>
                  <input required placeholder="07XXXXXXXX or 2547XXXXXXXX" value={addManagerForm.whatsappNumber} onChange={(e) => setAddManagerForm((f) => ({ ...f, whatsappNumber: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">Email</label>
                  <input type="email" required value={addManagerForm.email} onChange={(e) => setAddManagerForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
              </div>

              <div className="form-field">
                <label className="form-field__label">Which properties can they access?</label>
                {properties.length === 0 ? (
                  <EmptyState icon="🏢" title="No properties yet" message="Add a property first, then assign this manager to it." compact />
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
            <ul className="settings-manager-list u-mt-4">
              {managers.map((m) => (
                <li key={m.id} className="settings-manager-row">
                  <div className="settings-manager-row__name">
                    <strong>{m.full_name}</strong>
                    <span className="settings-manager-role-tag">
                      ({m.role_level === 'caretaker' ? 'Caretaker' : 'Property Manager'})
                    </span>
                    {!m.is_active && <span className="settings-manager-row__empty"> (removed)</span>}
                  </div>
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
                    {/* Settings/Financial Statistics spec, section 2.3:
                        a single "Manage" action replaces the three
                        repeated same-weight buttons per row - contact
                        info, access scope, and remove now all live
                        inside the detail sheet below instead. Full
                        managers get a read-only "View" (no edit/remove
                        rights on their peers), matching what they
                        already couldn't do before this change. */}
                    <div className="settings-manager-row__actions">
                      <button type="button" className="ghost-link" onClick={() => openManageSheet(m.id)}>
                        {isManager ? 'View' : 'Manage'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Property manager detail sheet - opened by "Manage"/"View"
          above. Houses contact info, access scope, and (landlord only)
          the remove action, so the row list itself stays to one line
          per person instead of three inline buttons each. */}
      {manageManagerId && (() => {
        const m = managers.find((mgr) => mgr.id === manageManagerId);
        if (!m) return null;
        return (
          <ModalShell title={m.full_name} onClose={closeManageSheet}>
            <p className="settings-manager-role-tag u-mb-4">
              {m.role_level === 'caretaker' ? 'Caretaker' : 'Property Manager'}
              {!m.is_active && ' · removed'}
            </p>

            <h4 className="u-mb-2">Contact info</h4>
            {!isManager && editingManagerId === m.id ? (
              <div className="settings-manager-row__edit">
                <input placeholder="Full name" value={managerEditDraft.fullName} onChange={(e) => setManagerEditDraft((d) => ({ ...d, fullName: e.target.value }))} />
                <input placeholder="Phone" value={managerEditDraft.phone} onChange={(e) => setManagerEditDraft((d) => ({ ...d, phone: e.target.value }))} />
                <input placeholder="WhatsApp number" value={managerEditDraft.whatsappNumber} onChange={(e) => setManagerEditDraft((d) => ({ ...d, whatsappNumber: e.target.value }))} />
                <input placeholder="Email" value={managerEditDraft.email} onChange={(e) => setManagerEditDraft((d) => ({ ...d, email: e.target.value }))} />
                <div className="settings-manager-row__actions">
                  <Button variant="primary" loading={savingManagerEdit} onClick={() => saveManagerEdit(m.id)}>Save</Button>
                  <button type="button" className="ghost-link" onClick={() => setEditingManagerId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="settings-manager-row__display">
                <span>{m.phone} {m.email && `· ${m.email}`}</span>
                {!isManager && (
                  <div className="settings-manager-row__actions">
                    <button type="button" className="ghost-link" onClick={() => startEditingManager(m)}>Edit contact</button>
                  </div>
                )}
              </div>
            )}

            <h4 className="u-mb-2 u-mt-5">Access scope</h4>
            {!isManager && editingAssignmentsId === m.id ? (
              <div className="settings-manager-row__edit u-flex-col--stretch">
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
                <span className="settings-manager-row__empty">
                  {(m.assignedProperties || []).length === 0
                    ? 'No properties assigned'
                    : m.assignedProperties.map((p) => p.name).join(', ')}
                </span>
                {!isManager && (
                  <div className="settings-manager-row__actions">
                    <button type="button" className="ghost-link" onClick={() => startEditingAssignments(m)}>Edit access</button>
                  </div>
                )}
              </div>
            )}

            {!isManager && m.is_active && (
              <div className="u-mt-5">
                <button type="button" className="ghost-link danger-link" onClick={() => removeManagerAccount(m.id, m.full_name)}>
                  Remove this account
                </button>
              </div>
            )}
          </ModalShell>
        );
      })()}

      {/* ---------------- Contact Details ---------------- */}
      <section className="settings-card">
        <h2>
          Contact Details
          <InfoTip
            text={
              isManager
                ? "Your own contact info. The landlord's stays untouched. Whichever properties you're set as the contact for, tenants there see this number."
                : "Your own contact info. If a property manager is set as the contact for a property instead, tenants there see the manager's number rather than yours."
            }
          />
        </h2>

        {editingMyContact ? (
          <form className="settings-payment-form" onSubmit={saveMyContact}>
            <div className="form-field">
              <label className="form-field__label">Full name</label>
              <input required value={myContact.fullName} onChange={(e) => setMyContact((c) => ({ ...c, fullName: e.target.value }))} />
            </div>
            <div className="settings-payment-form__grid">
              <div className="form-field">
                <label className="form-field__label">Phone</label>
                <input required disabled title="Your primary phone number is locked after registration. Contact support to change it." placeholder="07XXXXXXXX or 2547XXXXXXXX" value={myContact.phone} />
              </div>
              <div className="form-field">
                <label className="form-field__label">WhatsApp number<InfoTip text="Shown publicly on free vacant-unit listings." /></label>
                <input required placeholder="07XXXXXXXX or 2547XXXXXXXX" value={myContact.whatsappNumber} onChange={(e) => setMyContact((c) => ({ ...c, whatsappNumber: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-field__label">Email</label>
                <input type="email" disabled title="Your primary email is locked after registration. Contact support to change it." value={myContact.email} />
              </div>
              {!isManager && (
                <div className="form-field">
                  <label className="form-field__label">KRA PIN / business registration no. (optional)<InfoTip text="Printed on your tenants' payment receipts, when filled in." /></label>
                  <input placeholder="e.g. A001234567X" value={myContact.kraPin || ''} onChange={(e) => setMyContact((c) => ({ ...c, kraPin: e.target.value }))} />
                </div>
              )}
              <div className="form-field">
                <label className="form-field__label">{isManager && myAccess?.role_level === 'caretaker' ? 'Gender' : 'I am a'} (optional)</label>
                <select value={myContact.gender} onChange={(e) => setMyContact((c) => ({ ...c, gender: e.target.value }))}>
                  <option value="">Prefer not to say</option>
                  <option value="male">{isManager ? 'Male' : 'Landlord (male)'}</option>
                  <option value="female">{isManager ? 'Female' : 'Landlady (female)'}</option>
                </select>
              </div>
              {!isManager && (
                <div className="form-field">
                  <label className="form-field__label">Notifications<InfoTip text={'How push notifications on your device should get your attention. "Ring" uses your phone\'s own notification sound - we can\'t override it with a custom tone.'} /></label>
                  <select value={myContact.notificationStyle} onChange={(e) => setMyContact((c) => ({ ...c, notificationStyle: e.target.value }))}>
                    <option value="ring">Ring (normal sound)</option>
                    <option value="vibrate">Vibrate only</option>
                    <option value="silent">Silent (inbox only)</option>
                  </select>
                </div>
              )}
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
      </section>

      {/* ---------------- BA attribution dispute (Phase 14) ----------------
          Deliberately low-emphasis and neutral: never names a BA,
          never shows a BA code, never says whether it affects
          anyone's payout. Only rendered at all when the server has
          told us there's something to dispute (baAttribution.eligible) -
          the landlord's own account never receives ba_id itself. */}
      {!isManager && baAttribution.eligible && (
        <p className="settings-card__hint u-mt-2">
          {baAttribution.disputed
            ? "Thanks, we're reviewing your attribution."
            : (
              <>
                Think you were referred incorrectly?{' '}
                <button type="button" className="ghost-link" onClick={() => { setDisputeBaError(''); setPendingDisputeBa(true); }}>
                  Let us know
                </button>
              </>
            )}
        </p>
      )}

      {/* ---------------- Tenant contact routing ----------------
          Settings/Financial Statistics spec, section 2.2: this was
          previously buried inside the Contact Details card with no
          visual distinction and no explanation of what happens if
          left unset. Now its own labeled card, with a one-line
          explanation of the default. */}
      {!isManager && properties.length > 0 && (
        <section className="settings-card settings-card--routing">
          <h2>
            Who tenants see as the contact, per property
            <InfoTip text="Controls which phone number a tenant is routed to for that property: your own, or a property manager's. Change it any time." />
          </h2>
          <InfoTip text={<>
            If unset, tenants will see <strong>you (the landlord)</strong> as their contact.
          </>} />
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
        </section>
      )}

      </div>

      {/* ---------------- Account & security ---------------- */}
      <div className={`settings-category${activeCategory === 'security' ? '' : ' settings-category--hidden'}`}>
      <h2 className="settings-cluster-title">Account &amp; security</h2>

      {/* FIX (follow the BA portal / TenantSettings pattern): a
          dedicated password-change entry point inside Settings
          itself, not just the AccountMenu dropdown - same
          "Password" card BaSettingsPanel and TenantSettings.jsx
          already use. */}
      <section className="settings-card">
        <h2>
          Password
          <InfoTip text="Change the password you use to log in." />
        </h2>
        <Button variant="ghost" onClick={() => navigate('/change-password')}>Change password</Button>
      </section>

      <BiometricSettingsPanel
        phone={myContact.phone}
        email={myContact.email}
        role={role}
        roleLevel={roleLevel}
        token={token}
        refreshToken={refreshToken}
        label={myContact.fullName}
      />

      {/* OPTIONAL 2FA (direct request: mandatory for admin/general
          manager, optional here) - landlord and property manager/
          caretaker accounts can turn this on for themselves. */}
      <section className="settings-card">
        <TwoFactorSettings token={token} />
      </section>

      </div>

      {/* ---------------- Finances ---------------- */}
      <div className={`settings-category${activeCategory === 'finances' ? '' : ' settings-category--hidden'}`}>
      <h2 className="settings-cluster-title">Finances</h2>

      {/* ---------------- Payment method ----------------
          Landlord: fully editable.
          Manager/caretaker: visible so they know how tenants are
          paying, but read-only - editing stays landlord-only since
          it's the account's actual M-Pesa collection setup. */}
      <section className="settings-card">
        <h2>
          Payment method (how rent reaches {isManager ? 'the landlord' : 'you'})
          <InfoTip text="Linked directly to M-Pesa via Safaricom Daraja. Each apartment can use the account default below, or its own payment method. Changing one apartment's method never affects any other apartment." />
        </h2>
        {properties.length > 1 && !isCaretaker && (
          <div className="form-field u-mb-3">
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
                    <label className="form-field__label">
                      Account number
                      <InfoTip text="Set this up once. Use {unit} anywhere in the value and it's automatically replaced with each tenant's own unit number, e.g. RENT-{unit} shows tenant A3 'RENT-A3', no need to enter it per unit." />
                    </label>
                    <input
                      value={paymentMethod.accountNumber}
                      onChange={(e) => setPaymentMethod((p) => ({ ...p, accountNumber: e.target.value }))}
                      placeholder="e.g. RENT-{unit}"
                    />
                    {/* FIX (bug report): a landlord had typed literal
                        instructions ("888917#your room number") instead
                        of the {unit} token, so every tenant saw that raw
                        text as their account number. The backend now
                        auto-substitutes phrasing like this as a
                        fallback, but nudge landlords toward {unit} going
                        forward - it's clearer and covers unit/house/door
                        number wording too. */}
                    {/(your|the)\s+(room|unit|house|door)\s+number/i.test(paymentMethod.accountNumber || '') && !paymentMethod.accountNumber.includes('{unit}') && (
                      <p className="form-field__hint form-field__hint--warning">
                        This reads as an instruction rather than an account number. Tenants will see it exactly as typed. Use{' '}
                        <button
                          type="button"
                          className="ghost-link"
                          onClick={() => setPaymentMethod((p) => ({
                            ...p,
                            accountNumber: p.accountNumber.replace(/(your|the)\s+(room|unit|house|door)\s+number/i, '{unit}'),
                          }))}
                        >
                          {'{unit}'} instead
                        </button>{' '}
                        so each tenant automatically sees their own unit number there.
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="form-field">
                <label className="form-field__label">
                  Description for tenants (optional)
                  <InfoTip text="Shown to the tenant right where they tap Pay Rent / Pay Water / Pay Electricity, e.g. 'Rent due by the 5th. Water and electricity are billed separately.'" />
                </label>
                <textarea
                  value={paymentMethod.description || ''}
                  onChange={(e) => setPaymentMethod((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Rent is due by the 5th of every month. Water is billed separately."
                  rows={2}
                />
              </div>
              {paymentMethod.method === 'stk' && (
                <div className="form-field">
                  <label className="form-field__label">STK push phone number<InfoTip text={`The M-Pesa prompt for this ${paymentPropertyId ? 'apartment' : 'account'} goes to this number.`} /></label>
                  <input
                    value={paymentMethod.stkPhoneNumber || ''}
                    onChange={(e) => setPaymentMethod((p) => ({ ...p, stkPhoneNumber: e.target.value }))}
                    placeholder="e.g. 0712345678"
                  />
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
                  <>Paybill · {paymentMethod.paybillNumber || '-'} {paymentMethod.accountNumber && `· Acc ${paymentMethod.accountNumber}`}</>
                )}
                {paymentMethod.method === 'till' && <>Till Number · {paymentMethod.tillNumber || '-'}</>}
                {paymentMethod.method === 'stk' && (
                  <>STK Push (M-Pesa prompt straight to the tenant's phone){paymentMethod.stkPhoneNumber && <><br />{paymentMethod.stkPhoneNumber}</>}</>
                )}
                {paymentMethod.description && <><br /><em>"{paymentMethod.description}"</em></>}
              </span>
              <div className="settings-manager-row__actions">
                {!isCaretaker && (
                  <button type="button" className="ghost-link" onClick={() => setEditingPayment(true)}>Edit payment method</button>
                )}
              </div>
            </div>
          )}
      </section>

      {/* Automatic Rent Collection (landlord-owned STK push) - opt-in,
          landlord-only (same reasoning as Payment method above: this
          is the account's own Daraja API/banking credentials, so
          editing stays strictly landlord-only, not manager/caretaker). */}
      {!isManager && <AutoRentCollectionWizard token={token} />}
      {/* Same read-only status banner as Dashboard.jsx - shown here too
          since this is where the landlord actually manages the wizard
          above, and managers/caretakers passing through Settings
          should see it as well. */}
      <DarajaHealthBanner token={token} />

      {/* ---------------- Late payment penalty ----------------
          FEATURE (direct request): configured PER APARTMENT/PROPERTY
          in Settings -> Finances - NOT one account-wide setting, NOT
          per-unit. Pick an apartment, toggle it on, enter a
          percentage, and it applies to every unit/tenant inside that
          apartment. Off by default; uses the rent/due-date/payment
          data already on file for every tenant. See
          LatePenaltySettingsPanel.jsx. */}
      {!isCaretaker && <LatePenaltySettingsPanel token={token} isManager={isManager} properties={properties} />}

      {!isManager && (
        <section className="settings-card">
          <h2>
            Export your data
            <InfoTip text="Download everything RentaPay holds for your account (properties, units, tenants, payments, expenses, maintenance requests, and document records) as a single file you can keep." />
          </h2>
          <Button onClick={handleExportData} disabled={exportingData} variant="ghost">
            {exportingData ? 'Preparing your export…' : '⬇ Export my data'}
          </Button>
          {exportError && <p className="modal-error">{exportError}</p>}
        </section>
      )}
      </div>

      {/* ---------------- Danger Zone ---------------- */}
      <div className={`settings-category${activeCategory === 'danger' ? '' : ' settings-category--hidden'}`}>
      <h2 className="settings-cluster-title">Danger Zone</h2>
      <section className="settings-card">
        <PropertyDangerZone
          properties={properties}
          token={token}
          isManager={isManager}
          onDeleted={(deletedId) => {
            setProperties((prev) => prev.filter((p) => p.id !== deletedId));
            setNotice('Apartment deleted.');
          }}
        />
      </section>
      </div>

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

      <ConfirmDialog
        open={pendingDisputeBa}
        title="Let us know?"
        message="We'll flag this for review. This won't affect your account or subscription."
        confirmLabel="Yes, let us know"
        danger={false}
        busy={disputeBaBusy}
        error={disputeBaError}
        onConfirm={confirmDisputeBaAttribution}
        onCancel={() => { setPendingDisputeBa(false); setDisputeBaError(''); }}
      />
    </div>
  );
}
