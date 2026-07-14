import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import './StatisticsPanel.css';

// Direct request: "we should have in menu a UI for payment histories
// and details of archived and deleted tenants... with a UI to restore
// them. The moment we restore them it should ask which unit to
// restore them to... and ask whether to restore with history or not -
// never automated either way."
export default function ArchivedTenantsPanel({ token }) {
  const [archived, setArchived] = useState(null);
  const [error, setError] = useState('');
  const [restoreTarget, setRestoreTarget] = useState(null); // tenant object mid-restore
  const [vacantUnits, setVacantUnits] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [includeHistory, setIncludeHistory] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState('');

  function load() {
    api.listArchivedTenants(token)
      .then((res) => setArchived(res.archivedTenants || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load archived tenants.'));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function openRestore(tenant) {
    setRestoreTarget(tenant);
    setSelectedUnitId('');
    setIncludeHistory('');
    setError('');
    try {
      const res = await api.listUnits(token);
      setVacantUnits((res.units || []).filter((u) => u.status === 'vacant'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load vacant units.');
    }
  }

  async function handleRestore(e) {
    e.preventDefault();
    if (!selectedUnitId) {
      setError('Choose which unit to restore this tenant into.');
      return;
    }
    if (includeHistory === '') {
      setError('Choose whether to restore their payment history too.');
      return;
    }
    setRestoring(true);
    setError('');
    try {
      const res = await api.restoreTenant(restoreTarget.id, { unitId: selectedUnitId, includeHistory: includeHistory === 'yes' }, token);
      setNotice(res.message);
      setRestoreTarget(null);
      load();
    } catch (err) {
      // FIX (direct request): "if by chance they choose a unit that's
      // occupied, give an error - not just vanishing the tenant." The
      // backend re-checks the destination unit right before writing,
      // so a stale vacant-looking unit surfaces as a real error here
      // instead of silently failing.
      setError(err instanceof ApiError ? err.message : 'Failed to restore tenant.');
    } finally {
      setRestoring(false);
    }
  }

  if (error && archived === null) return <section className="statistics-panel"><p className="modal-error">{error}</p></section>;

  return (
    <section className="statistics-panel">
      <h2>Archived Tenants</h2>
      <p className="tenant-portal-hint">
        Tenants removed from a unit land here, along with their full payment history - nothing is deleted when a tenant is removed, only archived.
      </p>
      {notice && <p style={{ color: '#1a7a3c' }}>{notice}</p>}
      {archived === null && <p>Loading…</p>}
      {archived && archived.length === 0 && <p className="tenant-portal-hint">No archived tenants.</p>}
      {archived && archived.length > 0 && (
        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Last unit</th><th>Left on</th><th>Total paid historically</th><th></th></tr>
            </thead>
            <tbody>
              {archived.map((t) => (
                <tr key={t.id}>
                  <td>{t.full_name}</td>
                  <td>{t.primary_phone}</td>
                  <td>{t.units?.unit_name || '—'}{t.units?.properties?.name ? ` (${t.units.properties.name})` : ''}</td>
                  <td>{t.left_at ? new Date(t.left_at).toLocaleDateString('en-GB') : '—'}</td>
                  <td>KES {Number(t.totalPaidHistorically || 0).toLocaleString()}</td>
                  <td><button type="button" className="ghost-link" onClick={() => openRestore(t)}>Restore</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {restoreTarget && (
        <div className="modal-overlay" onClick={() => setRestoreTarget(null)}>
          <div className="modal-shell" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2>Restore {restoreTarget.full_name}</h2>
            <form onSubmit={handleRestore}>
              <div className="form-field">
                <label className="form-field__label">Restore into which unit?</label>
                <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)} required>
                  <option value="" disabled>Select a vacant unit</option>
                  {vacantUnits.map((u) => (
                    <option key={u.id} value={u.id}>{u.unit_name}</option>
                  ))}
                </select>
                {vacantUnits.length === 0 && <p className="form-field__hint">No vacant units available right now.</p>}
              </div>
              <div className="form-field">
                <label className="form-field__label">Restore their payment history too?</label>
                <select value={includeHistory} onChange={(e) => setIncludeHistory(e.target.value)} required>
                  <option value="" disabled>Choose one</option>
                  <option value="yes">Yes - bring their full payment history</option>
                  <option value="no">No - start with a clean history (old payments stay on record, just hidden from their own view)</option>
                </select>
              </div>
              {error && <p className="form-error">{error}</p>}
              <div className="settings-manager-row__actions">
                <Button type="submit" variant="primary" loading={restoring}>Restore tenant</Button>
                <button type="button" className="ghost-link" onClick={() => setRestoreTarget(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
