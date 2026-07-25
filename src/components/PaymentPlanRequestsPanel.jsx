import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import './StatisticsPanel.css';
import '../pages/TenantPortal.css';

/**
 * FEATURE: landlord/manager worklist for tenant-proposed payment
 * plans - approve/decline in-app, same pattern as DisputesPanel.
 */
export default function PaymentPlanRequestsPanel({ token }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('pending'); // pending | approved | declined | all
  const [decidingId, setDecidingId] = useState(null);
  const [noteDraft, setNoteDraft] = useState({}); // requestId -> note text

  function load() {
    setLoading(true);
    setError('');
    api
      .listPaymentPlanRequests(filter === 'all' ? {} : { status: filter }, token)
      .then((res) => setRequests(res.requests || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load payment plan requests.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filter]);

  async function handleDecide(requestId, decision) {
    setDecidingId(requestId);
    try {
      await api.decidePaymentPlanRequest(requestId, decision, noteDraft[requestId] || '', token);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record decision.');
    } finally {
      setDecidingId(null);
    }
  }

  if (loading) return <section className="statistics-panel"><Skeleton rows={4} /></section>;

  return (
    <section className="statistics-panel">
      <div className="tenant-section__header-row">
        <h2>Payment plan requests</h2>
        <div className="dispute-filter-tabs">
          {['pending', 'approved', 'declined', 'all'].map((f) => (
            <button
              key={f}
              type="button"
              className={`ghost-link ${filter === f ? 'is-active' : ''}`}
              style={filter === f ? { fontWeight: 700, textDecoration: 'underline' } : undefined}
              onClick={() => setFilter(f)}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="modal-error">{error}</p>}

      {requests.length === 0 ? (
        <p className="tenant-portal-hint">{filter === 'pending' ? 'No requests waiting on a decision.' : 'Nothing here.'}</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {requests.map((r) => (
            <div key={r.id} className="rent-breakdown" style={{ padding: 14 }}>
              <div className="rent-breakdown__row">
                <span><strong>{r.tenants?.full_name || 'Tenant'}</strong> · {r.units?.unit_name || '—'}</span>
                <span>KES {Number(r.total_amount).toLocaleString()}</span>
              </div>
              {r.reason && <p className="tenant-portal-hint">"{r.reason}"</p>}
              <div className="paybill-pending__details">
                {(r.installments || []).map((inst, i) => (
                  <div key={i}>
                    <span>Installment {i + 1}</span>
                    <span>KES {Number(inst.amount).toLocaleString()} by {new Date(inst.dueDate).toLocaleDateString('en-GB')}</span>
                  </div>
                ))}
              </div>

              {r.status === 'pending' ? (
                <>
                  <textarea
                    rows={2}
                    placeholder="Note to tenant (optional)"
                    value={noteDraft[r.id] || ''}
                    onChange={(e) => setNoteDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    style={{ width: '100%', marginTop: 10 }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <Button variant="mpesa" loading={decidingId === r.id} onClick={() => handleDecide(r.id, 'approved')}>Approve</Button>
                    <Button variant="ghost" loading={decidingId === r.id} onClick={() => handleDecide(r.id, 'declined')}>Decline</Button>
                  </div>
                </>
              ) : (
                <p className="tenant-portal-hint" style={{ marginTop: 8 }}>
                  {r.status === 'approved' ? '✅ Approved' : r.status === 'declined' ? '❌ Declined' : r.status}
                  {r.decision_note ? ` — ${r.decision_note}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
