import { useEffect, useState } from 'react';
import Button from './Button.jsx';
import { api } from '../api/client.js';
import './ComplaintsPanel.css';

const STATUS_LABEL = { open: 'Reported', in_progress: 'Being worked on', resolved: 'Resolved' };

export default function MaintenancePanel({ token }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  function load() {
    setLoading(true);
    api.getMyMaintenanceRequests(token)
      .then((res) => setRequests(res.requests || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.submitMaintenanceRequest({ title, description }, token);
      setTitle('');
      setDescription('');
      setShowForm(false);
      setDone('Reported - your landlord/caretaker has been notified.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="complaints-panel">
      <div className="complaints-panel__header">
        <h2>Maintenance</h2>
        <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ Report an issue'}
        </Button>
      </div>

      {done && <p className="complaints-panel__done">{done}</p>}

      {showForm && (
        <form className="complaints-panel__form" onSubmit={submit}>
          {error && <p className="modal-error">{error}</p>}
          <label className="form-field__label">What's the issue?</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Leaking tap in the bathroom" />
          <label className="form-field__label">More detail (optional)</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anything that would help whoever's fixing it" />
          <Button type="submit" variant="primary" loading={busy}>Submit report</Button>
        </form>
      )}

      {loading ? (
        <p className="tenant-portal-hint">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="tenant-portal-hint">No maintenance issues reported yet.</p>
      ) : (
        <div className="complaints-panel__table-wrap">
        <table className="complaints-panel__table">
          <thead><tr><th>Date</th><th>Issue</th><th>Status</th></tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                <td>{r.title}</td>
                <td><span className={`complaints-panel__status complaints-panel__status--${r.status === 'resolved' ? 'resolved' : 'open'}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
}
