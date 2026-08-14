import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountMenu from '../components/AccountMenu.jsx';
import PortalSidebar from '../components/PortalSidebar.jsx';
import Skeleton from '../components/Skeleton.jsx';
import Button from '../components/Button.jsx';
import MiniBarChart from '../components/MiniBarChart.jsx';
import MiniLineChart from '../components/MiniLineChart.jsx';
import HelpButton from '../components/HelpButton.jsx';
import Faq from '../components/Faq.jsx';
import { openWhatsAppReminder } from '../utils/whatsapp.js';
import { HELP_WHATSAPP } from '../components/HelpButton.jsx';
import { initPushSubscription } from '../utils/push.js';
import { useSharedPoll } from '../utils/sharedPoll.js';
import { api, ApiError } from '../api/client.js';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload.jsx';
import './Settings.css';
import './BaPortal.css';
import InfoTip from '../components/InfoTip.jsx';

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
 * Item 5 (direct request): the PRIMARY "My Onboarded Landlords" view -
 * live, sourced directly from landlords.ba_id (set the instant a
 * landlord signs up via this BA's referral link/code, or is
 * successfully matched through the manual fallback below - either
 * way lands here automatically, no BA action required). Same
 * date-filter UX as the manual claims list below, for consistency.
 */
function OnboardedLandlordsPanel({ token }) {
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (dateFrom) params.from = `${dateFrom}T00:00:00.000Z`;
    if (dateTo) params.to = `${dateTo}T23:59:59.999Z`;
    api
      .listMyOnboardedLandlords(params, token)
      .then((res) => setLandlords(res.landlords || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  function handleShowToday() {
    setDateFrom(todayIsoDate());
    setDateTo(todayIsoDate());
  }

  function handleShowThisWeek() {
    const now = new Date();
    // Monday-start week, to match the Stats section's weekly rollups.
    const day = now.getUTCDay(); // 0 = Sun ... 6 = Sat
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - diffToMonday);
    setDateFrom(monday.toISOString().slice(0, 10));
    setDateTo(todayIsoDate());
  }

  function handleShowAll() {
    setDateFrom('');
    setDateTo('');
  }

  return (
    <section className="ba-claim-panel">
      <h2>My Onboarded Landlords</h2>
      <InfoTip text={<>
        Every landlord who signed up using your referral link or code is listed here automatically, the moment
        they complete registration — no need to log them yourself.
      </>} />

      <div className="ba-claim-panel__list-header">
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
          <button type="button" className="ba-referral-card__btn" onClick={handleShowThisWeek}>This week</button>
          <button type="button" className="ba-referral-card__btn" onClick={handleShowAll}>All time</button>
        </div>
      </div>

      {loading ? (
        <Skeleton rows={3} />
      ) : landlords.length === 0 ? (
        <p className="ba-claim-panel__empty">No landlords onboarded in this range yet.</p>
      ) : (
        <div className="ba-onboarded-cards">
          {landlords.map((l) => (
            <div key={l.id} className="ba-onboarded-card">
              <div className="ba-onboarded-card__top">
                <div className="ba-onboarded-card__name">{l.fullName}</div>
                <div className={`ba-claim-list__status ba-claim-list__status--${l.qualificationStatus}`}>
                  {l.qualificationStatus === 'qualified' || l.qualificationStatus === 'paid' ? 'Qualifies for payout' : l.qualificationStatus}
                </div>
              </div>
              <div className="ba-onboarded-card__row">
                <span className="ba-onboarded-card__label">Phone</span>
                <span>{l.phone}</span>
              </div>
              {l.location && (
                <div className="ba-onboarded-card__row">
                  <span className="ba-onboarded-card__label">Location</span>
                  <span>{l.location}</span>
                </div>
              )}
              <div className="ba-onboarded-card__row">
                <span className="ba-onboarded-card__label">Status</span>
                <span className="ba-claim-list__status ba-claim-list__status--qualified">{l.subscriptionStatus}</span>
              </div>
              <div className="ba-onboarded-card__row">
                <span className="ba-onboarded-card__label">Onboarded</span>
                <span className="ba-claim-list__date">
                  {new Date(l.onboardedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Phase 4, item 6 - "My Onboarded Landlords" claim-logging form + list.
 * Never discards what the BA typed on an unmatched/conflict response -
 * the form stays populated so they can correct and resubmit in place.
 *
 * Item 5 (direct request): the referral link/code already attaches a
 * landlord to this BA automatically at signup - see
 * OnboardedLandlordsPanel above, which is now the primary view. This
 * form is a FALLBACK/exception path only, for a landlord the BA
 * onboarded in person who, for whatever reason, didn't use the
/**
 * Shared "today" helper for the date-range filters below.
 */
function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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

          <div className="ba-table-scroll">
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
                  <td>
                    {money(c.payoutAmount)}
                    {c.breakdown?.unitBracket && (
                      <div className="ba-earnings-panel__why">
                        {c.breakdown.unitBracket.minUnits}–{c.breakdown.unitBracket.maxUnits ?? '+'} units bracket
                        {c.breakdown.unitCount != null ? ` (had ${c.breakdown.unitCount})` : ''}
                      </div>
                    )}
                    {!c.breakdown?.unitBracket && <div className="ba-earnings-panel__why">Flat rate</div>}
                  </td>
                  <td>
                    {money(c.commissionBonusAmount)}
                    {c.breakdown?.commissionTier && (
                      <div className="ba-earnings-panel__why">
                        {c.breakdown.commissionTier.commissionPercent}% tier (at {c.breakdown.commissionTier.targetQualifiedLandlords} qualified)
                      </div>
                    )}
                  </td>
                  <td>{c.status === 'paid' ? 'Paid' : 'Qualified'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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

  return (
    <section className="ba-leaderboard-panel">
      <h2>Leaderboard</h2>
      <InfoTip text={<>Ranked by qualified landlords onboarded. Opt in from Settings to appear here - your own rank is always shown below.</>} />

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
          <div className="ba-table-scroll">
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
          </div>

          {/* Always rendered as its own separate row, regardless of whether
              this BA also appears in the opted-in table above. The table
              ranks only opted-in BAs (#1, #2, ... among that subset), which
              is a different number from this BA's real standing among every
              active BA - so "you're #2" in the table above and "#2 of 47
              overall" here can legitimately both be true and both need to be
              visible, not one hiding the other. */}
          {data?.myRank ? (
            <div className="ba-leaderboard-panel__my-rank">
              Your rank (all active BAs): #{data.myRank.rank} of {data.myRank.totalActiveBAs} · {data.myRank.qualifiedCount} qualified
            </div>
          ) : (
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
        <h3>Commission rate</h3>
        <p className="ba-tier-card__current">
          {stats?.currentCommissionPercent
            ? `You currently earn ${stats.currentCommissionPercent}% of every qualifying landlord's subscription payment, recurring for as long as they stay subscribed.`
            : 'No commission rate has been set yet — check back soon.'}
        </p>
        <div className="ba-tier-card__earnings-row">
          <div>
            <div className="ba-tier-card__earnings-value">KES {(stats?.thisMonthCommissionEarned ?? 0).toLocaleString()}</div>
            <div className="ba-tier-card__earnings-label">Earned this month</div>
          </div>
          <div>
            <div className="ba-tier-card__earnings-value">KES {(stats?.lifetimeCommissionEarned ?? 0).toLocaleString()}</div>
            <div className="ba-tier-card__earnings-label">Earned all-time</div>
          </div>
        </div>
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
      // FIX (item 5): phone/email are read-only in this form now (see
      // the inputs below) - only fullName can ever change here, so
      // that's all we send. Sending phone/email unchanged was
      // harmless before (the backend no-ops on unchanged values), but
      // narrowing the payload to what the form can actually edit
      // keeps this endpoint's contract honest.
      const res = await api.updateBaProfile({ fullName: form.fullName }, token);
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
            {/* FIX (item 5): phone/email used to be plain editable
                inputs, letting a BA silently swap either one with no
                verification at all. They're now pre-filled read-only
                fields - changing either has to go through Support
                instead of a bare text box. */}
            <input value={form.phone} disabled readOnly className="ba-settings-form__readonly" />
          </label>
          <label>
            Email
            <input type="email" value={form.email} disabled readOnly className="ba-settings-form__readonly" />
          </label>
          <InfoTip text={<>
            To change your phone number or email, contact Support below - we verify identity before updating either one.
          </>} />
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </form>
      </section>

      <h2 className="settings-cluster-title u-mt-6">Account &amp; security</h2>
      <section className="settings-card">
        <h2>
          Password
          <InfoTip text="Change the password you use to log in." />
        </h2>
        <Button variant="ghost" onClick={() => navigate('/change-password')}>Change password</Button>
      </section>

      <h2 className="settings-cluster-title u-mt-6">Notification preferences</h2>
      <section className="settings-card">
        <h2>Push notifications</h2>
        <InfoTip text={<>
          Get notified on this device when one of your onboarded landlords qualifies for payout.
        </>} />
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
        <InfoTip text={<>
          Opting in shows your first name, last initial, and qualified-landlord count to other Brand Ambassadors. Your earnings are never shown.
        </>} />
        <label className="ba-settings-toggle">
          <input type="checkbox" checked={leaderboardOptIn} disabled={savingOptIn} onChange={handleToggleLeaderboard} />
          <span>{leaderboardOptIn ? 'You are visible on the leaderboard' : 'You are hidden from the leaderboard'}</span>
        </label>
      </section>
    </div>
  );
}

/**
 * BA-scoped Announcements tab. BAs aren't attached to a landlord
 * account, so the only announcements that can ever reach them are
 * platform-wide broadcasts targeted at group 'ba' or 'all' (see the
 * BA branch in announcement.controller.js's listAnnouncements) - a BA
 * never sends announcements themselves and never sees a "delete for
 * everyone" option, only "delete for me" (same as a tenant).
 * This used to only reach BAs via SMS/push (notify()), with nothing
 * to see inside the BA portal itself - this tab is what closes that
 * gap.
 */
function BaAnnouncementsPanel({ token, onChange }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listAnnouncements(token)
      .then((res) => setAnnouncements(res.announcements || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function handleMarkRead(a) {
    if (a.isRead) return;
    api
      .markAnnouncementRead(a.id, token)
      .then(() => {
        setAnnouncements((list) => list.map((x) => (x.id === a.id ? { ...x, isRead: true } : x)));
        onChange?.();
      })
      .catch(() => {});
  }

  function handleDelete(a) {
    setDeletingId(a.id);
    api
      .deleteAnnouncement(a.id, 'self', token)
      .then(() => {
        setAnnouncements((list) => list.filter((x) => x.id !== a.id));
        onChange?.();
      })
      .catch(() => {})
      .finally(() => setDeletingId(null));
  }

  return (
    <section className="ba-claim-panel">
      <h2>Announcements</h2>
      <InfoTip text={<>
        Platform-wide messages from RentaPay show up here, in addition to the SMS/push you already get.
      </>} />

      {loading ? (
        <Skeleton rows={3} />
      ) : announcements.length === 0 ? (
        <p className="ba-claim-panel__empty">No announcements yet.</p>
      ) : (
        <ul className="announcement-bell__list ba-announcements-list">
          {announcements.map((a) => (
            <li
              key={a.id}
              className={`announcement-bell__item ${a.isRead ? '' : 'announcement-bell__item--unread'}`}
              aria-disabled={deletingId === a.id}
              onClick={() => handleMarkRead(a)}
            >
              <div className="announcement-bell__item-top">
                <span className={`announcement-bell__sender announcement-bell__sender--${a.sender_role || 'system'}`}>
                  {a.senderLabel || 'RentaPay'}
                </span>
              </div>
              <p>{a.message}</p>
              <span className="announcement-bell__time">{new Date(a.created_at).toLocaleString()}</span>
              <button
                type="button"
                className="ba-referral-card__btn u-mt-2"
                disabled={deletingId === a.id}
                onClick={(e) => { e.stopPropagation(); handleDelete(a); }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
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
  const [codeCopied, setCodeCopied] = useState(false);
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);

  const load = useCallback(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    setError('');
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

  // Keeps the sidebar's "Announcements" badge current even while the
  // BA is sitting on a different tab, same lightweight polling every
  // other bell-style badge in the app already rides (see
  // AnnouncementBell.jsx).
  const loadAnnouncementUnreadCount = useCallback(() => {
    if (!token) return;
    api
      .listAnnouncements(token)
      .then((res) => setAnnouncementUnreadCount(res.unreadCount || 0))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    loadAnnouncementUnreadCount();
  }, [loadAnnouncementUnreadCount]);

  useSharedPoll(loadAnnouncementUnreadCount, 30000);

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

  function handleCopyReferralCode() {
    if (!profile?.ba_code) return;
    navigator.clipboard
      ?.writeText(profile.ba_code)
      .then(() => {
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      })
      .catch(() => {});
  }

  function handleShareReferralLink() {
    if (!profile?.referralLink) return;
    // FIX: this used to pass profile.phone (the BA's OWN number) as
    // the wa.me recipient, which opens a WhatsApp chat with yourself
    // instead of letting you choose which landlord to send it to.
    // Omitting the phone number entirely makes wa.me open WhatsApp's
    // own contact picker instead (see buildWaMeLink in
    // src/utils/whatsapp.js) - the whole point of this button is to
    // send the link to a landlord, a different person every time, not
    // to a single fixed number.
    openWhatsAppReminder(
      null,
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
              { key: 'announcements', label: 'Announcements', icon: '📣', badge: announcementUnreadCount, onClick: () => setActiveTab('announcements') },
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
              // FIX (item 8): FAQ + contact-support entry point,
              // consistent with what the Landlord/Tenant portals
              // offer - previously there was no Help entry anywhere
              // in this sidebar at all.
              { key: 'help', label: 'Help', icon: '❓', onClick: () => setActiveTab('help') },
            ],
          },
        ]}
      />

      <header className="ba-portal-header portal-topbar">
        <div className="portal-topbar__left">
          <button type="button" className="portal-topbar__hamburger" aria-label="Menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="portal-topbar__brand-block">
            <div className="portal-topbar__brand"><img className="portal-topbar__brand-logo" src="/logo.png" alt="RentaPay" /> RentaPay</div>
            <div className="portal-topbar__role-label">Brand Ambassador</div>
          </div>
        </div>
        <div className="portal-topbar__right">
          {profile && (
            <>
              <AccountMenu
                name={profile.full_name}
                photoUrl={profile.photo_url}
                role="brand_ambassador"
                phone={profile.phone}
                token={token}
                onPhotoChange={(photoUrl) => setProfile((p) => ({ ...p, photo_url: photoUrl }))}
                onEditProfile={() => { setActiveTab('settings'); setSidebarOpen(false); }}
              />
              {/* FIX (item 8): every other portal (Dashboard.jsx,
                  TenantPortal.jsx) has a Help button in the topbar -
                  the BA Portal had none at all, with no FAQ/contact-
                  support entry point anywhere in it. Same shared
                  HelpButton component/modal (WhatsApp, call, email,
                  live chat-with-an-agent) used everywhere else. */}
              <HelpButton role="brand_ambassador" token={token} renderAs="quick-action-btn help-button" />
            </>
          )}
        </div>
      </header>

      <main className="ba-portal-main">
        {error && (
          // FIX (item 3): this used to be a dead-end banner - the
          // profile fetch had failed, so `profile` stays null forever
          // and every tab below (which all key off `profile` or
          // assume a loaded portal shell) just silently renders
          // nothing useful, with no way to recover short of a full
          // page refresh. A Retry button re-runs the same load() used
          // on mount/first load.
          <div className="ba-portal-banner ba-portal-banner--error">
            <span>{error}</span>
            <button type="button" className="ba-portal-banner__retry" onClick={load}>Retry</button>
          </div>
        )}

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
              <InfoTip text={<>
                Walk the landlord through registering directly on this link - it auto-tags their account to you the moment they sign up.
              </>} />
            </section>

            {/* Referral code gets its own slot, separate from the
                referral link card above, with its own copy button -
                it used to be crammed into the topbar next to the
                BA's name, which isn't where someone looks for
                something they need to copy and hand to a landlord. */}
            <section className="ba-referral-card ba-referral-card--code">
              <div className="ba-referral-card__label">Your referral code</div>
              <div className="ba-referral-card__link-row">
                <code className="ba-referral-card__link">{profile?.ba_code || 'Not assigned yet'}</code>
                <div className="ba-referral-card__actions">
                  <button type="button" className="ba-referral-card__btn" onClick={handleCopyReferralCode} disabled={!profile?.ba_code}>
                    {codeCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <InfoTip text={<>
                Landlords can also type this code in manually during registration instead of using the link.
              </>} />
            </section>

            <BaDashboardStats token={token} />
          </>
        )}

        {activeTab === 'landlords' && (
          <>
            <OnboardedLandlordsPanel token={token} />
          </>
        )}

        {activeTab === 'announcements' && (
          <BaAnnouncementsPanel token={token} onChange={loadAnnouncementUnreadCount} />
        )}

        {activeTab === 'stats' && <BaStatsPanel token={token} />}

        {activeTab === 'earnings' && <BaEarningsPanel token={token} />}

        {activeTab === 'leaderboard' && <BaLeaderboardPanel token={token} />}

        {activeTab === 'settings' && <BaSettingsPanel profile={profile} token={token} onProfileChange={(fn) => setProfile((p) => fn(p))} />}

        {activeTab === 'help' && (
          <div className="ba-help-panel">
            <Faq audience="brand_ambassador" />
            <section className="settings-card u-mt-6">
              <h2>Still need help?</h2>
              <InfoTip text={<>Chat with an agent, or reach us directly:</>} />
              <HelpButton role="brand_ambassador" token={token} renderAs="ghost-link" />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
