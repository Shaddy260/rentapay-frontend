import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import './AdminBaCompletedPayments.css';

/**
 * BA Monthly Payment Details & Payout Workflow - Phase 4.
 *
 * Read-only Completed tab: paid cards browsable/filterable by the
 * month each card originally belonged to, summary totals (count paid
 * + total KES disbursed) for the selected month, and a Download
 * action that generates the payout PDF for the selection - reusing
 * the existing Payout Run PDF look, fed from this completed-
 * submissions data instead of the qualification-report snapshot.
 */
function fmtKes(amount) {
  return `KES ${Number(amount || 0).toLocaleString('en-KE')}`;
}

export default function AdminBaCompletedPayments({ token }) {
  const [periods, setPeriods] = useState(null);
  const [periodsError, setPeriodsError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // 'all' | 'YYYY-MM'

  const [cards, setCards] = useState(null);
  const [totals, setTotals] = useState({ count: 0, totalAmount: 0 });
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const loadPeriods = useCallback(() => {
    api
      .getBaCompletedPeriods(token)
      .then((res) => setPeriods(res.periods || []))
      .catch((err) => setPeriodsError(err instanceof ApiError ? err.message : 'Failed to load completed months.'));
  }, [token]);

  const loadCompleted = useCallback(() => {
    setError('');
    setCards(null);
    api
      .getBaCompletedPayments(selectedPeriod === 'all' ? null : selectedPeriod, token)
      .then((res) => {
        setCards(res.cards || []);
        setTotals(res.totals || { count: 0, totalAmount: 0 });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load completed payments.'));
  }, [selectedPeriod, token]);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);
  useEffect(() => { loadCompleted(); }, [loadCompleted]);

  async function downloadPdf() {
    setDownloading(true);
    setError('');
    try {
      await api.downloadBaCompletedPayoutPdf(selectedPeriod === 'all' ? null : selectedPeriod, token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download the payout PDF.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="admin-ba-completed">
      <div className="admin-ba-completed__toolbar">
        <label className="admin-ba-completed__period-label" htmlFor="admin-ba-completed-period">
          Month
        </label>
        <select
          id="admin-ba-completed-period"
          className="admin-ba-completed__period-select"
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
        >
          <option value="all">All months</option>
          {(periods || []).map((p) => (
            <option key={p.periodKey} value={p.periodKey}>
              {p.periodKey} — {p.count} paid · {fmtKes(p.totalAmount)}
            </option>
          ))}
        </select>
        <Button variant="ghost" onClick={downloadPdf} disabled={downloading || !cards || cards.length === 0}>
          {downloading ? 'Downloading…' : 'Download PDF'}
        </Button>
      </div>

      {periodsError && <p className="admin-ba-completed__error">{periodsError}</p>}
      {periods && periods.length === 0 && <p className="admin-ba-completed__empty">No completed payments yet.</p>}

      <div className="admin-ba-completed__summary">
        <div><strong>{totals.count}</strong> paid</div>
        <div><strong>{fmtKes(totals.totalAmount)}</strong> disbursed</div>
      </div>

      {error && <p className="admin-ba-completed__error">{error}</p>}
      {!cards && !error && <Skeleton height="200px" />}
      {cards && cards.length === 0 && !error && (
        <p className="admin-ba-completed__empty">No completed payments for this selection.</p>
      )}

      {cards && cards.length > 0 && (
        <ul className="admin-ba-completed__list">
          {cards.map((c) => (
            <li key={c.submissionId} className="admin-ba-completed__row">
              <div className="admin-ba-completed__row-main">
                <strong>{c.baName}</strong>
                {c.baCode && <span className="admin-ba-completed__ba-code">({c.baCode})</span>}
                <span className="admin-ba-completed__period-tag">{c.periodKey}</span>
              </div>
              <div className="admin-ba-completed__row-sub">{c.submittedEmail} · {c.mpesaNumber}</div>
              <div className="admin-ba-completed__row-sub">
                {c.landlordsOnboarded} onboarded
                {c.commissionPercentage != null ? ` · ${c.commissionPercentage}%` : ''}
                {' · '}paid {c.paidAt ? new Date(c.paidAt).toLocaleDateString('en-GB') : '—'}
              </div>
              <div className="admin-ba-completed__row-amount">{fmtKes(c.amountOwed)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
