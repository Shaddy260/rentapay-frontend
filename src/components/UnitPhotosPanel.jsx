import { useState } from 'react';
import { api, ApiError } from '../api/client.js';

// FEATURE (direct request: unit photos - "features to improve
// appearance and functionality"). A vacant-unit listing scouts browse
// (see ScoutVacancies.jsx) had no photos at all, text-only. This gives
// a landlord/manager a simple way to add up to 5 photos per unit
// directly from the unit's own page.
export default function UnitPhotosPanel({ unitId, photoUrls = [], token, canEdit = true, onChange }) {
  const [photos, setPhotos] = useState(photoUrls);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [removingUrl, setRemovingUrl] = useState(null);

  async function handleFilesChosen(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('photos', f));
      const res = await api.uploadUnitPhotos(unitId, formData, token);
      setPhotos(res.photoUrls);
      onChange?.(res.photoUrls);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload photos.');
    } finally {
      setUploading(false);
      e.target.value = ''; // allow re-selecting the same file(s) again later
    }
  }

  async function handleRemove(url) {
    setRemovingUrl(url);
    setError('');
    try {
      const res = await api.removeUnitPhoto(unitId, url, token);
      setPhotos(res.photoUrls);
      onChange?.(res.photoUrls);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove photo.');
    } finally {
      setRemovingUrl(null);
    }
  }

  return (
    <section style={{ marginTop: 20 }}>
      <h3 style={{ marginBottom: 8 }}>Photos</h3>
      {photos.length === 0 && !canEdit && <p className="tenant-portal-hint">No photos added yet.</p>}
      {photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          {photos.map((url) => (
            <div key={url} style={{ position: 'relative' }}>
              <img src={url} alt="Unit" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8 }} />
              {canEdit && (
                <button
                  type="button"
                  aria-label="Remove this photo"
                  onClick={() => handleRemove(url)}
                  disabled={removingUrl === url}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    lineHeight: '20px',
                    padding: 0,
                    background: '#fff',
                    border: '1px solid #ccc',
                  }}
                >
                  {removingUrl === url ? '…' : '✕'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit && photos.length < 5 && (
        <label className="form-field__label" style={{ display: 'inline-block' }}>
          <span style={{ display: 'inline-block', marginBottom: 4 }}>
            {uploading ? 'Uploading…' : `Add photo${photos.length > 0 ? 's' : ''} (up to ${5 - photos.length} more)`}
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={handleFilesChosen} />
        </label>
      )}
      {error && <p className="modal-error">{error}</p>}
    </section>
  );
}
