import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';

/**
 * FEATURE (direct request: scout/referral gamification - "scout
 * portal is the least developed, gives scouts a reason to check back
 * in"): a top-10 leaderboard ranked by confirmed placements (shares
 * are only a tiebreaker - placements are the number that actually
 * justifies the subscription, same weighting ScoutStatsPanel already
 * gives them), plus milestone badges at 1/5/10/25 placements. Backed
 * by GET /scout/leaderboard.
 */
export default function ScoutLeaderboardPanel({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getScoutLeaderboard(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the leaderboard.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p>Loading leaderboard…</p>;
  if (error) return <p className="login-page__error" role="alert">{error}</p>;
  if (!data) return null;

  const { leaderboard = [], me, milestones = [] } = data;

  return (
    <section style={{ marginBottom: 24 }}>
      <h2>Leaderboard</h2>

      {me && (
        <div style={{ border: '2px solid #2E7D32', background: '#E8F5E9', borderRadius: 10, padding: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: '0.8em', color: '#2E7D32' }}>Your rank</div>
            <div style={{ fontSize: '1.6em', fontWeight: 700, color: '#2E7D32' }}>#{me.rank}</div>
          </div>
          <div style={{ fontSize: '0.85em', color: '#2E7D32' }}>
            {me.placements} placement{me.placements === 1 ? '' : 's'} · {me.shared} shared
          </div>
          {me.milestone && (
            <span style={{ fontSize: '0.78em', padding: '4px 12px', borderRadius: 12, background: '#2E7D32', color: '#fff', fontWeight: 600 }}>
              🏅 {me.milestone}
            </span>
          )}
        </div>
      )}

      {leaderboard.length === 0 ? (
        <p className="tenant-portal-hint">No referrals shared yet — be the first on the board.</p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {leaderboard.map((s) => (
            <div
              key={s.scoutId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                border: '1px solid #eee',
                borderRadius: 8,
                padding: '8px 14px',
                background: me && s.scoutId === me.scoutId ? '#F1F8E9' : undefined,
              }}
            >
              <span style={{ fontWeight: 700, width: 28, textAlign: 'center', color: s.rank <= 3 ? '#B85C00' : '#999' }}>
                {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`}
              </span>
              <span style={{ flex: 1, fontWeight: 600 }}>{s.name}</span>
              {s.milestone && (
                <span style={{ fontSize: '0.72em', padding: '2px 8px', borderRadius: 10, background: '#E8F5E9', color: '#2E7D32' }}>
                  {s.milestone}
                </span>
              )}
              <span style={{ fontSize: '0.85em', color: '#666' }}>{s.placements} placed</span>
            </div>
          ))}
        </div>
      )}

      {milestones.length > 0 && (
        <p className="tenant-portal-hint" style={{ marginTop: 10 }}>
          Milestones: {milestones.slice().reverse().map((m) => `${m.label} at ${m.threshold}+`).join(' · ')}.
        </p>
      )}
    </section>
  );
}
