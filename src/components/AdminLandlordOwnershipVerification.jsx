import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';
import './AdminLandlordOwnershipVerification.css';

/**
 * DIRECT REQUEST (anti-fraud): admin's review queue for landlord
 * ownership/management proof documents (see
 * landlordOwnership.controller.js / adminLandlordOwnership.controller.js).
 * Approving a landlord here is what lets their already-vacant,
 * already-publicly-toggled units start appearing on the public
 * listings page - enforced live server-side, not by anything this
 * page does beyond the approve call itself.
 *
 * Documents come back one row per file; grouped here by landlord so a
 * landlord who submitted several files (e.g. title deed + ID) shows
 * as one card with all their documents, and one approve/reject
 * decision covers the whole submission.
 */
export default function AdminLandlordOwnershipVerification({ token, readOnly = false }) {
  const [status, setStatus] = useState('pending');
  const [submissions, setSubmissions] = useState(null);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [notes, setNotes] = useState({});
  const [reasons, setReasons] = useState({});
  const [openUrls, setOpenUrls] = useState({});

  const load = useCallback(() => {
    setSubmissions(null);
    setError('');
    api
      .listLandlordOwnershipSubmissions(status, token)
      .then((res) => setSubmissions(res.submissions || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submissions.'));
  }, [status, token]);

  useEffect(() => {
    load();
  }, [load]);

  const groupedByLandlord = useMemo(() => {
    const map = new Map();
    (submissions || []).forEach((doc) => {
      if (!map.has(doc.landlord_id)) {
        map.set(doc.landlord_id, {
          landlordId: doc.landlord_id,
          landlord: doc.landlords,
          documents: [],
        });
      }
      map.get(doc.landlord_id).documents.push(doc);
    });
    return Array.from(map.values());
  }, [submissions]);

  async function viewDocument(documentId) {
    try {
      const res = await api.getLandlordOwnershipDocumentUrl(documentId, token);
      if (res.url) {
        setOpenUrls((prev) => ({ ...prev, [documentId]: res.url }));
        window.open(res.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to open document.');
    }
  }

  async function approve(landlordId) {
    setBusyKey(landlordId);
    setError('');
    try {
      await api.approveLandlordOwnership(landlordId, notes[landlordId] || undefined, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve landlord.');
    } finally {
      setBusyKey(null);
    }
  }

  async function reject(landlordId) {
    const reason = (reasons[landlordId] || '').trim();
    if (!reason) {
      setError('Enter a reason before rejecting.');
      return;
    }
    setBusyKey(landlordId);
    setError('');
    try {
      await api.rejectLandlordOwnership(landlordId, reason, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject landlord.');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="admin-landlord-ownership">
      <h2>Landlord Verification</h2>
      <InfoTip text={<>
        Proof-of-ownership/management documents landlords submit before their vacant units are allowed onto the
        public listings page. Approving a landlord here takes effect immediately - their already-vacant,
        publicly-toggled units start appearing on the public page right away.
      </>} />

      <div className="admin-landlord-ownership__filter">
        {['pending', 'verified', 'rejected', 'all'].map((s) => (
          <button
            key={s}
            type="button"
            className={`admin-landlord-ownership__filter-btn${status === s ? ' admin-landlord-ownership__filter-btn--active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="admin-landlord-ownership__error">{error}</p>}

      {!submissions ? (
        <Skeleton rows={3} />
      ) : !groupedByLandlord.length ? (
        <p className="admin-landlord-ownership__empty">No {status === 'all' ? '' : status} submissions.</p>
      ) : (
        <ul className="admin-landlord-ownership__list">
          {groupedByLandlord.map((group) => (
            <li key={group.landlordId} className="admin-landlord-ownership__item">
              <div className="admin-landlord-ownership__header">
                <strong>{group.landlord?.full_name || 'Unknown landlord'}</strong>
                <span className="admin-landlord-ownership__meta">
                  {group.landlord?.email || 'no email'} · {group.landlord?.phone || 'no phone'}
                </span>
              </div>

              <ul className="admin-landlord-ownership__docs">
                {group.documents.map((doc) => (
                  <li key={doc.id} className="admin-landlord-ownership__doc">
                    <button type="button" className="ghost-link" onClick={() => viewDocument(doc.id)}>
                      {doc.label}
                    </button>
                    <span className="admin-landlord-ownership__doc-meta">
                      Submitted {doc.submitted_at ? new Date(doc.submitted_at).toLocaleDateString() : '-'}
                      {doc.status !== 'pending' ? ` · ${doc.status}` : ''}
                    </span>
                    {doc.admin_note && (
                      <p className="admin-landlord-ownership__doc-note"><strong>Admin note:</strong> {doc.admin_note}</p>
                    )}
                  </li>
                ))}
              </ul>

              {status === 'pending' && !readOnly && (
                <div className="admin-landlord-ownership__actions">
                  <input
                    type="text"
                    placeholder="Optional approval note"
                    value={notes[group.landlordId] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [group.landlordId]: e.target.value }))}
                  />
                  <Button disabled={busyKey === group.landlordId} onClick={() => approve(group.landlordId)}>
                    Approve
                  </Button>
                  <input
                    type="text"
                    placeholder="Rejection reason (required to reject)"
                    value={reasons[group.landlordId] || ''}
                    onChange={(e) => setReasons((prev) => ({ ...prev, [group.landlordId]: e.target.value }))}
                  />
                  <Button variant="danger" disabled={busyKey === group.landlordId} onClick={() => reject(group.landlordId)}>
                    Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
