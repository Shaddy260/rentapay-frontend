import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import ChatWidget from './ChatWidget.jsx';
import Skeleton from './Skeleton.jsx';
import './StatisticsPanel.css';
import '../pages/TenantPortal.css';

/**
 * FEATURE: "Disputed" worklist for the landlord/manager side - the
 * last missing piece of "Dispute a charge". Every open charge_disputes
 * row across the account, so the landlord doesn't have to remember
 * which chat threads had a complaint buried in them. Resolving here
 * clears it off this list and off the "Disputed" badge on the
 * payment row in PaymentHistoryPanel/TenantPortal (both read the same
 * GET /api/disputes?status=open on their own load()).
 */
export default function DisputesPanel({ token, role = 'landlord' }) {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('open'); // open | resolved | all
  const [chatThread, setChatThread] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveNote, setResolveNote] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api
      .listDisputes(filter === 'all' ? {} : { status: filter }, token)
      .then((res) => setDisputes(res.disputes || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load disputes.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filter]);

  async function handleResolve(disputeId) {
    setResolvingId(disputeId);
    try {
      await api.resolveDispute(disputeId, resolveNote.trim(), token);
      setDisputes((prev) => prev.filter((d) => d.id !== disputeId));
      setResolveNote('');
      window.dispatchEvent(new Event('rentapay:pending-payments-changed'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resolve dispute.');
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) return <section className="statistics-panel"><Skeleton rows={4} /></section>;

  return (
    <section className="statistics-panel">
      <div className="tenant-section__header-row">
        <h2>Disputed charges</h2>
        <div className="dispute-filter-tabs">
          {['open', 'resolved', 'all'].map((f) => (
            <button
              key={f}
              type="button"
              className={`ghost-link ${filter === f ? 'is-active' : ''}`}
              style={filter === f ? { fontWeight: 700, textDecoration: 'underline' } : undefined}
              onClick={() => setFilter(f)}
            >
              {f === 'open' ? 'Open' : f === 'resolved' ? 'Resolved' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="modal-error">{error}</p>}

      {disputes.length === 0 ? (
        <p className="tenant-portal-hint">
          {filter === 'open' ? 'No open disputes. Nice and quiet.' : 'Nothing here.'}
        </p>
      ) : (
        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr><th>Raised</th><th>Tenant</th><th>Payment</th><th>Reason</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id}>
                  <td>{d.created_at ? new Date(d.created_at).toLocaleDateString('en-GB') : '—'}</td>
                  <td>{d.tenants?.full_name || '—'}</td>
                  <td>
                    {d.payments ? (
                      <>
                        KES {Number(d.payments.amount).toLocaleString()}
                        {d.payments.paid_at ? ` · ${new Date(d.payments.paid_at).toLocaleDateString('en-GB')}` : ''}
                      </>
                    ) : '—'}
                  </td>
                  <td>{d.reason || <span className="tenant-portal-hint">No reason given</span>}</td>
                  <td><span className={`payment-status payment-status--${d.status === 'open' ? 'pending' : 'completed'}`}>{d.status}</span></td>
                  <td className="u-flex-row">
                    <button
                      type="button"
                      className="ghost-link"
                      onClick={() =>
                        setChatThread({
                          threadType: 'landlord_tenant',
                          landlordId: d.landlord_id,
                          tenantId: d.tenant_id,
                          name: d.tenants?.full_name || 'Tenant',
                        })
                      }
                    >
                      View conversation
                    </button>
                    {d.status === 'open' && (
                      <Button
                        variant="ghost"
                        loading={resolvingId === d.id}
                        onClick={() => handleResolve(d.id)}
                      >
                        Mark resolved
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {chatThread && (
        <ChatWidget
          token={token}
          role={role}
          hideLauncher
          controlledOpen
          onOpenChange={(open) => !open && setChatThread(null)}
          directThread={chatThread}
        />
      )}
    </section>
  );
}
