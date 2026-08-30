import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';
import './AdminPlatformPaymentSettings.css';

/**
 * Direct request: "strictly admin only...a way for him to change the
 * payment method that the landlords pay their amounts during
 * subscription...just like landlords themselves add their payment
 * method, and admin's one should affect the manual payments that
 * landlord pay to."
 *
 * This is the platform's OWN receiving Paybill/Till - where a
 * landlord/manager/caretaker sends their RentaPay subscription fee
 * (the "didn't receive the popup? pay manually" fallback on
 * SubscriptionManage.jsx, shown via PaymentDetailsCard.jsx). It's the
 * mirror image of a landlord's own payment_method (Settings.jsx),
 * which controls where their TENANTS' rent goes - this one controls
 * where LANDLORDS' subscription money goes, and only an admin can see
 * or change it (no General Manager access at all, unlike most other
 * admin settings).
 */
export default function AdminPlatformPaymentSettings({ token }) {
  const [data, setData] = useState(null); // { current, history }
  const [loadError, setLoadError] = useState('');

  const [method, setMethod] = useState('paybill');
  const [paybillNumber, setPaybillNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [tillNumber, setTillNumber] = useState('');
  const [note, setNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setData(null);
    setLoadError('');
    api
      .getPlatformPaymentSettings(token)
      .then((res) => setData(res))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load the current payment settings.'));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data?.current) return;
    setMethod(data.current.method || 'paybill');
    setPaybillNumber(data.current.paybill_number || '');
    setAccountNumber(data.current.account_number || '');
    setTillNumber(data.current.till_number || '');
  }, [data]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      if (method === 'paybill' && !paybillNumber.trim()) {
        setSaveError('Enter a Paybill number.');
        setSaving(false);
        return;
      }
      if (method === 'till' && !tillNumber.trim()) {
        setSaveError('Enter a Till number.');
        setSaving(false);
        return;
      }

      await api.updatePlatformPaymentSettings(
        {
          method,
          paybillNumber: method === 'paybill' ? paybillNumber.trim() : undefined,
          accountNumber: method === 'paybill' ? accountNumber.trim() : undefined,
          tillNumber: method === 'till' ? tillNumber.trim() : undefined,
          note: note.trim() || undefined,
        },
        token
      );
      setSaved(true);
      setNote('');
      setTimeout(() => setSaved(false), 2000);
      load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save the payment settings.');
    } finally {
      setSaving(false);
    }
  }

  const current = data?.current || null;
  const history = data?.history || [];

  return (
    <div className="admin-platform-payment">
      <InfoTip text={<>
        This is where every landlord's RentaPay subscription payment lands — not any individual landlord's rent
        Paybill. It's shown on the "pay manually" screen whenever the M-Pesa prompt fails or isn't received. Changing
        it here updates that screen for everyone immediately.
      </>} />

      {loadError && <p className="admin-platform-payment__error">{loadError}</p>}

      {!data ? (
        <Skeleton rows={4} />
      ) : (
        <>
          <section className="admin-platform-payment__card">
            <h3>Current receiving method</h3>
            {current ? (
              <div className="admin-platform-payment__current">
                {current.method === 'till' ? (
                  <>
                    <span className="admin-platform-payment__current-label">Till Number</span>
                    <span className="admin-platform-payment__current-value">{current.till_number || '—'}</span>
                  </>
                ) : (
                  <>
                    <span className="admin-platform-payment__current-label">Paybill Number</span>
                    <span className="admin-platform-payment__current-value">{current.paybill_number || '—'}</span>
                    <span className="admin-platform-payment__current-label u-mt-2">Account Number</span>
                    <span className="admin-platform-payment__current-value">{current.account_number || '—'}</span>
                  </>
                )}
                {current.updated_at && (
                  <p className="admin-platform-payment__meta">
                    Last changed {new Date(current.updated_at).toLocaleString('en-GB')}
                  </p>
                )}
              </div>
            ) : (
              <p className="admin-platform-payment__meta">No payment method set yet.</p>
            )}
          </section>

          <section className="admin-platform-payment__card">
            <h3>Change receiving method</h3>
            <form onSubmit={save}>
              <div className="admin-platform-payment__form-row">
                <label>
                  Method
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="paybill">Paybill</option>
                    <option value="till">Till Number</option>
                  </select>
                </label>
              </div>

              {method === 'paybill' ? (
                <div className="admin-platform-payment__form-row">
                  <label>
                    Paybill number
                    <input value={paybillNumber} onChange={(e) => setPaybillNumber(e.target.value)} placeholder="e.g. 522522" />
                  </label>
                  <label>
                    Account number
                    <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="e.g. 1341657388" />
                  </label>
                </div>
              ) : (
                <div className="admin-platform-payment__form-row">
                  <label>
                    Till number
                    <input value={tillNumber} onChange={(e) => setTillNumber(e.target.value)} placeholder="e.g. 900100" />
                  </label>
                </div>
              )}

              <div className="admin-platform-payment__form-row">
                <label className="admin-platform-payment__note-field">
                  Note (optional, for the audit log below)
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Switched banks" />
                </label>
              </div>

              {saveError && <p className="admin-platform-payment__error">{saveError}</p>}
              <div className="admin-platform-payment__actions">
                <Button type="submit" loading={saving}>{saved ? 'Saved!' : 'Save payment method'}</Button>
              </div>
            </form>
          </section>

          <section className="admin-platform-payment__card">
            <h3>Change history</h3>
            {history.length === 0 ? (
              <p className="admin-platform-payment__meta">No previous changes recorded.</p>
            ) : (
              <div className="admin-platform-payment__table-scroll">
                <table className="admin-platform-payment__history-table">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Details</th>
                      <th>Note</th>
                      <th>Changed at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id}>
                        <td>{row.method === 'till' ? 'Till' : 'Paybill'}</td>
                        <td>{row.method === 'till' ? row.till_number : `${row.paybill_number || '—'}${row.account_number ? ` · Acc ${row.account_number}` : ''}`}</td>
                        <td>{row.note || '—'}</td>
                        <td>{new Date(row.changed_at).toLocaleString('en-GB')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
