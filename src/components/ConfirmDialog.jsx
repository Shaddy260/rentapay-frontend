import React, { useState, useEffect } from 'react';
import Button from './Button.jsx';
import PasswordInput from './PasswordInput.jsx';
import './ConfirmDialog.css';

/**
 * Shared "are you sure?" modal for destructive actions (remove a
 * caretaker/manager, delete a tenant, delete a unit/apartment, etc).
 *
 * FIX ("sometimes they tap them by mistake - there should always be a
 * second confirmation before deleting anything"): a plain
 * window.confirm() is one click/tap away from an accidental delete
 * (easy to fat-finger through on a phone). This always requires an
 * explicit second step - either just a clearly-labelled confirm
 * button (default), or, for the most sensitive actions, typing a
 * specific word before the confirm button even becomes clickable
 * (pass `typeToConfirm`).
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Yes, delete',
  cancelLabel = 'Cancel',
  danger = true,
  typeToConfirm, // if set, e.g. "DELETE" or a unit name, must be typed exactly to enable the confirm button
  // FIX (direct request): suspend/activate/offboard/restore for a
  // Brand Ambassador should require the admin password to confirm,
  // same as it already does for a landlord. Passing this re-collects
  // the admin's password here and hands it to onConfirm(password)
  // instead of onConfirm() - the caller re-checks it server-side and
  // does NOT proceed on a wrong password.
  requirePassword = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}) {
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');

  // Reset both fields whenever the dialog opens/closes so a leftover
  // password from a previous action can't linger and get submitted
  // for a different one.
  useEffect(() => {
    if (!open) {
      setTyped('');
      setPassword('');
    }
  }, [open]);

  if (!open) return null;

  const canConfirm = (!typeToConfirm || typed.trim() === typeToConfirm) && (!requirePassword || password.length > 0);

  function handleConfirm() {
    if (requirePassword) onConfirm?.(password);
    else onConfirm?.();
  }

  return (
    <div className="modal-overlay" onClick={() => !busy && onCancel?.()}>
      <div className="modal-shell confirm-dialog" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <h2>{title}</h2>
        {message && <p className="confirm-dialog__message">{message}</p>}
        {typeToConfirm && (
          <div className="form-field">
            <label className="form-field__label">
              Type <strong>{typeToConfirm}</strong> to confirm
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={typeToConfirm}
            />
          </div>
        )}
        {requirePassword && (
          <div className="form-field">
            <label className="form-field__label" htmlFor="confirm-dialog-password">Admin password</label>
            <PasswordInput
              id="confirm-dialog-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="confirm-dialog__actions">
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            disabled={!canConfirm || busy}
            loading={busy}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
          <button type="button" className="ghost-link" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
