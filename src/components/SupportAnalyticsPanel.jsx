import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import './SupportAnalyticsPanel.css';
import InfoTip from './InfoTip.jsx';

const ROLE_LABELS = { tenant: 'Tenant', landlord: 'Landlord', manager: 'Manager', caretaker: 'Caretaker', admin: 'Admin' };
const REASON_LABELS = {
  user_requested: 'User requested agent',
  dissatisfaction: 'Dissatisfaction detected',
  menu_exhausted: 'All automated options exhausted',
  repetition: 'Repeated question',
};
function reasonLabel(reason) {
  if (REASON_LABELS[reason]) return REASON_LABELS[reason];
  if (reason?.startsWith('always_escalate_topic:')) {
    const topic = reason.split(':')[1];
    return `Always-escalate topic: ${topic?.replace(/_/g, ' ')}`;
  }
  return reason || 'Unknown';
}

// Section 8 - how many support conversations get redirected to a call
// with an agent, so the product owner can see support load/trends.
export default function SupportAnalyticsPanel({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSupportAnalytics(token)
      .then(setData)
      .catch(() => setError('Failed to load support analytics.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="support-analytics__loading">Loading…</p>;
  if (error) return <p className="support-analytics__error">{error}</p>;
  if (!data) return null;

  return (
    <div className="support-analytics">
      <h2>Support Analytics</h2>
      <InfoTip text={<>How often the AI support chat hands off to a live agent call.</>} />

      <div className="support-analytics__counts">
        <div className="support-analytics__count-card">
          <span className="support-analytics__count-number">{data.dailyCount}</span>
          <span>Today</span>
        </div>
        <div className="support-analytics__count-card">
          <span className="support-analytics__count-number">{data.weeklyCount}</span>
          <span>This week</span>
        </div>
        <div className="support-analytics__count-card">
          <span className="support-analytics__count-number">{data.monthlyCount}</span>
          <span>This month</span>
        </div>
        {data.averageRating != null && (
          <div className="support-analytics__count-card">
            <span className="support-analytics__count-number">{data.averageRating} ★</span>
            <span>Avg. call rating</span>
          </div>
        )}
      </div>

      <div className="support-analytics__breakdowns">
        <div>
          <h3>By role</h3>
          <ul>
            {Object.entries(data.byRole).map(([role, count]) => (
              <li key={role}><span>{ROLE_LABELS[role] || role}</span><strong>{count}</strong></li>
            ))}
            {Object.keys(data.byRole).length === 0 && <li className="support-analytics__empty">No escalations yet.</li>}
          </ul>
        </div>
        <div>
          <h3>By reason</h3>
          <ul>
            {Object.entries(data.byReason).map(([reason, count]) => (
              <li key={reason}><span>{reasonLabel(reason)}</span><strong>{count}</strong></li>
            ))}
            {Object.keys(data.byReason).length === 0 && <li className="support-analytics__empty">No escalations yet.</li>}
          </ul>
        </div>
      </div>

      <h3>Recent escalations</h3>
      {data.recent.length === 0 ? (
        <p className="support-analytics__empty">Nothing yet.</p>
      ) : (
        <ul className="support-analytics__recent-list">
          {data.recent.map((e) => (
            <li key={e.id}>
              <div>
                <strong>{ROLE_LABELS[e.role_level === 'caretaker' ? 'caretaker' : e.user_type] || e.user_type}</strong>
                <span className="support-analytics__recent-reason">{reasonLabel(e.reason)}</span>
              </div>
              <div className="support-analytics__recent-meta">
                <span>{new Date(e.created_at).toLocaleString()}</span>
                {e.rating_stars && <span>{e.rating_stars}★ ({e.rating_label})</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
