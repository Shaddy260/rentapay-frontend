import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import Avatar from './Avatar.jsx';
import './StatisticsPanel.css';

export default function AdminScoutsPanel({ token }) {
  const [scouts, setScouts] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  function load() {
    api.listAllScouts(token)
      .then((res) => setScouts(res.scouts || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load scouts.'));
  }

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleStatus(scout) {
    const nextStatus = scout.is_active ? 'suspended' : 'active';
    setBusyId(scout.id);
    try {
      await api.setScoutStatus(scout.id, { status: nextStatus }, token);
      setScouts((prev) => prev.map((s) => (s.id === scout.id ? { ...s, is_active: nextStatus === 'active' } : s)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update scout status.');
    } finally {
      setBusyId(null);
    }
  }

  const filtered = (scouts || []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (s.full_name || '').toLowerCase().includes(q) || (s.phone || '').includes(q);
  });

  return (
    <section className="statistics-panel">
      <h2>Scouts</h2>
      <p className="tenant-portal-hint">
        Every Scout account registered on the platform, with how many counties they currently hold an active
        subscription in. Suspending a scout blocks their portal access immediately, same as suspending a manager
        or caretaker — it does not touch billing.
      </p>

      <input
        type="search"
        placeholder="Search scouts by name or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="admin-search-input"
        style={{ marginBottom: 16, maxWidth: 380 }}
        aria-label="Search scouts"
      />

      {error && <p className="modal-error">{error}</p>}
      {scouts === null && !error && <p>Loading…</p>}
      {scouts && filtered.length === 0 && <p className="tenant-portal-hint">No scouts found.</p>}

      {scouts && filtered.length > 0 && (
        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Active counties</th>
                <th>Joined</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td><Avatar name={s.full_name} size={32} /></td>
                  <td>{s.full_name}</td>
                  <td>{s.phone}</td>
                  <td>{s.email || '—'}</td>
                  <td>{s.activeCounties}</td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                  <td>{s.is_active ? 'Active' : 'Suspended'}</td>
                  <td>
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={busyId === s.id}
                      onClick={() => toggleStatus(s)}
                    >
                      {busyId === s.id ? 'Saving…' : s.is_active ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
