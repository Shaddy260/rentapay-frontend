import React, { useState } from 'react';
import ModalShell from './ModalShell.jsx';

/**
 * RentaPay - General Manager Sectioned Build Spec, Section 6.
 *
 * "The login password plays no role here - it's used only to log in.
 * Every edit action requires the Operations PIN to confirm it. Every
 * PIN-confirmed action also requires the General Manager to type a
 * mandatory reason before the action can be submitted - the action
 * cannot succeed without one."
 *
 * A single reusable confirmation step for every General Manager edit
 * action on the platform (activate/suspend/delete a landlord,
 * suspend/reactivate/offboard/restore a Brand Ambassador, warn/
 * suspend/unsuspend any account, approve/reject a BA application,
 * ...). Renders nothing until `open` is true. On confirm, calls
 * `onConfirm({ operationsPin, reason })` - the caller is responsible
 * for merging that into whatever request body the underlying action
 * needs and calling the API; this component only collects and
 * validates the two fields, it never calls the API itself.
 *
 * Usage:
 *   const [confirming, setConfirming] = useState(null); // e.g. { landlordId, status }
 *   ...
 *   <GmActionConfirmModal
 *     open={!!confirming}
 *     title="Confirm action"
 *     description={`Suspend ${confirming?.name}?`}
 *     busy={busy}
 *     error={error}
 *     onCancel={() => setConfirming(null)}
 *     onConfirm={({ operationsPin, reason }) => doTheActualApiCall(confirming, operationsPin, reason)}
 *   />
 */
export default function GmActionConfirmModal({ open, title, description, busy, error, onCancel, onConfirm }) {
  const [operationsPin, setOperationsPin] = useState('');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState('');

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    setLocalError('');
    if (!/^\d{4}$/.test(operationsPin)) {
      setLocalError('Enter your 4-digit Operations PIN.');
      return;
    }
    if (!reason.trim()) {
      setLocalError('A reason is required before this action can be submitted.');
      return;
    }
    onConfirm({ operationsPin, reason: reason.trim() });
  }

  function handleClose() {
    setOperationsPin('');
    setReason('');
    setLocalError('');
    onCancel();
  }

  return (
    <ModalShell title={title || 'Confirm action'} onClose={handleClose}>
      <form className="gm-confirm-form" onSubmit={handleSubmit}>
        {description && <p className="gm-confirm-form__description">{description}</p>}

        <label className="gm-confirm-form__field">
          <span>Operations PIN</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            autoFocus
            value={operationsPin}
            onChange={(e) => setOperationsPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
          />
        </label>

        <label className="gm-confirm-form__field">
          <span>Reason for this action (required)</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why you're making this change…"
          />
        </label>

        {(localError || error) && <p className="gm-confirm-form__error">{localError || error}</p>}

        <div className="gm-confirm-form__actions">
          <button type="button" className="gm-confirm-form__cancel" onClick={handleClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="gm-confirm-form__submit" disabled={busy}>
            {busy ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
