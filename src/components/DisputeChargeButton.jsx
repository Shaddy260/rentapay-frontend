import React, { useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import ChatWidget from './ChatWidget.jsx';
import './DisputeChargeButton.css';
import InfoTip from './InfoTip.jsx';

/**
 * FEATURE (direct request: "dispute a charge - a lightweight 'this
 * doesn't look right' button on any line item that opens a chat
 * thread pre-filled with context. Reduces landlord/tenant friction
 * dramatically."): drop this next to any payment row (tenant's own
 * payment history, or the landlord/manager payment history panels).
 *
 * Flow: tap "This doesn't look right" -> a tiny optional-reason prompt
 * -> submit posts a pre-filled context bubble into the existing
 * landlord_tenant chat thread (date/amount/method/status + whatever
 * was typed) and flags the row - the button then shows "Disputed" and
 * offers a one-tap "View conversation" straight into that thread,
 * instead of either side re-explaining the payment from scratch.
 *
 * Props:
 *   token, role ('tenant' | 'landlord' | 'manager')
 *   paymentId          - the payment this button is attached to
 *   initiallyDisputed   - true if this row already has an open dispute
 *                         (pass down from a bulk /api/disputes lookup
 *                         so every row doesn't fire its own request)
 *   threadName          - label for the chat popup header, e.g. the
 *                         tenant's name (landlord/manager side) or
 *                         "Your Landlord" (tenant side)
 *   landlordId, tenantId - needed to open the right landlord_tenant thread
 */
export default function DisputeChargeButton({
  token,
  role,
  paymentId,
  initiallyDisputed = false,
  threadName = 'Conversation',
  landlordId,
  tenantId,
}) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [disputed, setDisputed] = useState(initiallyDisputed);
  const [chatOpen, setChatOpen] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.raiseDispute(paymentId, reason.trim(), token);
      setDisputed(true);
      setPromptOpen(false);
      setReason('');
    } catch (err) {
      // A 409 means someone (the other side, or this same tenant on
      // another tab) already opened a dispute on this exact payment -
      // treat that as success rather than an error, since the goal
      // (a dispute thread exists) is already met.
      if (err instanceof ApiError && err.status === 409) {
        setDisputed(true);
        setPromptOpen(false);
        setReason('');
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to raise dispute.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (disputed) {
    return (
      <>
        <button type="button" className="dispute-charge-btn dispute-charge-btn--active" onClick={() => setChatOpen(true)}>
          🚩 Disputed — view conversation
        </button>
        <ChatWidget
          token={token}
          role={role}
          hideLauncher
          controlledOpen={chatOpen}
          onOpenChange={setChatOpen}
          directThread={{ threadType: 'landlord_tenant', landlordId, tenantId, name: threadName }}
        />
      </>
    );
  }

  return (
    <>
      <button type="button" className="dispute-charge-btn" onClick={() => setPromptOpen(true)}>
        ⚠️ This doesn't look right
      </button>

      {promptOpen && (
        <div className="modal-overlay" onClick={() => !submitting && setPromptOpen(false)}>
          <div className="modal-shell dispute-charge-prompt" onClick={(e) => e.stopPropagation()}>
            <h2>Dispute this charge?</h2>
            <InfoTip text={<>
              This posts a message into your {role === 'tenant' ? "landlord's" : "tenant's"} chat with the payment details already
              filled in, so you don't have to re-explain it. Add anything specific below (optional).
            </>} />
            <form onSubmit={handleSubmit}>
              <textarea
                autoFocus
                rows={3}
                placeholder="e.g. I paid this on the 3rd, not the 12th…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
              />
              {error && <p className="form-error">{error}</p>}
              <div className="dispute-charge-prompt__actions">
                <Button type="submit" variant="primary" loading={submitting}>
                  Raise dispute
                </Button>
                <button type="button" className="ghost-link" onClick={() => setPromptOpen(false)} disabled={submitting}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
