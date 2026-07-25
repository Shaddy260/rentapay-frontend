import React, { useState, useEffect } from 'react';
import Button from './Button.jsx';
import { api } from '../api/client.js';
import { downloadCsv } from '../utils/downloadCsv.js';
import './ComplaintsPanel.css';

/**
 * "Complaints" tab - reaches RentaPay's own support team (reuses the
 * help_requests table/endpoint: submitHelpRequest / GET /help/mine),
 * for account, billing, or platform issues. Property maintenance/
 * repair issues have their own separate flow now (MaintenancePanel.jsx,
 * /api/maintenance) that reaches the landlord/caretaker directly
 * instead - that used to be funneled through here, which meant a
 * tenant's "leaking tap" report only ever reached RentaPay support,
 * never the person who could actually fix it.
 */
export default function ComplaintsPanel({ token, name, defaultPhone }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  function load() {
    setLoading(true);
    api.getMyHelpRequests(token)
      .then((res) => setRequests(res.helpRequests || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.submitHelpRequest({ name, phone: defaultPhone, message }, token);
      setMessage('');
      setShowForm(false);
      setDone('Complaint submitted. We will get back to you within 24 hours.');
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
        <h2>Complaints</h2>
        {requests.length > 0 && (
          <button
            className="ghost-link"
            onClick={() =>
              downloadCsv(
                'rentapay-complaints',
                ['Date', 'Description', 'Status'],
                requests.map((r) => [new Date(r.created_at).toLocaleDateString('en-GB'), r.message, r.status])
              )
            }
          >
            Download
          </button>
        )}
        <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ File Complaint'}
        </Button>
      </div>

      {done && <p className="complaints-panel__done">{done}</p>}

      {showForm && (
        <form className="complaints-panel__form" onSubmit={submit}>
          {error && <p className="modal-error">{error}</p>}
          <label className="form-field__label">Describe the issue</label>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. A payment I made isn't reflecting, or an account issue…"
          />
          <Button type="submit" variant="primary" loading={busy}>Submit complaint</Button>
        </form>
      )}

      {loading ? (
        <p className="tenant-portal-hint">Loading your complaints…</p>
      ) : requests.length === 0 ? (
        <p className="tenant-portal-hint">No complaints filed yet.</p>
      ) : (
        <div className="complaints-panel__table-wrap">
        <table className="complaints-panel__table">
          <thead><tr><th>Date</th><th>Description</th><th>Status</th></tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                <td>{r.message}</td>
                <td><span className={`complaints-panel__status complaints-panel__status--${r.status}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
}
