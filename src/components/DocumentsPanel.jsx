import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AuditLogPanel from './AuditLogPanel.jsx';
import './DocumentsPanel.css';

/**
 * Lease/document storage panel.
 *
 * Landlord/manager mode (pass tenantId + canManage): upload a lease/ID
 * for this tenant, and delete any document they uploaded.
 * Tenant mode (no tenantId/canManage, just token+role='tenant' on the
 * backend): view/download only - a tenant can see their own lease but
 * never delete it (flagged design decision, built as agreed).
 */
export default function DocumentsPanel({ token, tenantId, unitId, canManage = false }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  function load() {
    setLoading(true);
    setError('');
    const params = tenantId ? { tenantId } : unitId ? { unitId } : {};
    api.listDocuments(params, token)
      .then((res) => setDocuments(res.documents || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId, unitId]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) { setError('Choose a file to upload.'); return; }
    if (!label.trim()) { setError('Give this document a label (e.g. "Lease agreement").'); return; }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('tenantId', tenantId);
      formData.append('label', label.trim());
      formData.append('file', file);
      await api.uploadDocument(formData, token);
      setLabel('');
      setFile(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    setDeletingId(id);
    setError('');
    try {
      await api.deleteDocument(id, token);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="documents-panel">
      <div className="tenant-section__header-row">
        <h2>Documents</h2>
      </div>

      {canManage && <AuditLogPanel token={token} targetType="document" />}

      {error && <p className="modal-error">{error}</p>}

      {canManage && tenantId && (
        <form className="documents-panel__form" onSubmit={handleUpload}>
          <input
            type="text"
            placeholder="Label (e.g. Lease agreement 2026)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button type="submit" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
        </form>
      )}

      {loading ? (
        <p className="tenant-portal-hint">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="tenant-portal-hint">No documents uploaded yet.</p>
      ) : (
        <ul className="documents-panel__list">
          {documents.map((d) => (
            <li key={d.id} className="documents-panel__item">
              <div>
                <strong>{d.label}</strong>
                <p className="documents-panel__meta">Uploaded {new Date(d.uploaded_at).toLocaleDateString('en-GB')}</p>
              </div>
              <div className="documents-panel__actions">
                {d.file_url && (
                  <a href={d.file_url} target="_blank" rel="noreferrer" className="ghost-link">View / Download</a>
                )}
                {canManage && (
                  <button disabled={deletingId === d.id} onClick={() => handleDelete(d.id)} style={{ color: '#b3261e' }}>
                    {deletingId === d.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
