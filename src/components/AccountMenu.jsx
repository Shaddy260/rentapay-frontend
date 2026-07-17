import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import HelpButton from './HelpButton.jsx';
import BiometricSettingsPanel from './BiometricSettingsPanel.jsx';
import { api, ApiError } from '../api/client.js';
import './AccountMenu.css';

/**
 * Small avatar-triggered dropdown present in every portal header
 * (landlord, manager, caretaker, tenant). Reuses HelpButton as-is for
 * the Help entry (it already owns its own modal + submission logic)
 * rather than duplicating that logic here.
 *
 * FIX ("two profile pic positions makes the place look messy"): photo
 * upload/removal used to be its own separate widget sitting right
 * next to this one in the header. It now lives entirely inside this
 * dropdown ("Update profile picture" / "Remove photo") - one avatar
 * control per header, not two.
 */
export default function AccountMenu({ name, photoUrl, role, phone, roleLevel, token, onPhotoChange }) {
  const resolvedPhone = phone || sessionStorage.getItem('rentapay_phone') || '';
  const resolvedRoleLevel = roleLevel || sessionStorage.getItem('rentapay_role_level') || null;
  const [open, setOpen] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const navigate = useNavigate();
  const ref = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleLogout() {
    sessionStorage.removeItem('rentapay_token');
    sessionStorage.removeItem('rentapay_role');
    sessionStorage.removeItem('rentapay_role_level');
    navigate('/login');
  }

  function triggerFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhotoError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Please choose a JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be smaller than 5MB.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.uploadProfilePhoto(formData, token);
      onPhotoChange?.(res.photoUrl);
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto() {
    setUploading(true);
    setPhotoError('');
    try {
      await api.removeProfilePhoto(token);
      onPhotoChange?.(null);
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Failed to remove photo.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="account-menu" ref={ref}>
      <button type="button" className="account-menu__trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
        <Avatar name={name} photoUrl={photoUrl} size={32} />
        <span className="account-menu__name">{name}</span>
        <span className="account-menu__chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="account-menu__dropdown" role="menu">
          {onPhotoChange && (
            <>
              <div className="account-menu__photo-row">
                <Avatar name={name} photoUrl={photoUrl} size={44} />
                <div className="account-menu__photo-actions">
                  <button type="button" className="account-menu__item account-menu__item--compact" onClick={triggerFilePicker} disabled={uploading}>
                    {uploading ? 'Working…' : 'Update profile picture'}
                  </button>
                  {photoUrl && (
                    <button type="button" className="account-menu__item account-menu__item--compact account-menu__item--danger" onClick={handleRemovePhoto} disabled={uploading}>
                      Remove photo
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />
              </div>
              {photoError && <p className="account-menu__photo-error">{photoError}</p>}
              <div className="account-menu__divider" />
            </>
          )}
          <button type="button" className="account-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate('/change-password'); }}>
            Change password
          </button>
          <button
            type="button"
            className="account-menu__item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              if (role === 'tenant') setShowSecurityModal(true);
              else navigate('/settings#security');
            }}
          >
            Fingerprint / device login
          </button>
          <HelpButton role={role} token={token} renderAs="account-menu__item" />
          <div className="account-menu__divider" />
          <button type="button" className="account-menu__item account-menu__item--danger" role="menuitem" onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}

      {showSecurityModal && (
        <div className="modal-overlay" onClick={() => setShowSecurityModal(false)}>
          <div className="modal-shell" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <BiometricSettingsPanel phone={resolvedPhone} role={role} roleLevel={resolvedRoleLevel} token={token} label={name} />
            <button type="button" className="ghost-link" onClick={() => setShowSecurityModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
