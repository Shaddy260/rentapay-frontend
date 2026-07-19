import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';

/**
 * Admin panel for managing Scout accounts: a list of all scouts with
 * their active county subscription count and a suspend/activate
 * toggle, plus a sub-tab for reviewing manual county-subscription
 * payment submissions (mirrors LandlordManualPaymentConfirmations).
 */
export default function AdminScoutsPanel({ token }) {
  const [subTab, setSubTab] = useState('scouts');

  return (
    <section className="statistics-panel">
      <h2>Scouts</h2>

      <div className="admin-tabs" style={{ marginBottom: '1rem' }}>
        <button className={subTab === 'scouts' ? 'is-active' : ''} onClick={() => setSubTab('scouts')}>
          All Scouts
        </button>
        <button className={subTab === 'manual-payments' ? 'is-active' : ''} onClick={() => setSubTab('manual-payments')}>
          Manual County Payments
        </button>
      </div>

      {subTab === 'scouts' ? <ScoutsList token={token} /> : <ScoutManualPayments token={token} />}
    </section>
  );
}

function ScoutsList({ token }) {
  const [scouts, setScouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api
      .listAllScouts(token)
      .then((res) => setScouts(res.scouts || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load scouts.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [token]);

  async function toggleStatus(scout) {
    const nextStatus = scout.is_active ? 'suspended' : 'active';
    if (!window.confirm(`${nextStatus === 'suspended' ? 'Suspend' : 'Activate'} ${scout.full_name}?`)) return;
    setBusyId(scout.id);
    setError('');
    try {
      await api.setScoutStatus(scout.id, { status: nextStatus }, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (error) return <p className="modal-error">{error}</p>;
  if (scouts.length === 0) return <p>No scouts yet.</p>;

  return (
    <div className="statistics-panel__county-table-wrap">
      <table className="statistics-panel__county-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Active counties</th>
            <th>Joined</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {scouts.map((s) => (
            <tr key={s.id}>
              <td>{s.full_name}</td>
              <td>{s.phone}</td>
              <td>{s.email || '—'}</td>
              <td>{s.activeCounties}</td>
              <td>{new Date(s.created_at).toLocaleDateString('en-GB')}</td>
              <td>{s.is_active ? 'Active' : 'Suspended'}</td>
              <td>
                <button disabled={busyId === s.id} onClick={() => toggleStatus(s)} style={s.is_active ? { color: '#B3261E' } : {}}>
                  {s.is_active ? 'Suspend' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoutManualPayments({ token }) {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  function load() {
    setLoading(true);
    api
      .listScoutManualCountyPayments(statusFilter, token)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load payments.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [statusFilter, token]);

  async function handleConfirm(id) {
    setBusyId(id);
    setError('');
    try {
      await api.confirmScoutManualCountyPayment(id, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to confirm.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id) {
    setBusyId(id);
    setError('');
    try {
      await api.rejectScoutManualCountyPayment(id, rejectReason.trim(), token);
      setRejectingId(null);
      setRejectReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this payment record permanently? This cannot be undone.')) return;
    setBusyId(id);
    setError('');
    try {
      await api.deleteScoutManualCountyPayment(id, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="admin-tabs" style={{ marginBottom: '1rem' }}>
        {['pending', 'confirmed', 'rejected', 'all'].map((s) => (
          <button key={s} className={statusFilter === s ? 'is-active' : ''} onClick={() => setStatusFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="modal-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>No {statusFilter === 'all' ? '' : statusFilter} payment submissions.</p>
      ) : (
        <div className="statistics-panel__county-table-wrap">
          <table className="statistics-panel__county-table">
            <thead>
              <tr>
                <th>Scout</th>
                <th>County</th>
                <th>Transaction code</th>
                <th>Amount</th>
                <th>Paid by</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <React.Fragment key={item.id}>
                  <tr>
                    <td>{item.scouts?.full_name || '—'}<br /><small>{item.scouts?.phone}</small></td>
                    <td>{item.county}</td>
                    <td>{item.transaction_code}</td>
                    <td>KES {Number(item.amount_paid).toLocaleString()}</td>
                    <td>{item.mpesa_payer_name}<br /><small>{item.mpesa_payer_phone}</small></td>
                    <td>{new Date(item.submitted_at).toLocaleString('en-GB')}</td>
                    <td>{item.status}</td>
                    <td>
                      {item.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button disabled={busyId === item.id} onClick={() => handleConfirm(item.id)}>Confirm</button>
                          <button disabled={busyId === item.id} onClick={() => setRejectingId(rejectingId === item.id ? null : item.id)}>Reject</button>
                          <button disabled={busyId === item.id} onClick={() => handleDelete(item.id)} style={{ color: '#B3261E' }}>Delete</button>
                        </div>
                      ) : (
                        <button disabled={busyId === item.id} onClick={() => handleDelete(item.id)} style={{ color: '#B3261E' }}>Delete</button>
                      )}
                    </td>
                  </tr>
                  {rejectingId === item.id && (
                    <tr>
                      <td colSpan={8}>
                        <input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason for rejection"
                          style={{ width: '60%', marginRight: 8 }}
                        />
                        <button disabled={busyId === item.id} onClick={() => handleReject(item.id)}>Submit rejection</button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
