// src/pages/ReceiptVerify.jsx
//
// FIX (spec item 2.1): the QR code printed on every payment receipt
// (see backend/pdfReport.service.js) has always pointed at
// `${FRONTEND_URL}/verify/:paymentId` - there was just no route or
// page here to catch it, so scanning it fell through the app's
// catch-all route and bounced straight to /login. This is that page:
// a no-login landing view that confirms the receipt is authentic and
// shows its key details. Modeled on SharedReputation.jsx, the other
// no-login "resolve a link, show a summary" page in the app.
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';

const KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

const PAYMENT_METHOD_LABELS = {
  stk_push: 'M-Pesa (Send Money)',
  paybill: 'M-Pesa Paybill',
  till: 'M-Pesa Till Number',
  manual: 'Recorded manually',
};

export default function ReceiptVerify() {
  const { paymentId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.verifyReceipt(paymentId);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err.message || 'This receipt could not be verified.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paymentId]);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px', fontFamily: 'inherit' }}>
      <Link to="/" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>&larr; RentaPay</Link>

      {loading && <p style={{ marginTop: 24 }}>Verifying receipt…</p>}

      {!loading && error && (
        <div style={{ marginTop: 24, padding: 16, background: 'var(--color-error-bg)', border: '1px solid var(--color-hairline)', borderRadius: 10 }}>
          <p style={{ margin: 0, color: '#a33' }}>{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'var(--color-success-bg)', border: '1px solid var(--color-hairline)', borderRadius: 12, marginBottom: 20 }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#2e7d32', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>✓</span>
            <div>
              <div style={{ fontWeight: 700, color: '#1f7a3f' }}>Receipt verified</div>
              <div style={{ fontSize: 13, color: '#666' }}>Receipt No. {data.receiptNumber}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 12, color: '#888', letterSpacing: 0.5 }}>AMOUNT PAID</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: '#2e7d32' }}>{KES(data.amount)}</div>
          </div>

          <div style={{ padding: '10px 14px', background: 'var(--color-surface-subtle)', fontSize: 14, borderRadius: 10, border: '1px solid var(--color-hairline)', marginBottom: 8 }}>
            <div style={{ color: '#666', marginBottom: 4 }}>Rent period</div>
            <strong style={{ lineHeight: 1.5 }}>{data.rentPeriod || '-'}</strong>
          </div>

          <div style={{ display: 'grid', gap: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid #eee' }}>
            {[
              ['Date paid', data.paidAt ? new Date(data.paidAt).toLocaleString('en-GB') : '-'],
              ['Payment method', PAYMENT_METHOD_LABELS[data.paymentMethod] || data.paymentMethod || '-'],
              ['Tenant', data.tenantName || '-'],
              ['Unit', data.unitName || '-'],
              ['Property', data.propertyName || '-'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-surface-subtle)', fontSize: 14 }}>
                <span style={{ color: '#666' }}>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 24, fontSize: 12, color: '#999' }}>
            This confirms a completed payment on RentaPay. No account or login is needed to view this page.
          </p>
        </div>
      )}
    </div>
  );
}
