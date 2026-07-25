import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';

// FEATURE (direct request: scout referral payout tracking). An admin's
// "owed to scouts" queue - every referral that's been credited as a
// real placement (scout_referrals.status = 'placed') but not yet
// marked as paid out. Marking one paid here is purely a record of
// "this was paid, however it happened" - it does not move any real
// money itself.
export default function AdminScoutPayoutsPanel({ token }) {
  const [payouts, setPayouts] = useState(null);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState(null); // referral id currently in the pay form
  const [amountDraft, setAmountDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    api
      .listPendingScoutPayouts(token)
      .then(setPayouts)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load pending payouts.'));
  }

  async function handleMarkPaid(referralId) {
    if (!amountDraft || Number(amountDraft) <= 0) {
      setError('Enter the amount actually paid to this scout.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.markScoutPayoutPaid(referralId, { amount: Number(amountDraft), note: noteDraft }, token);
      setPayingId(null);
      setAmountDraft('');
      setNoteDraft('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to mark payout as paid.');
    } finally {
      setSubmitting(false);
    }
  }

  if (payouts === null && !error) return <p>Loading pending scout payouts…</p>;

  return (
    <section style={{ marginBottom: 24 }}>
      <h2>Scout payouts owed</h2>
      <p className="tenant-portal-hint" style={{ marginTop: -6 }}>
        Referrals credited as real placements, not yet marked as paid out to the scout.
      </p>
      {error && <p className="login-page__error" role="alert">{error}</p>}
      {payouts && payouts.length === 0 ? (
        <p className="tenant-portal-hint">Nothing owed right now — all credited placements have been paid out.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {(payouts || []).map((p) => (
            <div key={p.id} style={{ border: '1px solid #eee', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{p.scouts?.full_name || 'Scout'}</strong>
                  <span style={{ color: '#888' }}> — {p.scouts?.phone}</span>
                  <div style={{ color: '#666', fontSize: '0.9em' }}>
                    {p.units?.unit_name || 'Unit'} for {p.landlords?.full_name || 'landlord'}, placed {new Date(p.placed_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
                {payingId !== p.id && (
                  <button type="button" onClick={() => { setPayingId(p.id); setAmountDraft(''); setNoteDraft(''); setError(''); }}>
                    Mark as paid
                  </button>
                )}
              </div>

              {payingId === p.id && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="form-field" style={{ marginBottom: 0 }}>
                    <label className="form-field__label">Amount paid (KES)</label>
                    <input type="number" min="1" value={amountDraft} onChange={(e) => setAmountDraft(e.target.value)} />
                  </div>
                  <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                    <label className="form-field__label">Note (optional)</label>
                    <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="e.g. paid via M-Pesa 24/7" />
                  </div>
                  <Button variant="primary" loading={submitting} onClick={() => handleMarkPaid(p.id)}>Confirm paid</Button>
                  <button type="button" className="button-secondary" onClick={() => setPayingId(null)}>Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
