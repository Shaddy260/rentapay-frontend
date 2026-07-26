import { useState } from 'react';
import Button from './Button.jsx';
import { api, ApiError } from '../api/client.js';

// Modal for a landlord/property manager/caretaker to type and send an
// announcement to their tenants (caretakers included per direct
// request - see announcement.routes.js).
export default function AnnouncementComposer({ token, properties, onClose, onSent }) {
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [propertyId, setPropertyId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSend(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.createAnnouncement({ message: message.trim(), audience, propertyId: audience === 'property' ? propertyId : undefined }, token);
      onSent?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send announcement.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-shell" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h2>Announce to your tenants</h2>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          This shows up as a bell notification in every tenant's portal (and your managers/caretakers too).
        </p>
        <form onSubmit={handleSend}>
          <div className="form-field">
            <label className="form-field__label">Who should see this?</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">All tenants</option>
              <option value="property">Just one property</option>
            </select>
          </div>
          {audience === 'property' && (
            <div className="form-field">
              <label className="form-field__label">Property</label>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required>
                <option value="" disabled>Select a property</option>
                {(properties || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-field">
            <label className="form-field__label">Message</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Water will be off on Saturday from 9am to 1pm for maintenance."
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="settings-manager-row__actions">
            <Button type="submit" variant="primary" loading={sending}>Send announcement</Button>
            <button type="button" className="ghost-link" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
