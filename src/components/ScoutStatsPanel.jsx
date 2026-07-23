import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';

// Spec §6: "shows counts - units shared this month, landlord views,
// confirmed placements - plus a simple list of the scout's referrals
// with status badges." Placements is deliberately the biggest/most
// prominent number here - per the spec, it's the one that actually
// justifies the subscription fee, so it shouldn't be buried at the
// same visual weight as the other two.
export default function ScoutStatsPanel({ token }) {
  const [data, setData] = useState(null); // { stats, referrals }
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMyScoutReferrals(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load referral stats.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function badgeStyle(status) {
    if (status === 'placed') return { background: '#E8F5E9', color: '#2E7D32' };
    if (status === 'viewed_by_landlord') return { background: '#FFF8E1', color: '#8D6E00' };
    return { background: '#F5F5F5', color: '#555' }; // 'shared'
  }
  function badgeLabel(status) {
    if (status === 'placed') return 'Placed';
    if (status === 'viewed_by_landlord') return 'Viewed';
    return 'Shared';
  }

  if (loading) return <p>Loading your referral stats…</p>;
  if (error) return <p className="login-page__error" role="alert">{error}</p>;

  const stats = data?.stats || { sharedThisMonth: 0, landlordViews: 0, placements: 0 };
  const referrals = data?.referrals || [];

  return (
    <section style={{ marginBottom: 24 }}>
      <h2>My referrals</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: '0.8em', color: '#666' }}>Shared this month</div>
          <div style={{ fontSize: '1.6em', fontWeight: 600 }}>{stats.sharedThisMonth}</div>
        </div>
        <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: '0.8em', color: '#666' }}>Landlord views</div>
          <div style={{ fontSize: '1.6em', fontWeight: 600 }}>{stats.landlordViews}</div>
        </div>
        <div style={{ border: '2px solid #2E7D32', borderRadius: 10, padding: 14, textAlign: 'center', background: '#E8F5E9' }}>
          <div style={{ fontSize: '0.8em', color: '#2E7D32' }}>Confirmed placements</div>
          <div style={{ fontSize: '2em', fontWeight: 700, color: '#2E7D32' }}>{stats.placements}</div>
        </div>
      </div>

      {referrals.length === 0 ? (
        <p className="tenant-portal-hint">You haven't shared any units yet — tap "Share this unit" on a vacancy to start building your pipeline.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {referrals.map((r) => (
            <div
              key={r.id}
              style={{
                border: '1px solid #eee',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div>
                <strong>{r.unitName || 'Unit'}</strong>
                <div style={{ color: '#888', fontSize: '0.8em' }}>{new Date(r.sharedAt).toLocaleDateString('en-GB')}</div>
              </div>
              <span style={{ fontSize: '0.75em', padding: '2px 10px', borderRadius: 12, ...badgeStyle(r.status) }}>
                {badgeLabel(r.status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
