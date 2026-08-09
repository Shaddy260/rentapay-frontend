import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';
import Button from './Button.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import './TenantOnboardingPanel.css';

// Best-effort, UI-only decode of the JWT payload so "delete" on a
// resolved request can be scoped to THIS user only (same pattern as
// CommunityPanel.jsx). Resolved onboarding requests are shared history
// visible to the landlord and every manager/caretaker on the property -
// deleting one to declutter your own list should never remove it from
// theirs, so this is stored per-user in localStorage rather than as a
// server-side delete.
function decodeTokenPayload(token) {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

const FIELD_LABELS = {
  full_name: 'Full name',
  primary_phone: 'Phone',
  secondary_phone: 'Secondary phone',
  email: 'Email',
  id_number: 'ID number',
  move_in_date: 'Move-in date',
  emergency_contact_name: 'Emergency contact',
  emergency_contact_phone: 'Emergency contact phone',
};

/**
 * Sits above the units list on the Units/Dashboard page (blueprint:
 * "Tenant Self-Onboarding via Shared Link").
 *
 *  - Persistent link bar: generate-once-per-property, always visible,
 *    Copy button (section 1B).
 *  - First-visit popup nudging the landlord/manager/caretaker to
 *    generate and share the link (section 1A) - shown once per
 *    property per browser, via localStorage.
 *  - "Tenant Onboarding Requests" list with a pending-count badge,
 *    edit-before-confirm, and confirm actions any of the three roles
 *    can take (section 3).
 */
export default function TenantOnboardingPanel({ token, propertyId, propertyName, canAct = true, onConfirmed }) {
  const toast = useToast();
  const [link, setLink] = useState(null); // { token, propertyName }
  const [linkLoading, setLinkLoading] = useState(false);
  const [showFirstVisitPopup, setShowFirstVisitPopup] = useState(false);
  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // request object pending delete confirmation
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // --- "Delete" on resolved requests: per-user hide, not a server
  // delete (see decodeTokenPayload comment above). selectMode/selected
  // power the long-press-to-select UI; longPressTimer tracks the
  // in-progress press so a normal tap doesn't accidentally select.
  const userId = decodeTokenPayload(token)?.id || 'unknown';
  const dismissedKey = propertyId ? `rentapay_onboarding_dismissed_${userId}_${propertyId}` : null;
  const [dismissedIds, setDismissedIds] = useState(() => {
    if (!dismissedKey) return [];
    try {
      return JSON.parse(localStorage.getItem(dismissedKey) || '[]');
    } catch {
      return [];
    }
  });
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const longPressTimer = useRef(null);

  function persistDismissed(ids) {
    setDismissedIds(ids);
    if (dismissedKey) localStorage.setItem(dismissedKey, JSON.stringify(ids));
  }

  function toggleSelected(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function startLongPress(id) {
    longPressTimer.current = setTimeout(() => {
      setSelectMode(true);
      setSelected([id]);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected([]);
  }

  function deleteSelected() {
    persistDismissed([...new Set([...dismissedIds, ...selected])]);
    toast.success(selected.length === 1 ? 'Removed from your list.' : `Removed ${selected.length} from your list.`);
    exitSelectMode();
  }

  function clearAllResolvedForMe() {
    persistDismissed([...new Set([...dismissedIds, ...visibleResolvedRequests.map((r) => r.id)])]);
    toast.success('Cleared resolved requests from your list.');
    setShowClearAllConfirm(false);
    exitSelectMode();
  }

  const popupKey = propertyId ? `rentapay_onboarding_popup_seen_${propertyId}` : null;

  const loadRequests = useCallback(() => {
    if (!propertyId) return;
    setRequestsLoading(true);
    api
      .listOnboardingRequests(token, propertyId)
      .then((res) => {
        setRequests(res.requests || []);
        setPendingCount(res.pendingCount || 0);
      })
      .catch((err) => toast.error(err.message || 'Failed to load onboarding requests.'))
      .finally(() => setRequestsLoading(false));
  }, [propertyId, token, toast]);

  useEffect(() => {
    if (!propertyId) return;
    setLink(null);
    api
      .getOnboardingLink(propertyId, token)
      .then((res) => {
        setLink(res);
        // First-login popup: only nudge if the link is brand new to
        // this browser for this property AND the landlord/manager
        // hasn't already dismissed it.
        if (popupKey && !localStorage.getItem(popupKey)) {
          setShowFirstVisitPopup(true);
        }
      })
      .catch((err) => toast.error(err.message || 'Failed to load onboarding link.'));
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, token]);

  function dismissPopup() {
    setShowFirstVisitPopup(false);
    if (popupKey) localStorage.setItem(popupKey, '1');
  }

  function shareUrl() {
    if (!link) return '';
    return `${window.location.origin}/onboard/${link.token}`;
  }

  function handleCopy() {
    const url = shareUrl();
    if (!url) return;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Onboarding link copied.'))
      .catch(() => toast.error('Could not copy the link - long-press/select it manually.'));
  }

  function startEdit(req) {
    setEditingId(req.id);
    setEditForm({
      fullName: req.full_name,
      primaryPhone: req.primary_phone,
      secondaryPhone: req.secondary_phone || '',
      email: req.email,
      idNumber: req.id_number,
      moveInDate: req.move_in_date,
      emergencyContactName: req.emergency_contact_name,
      emergencyContactPhone: req.emergency_contact_phone,
    });
  }

  async function saveEdit(id) {
    setBusyId(id);
    try {
      await api.editOnboardingRequest(id, editForm, token);
      toast.success('Request updated.');
      setEditingId(null);
      loadRequests();
    } catch (err) {
      toast.error(err.message || 'Failed to update request.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirm(id) {
    setBusyId(id);
    try {
      const res = await api.confirmOnboardingRequest(id, token);
      if (res.emailSent === false) {
        toast.error(res.message || 'Tenant onboarded, but the login-details email failed to send.');
      } else {
        toast.success(res.message || 'Tenant onboarded.');
      }
      loadRequests();
      onConfirmed?.();
    } catch (err) {
      toast.error(err.message || 'Failed to confirm request.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteRequest() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api.deleteOnboardingRequest(deleteTarget.id, token);
      toast.success('Request deleted.');
      setDeleteTarget(null);
      loadRequests();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete request.');
    } finally {
      setDeleteBusy(false);
    }
  }

  if (!propertyId) return null;

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const resolvedRequests = requests.filter((r) => r.status !== 'pending');
  const visibleResolvedRequests = resolvedRequests.filter((r) => !dismissedIds.includes(r.id));

  return (
    <>
      {showFirstVisitPopup && (
        <div className="onboarding-popup-overlay" role="dialog" aria-modal="true">
          <div className="onboarding-popup">
            <h3>Save time onboarding tenants</h3>
            <p>
              Generate a link and share it with your tenants. They'll fill in their own details - you just confirm.
            </p>
            <div className="onboarding-popup__actions">
              <Button variant="primary" onClick={dismissPopup}>Got it</Button>
            </div>
          </div>
        </div>
      )}

      {/* Card 2 - Tenant Onboarding (redesign spec section 5) */}
      <section className="dashboard-card onboarding-link-bar">
        <h3 className="dashboard-card__header">Tenant Onboarding</h3>
        <div className="onboarding-link-bar__row">
          <div className="onboarding-link-bar__text">
            <span className="onboarding-link-bar__hint">
              Share this with tenants of {propertyName || 'this property'} - they'll pick their own unit and fill in their own details.
            </span>
          </div>
          <div className="onboarding-link-bar__actions">
            {link ? (
              <>
                <input className="onboarding-link-bar__input" readOnly value={shareUrl()} onFocus={(e) => e.target.select()} />
                <Button variant="ghost" onClick={handleCopy}>Copy</Button>
              </>
            ) : (
              <Button variant="ghost" loading={linkLoading} disabled>Loading link…</Button>
            )}
          </div>
        </div>
      </section>

      {/* Card 3 - Onboarding Requests (redesign spec section 5) */}
      <section className="dashboard-card onboarding-requests">
        <div className="onboarding-requests__header">
          <h3 className="dashboard-card__header">
            Onboarding Requests
            {pendingCount > 0 && <span className="onboarding-requests__badge">{pendingCount}</span>}
          </h3>
          {visibleResolvedRequests.length > 0 && (
            <button type="button" className="onboarding-requests__toggle" onClick={() => setShowResolved((v) => !v)}>
              {showResolved ? 'Hide resolved' : `Show resolved (${visibleResolvedRequests.length})`}
            </button>
          )}
        </div>

        {requestsLoading && <p className="onboarding-requests__empty">Loading…</p>}
        {!requestsLoading && pendingRequests.length === 0 && (
          <p className="onboarding-requests__empty">No pending onboarding requests right now.</p>
        )}

        {pendingRequests.length > 0 && (
          <div className="onboarding-requests__scroll">
            {pendingRequests.map((req) => (
              <div className="onboarding-request-card" key={req.id}>
                {editingId === req.id ? (
                  <div className="onboarding-request-card__edit">
                    {Object.entries({
                      fullName: editForm.fullName,
                      primaryPhone: editForm.primaryPhone,
                      secondaryPhone: editForm.secondaryPhone,
                      email: editForm.email,
                      idNumber: editForm.idNumber,
                      moveInDate: editForm.moveInDate,
                      emergencyContactName: editForm.emergencyContactName,
                      emergencyContactPhone: editForm.emergencyContactPhone,
                    }).map(([key, value]) => {
                      // SECTION 9 - email is locked here: the tenant
                      // already verified this exact address by OTP
                      // before the request could be submitted, so it
                      // can't be changed from this edit screen under
                      // any circumstance. The backend enforces this
                      // too (editOnboardingRequest ignores an email
                      // field entirely) - this is belt-and-braces, not
                      // the only guard.
                      const isEmail = key === 'email';
                      return (
                        <label key={key} className="onboarding-request-card__field">
                          <span>{FIELD_LABELS[key.replace(/([A-Z])/g, '_$1').toLowerCase()] || key}</span>
                          <input
                            type={key === 'moveInDate' ? 'date' : 'text'}
                            value={value || ''}
                            readOnly={isEmail}
                            disabled={isEmail}
                            title={isEmail ? 'Email is verified and cannot be changed here.' : undefined}
                            className={isEmail ? 'onboarding-request-card__field-locked' : undefined}
                            onChange={(e) => !isEmail && setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                          />
                        </label>
                      );
                    })}
                    <div className="onboarding-request-card__actions">
                      <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button variant="primary" loading={busyId === req.id} onClick={() => saveEdit(req.id)}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="onboarding-request-card__summary">
                      <strong>{req.full_name}</strong>
                      <span>Unit {req.units?.unit_name || '—'}</span>
                      <span>{req.primary_phone}</span>
                      <span>{req.email}</span>
                      <span>ID {req.id_number}</span>
                      <span>Moving in {req.move_in_date}</span>
                      <span>Emergency: {req.emergency_contact_name} ({req.emergency_contact_phone})</span>
                    </div>
                    {canAct && (
                      <div className="onboarding-request-card__actions">
                        <Button variant="ghost" onClick={() => startEdit(req)}>Edit</Button>
                        <Button variant="ghost" onClick={() => { setDeleteTarget(req); setDeleteError(''); }}>Delete</Button>
                        <Button variant="primary" loading={busyId === req.id} onClick={() => handleConfirm(req.id)}>Confirm</Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {showResolved && visibleResolvedRequests.length > 0 && (
          <>
            <div className="onboarding-requests__resolved-toolbar">
              {selectMode ? (
                <>
                  <span className="onboarding-requests__resolved-count">{selected.length} selected</span>
                  <button type="button" className="ghost-link" onClick={exitSelectMode}>Cancel</button>
                  <Button variant="ghost" disabled={selected.length === 0} onClick={deleteSelected}>Delete selected</Button>
                </>
              ) : (
                <>
                  <span className="onboarding-requests__resolved-hint">Long-press an item to select</span>
                  <button type="button" className="ghost-link" onClick={() => setShowClearAllConfirm(true)}>Delete all</button>
                </>
              )}
            </div>
            <div className="onboarding-requests__scroll onboarding-requests__scroll--resolved">
              {visibleResolvedRequests.map((req) => {
                const isSelected = selected.includes(req.id);
                return (
                  <div
                    className={`onboarding-request-card onboarding-request-card--resolved ${isSelected ? 'is-selected' : ''}`}
                    key={req.id}
                    onMouseDown={() => startLongPress(req.id)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    onTouchStart={() => startLongPress(req.id)}
                    onTouchEnd={cancelLongPress}
                    onClick={() => selectMode && toggleSelected(req.id)}
                  >
                    {selectMode && (
                      <input
                        type="checkbox"
                        className="onboarding-request-card__checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(req.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div className="onboarding-request-card__summary">
                      <strong>{req.full_name}</strong>
                      <span>Unit {req.units?.unit_name || '—'}</span>
                      {req.status === 'confirmed' && (
                        <span className="onboarding-request-card__status">
                          Confirmed by {req.confirmed_by_name} at {new Date(req.confirmed_at).toLocaleString()}
                        </span>
                      )}
                      {req.status === 'superseded' && (
                        <span className="onboarding-request-card__status onboarding-request-card__status--superseded">
                          {req.superseded_reason || 'Superseded'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={showClearAllConfirm}
        title="Delete all resolved requests?"
        message="This clears every resolved onboarding request from YOUR view only - it stays visible to any other landlord, manager, or caretaker on this property. This cannot be undone on your side."
        confirmLabel="Delete all"
        onConfirm={clearAllResolvedForMe}
        onCancel={() => setShowClearAllConfirm(false)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this onboarding request?"
        message={`This removes ${deleteTarget?.full_name || 'this'}'s pending onboarding request for Unit ${deleteTarget?.units?.unit_name || '—'}. Use this for spam or mistaken submissions - the unit stays vacant and open to a real submission afterward. This cannot be undone.`}
        confirmLabel="Delete request"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={handleDeleteRequest}
        onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
      />
    </>
  );
}
