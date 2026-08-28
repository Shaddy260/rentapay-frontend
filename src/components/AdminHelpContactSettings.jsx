import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client.js';
import Button from './Button.jsx';
import './AdminHelpContactSettings.css';
import InfoTip from './InfoTip.jsx';

// Item 3: Admin > Settings > "Help & Contact Details" - support
// MULTIPLE call/WhatsApp numbers (add/edit/remove individually),
// instead of one fixed field for each. Email stays a single field -
// there's still only ever one support email.
export default function AdminHelpContactSettings({ token, readOnly = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const [numbers, setNumbers] = useState([]);
  const [rowBusyId, setRowBusyId] = useState(null);
  const draftSeq = useRef(0);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.getAdminSettings(token)
      .then((data) => {
        setEmail(data.helpEmail || '');
        setNumbers(Array.isArray(data.helpNumbers) ? data.helpNumbers : []);
      })
      .catch((err) => setError(err.message || 'Failed to load Help & Contact settings.'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveEmail(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setEmailBusy(true);
    try {
      await api.updateHelpEmail({ helpEmail: email }, token);
      setNotice('Support email saved.');
    } catch (err) {
      setError(err.message || 'Failed to save support email.');
    } finally {
      setEmailBusy(false);
    }
  }

  function handleAddNumber(type) {
    setError('');
    setNotice('');
    // Add a local, unsaved draft row only — nothing is sent to the backend
    // until the person actually types a value and clicks Save. This avoids
    // POSTing a blank value the moment "+ Add" is clicked.
    draftSeq.current += 1;
    const draftId = `draft-${draftSeq.current}`;
    setNumbers((prev) => [...prev, { id: draftId, label: '', type, value: '', isActive: true, isDraft: true }]);
  }

  function updateLocalNumber(id, patch) {
    setNumbers((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  async function handleSaveNumber(number) {
    if (!number.value || !number.value.trim()) {
      setError('Enter a number before saving.');
      return;
    }
    setRowBusyId(number.id);
    setError('');
    setNotice('');
    try {
      if (number.isDraft) {
        // First save of a new row: create it now that it actually has a value.
        const created = await api.createHelpContactNumber(
          { label: number.label, type: number.type, value: number.value, isActive: number.isActive },
          token
        );
        setNumbers((prev) => prev.map((n) => (n.id === number.id ? created : n)));
      } else {
        const saved = await api.updateHelpContactNumber(
          number.id,
          { label: number.label, type: number.type, value: number.value, isActive: number.isActive },
          token
        );
        setNumbers((prev) => prev.map((n) => (n.id === number.id ? saved : n)));
      }
      setNotice('Contact number saved.');
    } catch (err) {
      setError(err.message || 'Failed to save contact number.');
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleRemoveNumber(id) {
    const target = numbers.find((n) => n.id === id);
    // A draft row only exists locally — just drop it, no API call needed.
    if (target && target.isDraft) {
      setNumbers((prev) => prev.filter((n) => n.id !== id));
      return;
    }
    setRowBusyId(id);
    setError('');
    setNotice('');
    try {
      await api.deleteHelpContactNumber(id, token);
      setNumbers((prev) => prev.filter((n) => n.id !== id));
      setNotice('Contact number removed.');
    } catch (err) {
      setError(err.message || 'Failed to remove contact number.');
    } finally {
      setRowBusyId(null);
    }
  }

  const callNumbers = numbers.filter((n) => n.type === 'call');
  const whatsappNumbers = numbers.filter((n) => n.type === 'whatsapp');

  if (loading) return <div className="admin-help-contacts"><p>Loading Help & Contact settings…</p></div>;

  // General Manager view: same data, no edit affordances at all - a
  // plain read-out instead of reusing the editable form/rows below.
  if (readOnly) {
    return (
      <div className="admin-help-contacts">
        <h2>Help &amp; Contact Details</h2>
        {error && <div className="admin-banner admin-banner--error">{error}</div>}
        <p><strong>Support email:</strong> {email || '—'}</p>
        <div className="admin-help-contacts__list">
          <h3>Call numbers</h3>
          {callNumbers.length === 0 && <p className="admin-help-contacts__empty">No numbers added yet.</p>}
          <ul>
            {callNumbers.map((n) => (
              <li key={n.id}>{n.label ? `${n.label}: ` : ''}{n.value} {n.isActive === false ? '(inactive)' : ''}</li>
            ))}
          </ul>
        </div>
        <div className="admin-help-contacts__list">
          <h3>WhatsApp numbers</h3>
          {whatsappNumbers.length === 0 && <p className="admin-help-contacts__empty">No numbers added yet.</p>}
          <ul>
            {whatsappNumbers.map((n) => (
              <li key={n.id}>{n.label ? `${n.label}: ` : ''}{n.value} {n.isActive === false ? '(inactive)' : ''}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-help-contacts">
      <h2>Help &amp; Contact Details</h2>
      <InfoTip text={<>
        These numbers and this email show up in the Help modal on every portal (including the logged-out login
        screen) and in the manual-payment "call customer care" message. You can add as many call and WhatsApp
        numbers as you need — e.g. a primary line and a backup — not just one of each.
      </>} />

      {error && <div className="admin-banner admin-banner--error">{error}</div>}
      {notice && <div className="admin-banner admin-banner--ok">{notice}</div>}

      <form className="admin-help-contacts__email" onSubmit={handleSaveEmail}>
        <label>
          <span>Support email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <Button type="submit" variant="primary" loading={emailBusy}>Save email</Button>
      </form>

      <NumberList
        title="Call numbers"
        type="call"
        numbers={callNumbers}
        onChange={updateLocalNumber}
        onSave={handleSaveNumber}
        onRemove={handleRemoveNumber}
        onAdd={() => handleAddNumber('call')}
        rowBusyId={rowBusyId}
      />

      <NumberList
        title="WhatsApp numbers"
        type="whatsapp"
        numbers={whatsappNumbers}
        onChange={updateLocalNumber}
        onSave={handleSaveNumber}
        onRemove={handleRemoveNumber}
        onAdd={() => handleAddNumber('whatsapp')}
        rowBusyId={rowBusyId}
      />
    </div>
  );
}

function NumberList({ title, numbers, onChange, onSave, onRemove, onAdd, rowBusyId }) {
  return (
    <div className="admin-help-contacts__list">
      <h3>{title}</h3>
      {numbers.length === 0 && <p className="admin-help-contacts__empty">No numbers added yet.</p>}
      {numbers.map((n) => (
        <div key={n.id} className="admin-help-contacts__row">
          <input
            type="text"
            placeholder="Label (e.g. Primary, Backup)"
            value={n.label || ''}
            onChange={(e) => onChange(n.id, { label: e.target.value })}
            className="admin-help-contacts__row-label"
          />
          <input
            type="text"
            placeholder="Number"
            value={n.value || ''}
            onChange={(e) => onChange(n.id, { value: e.target.value })}
            className="admin-help-contacts__row-value"
          />
          <label className="admin-help-contacts__row-active">
            <input
              type="checkbox"
              checked={n.isActive !== false}
              onChange={(e) => onChange(n.id, { isActive: e.target.checked })}
            />
            Active
          </label>
          <Button type="button" variant="ghost" loading={rowBusyId === n.id} onClick={() => onSave(n)}>
            Save
          </Button>
          <Button type="button" variant="ghost" loading={rowBusyId === n.id} onClick={() => onRemove(n.id)}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" onClick={onAdd}>
        + Add {title.toLowerCase().replace(/s$/, '')}
      </Button>
    </div>
  );
}
