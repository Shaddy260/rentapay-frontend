import React, { useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { api, ApiError } from '../api/client.js';
import './ProfilePhotoUpload.css';

/**
 * Wraps the existing Avatar component with an upload control. Shows
 * the current photo (or initials fallback, same as everywhere else
 * Avatar is used) with a small camera button overlay to change it,
 * plus a "Remove" link when a real photo is set.
 *
 * Handles its own upload state so a parent page just needs to render
 * <ProfilePhotoUpload name={...} photoUrl={...} token={...} onChange={...} />
 * and doesn't need to know anything about multipart requests.
 */
export default function ProfilePhotoUpload({ name, photoUrl, token, size = 88, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setError('');

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please choose a JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.uploadProfilePhoto(formData, token);
      onChange?.(res.photoUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setUploading(true);
    setError('');
    try {
      await api.removeProfilePhoto(token);
      onChange?.(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove photo.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="photo-upload">
      <div className="photo-upload__avatar-wrap" style={{ width: size, height: size }}>
        <button
          type="button"
          className="photo-upload__avatar-btn"
          onClick={() => photoUrl && setExpanded(true)}
          aria-label={photoUrl ? 'View full-size photo' : name || 'Profile'}
          title={photoUrl ? 'View photo' : undefined}
          style={{ cursor: photoUrl ? 'pointer' : 'default' }}
        >
          <Avatar name={name} photoUrl={photoUrl} size={size} />
        </button>
        <button
          type="button"
          className="photo-upload__camera-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Change profile photo"
          title="Change profile photo"
        >
          {uploading ? '…' : '📷'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
      </div>
      {photoUrl && (
        <button type="button" className="photo-upload__remove-link" onClick={handleRemove} disabled={uploading}>
          Remove photo
        </button>
      )}
      {error && <p className="photo-upload__error">{error}</p>}

      {expanded && photoUrl && (
        <div className="photo-lightbox" onClick={() => setExpanded(false)}>
          <button type="button" className="photo-lightbox__close" onClick={() => setExpanded(false)} aria-label="Close">×</button>
          <img src={photoUrl} alt={name || 'Profile'} className="photo-lightbox__img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
