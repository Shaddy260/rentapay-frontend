import React, { useEffect, useRef, useState } from 'react';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Avatar from './Avatar.jsx';
import ThemeToggleItem from './ThemeToggle.jsx';
import { api, ApiError, logoutSession } from '../api/client.js';
import './AccountMenu.css';

/**
 * Small avatar-triggered dropdown present in every portal header
 * (landlord, manager, caretaker, tenant).
 *
 * NOTE (direct request: "remove the help UIs in profile dropdowns in
 * all user portals"): Help used to be an entry in here too, duplicating
 * the always-visible Help button already in the topbar/quick-actions
 * of every portal (Dashboard.jsx, TenantPortal.jsx, Login.jsx). It's
 * been removed from this menu; those other Help entry points are the
 * sole ones now, and are handled separately in HelpButton.css/.jsx.
 *
 * FIX ("two profile pic positions makes the place look messy"): photo
 * upload/removal used to be its own separate widget sitting right
 * next to this one in the header. It now lives entirely inside this
 * dropdown ("Update profile picture" / "Remove photo") - one avatar
 * control per header, not two.
 */
export default function AccountMenu({ name, photoUrl, role, token, onPhotoChange, onEditProfile }) {
  const [open, setOpen] = useState(false);
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
    // Revokes the refresh-token family server-side (best-effort, see
    // logoutSession) on top of clearing both tokens client-side - a
    // real logout button should mean this session can't silently
    // renew itself via /auth/refresh afterwards.
    logoutSession();
    localStorage.removeItem('rentapay_role');
    localStorage.removeItem('rentapay_role_level');
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

      <div className={`account-menu__dropdown${open ? '' : ' account-menu__dropdown--closed'}`} role="menu" aria-hidden={!open}>
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
        {onEditProfile && (
          // FIX (item 3, BA Portal): the account menu previously had
          // no profile entry point at all for the 'brand_ambassador'
          // role - tapping the avatar (which shows a "?" fallback
          // whenever there's no photo) opened this dropdown but it
          // led nowhere related to a profile. Any caller that wants
          // this trigger to actually double as a profile-setup entry
          // point passes onEditProfile; other portals that already
          // have their own dedicated profile/settings pages don't
          // pass it and this item simply doesn't render.
          <button type="button" className="account-menu__item" role="menuitem" onClick={() => { setOpen(false); onEditProfile(); }}>
            Edit profile
          </button>
        )}
        <ThemeToggleItem className="account-menu__item" onToggle={() => setOpen(false)} />
        <div className="account-menu__divider" />
        <button type="button" className="account-menu__item account-menu__item--danger" role="menuitem" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
