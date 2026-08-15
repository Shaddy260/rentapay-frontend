import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import ModalShell from './ModalShell.jsx';
import './AdminBaRewardsDashboard.css';

const KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

/**
 * Premium Redesign Plan - Phase 8: Admin BA Performance & Rewards
 * Dashboard.
 *
 * Leaderboard ranked by NET REVENUE CONTRIBUTION (total paid by a BA's
 * onboarded landlords, minus commission already paid to that BA) - not
 * by landlord count. Admin can select one or several BAs and grant a
 * time-bound custom commission reward, which auto-reverts to the
 * universal default rate once the period elapses.
 */
export default function AdminBaRewardsDashboard({ token }) {
  const [view, setView] = useState('leaderboard'); // 'leaderboard' | 'history'

  const [leaderboard, setLeaderboard] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [showRewardModal, setShowRewardModal] = useState(false);

  const loadLeaderboard = useCallback(() => {
    setLeaderboard(null);
    setLoadError('');
    api
      .getBaRewardsLeaderboard(token)
      .then((res) => setLeaderboard(res.leaderboard || []))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load the leaderboard.'));
  }, [token]);

  const loadHistory = useCallback(() => {
    setHistory(null);
    setHistoryError('');
    api
      .getBaRewardHistory(token)
      .then((res) => setHistory(res.history || []))
      .catch((err) => setHistoryError(err instanceof ApiError ? err.message : 'Failed to load reward history.'));
  }, [token]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (view === 'history' && !history) loadHistory();
  }, [view, history, loadHistory]);

  function toggleSelect(baId) {
    setSelectedIds((prev) => (prev.includes(baId) ? prev.filter((id) => id !== baId) : [...prev, baId]));
  }

  const selectedBas = (leaderboard || []).filter((b) => selectedIds.includes(b.baId));

  return (
    <div className="admin-ba-rewards">
      <div className="admin-ba-rewards__tabs">
        <button className={`admin-ba-rewards__tab${view === 'leaderboard' ? ' admin-ba-rewards__tab--active' : ''}`} onClick={() => setView('leaderboard')}>
          Leaderboard
        </button>
        <button className={`admin-ba-rewards__tab${view === 'history' ? ' admin-ba-rewards__tab--active' : ''}`} onClick={() => setView('history')}>
          Reward history
        </button>
      </div>

      {view === 'leaderboard' && (
        <>
          <div className="admin-ba-rewards__toolbar">
            <p className="admin-ba-rewards__hint">
              Ranked by net revenue contribution. BAs not yet rewarded are surfaced first. Select one or more to grant a custom commission reward.
            </p>
            <Button variant="primary" disabled={selectedIds.length === 0} onClick={() => setShowRewardModal(true)}>
              Reward selected {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </Button>
          </div>

          {loadError && <p className="admin-ba-rewards__error">{loadError}</p>}
          {!leaderboard && !loadError && (
            <div className="admin-ba-rewards__list">
              <Skeleton height={110} />
              <Skeleton height={110} />
              <Skeleton height={110} />
            </div>
          )}
          {leaderboard && leaderboard.length === 0 && <p className="admin-ba-rewards__empty">No active Brand Ambassadors yet.</p>}

          <div className="admin-ba-rewards__list">
            {(leaderboard || []).map((ba) => (
              <label
                key={ba.baId}
                className={`admin-ba-rewards__card${ba.rank <= 3 ? ' admin-ba-rewards__card--top' : ''}${selectedIds.includes(ba.baId) ? ' admin-ba-rewards__card--selected' : ''}`}
              >
                <input type="checkbox" className="admin-ba-rewards__checkbox" checked={selectedIds.includes(ba.baId)} onChange={() => toggleSelect(ba.baId)} />
                <div className="admin-ba-rewards__card-body">
                  <div className="admin-ba-rewards__card-top">
                    <span className="admin-ba-rewards__rank">#{ba.rank}</span>
                    <span className="admin-ba-rewards__name">{ba.name}</span>
                    <span className={`admin-ba-rewards__pill${ba.neverRewarded ? ' admin-ba-rewards__pill--muted' : ' admin-ba-rewards__pill--gold'}`}>
                      {ba.neverRewarded ? 'Not yet rewarded' : `Rewarded ${ba.rewardCount}\u00d7`}
                    </span>
                  </div>
                  <p className="admin-ba-rewards__contact">
                    {ba.phone} · {ba.email}
                  </p>
                  <div className="admin-ba-rewards__stats">
                    <div>
                      <span className="admin-ba-rewards__stat-label">Onboarded (all-time)</span>
                      <span className="admin-ba-rewards__stat-value">{ba.landlordsOnboardedAllTime}</span>
                    </div>
                    <div>
                      <span className="admin-ba-rewards__stat-label">Active now</span>
                      <span className="admin-ba-rewards__stat-value">{ba.landlordsOnboardedActive}</span>
                    </div>
                    <div>
                      <span className="admin-ba-rewards__stat-label">Commission rate</span>
                      <span className="admin-ba-rewards__stat-value">{ba.commissionRate}%</span>
                    </div>
                  </div>
                  <p className="admin-ba-rewards__net">
                    Net contribution: <strong>{KES(ba.netContribution)}</strong>
                  </p>
                </div>
              </label>
            ))}
          </div>
        </>
      )}

      {view === 'history' && (
        <>
          {historyError && <p className="admin-ba-rewards__error">{historyError}</p>}
          {!history && !historyError && <Skeleton height={200} />}
          {history && history.length === 0 && <p className="admin-ba-rewards__empty">No rewards issued yet.</p>}
          <ul className="admin-ba-rewards__history-list">
            {(history || []).map((r) => (
              <li key={r.id} className="admin-ba-rewards__history-item">
                <div className="admin-ba-rewards__history-row">
                  <span className="admin-ba-rewards__history-name">
                    {r.baName} {r.baCode ? <span className="admin-ba-rewards__code">({r.baCode})</span> : null}
                  </span>
                  <span className={`admin-ba-rewards__pill${r.status === 'active' ? ' admin-ba-rewards__pill--gold' : ' admin-ba-rewards__pill--muted'}`}>
                    {r.status === 'active' ? 'Active' : 'Completed'}
                  </span>
                </div>
                <p className="admin-ba-rewards__history-meta">
                  {r.previous_percentage != null ? `${r.previous_percentage}% → ` : ''}
                  <strong>{r.new_percentage}%</strong> · {fmtDate(r.start_at)} – {fmtDate(r.end_at)}
                </p>
                <Button
                  variant="ghost"
                  className="admin-ba-rewards__pdf-btn"
                  onClick={() =>
                    api.downloadBaRewardPdf(r.batch_id, token).catch((err) => alert(err instanceof ApiError ? err.message : 'Failed to download PDF.'))
                  }
                >
                  Download reward PDF
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      {showRewardModal && (
        <RewardConfirmModal
          token={token}
          selectedBas={selectedBas}
          onClose={() => setShowRewardModal(false)}
          onDone={() => {
            setShowRewardModal(false);
            setSelectedIds([]);
            loadLeaderboard();
          }}
        />
      )}
    </div>
  );
}

function RewardConfirmModal({ token, selectedBas, onClose, onDone }) {
  const [percentage, setPercentage] = useState('');
  const [startAt, setStartAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [endAt, setEndAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { whatHappensNext, batch } once confirmed

  const defaultRate = selectedBas[0]?.commissionRate;

  async function handleConfirm() {
    setError('');
    const pct = Number(percentage);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setError('Enter a valid commission percentage between 0 and 100.');
      return;
    }
    if (!endAt || new Date(endAt) <= new Date(startAt)) {
      setError('The end date must be after the start date.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.rewardBrandAmbassadors(
        {
          baIds: selectedBas.map((b) => b.baId),
          newPercentage: pct,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
        },
        token
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to confirm the reward.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Reward selected Brand Ambassadors" onClose={onClose}>
      {!result ? (
        <div className="ba-reward-confirm">
          <div className="ba-reward-confirm__chips">
            {selectedBas.map((b) => (
              <span key={b.baId} className="ba-reward-confirm__chip">
                {b.name}
              </span>
            ))}
          </div>

          <label className="ba-reward-confirm__field">
            <span>New commission rate</span>
            <div className="ba-reward-confirm__rate-row">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                placeholder="e.g. 12"
              />
              <span className="ba-reward-confirm__default-hint">% (default is {defaultRate}%)</span>
            </div>
          </label>

          <div className="ba-reward-confirm__date-row">
            <label className="ba-reward-confirm__field">
              <span>Start date</span>
              <input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </label>
            <label className="ba-reward-confirm__field">
              <span>End date</span>
              <input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </label>
          </div>
          <p className="ba-reward-confirm__caption">
            The reward automatically reverts to the universal default commission rate once the end date passes — no manual step needed.
          </p>

          {error && <p className="admin-ba-rewards__error">{error}</p>}

          <Button variant="primary" className="ba-reward-confirm__submit" loading={saving} onClick={handleConfirm}>
            Confirm reward &amp; notify
          </Button>

          <div className="ba-reward-confirm__next">
            <p className="ba-reward-confirm__next-title">What happens next</p>
            <div className="ba-reward-confirm__next-cards">
              <span className="ba-reward-confirm__next-card">📄 PDF report generated</span>
              <span className="ba-reward-confirm__next-card">🔔 Rewarded BAs notified</span>
              <span className="ba-reward-confirm__next-card">📢 Broadcast sent to the rest of the BA base</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="ba-reward-confirm">
          <p className="ba-reward-confirm__success">Reward confirmed for {selectedBas.length} Brand Ambassador{selectedBas.length === 1 ? '' : 's'}.</p>
          <div className="ba-reward-confirm__next-cards">
            {result.whatHappensNext.map((item) => (
              <span key={item.key} className="ba-reward-confirm__next-card ba-reward-confirm__next-card--done">
                ✅ {item.label}
              </span>
            ))}
          </div>
          <div className="ba-reward-confirm__done-actions">
            <Button
              variant="ghost"
              onClick={() => api.downloadBaRewardPdf(result.batch.id, token).catch((err) => alert(err instanceof ApiError ? err.message : 'Failed to download PDF.'))}
            >
              Download PDF now
            </Button>
            <Button variant="primary" onClick={onDone}>
              Done
            </Button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
