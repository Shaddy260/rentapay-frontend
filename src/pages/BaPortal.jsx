import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountMenu from '../components/AccountMenu.jsx';
import PortalSidebar from '../components/PortalSidebar.jsx';
import Skeleton from '../components/Skeleton.jsx';
import Button from '../components/Button.jsx';
import MiniBarChart from '../components/MiniBarChart.jsx';
import MiniLineChart from '../components/MiniLineChart.jsx';
import { openWhatsAppReminder } from '../utils/whatsapp.js';
import { HELP_WHATSAPP } from '../components/HelpButton.jsx';
import { initPushSubscription } from '../utils/push.js';
import { api, ApiError } from '../api/client.js';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload.jsx';
import './Settings.css';
import './BaPortal.css';

/**
 * Build spec Phase 3 - BA Portal: Login, Redirect, Shell.
 *
 * BAs log in through the exact same /login screen as everyone else
 * (see Login.jsx's post-login redirect) - this is their own portal
 * shell, following the same header/sidebar structure already used by
 * TenantPortal.jsx/Dashboard.jsx (AccountMenu, PortalSidebar, a
 * content area keyed off activeTab).
 *
 * Sidebar sections per the spec: Dashboard, My Onboarded Landlords,
 * Stats, Earnings, Leaderboard, Settings. Only Dashboard has real
 * content in this phase (the referral link, front and center, per
 * item 5) - the rest are placeholders built out in Phases 5, 6 and 18.
 */
/**
 * Phase 4, item 6 - "My Onboarded Landlords" claim-logging form + list.
 * Never discards what the BA typed on an unmatched/conflict response -
 * the form stays populated so they can correct and resubmit in place.
 */
function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Phase 5, item 2 - "My Onboarded Landlords" is date-filterable
 * (default to today, with pickers for any past day or range), and
 * shows the fuller column set the spec calls for (name, phone,
 * location, match status, qualification status, date submitted) -
 * reusing this same list/row styling (ba-claim-list) rather than
 * building new table styling from scratch, per the spec's pointer to
 * the app's existing list-component conventions.
 */
