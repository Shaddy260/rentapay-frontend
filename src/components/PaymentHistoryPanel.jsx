import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import { downloadCsv } from '../utils/downloadCsv.js';
import DisputeChargeButton from './DisputeChargeButton.jsx';
import Skeleton from './Skeleton.jsx';
import { pollExportAndDownload } from '../utils/exportDownload.js';
import './StatisticsPanel.css';
import '../pages/TenantPortal.css';

/**
 * Full, all-time "Payment History" for the landlord/manager portal -
 * requested to live in the menu (not buried in a Quick Action) and be
 * downloadable, matching the tenant portal's equivalent. Backed by
 * GET /api/payments/history (see payment.controller.js).
 */
export default function PaymentHistoryPanel({ token, role = 'landlord', propertyId, propertyIdReady = true, canDelete = true, isCaretaker = false }) {
  const [payments, setPayments] = useState([]);
  const [disputedPaymentIds, setDisputedPaymentIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    // BUG FIX: the parent (Dashboard.jsx) starts with activePropertyId
    // === null while it's still resolving which property to show, then
    // sets the real id a moment later. Without this guard, this effect
    // fired once with propertyId=null - which the backend correctly
    // reads as "no property filter, show every apartment's payments" -
    // and only THEN re-fired with the real, scoped propertyId. That's
    // the "shows 11 payments (one from a different apartment) then
    // blinks down to 10" bug: it wasn't a data bug, it was a real,
    // unscoped fetch briefly rendering before the scoped one replaced
    // it. propertyIdReady lets the parent tell us "I haven't resolved
    // the active property yet" so we skip fetching entirely until then,
    // instead of ever doing an unscoped fetch by accident.
    if (!propertyIdReady) return undefined;
    // Role Permissions spec (Section 3): Payment History is in the
    // caretaker "no access at all, not even read-only" list. The
    // backend now 403s both GET /payments/history and GET /disputes
    // for a caretaker token, so skip the fetch entirely.
    if (isCaretaker) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getPaymentHistoryFull(token, propertyId),
      // Fail-soft: a hiccup on the disputes lookup shouldn't take the
      // whole payment history panel down with it, just leave every
      // row's dispute badge un-set for this load.
      api.listDisputes({ status: 'open' }, token).catch(() => ({ disputes: [] })),
    ])
      .then(([historyRes, disputesRes]) => {
        if (cancelled) return;
        setPayments(historyRes.payments || []);
        setDisputedPaymentIds(new Set((disputesRes.disputes || []).map((d) => d.payment_id)));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load payment history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, propertyId, propertyIdReady, isCaretaker]);

  // FIX (direct request): "the landlord and manager should be able to
  // delete a payment history entry - and when they do it deletes for
  // all" - a real delete, gone from everyone's view (landlord's,
  // manager's, and the tenant's own payment history), not a hide.
  async function handleDelete(paymentId) {
    if (!window.confirm('Permanently delete this payment record? This removes it for everyone, including the tenant\'s own payment history, and cannot be undone.')) return;
    setDeletingId(paymentId);
    setError('');
    try {
      await api.deletePayment(paymentId, token);
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete that payment.');
    } finally {
      setDeletingId(null);
    }
  }

  function handleDownload() {
    downloadCsv(
      'rentapay-payment-history',
      ['Date', 'Tenant', 'Unit', 'Amount (KES)', 'Method', 'Status'],
      payments.map((p) => [
        p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '-',
        p.tenants?.full_name || '-',
        p.units?.unit_name || '-',
        p.amount,
        (p.payment_method || '').replace('_', ' '),
        p.status,
      ])
    );
  }

  // DIRECT REQUEST: bulk-download every completed payment's official
  // receipt as one zip, for record-keeping. Phase 2: this now runs as
  // a queued background export (the worker builds the zip and uploads
  // it to Supabase Storage; we download the signed URL when ready)
  // instead of blocking the API process. If the deployment has no
  // worker configured, the API answers 503 and the message is shown.
  const [receiptsJob, setReceiptsJob] = useState(null); // null | { status, error }
  const receiptsRunning = ['creating', 'queued', 'processing'].includes(receiptsJob?.status);
  async function handleDownloadAllReceipts() {
    setError('');
    setReceiptsJob({ status: 'creating' });
    try {
      const created = await api.createReceiptsZipJob(
        { propertyId: propertyId && propertyId !== 'unassigned' ? propertyId : undefined },
        token
      );
      setReceiptsJob({ status: 'queued' });
      await pollExportAndDownload(created.exportJobId, token, {
        onStatus: (status) => setReceiptsJob({ status }),
      });
      setReceiptsJob(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download receipts.');
      setReceiptsJob((j) => (j ? { ...j, status: 'failed' } : null));
    }
  }

  // Section 6: single-payment receipt download, same manual-trigger
  // pattern as the tenant portal - the landlord/manager only ever gets
  // the receipt document when they tap this themselves, never pushed
  // automatically.
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);
  async function handleDownloadReceipt(paymentId) {
    setDownloadingReceiptId(paymentId);
    setError('');
    try {
      await api.downloadReceiptPdf(paymentId, token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate receipt.');
    } finally {
      setDownloadingReceiptId(null);
    }
  }

  if (isCaretaker) {
    return (
      <section className="statistics-panel">
        <h2>Payment History</h2>
        <p className="tenant-portal-hint">
          This section isn't available to caretaker accounts. Contact the landlord or property manager for payment history.
        </p>
      </section>
    );
  }

  if (loading && payments.length === 0) return <section className="statistics-panel"><Skeleton rows={4} /></section>;
  if (error) return <section className="statistics-panel"><p className="modal-error">{error}</p></section>;

  return (
    <section className="statistics-panel">
      <div className="tenant-section__header-row">
        <h2>Payment History</h2>
        {payments.length > 0 && (
          <div className="u-flex-row" style={{ gap: 8 }}>
            <button className="ghost-link" data-download-fx onClick={handleDownload}>Download</button>
            <button className="ghost-link" data-download-fx onClick={handleDownloadAllReceipts} disabled={receiptsRunning}>
              {receiptsRunning ? 'Preparing…' : 'Download all receipts'}
            </button>
          </div>
        )}
      </div>
      {payments.length === 0 ? (
        <p className="tenant-portal-hint">No payments recorded yet.</p>
      ) : (
        <div className="payment-history-panel__scroll">
        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr><th>Date</th><th>Tenant</th><th>Unit</th><th>Amount</th><th>Method</th><th>Status</th><th></th><th></th>{canDelete && <th></th>}</tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '-'}</td>
                  <td>{p.tenants?.full_name || '-'}</td>
                  <td>{p.units?.unit_name || '-'}</td>
                  <td>KES {Number(p.amount).toLocaleString()}</td>
                  <td>{(p.payment_method || '').replace('_', ' ')}</td>
                  <td><span className={`payment-status payment-status--${p.status}`}>{p.status}</span></td>
                  <td>
                    {p.status === 'completed' && (
                      <button
                        type="button"
                        className="ghost-link"
                        data-download-fx
                        disabled={downloadingReceiptId === p.id}
                        onClick={() => handleDownloadReceipt(p.id)}
                      >
                        {downloadingReceiptId === p.id ? 'Preparing…' : 'Receipt'}
                      </button>
                    )}
                  </td>
                  <td>
                    <DisputeChargeButton
                      token={token}
                      role={role}
                      paymentId={p.id}
                      initiallyDisputed={disputedPaymentIds.has(p.id)}
                      threadName={p.tenants?.full_name || 'Tenant'}
                      landlordId={p.landlord_id}
                      tenantId={p.tenant_id}
                    />
                  </td>
                  {canDelete && (
                    <td>
                      <button
                        type="button"
                        className="ghost-link u-text-error"
                        disabled={deletingId === p.id}
                        onClick={() => handleDelete(p.id)}
                      >
                        {deletingId === p.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </section>
  );
}
