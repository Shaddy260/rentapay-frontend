import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import ModalShell from './ModalShell.jsx';
import './OwnershipVerificationBanner.css';

// DIRECT REQUEST (anti-fraud): "there should just be a way to ensure
// there is no fraud... a consistent banner on their dashboards after
// they log in telling them to submit the documents of proof."
//
// Deliberately NOT dismissible like IncomingItemsBanner or
// MissingPhotosBanner - it stays on screen every session until the
// account is actually 'verified' by admin, since the whole point is
// that it can't be nagged away without acting on it. Nothing else in
// the dashboard is blocked while it's showing (see
// SubscriptionLockGate.jsx for what an actual full lock looks like -
// this is intentionally not that); only the public listings page is
// gated, enforced server-side in public.controller.js.
//
// Caretakers never see this (they can't submit documents - see
// landlordOwnership.routes.js) so the caller should not render this
// for isCaretaker.
export default function OwnershipVerificationBanner({ token }) {
  const [status, setStatus] = useState(null); // 'unverified' | 'pending' | 'verified' | 'rejected'
  const [rejectionReason, setRejectionReason] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [label, setLabel] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  function load() {
    api
      .getOwnershipVerificationStatus(token)
      .then((res) => {
        setStatus(res.status);
        setRejectionReason(res.rejectionReason || '');
      })
      .catch(() => {
        // Fail quiet - a transient error here shouldn't itself become
        // a second banner on top of whatever else the dashboard is
        // already showing. It'll re-check next load.
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Nothing to show once verified, or before the first status check
  // has resolved (avoids a flash of the banner on every page load).
  if (status === null || status === 'verified') return null;

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) { setError('Choose a file to upload.'); return; }
    if (!label.trim()) { setError('Give this document a label (e.g. "Title deed").'); return; }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('label', label.trim());
      formData.append('file', file);
      await api.uploadOwnershipDocument(formData, token);
      setLabel('');
      setFile(null);
      setJustSubmitted(true);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit document.');
    } finally {
      setUploading(false);
    }
  }

  const isPending = status === 'pending';
  const isRejected = status === 'rejected';

  return (
    <>
      <div className={`ownership-verification-banner ${isRejected ? 'ownership-verification-banner--rejected' : isPending ? 'ownership-verification-banner--pending' : ''}`}>
        <div className="ownership-verification-banner__text">
          {isPending && !justSubmitted && (
            <span>⏳ Your ownership verification documents are under review. Your vacant units will appear on the public listings page once approved - everything else in your account works as normal.</span>
          )}
          {isPending && justSubmitted && (
            <span>✅ Document submitted - it's now waiting on admin review.</span>
          )}
          {isRejected && (
            <span>⚠️ Your ownership documents weren't approved{rejectionReason ? `: "${rejectionReason}"` : '.'} Please submit a new document to have your vacant units listed publicly.</span>
          )}
          {status === 'unverified' && (
            <span>📄 Verify that you own or manage your apartment(s) to have your vacant units appear on the public listings page. This is a one-time check to keep RentaPay free of fraudulent listings.</span>
          )}
        </div>
        <Button variant="secondary" onClick={() => { setShowModal(true); setJustSubmitted(false); setError(''); }}>
          {isRejected || isPending ? 'Submit another document' : 'Submit documents'}
        </Button>
      </div>

      {showModal && (
        <ModalShell title="Submit proof of ownership" onClose={() => setShowModal(false)}>
          <p className="ownership-verification-banner__modal-hint">
            Upload a document that shows you own or manage this property - e.g. a title deed, a rates/utility
            bill in your name, or a management agreement. An admin reviews it before your vacant units go public.
          </p>
          {error && <p className="modal-error">{error}</p>}
          <form className="ownership-verification-banner__form" onSubmit={handleUpload}>
            <input
              type="text"
              placeholder="Label (e.g. Title deed, Rates bill)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button type="submit" variant="primary" disabled={uploading}>{uploading ? 'Submitting…' : 'Submit for review'}</Button>
          </form>
        </ModalShell>
      )}
    </>
  );
}
