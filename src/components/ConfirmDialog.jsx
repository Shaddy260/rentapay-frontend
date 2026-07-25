import React, { useState } from 'react';
import Button from './Button.jsx';
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
  busy = false,
  error,
  onConfirm,
  onCancel,
}) {
  const [typed, setTyped] = useState('');

  if (!open) return null;

  const canConfirm = !typeToConfirm || typed.trim() === typeToConfirm;

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
        {error && <p className="form-error">{error}</p>}
        <div className="confirm-dialog__actions">
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            disabled={!canConfirm || busy}
            loading={busy}
            onClick={onConfirm}
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
