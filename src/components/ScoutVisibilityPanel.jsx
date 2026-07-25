import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';

// Landlord-only settings panel (Pass 1 of the Scout audit): the
// account-wide opt-out of the whole Scout marketplace, plus the list
// of individually-blocked Scouts with an unblock action. A landlord
// blocks a Scout from inside a scout_landlord chat conversation
// (ChatConversation.jsx) - this panel is where they manage/undo that
// afterwards, since a chat thread isn't a natural place to keep a
// standing list.
export default function ScoutVisibilityPanel({ token }) {
  const [enabled, setEnabled] = useState(true);
  const [disclosureSeenAt, setDisclosureSeenAt] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getScoutVisibilitySettings(token), api.listBlockedScouts(token)])
      .then(([settings, blockedRes]) => {
        setEnabled(settings.scoutVisibilityEnabled !== false);
        setDisclosureSeenAt(settings.scoutDisclosureSeenAt);
        setBlocked(blockedRes.blocked || []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load Scout settings.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleToggle() {
    const next = !enabled;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await api.setScoutVisibility(next, token);
      setEnabled(next);
      setDisclosureSeenAt(new Date().toISOString());
      setNotice(res.message || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update setting.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnblock(scoutId) {
    setError('');
    setNotice('');
    try {
      await api.unblockScout(scoutId, token);
      setBlocked((prev) => prev.filter((b) => b.scoutId !== scoutId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to unblock scout.');
    }
  }

  if (loading) return null;

  return (
    <section className="settings-card">
      <h2>Scout visibility</h2>

      {!disclosureSeenAt && (
        <p className="form-field__hint" style={{ marginBottom: '0.75rem' }}>
          Scouts are independent agents who pay to browse vacant units in your county and refer tenants to you.
          Turning this off hides all your units from every Scout, everywhere.
        </p>
      )}

      <div className="settings-manager-row__display">
        <span>{enabled ? 'Your vacant units are visible to Scouts.' : 'Your units are hidden from all Scouts.'}</span>
        <div className="settings-manager-row__actions">
          <button type="button" className="ghost-link" onClick={handleToggle} disabled={saving}>
            {saving ? 'Saving…' : enabled ? 'Hide my units from Scouts' : 'Make my units visible to Scouts'}
          </button>
        </div>
      </div>

      {notice && <p className="form-field__hint" style={{ color: '#1f6f5c' }}>{notice}</p>}
      {error && <p className="form-field__hint" style={{ color: '#B3261E' }}>{error}</p>}

      <h3 style={{ marginTop: '1.25rem', fontSize: '0.95rem' }}>Blocked Scouts</h3>
      {blocked.length === 0 ? (
        <p className="form-field__hint">You haven't blocked any Scouts.</p>
      ) : (
        <div>
          {blocked.map((b) => (
            <div key={b.scoutId} className="settings-manager-row__display">
              <span>
                {b.fullName || 'Scout'} {b.phone && `· ${b.phone}`}
                {b.blockedAt && (
                  <>
                    {' '}
                    · blocked {new Date(b.blockedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </>
                )}
              </span>
              <div className="settings-manager-row__actions">
                <button type="button" className="ghost-link" onClick={() => handleUnblock(b.scoutId)}>Unblock</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