function ClaimLandlordPanel({ token }) {
  const [form, setForm] = useState({ fullName: '', phone: '', location: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { type: 'matched'|'unmatched'|'conflict', ...data }
  const [claims, setClaims] = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [dateFrom, setDateFrom] = useState(todayIsoDate());
  const [dateTo, setDateTo] = useState(todayIsoDate());
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState(null); // { type: 'ok'|'error', message }

  const loadClaims = useCallback(() => {
    setLoadingClaims(true);
    const params = {};
    if (dateFrom) params.from = `${dateFrom}T00:00:00.000Z`;
    if (dateTo) params.to = `${dateTo}T23:59:59.999Z`;
    api
      .listMyClaims(params, token)
      .then((res) => setClaims(res.claims || []))
      .catch(() => {})
      .finally(() => setLoadingClaims(false));
  }, [token, dateFrom, dateTo]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  function handleShowToday() {
    setDateFrom(todayIsoDate());
    setDateTo(todayIsoDate());
  }

  function handleShowAll() {
    setDateFrom('');
    setDateTo('');
  }

  /**
   * Phase 7 - "Share with admin" for the currently selected date/
   * range. Both delivery methods fire together from one tap, not a
   * choice between them: the backend posts the summary straight into
   * the admin notifications inbox, and its response hands back that
   * exact same text so a WhatsApp deep link (wa.me, via
   * src/utils/whatsapp.js) opens pre-filled with it too.
   */
  async function handleShareWithAdmin() {
    setSharing(true);
    setShareNotice(null);
    try {
      const params = {};
      if (dateFrom) params.from = `${dateFrom}T00:00:00.000Z`;
      if (dateTo) params.to = `${dateTo}T23:59:59.999Z`;
      const res = await api.shareClaimsReport(params, token);
      openWhatsAppReminder(HELP_WHATSAPP, res.summary);
      setShareNotice({ type: 'ok', message: `Sent to admin's inbox — ${res.count} landlord${res.count === 1 ? '' : 's'}. Finish sending it on WhatsApp too.` });
    } catch (err) {
      setShareNotice({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to share your report. Please try again.' });
    } finally {
      setSharing(false);
    }
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await api.submitLandlordClaim(form, token);
      if (res.matched) {
        setResult({ type: 'matched', landlord: res.landlord });
        setForm({ fullName: '', phone: '', location: '' });
        loadClaims();
      } else {
        setResult({ type: 'unmatched', message: res.message });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setResult({ type: 'conflict', message: err.message || 'This landlord is already linked to another ambassador.' });
      } else {
        setResult({ type: 'unmatched', message: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ba-claim-panel">
      <h2>My Onboarded Landlords</h2>
      <p className="ba-claim-panel__intro">
        Log a landlord you've onboarded in the field. We'll match them against their real RentaPay account.
      </p>

      <form className="ba-claim-form" onSubmit={handleSubmit}>
        <div className="ba-claim-form__row">
          <label>
            Full name
            <input required value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} placeholder="Jane Wanjiru" />
          </label>
          <label>
            Phone
            <input required value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="07XXXXXXXX or 2547XXXXXXXX" />
          </label>
          <label>
            Location
            <input value={form.location} onChange={(e) => updateField('location', e.target.value)} placeholder="Kileleshwa, Nairobi" />
          </label>
        </div>
        <Button type="submit" disabled={busy}>{busy ? 'Checking…' : 'Log landlord'}</Button>
      </form>

      {result?.type === 'matched' && (
        <div className="ba-claim-result ba-claim-result--matched">
          ✅ Matched: <strong>{result.landlord.fullName}</strong> — {result.landlord.unitsCount} unit{result.landlord.unitsCount === 1 ? '' : 's'}
          {result.landlord.location || result.landlord.county ? ` — ${[result.landlord.location, result.landlord.county].filter(Boolean).join(', ')}` : ''}
          {' — '}subscription {result.landlord.subscriptionStatus}
        </div>
      )}
      {result?.type === 'unmatched' && (
        <div className="ba-claim-result ba-claim-result--unmatched">⚠️ {result.message}</div>
      )}
      {result?.type === 'conflict' && (
        <div className="ba-claim-result ba-claim-result--conflict">🚫 {result.message}</div>
      )}

      <div className="ba-claim-panel__list-header">
        <h3 className="ba-claim-panel__list-heading">Your logged claims</h3>
        <div className="ba-claim-filter">
          <label>
            From
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} />
          </label>
          <label>
            To
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />
          </label>
          <button type="button" className="ba-referral-card__btn" onClick={handleShowToday}>Today</button>
          <button type="button" className="ba-referral-card__btn" onClick={handleShowAll}>All time</button>
          <button
            type="button"
            className="ba-referral-card__btn ba-referral-card__btn--whatsapp"
            onClick={handleShareWithAdmin}
            disabled={sharing || claims.length === 0}
            title="Sends this list to admin's inbox and opens WhatsApp with the same summary"
          >
            {sharing ? 'Sharing…' : 'Share with admin'}
          </button>
        </div>
      </div>

      {shareNotice && (
        <div className={`ba-claim-result ${shareNotice.type === 'ok' ? 'ba-claim-result--matched' : 'ba-claim-result--conflict'}`}>
          {shareNotice.type === 'ok' ? '✅ ' : '🚫 '}{shareNotice.message}
        </div>
      )}

      {loadingClaims ? (
        <Skeleton rows={3} />
      ) : claims.length === 0 ? (
        <p className="ba-claim-panel__empty">No claims logged in this range.</p>
      ) : (
        <div className="ba-claim-list">
          <div className="ba-claim-list__row ba-claim-list__row--head">
            <div>Name</div>
            <div>Phone</div>
            <div>Location</div>
            <div>Match</div>
            <div>Qualification</div>
            <div>Submitted</div>
          </div>
          {claims.map((c) => (
            <div key={c.id} className="ba-claim-list__row">
              <div className="ba-claim-list__name">{c.submitted_name}</div>
              <div className="ba-claim-list__phone">{c.submitted_phone}</div>
              <div className="ba-claim-list__location">{c.submitted_location || '—'}</div>
              <div className={`ba-claim-list__status ba-claim-list__status--${c.match_status === 'matched' ? 'qualified' : 'pending'}`}>{c.match_status}</div>
              <div className={`ba-claim-list__status ba-claim-list__status--${c.qualification_status}`}>{c.qualification_status}</div>
              <div className="ba-claim-list__date">{new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Phase 5, item 1/3 - shared aggregate fetch for the Dashboard cards +
 * trend chart and the Stats section's weekly/monthly rollups. One
 * getBaStats call backs both views so they never drift against each
 * other.
 */
function useBaStats(token) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getBaStats(token)
      .then((res) => {
        if (!cancelled) setStats(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load your stats.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { stats, loading, error };
}

/** Phase 5, item 3 - Stats section: weekly/monthly rollups + conversion rate. */
function BaStatsPanel({ token }) {
  const { stats, loading, error } = useBaStats(token);
  const countFormatter = (v) => String(v);

  if (loading) {
    return (
      <section className="ba-portal-placeholder">
        <Skeleton rows={4} />
      </section>
    );
  }
  if (error) {
    return (
      <section className="ba-portal-placeholder">
        <p>{error}</p>
      </section>
    );
  }

  return (
    <section className="ba-stats-panel">
      <h2>Stats</h2>
      <div className="ba-stats-cards">
        <div className="ba-stats-card">
          <div className="ba-stats-card__value">{stats?.qualifiedCount ?? 0}</div>
          <div className="ba-stats-card__label">Qualified landlords</div>
        </div>
        <div className="ba-stats-card">
          <div className="ba-stats-card__value">{stats?.qualificationRate ?? 0}%</div>
          <div className="ba-stats-card__label">Conversion / qualification rate</div>
        </div>
      </div>

      <div className="ba-stats-chart-block">
        <h3>Weekly onboarding (last 8 weeks)</h3>
        <MiniBarChart data={stats?.weeklyRollup || []} valuePrefix="" formatValue={countFormatter} />
      </div>

      <div className="ba-stats-chart-block">
        <h3>Monthly onboarding (last 6 months)</h3>
        <MiniBarChart data={stats?.monthlyRollup || []} valuePrefix="" formatValue={countFormatter} />
      </div>
    </section>
  );
}

function money(n) {
  return `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currentMonthKeyLocal() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Phase 17 - Downloadable Earnings Statement, BA-side. Lives in the
 * Earnings section the sidebar already reserved (Phase 3). Period
 * picker (a calendar month, or a custom from/to range), the same
 * claims + totals breakdown the PDF/CSV exports use, and Download
 * PDF/CSV buttons that hand off to api/client.js's authenticated blob
 * download (same mechanism as Phase 11's admin statement download).
 */
function BaEarningsPanel({ token }) {
  const [periodType, setPeriodType] = useState('month');
  const [monthKeyInput, setMonthKeyInput] = useState(currentMonthKeyLocal());
  const [fromInput, setFromInput] = useState(todayIsoDate());
  const [toInput, setToInput] = useState(todayIsoDate());
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  const period = periodType === 'month' ? { periodType: 'month', periodKey: monthKeyInput } : { periodType: 'custom', from: fromInput, to: toInput };

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .getMyEarningsStatement(period, token)
      .then((res) => setStatement(res))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your earnings statement.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, monthKeyInput, fromInput, toInput, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDownload(format) {
    setDownloading(format);
    setError('');
    try {
      if (format === 'pdf') await api.downloadMyEarningsStatementPdf(period, token);
      else await api.downloadMyEarningsStatementCsv(period, token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download the statement.');
    } finally {
      setDownloading('');
    }
  }

  return (
    <section className="ba-earnings-panel">
      <h2>Earnings</h2>

      <div className="ba-earnings-panel__period-bar">
        <button type="button" className={`admin-ba-payout__filter-btn ${periodType === 'month' ? 'admin-ba-payout__filter-btn--active' : ''}`} onClick={() => setPeriodType('month')}>
          Month
        </button>
        <button type="button" className={`admin-ba-payout__filter-btn ${periodType === 'custom' ? 'admin-ba-payout__filter-btn--active' : ''}`} onClick={() => setPeriodType('custom')}>
          Custom range
        </button>

        {periodType === 'month' ? (
          <input type="month" value={monthKeyInput} onChange={(e) => setMonthKeyInput(e.target.value)} />
        ) : (
          <>
            <input type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)} />
            <span>to</span>
            <input type="date" value={toInput} onChange={(e) => setToInput(e.target.value)} />
          </>
        )}
      </div>

      {error && <p className="ba-earnings-panel__error">{error}</p>}

      {loading ? (
        <Skeleton rows={4} />
      ) : (
        <>
          <div className="ba-stats-cards">
            <div className="ba-stats-card">
              <div className="ba-stats-card__value">{money(statement?.totals?.grandTotal)}</div>
              <div className="ba-stats-card__label">Grand total this period</div>
            </div>
            <div className="ba-stats-card">
              <div className="ba-stats-card__value">{money(statement?.totals?.paidTotal)}</div>
              <div className="ba-stats-card__label">Already paid</div>
            </div>
            <div className="ba-stats-card">
              <div className="ba-stats-card__value">{money(statement?.totals?.qualifiedNotYetPaidTotal)}</div>
              <div className="ba-stats-card__label">Qualified, not yet paid</div>
            </div>
          </div>

          <div className="ba-earnings-panel__actions">
            <Button onClick={() => handleDownload('pdf')} disabled={downloading === 'pdf'}>
              {downloading === 'pdf' ? 'Preparing…' : 'Download PDF'}
            </Button>
            <Button onClick={() => handleDownload('csv')} variant="ghost" disabled={downloading === 'csv'}>
              {downloading === 'csv' ? 'Preparing…' : 'Download CSV'}
            </Button>
          </div>

          <table className="ba-earnings-panel__table">
            <thead>
              <tr>
                <th>Landlord</th>
                <th>Qualified</th>
                <th>Base</th>
                <th>Commission</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(statement?.claims || []).length === 0 && (
                <tr>
                  <td colSpan={5}>No qualified or paid claims in this period.</td>
                </tr>
              )}
              {(statement?.claims || []).map((c) => (
                <tr key={c.id}>
                  <td>{c.landlordName}</td>
                  <td>{c.qualifiedAt ? new Date(c.qualifiedAt).toLocaleDateString('en-GB') : '—'}</td>
                  <td>{money(c.payoutAmount)}</td>
                  <td>{money(c.commissionBonusAmount)}</td>
                  <td>{c.status === 'paid' ? 'Paid' : 'Qualified'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

const LEADERBOARD_TOP_N = 10;

/**
 * Phase 18 - Optional BA Leaderboard. Period selector (this
 * month/this quarter/all-time), top-N opted-in BAs by qualified
 * count, and "your rank" always shown at the bottom (even if the BA
 * hasn't opted in, or opted in but sits outside the top N) - the
 * backend computes that rank against every active BA regardless of
 * opt-in, see getLeaderboard. Never renders a KES figure - only
 * qualified counts and the tier badge.
 */
function BaLeaderboardPanel({ token }) {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getBaLeaderboard(period, token)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load the leaderboard.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, token]);

  const topN = (data?.leaderboard || []).slice(0, LEADERBOARD_TOP_N);
  const myRowInTopN = topN.some((row) => row.isMe);

  return (
    <section className="ba-leaderboard-panel">
      <h2>Leaderboard</h2>
      <p className="ba-leaderboard-panel__hint">Ranked by qualified landlords onboarded. Opt in from Settings to appear here - your own rank is always shown below.</p>

      <div className="ba-earnings-panel__period-bar">
        {[
          ['month', 'This month'],
          ['quarter', 'This quarter'],
          ['all', 'All-time'],
        ].map(([key, label]) => (
          <button key={key} type="button" className={`admin-ba-payout__filter-btn ${period === key ? 'admin-ba-payout__filter-btn--active' : ''}`} onClick={() => setPeriod(key)}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="ba-earnings-panel__error">{error}</p>}

      {loading ? (
        <Skeleton rows={4} />
      ) : (
        <>
          <table className="ba-earnings-panel__table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Ambassador</th>
                <th>Qualified</th>
                <th>Tier</th>
              </tr>
            </thead>
            <tbody>
              {topN.length === 0 && (
                <tr>
                  <td colSpan={4}>No opted-in Brand Ambassadors yet.</td>
                </tr>
              )}
              {topN.map((row) => (
                <tr key={row.rank} className={row.isMe ? 'ba-leaderboard-panel__row--me' : ''}>
                  <td>#{row.rank}</td>
                  <td>{row.displayName}{row.isMe ? ' (you)' : ''}</td>
                  <td>{row.qualifiedCount}</td>
                  <td>{row.currentCommissionPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          {data?.myRank && !myRowInTopN && (
            <div className="ba-leaderboard-panel__my-rank">
              Your rank: #{data.myRank.rank} of {data.myRank.totalActiveBAs} · {data.myRank.qualifiedCount} qualified
            </div>
          )}
          {!data?.myRank && (
            <div className="ba-leaderboard-panel__my-rank">Your rank isn't available right now.</div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Phase 5, item 1 - Dashboard: at-a-glance cards (today/this
 * week/this month + qualified count), a 14-day trend chart (reusing
 * MiniLineChart, same as the admin/landlord growth graphs), and
 * commission-tier progress.
 */
function BaDashboardStats({ token }) {
  const { stats, loading, error } = useBaStats(token);

  if (loading) {
    return (
      <section className="ba-portal-stub-grid">
        <Skeleton height="90px" />
        <Skeleton height="90px" />
        <Skeleton height="90px" />
        <Skeleton height="90px" />
      </section>
    );
  }
  if (error) {
    return <div className="ba-portal-banner ba-portal-banner--error">{error}</div>;
  }

  const tier = stats?.nextTier;

  return (
    <>
      <section className="ba-stats-cards ba-stats-cards--dashboard">
        <div className="ba-stats-card">
          <div className="ba-stats-card__value">{stats?.onboardedToday ?? 0}</div>
          <div className="ba-stats-card__label">Onboarded today</div>
        </div>
        <div className="ba-stats-card">
          <div className="ba-stats-card__value">{stats?.onboardedThisWeek ?? 0}</div>
          <div className="ba-stats-card__label">This week</div>
        </div>
        <div className="ba-stats-card">
          <div className="ba-stats-card__value">{stats?.onboardedThisMonth ?? 0}</div>
          <div className="ba-stats-card__label">This month</div>
        </div>
        <div className="ba-stats-card">
          <div className="ba-stats-card__value">{stats?.qualifiedCount ?? 0}</div>
          <div className="ba-stats-card__label">Qualified for payout</div>
        </div>
      </section>

      <section className="ba-portal-stub-card ba-trend-card">
        <h3>Landlords onboarded — last 14 days</h3>
        <MiniLineChart data={stats?.trend || []} unitLabel=" landlords" />
      </section>

      <section className="ba-portal-stub-card ba-tier-card">
        <h3>Commission tier</h3>
        <p className="ba-tier-card__current">
          {stats?.currentCommissionPercent ? `${stats.currentCommissionPercent}% commission on qualifying landlords` : 'No commission tier reached yet.'}
        </p>
        {tier && (
          <>
            <div className="ba-tier-card__progress-track">
              <div
                className="ba-tier-card__progress-fill"
                style={{ width: `${Math.min(100, (tier.currentQualifiedLandlords / tier.targetQualifiedLandlords) * 100)}%` }}
              />
            </div>
            <p className="ba-tier-card__progress-label">
              {tier.currentQualifiedLandlords} of {tier.targetQualifiedLandlords} to your next tier ({tier.commissionPercent}%)
            </p>
          </>
        )}
      </section>
    </>
  );
}

/**
 * Phase 6 - Settings & Profile. Mirrors the section-cluster pattern
 * used by Settings.jsx (landlord) / TenantSettings.jsx (tenant):
 * profile photo, editable contact details, change-password link
 * (reuses the existing forced-password-change gate - ChangePassword.jsx
 * already knows to send a BA back to /ba-portal), a real (not
 * placeholder) push-notification toggle, and the leaderboard opt-in.
 */
function BaSettingsPanel({ profile, token, onProfileChange }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: profile?.full_name || '', phone: profile?.phone || '', email: profile?.email || '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(!!profile?.leaderboard_opt_in);
  const [savingOptIn, setSavingOptIn] = useState(false);
  const [pushState, setPushState] = useState('unknown'); // 'unknown' | 'unsupported' | 'default' | 'denied' | 'granted'

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushState('unsupported');
      return;
    }
    setPushState(Notification.permission);
  }, []);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSaveContact(e) {
    e.preventDefault();
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const res = await api.updateBaProfile(form, token);
      onProfileChange?.((p) => ({ ...p, ...res }));
      setNotice('Profile updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleLeaderboard() {
    const next = !leaderboardOptIn;
    setLeaderboardOptIn(next);
    setSavingOptIn(true);
    try {
      await api.updateBaLeaderboardOptIn(next, token);
      onProfileChange?.((p) => ({ ...p, leaderboard_opt_in: next }));
    } catch {
      setLeaderboardOptIn(!next); // revert on failure
    } finally {
      setSavingOptIn(false);
    }
  }

  async function handleEnablePush() {
    await initPushSubscription(token);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushState(Notification.permission);
    }
  }

  return (
    <div className="settings-page ba-settings-panel">
      <h1>Settings</h1>

      {notice && <div className="settings-banner settings-banner--ok">{notice}</div>}
      {error && <div className="settings-banner settings-banner--error">{error}</div>}

      <h2 className="settings-cluster-title">Profile photo</h2>
      <section className="settings-card">
        <ProfilePhotoUpload
          name={profile?.full_name}
          photoUrl={profile?.photo_url}
          token={token}
          onChange={(photoUrl) => onProfileChange?.((p) => ({ ...p, photo_url: photoUrl }))}
        />
      </section>

      <h2 className="settings-cluster-title u-mt-6">Contact details</h2>
      <section className="settings-card">
        <form onSubmit={handleSaveContact} className="ba-settings-form">
          <label>
            Full name
            <input required value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} />
          </label>
          <label>
            Phone
            <input required value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
          </label>
          <label>
            Email
            <input required type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
          </label>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </form>
      </section>

      <h2 className="settings-cluster-title u-mt-6">Account &amp; security</h2>
      <section className="settings-card">
        <h2>Password</h2>
        <p className="settings-card__hint">Change the password you use to log in.</p>
        <Button variant="ghost" onClick={() => navigate('/change-password')}>Change password</Button>
      </section>

      <h2 className="settings-cluster-title u-mt-6">Notification preferences</h2>
      <section className="settings-card">
        <h2>Push notifications</h2>
        <p className="settings-card__hint">
          Get notified on this device when one of your onboarded landlords qualifies for payout.
        </p>
        {pushState === 'unsupported' && <p className="settings-card__hint">Push notifications aren't supported on this browser.</p>}
        {pushState === 'denied' && <p className="settings-card__hint">Notifications are blocked for this site in your browser settings.</p>}
        {pushState === 'granted' && <p className="settings-card__hint">✅ Push notifications are on for this device.</p>}
        {(pushState === 'default' || pushState === 'unknown') && (
          <Button variant="ghost" onClick={handleEnablePush}>Enable push notifications</Button>
        )}
      </section>

      <h2 className="settings-cluster-title u-mt-6">Leaderboard</h2>
      <section className="settings-card">
        <h2>Show me on the leaderboard</h2>
        <p className="settings-card__hint">
          Opting in shows your first name, last initial, and qualified-landlord count to other Brand Ambassadors. Your earnings are never shown.
        </p>
        <label className="ba-settings-toggle">
          <input type="checkbox" checked={leaderboardOptIn} disabled={savingOptIn} onChange={handleToggleLeaderboard} />
          <span>{leaderboardOptIn ? 'You are visible on the leaderboard' : 'You are hidden from the leaderboard'}</span>
        </label>
      </section>
    </div>
  );
}

export default function BaPortal() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('rentapay_token');

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    api
      .getMyBaProfile(token)
      .then((res) => setProfile(res))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          sessionStorage.removeItem('rentapay_token');
          sessionStorage.removeItem('rentapay_role');
          if (err.message) sessionStorage.setItem('rentapay_logout_message', err.message);
          navigate('/login');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Failed to load your Brand Ambassador profile.');
      })
      .finally(() => setLoading(false));
  }, [token, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  // Same "safe to call on every portal load, quiet no-op if
  // unsupported/declined" pattern already used in Dashboard.jsx /
  // TenantPortal.jsx - registers this device for push once a token
  // exists, so a BA doesn't have to find a toggle before it works.
  useEffect(() => {
    if (token) initPushSubscription(token);
  }, [token]);

  function handleCopyReferralLink() {
    if (!profile?.referralLink) return;
    navigator.clipboard
      ?.writeText(profile.referralLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  function handleShareReferralLink() {
    if (!profile?.referralLink) return;
    openWhatsAppReminder(
      profile.phone,
      `Hi! Register on RentaPay using my link and I'll help you get set up: ${profile.referralLink}`
    );
  }

  if (loading) {
    return (
      <div className="ba-portal">
        <div className="ba-portal-main ba-portal-main--loading">
          <Skeleton height="120px" />
          <Skeleton height="200px" />
        </div>
      </div>
    );
  }

  return (
    <div className="ba-portal">
      <PortalSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey={activeTab}
        items={[
          {
            group: 'Overview',
            items: [{ key: 'dashboard', label: 'Dashboard', icon: '🏠', onClick: () => setActiveTab('dashboard') }],
          },
          {
            group: 'My Work',
            items: [
              { key: 'landlords', label: 'My Onboarded Landlords', icon: '🧾', onClick: () => setActiveTab('landlords') },
              { key: 'stats', label: 'Stats', icon: '📊', onClick: () => setActiveTab('stats') },
            ],
          },
          {
            group: 'Money',
            items: [{ key: 'earnings', label: 'Earnings', icon: '💰', onClick: () => setActiveTab('earnings') }],
          },
          {
            group: 'Account',
            items: [
              { key: 'leaderboard', label: 'Leaderboard', icon: '🏆', onClick: () => setActiveTab('leaderboard') },
              { key: 'settings', label: 'Settings', icon: '⚙️', onClick: () => setActiveTab('settings') },
            ],
          },
        ]}
      />

      <header className="ba-portal-header portal-topbar">
        <div className="portal-topbar__left">
          <button type="button" className="portal-topbar__hamburger" aria-label="Menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="portal-topbar__brand-block">
            <div className="portal-topbar__brand"><span>🏠</span> RentaPay</div>
            <div className="portal-topbar__role-label">Brand Ambassador{profile?.ba_code ? ` · ${profile.ba_code}` : ''}</div>
          </div>
        </div>
        <div className="portal-topbar__right">
          {profile && (
            <AccountMenu
              name={profile.full_name}
              role="brand_ambassador"
              phone={profile.phone}
              token={token}
            />
          )}
        </div>
      </header>

      <main className="ba-portal-main">
        {error && <div className="ba-portal-banner ba-portal-banner--error">{error}</div>}

        {activeTab === 'dashboard' && (
          <>
            <section className="ba-portal-welcome">
              <h1>Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
              <p>Here's your referral link - share it with landlords you onboard.</p>
            </section>

            {/* Item 5 of the spec: the referral link is the BA's
                primary day-to-day tool, so it's front and center on
                the dashboard rather than buried in Settings. */}
            <section className="ba-referral-card">
              <div className="ba-referral-card__label">Your referral link</div>
              <div className="ba-referral-card__link-row">
                <code className="ba-referral-card__link">{profile?.referralLink || 'Not assigned yet'}</code>
                <div className="ba-referral-card__actions">
                  <button type="button" className="ba-referral-card__btn" onClick={handleCopyReferralLink} disabled={!profile?.referralLink}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button type="button" className="ba-referral-card__btn ba-referral-card__btn--whatsapp" onClick={handleShareReferralLink} disabled={!profile?.referralLink}>
                    Share on WhatsApp
                  </button>
                </div>
              </div>
              <p className="ba-referral-card__hint">
                Walk the landlord through registering directly on this link - it auto-tags their account to you the moment they sign up.
              </p>
            </section>

            <BaDashboardStats token={token} />
          </>
        )}

        {activeTab === 'landlords' && <ClaimLandlordPanel token={token} />}

        {activeTab === 'stats' && <BaStatsPanel token={token} />}

        {activeTab === 'earnings' && <BaEarningsPanel token={token} />}

        {activeTab === 'leaderboard' && <BaLeaderboardPanel token={token} />}

        {activeTab === 'settings' && <BaSettingsPanel profile={profile} token={token} onProfileChange={(fn) => setProfile((p) => fn(p))} />}
      </main>
    </div>
  );
}
