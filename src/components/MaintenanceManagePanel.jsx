import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import './MaintenanceManagePanel.css';

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };

export default function MaintenanceManagePanel({ token, propertyId }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('open');
  const [noteDraftFor, setNoteDraftFor] = useState(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    const params = {};
    if (propertyId) params.propertyId = propertyId;
    if (filter !== 'all') params.status = filter;
    api.getMaintenanceRequests(token, params)
      .then((res) => setRequests(res.requests || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, filter]);

  async function updateStatus(id, status, resolutionNote) {
    setBusyId(id);
    setError('');
    try {
      await api.updateMaintenanceStatus(id, { status, resolutionNote }, token);
      setNoteDraftFor(null);
      setNote('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="maintenance-manage-panel">
      <div className="maintenance-manage-panel__header">
        <h2>Maintenance</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
      </div>

      {error && <p className="modal-error">{error}</p>}

      {loading ? (
        <p className="tenant-portal-hint">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="tenant-portal-hint">Nothing here.</p>
      ) : (
        <ul className="maintenance-manage-panel__list">
          {requests.map((r) => (
            <li key={r.id} className="maintenance-manage-panel__item">
              <div className="maintenance-manage-panel__item-header">
                <strong>{r.title}</strong>
                <span className={`maintenance-manage-panel__badge maintenance-manage-panel__badge--${r.status}`}>{STATUS_LABEL[r.status]}</span>
              </div>
              <p className="maintenance-manage-panel__meta">
                {r.tenants?.full_name || 'Tenant'} · {r.units?.unit_name || 'Unit'} · {new Date(r.created_at).toLocaleDateString('en-GB')}
              </p>
              {r.description && <p className="maintenance-manage-panel__desc">{r.description}</p>}
              {r.status !== 'resolved' && (
                <div className="maintenance-manage-panel__actions">
                  {r.status === 'open' && (
                    <button disabled={busyId === r.id} onClick={() => updateStatus(r.id, 'in_progress')}>Mark in progress</button>
                  )}
                  {noteDraftFor === r.id ? (
                    <span className="maintenance-manage-panel__resolve-form">
                      <input placeholder="What was done (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                      <button disabled={busyId === r.id} onClick={() => updateStatus(r.id, 'resolved', note)}>Confirm resolved</button>
                    </span>
                  ) : (
                    <button disabled={busyId === r.id} onClick={() => setNoteDraftFor(r.id)}>Mark resolved</button>
                  )}
                </div>
              )}
              {r.status === 'resolved' && r.resolution_note && (
                <p className="maintenance-manage-panel__resolution">Resolved: {r.resolution_note}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
