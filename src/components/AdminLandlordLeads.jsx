import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Skeleton from './Skeleton.jsx';

/**
 * BUILD SPEC PHASE 9 - admin review queue for the public marketing
 * landlord-lead form (/partner-with-us). Lists landlord_leads with a
 * status filter and a manual "mark contacted" action, alongside the
 * automatic 'new'/'contacted' -> 'converted' transition that happens
 * server-side the moment a matching real landlord account registers
 * (see auth.controller.js's registerLandlord). Reuses the same
 * admin-table styling as the other admin panels.
 */
const STATUS_FILTERS = ['', 'new', 'contacted', 'converted'];

export default function AdminLandlordLeads({ token }) {
  const [status, setStatus] = useState('');
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLeads(null);
    setError('');
    api
      .listLandlordLeads({ status }, token)
      .then((res) => setLeads(res.leads || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load landlord leads.'));
  }, [status, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMarkContacted(id) {
    setBusyId(id);
    setError('');
    try {
      await api.markLandlordLeadContacted(id, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update lead.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-section">
      <div className="admin-section__header-row">
        <h2>Landlord Leads</h2>
        <div className="admin-ba__filter admin-ba__filter--status">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s || 'all'}
              type="button"
              className={`admin-ba__filter-btn${status === s ? ' admin-ba__filter-btn--active' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="admin-section__hint">{error}</p>}

      {!leads ? (
        <Skeleton rows={4} />
      ) : leads.length === 0 ? (
        <p className="admin-section__hint">No leads match this filter.</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>House / Location</th>
                <th>Submitted</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>{l.full_name}</td>
                  <td>{l.phone}</td>
                  <td>{[l.house_name, l.location].filter(Boolean).join(', ') || '—'}</td>
                  <td>{new Date(l.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td><span className={`admin-status admin-status--${l.status === 'converted' ? 'active' : l.status === 'contacted' ? 'warning' : 'pending'}`}>{l.status}</span></td>
                  <td className="admin-table__actions">
                    {l.status !== 'converted' && l.status !== 'contacted' && (
                      <button disabled={busyId === l.id} onClick={() => handleMarkContacted(l.id)}>Mark contacted</button>
                    )}
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
