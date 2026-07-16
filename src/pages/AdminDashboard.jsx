import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Avatar from '../components/Avatar.jsx';
import TenantContactCard from '../components/TenantContactCard.jsx';
import ChatThreadList from '../components/ChatThreadList.jsx';
import ChatConversation from '../components/ChatConversation.jsx';
import PortalSidebar from '../components/PortalSidebar.jsx';
import AdminStatistics from '../components/AdminStatistics.jsx';
import AdminCredentialsPanel from '../components/AdminCredentialsPanel.jsx';
import AdminSqlPanel from '../components/AdminSqlPanel.jsx';
import LandlordEditModal from '../components/LandlordEditModal.jsx';
import { downloadCsv } from '../utils/downloadCsv.js';
import Faq from '../components/Faq.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { api, ApiError } from '../api/client.js';
import './AdminDashboard.css';

/**
 * Blueprint section 13: Super Admin Panel. The platform owner's view -
 * platform-wide metrics (13.1), landlord management with suspend/
 * activate/delete (13.2), activity log, and emergency lockdown.
 *
 * Item B / A from the request tracker: the summary cards used to be
 * static numbers and there was nowhere to search a long landlord
 * list. Both are now real: each card opens a drill-down (tenants
 * list / units list / revenue breakdown / expiring-soon with a
 * renewal-reminder sender), and the Landlords tab has a live search
 * box. There's also a new Help Requests tab (item F).
 */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('rentapay_token');

  const [metrics, setMetrics] = useState(null);
  const [landlords, setLandlords] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // overview | landlords | activity | help | messages
  const [selectedThread, setSelectedThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [showLockdownConfirm, setShowLockdownConfirm] = useState(false);
  const [lockdownStatus, setLockdownStatus] = useState(null);
  const [lockdownReason, setLockdownReason] = useState('maintenance');
  const [customReason, setCustomReason] = useState('');

  const [landlordSearch, setLandlordSearch] = useState('');
  const [landlordStatusFilter, setLandlordStatusFilter] = useState('all'); // 'all' | 'active' | 'suspended'
  const [expandedActivityDays, setExpandedActivityDays] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [editingLandlord, setEditingLandlord] = useState(null); // { id, name } | null
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastTargetGroup, setBroadcastTargetGroup] = useState('all');
  // FIX ("deleting a landlord or locking down the platform should
  // require the admin password"): both actions now route through this
  // single confirmation modal, which re-collects the admin's password
  // and only proceeds once the backend confirms it's correct.
  const [pendingDangerAction, setPendingDangerAction] = useState(null); // { type: 'delete-landlord' | 'lockdown' | 'set-landlord-status' | 'resume-lockdown', label, landlordId?, status? }
  const [dangerPassword, setDangerPassword] = useState('');
  const [dangerError, setDangerError] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);

  function dateKeyOf(dateString) {
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // A manager and a caretaker both arrive as requester_type 'manager' -
  // requester_role_level is what actually tells them apart.
  function helpCategoryOf(h) {
    if (h.requester_type === 'manager' && h.requester_role_level === 'caretaker') return 'caretaker';
    return h.requester_type || 'guest';
  }

  const [helpRequests, setHelpRequests] = useState([]);
  const [helpCategory, setHelpCategory] = useState('all');
  const helpCategoryFiltered = useMemo(
    () => (helpCategory === 'all' ? helpRequests : helpRequests.filter((h) => helpCategoryOf(h) === helpCategory)),
    [helpRequests, helpCategory]
  );

  const helpGroups = useMemo(() => {
    const todayKey = dateKeyOf(new Date());
    const yesterdayKey = dateKeyOf(new Date(Date.now() - 86400000));

    const byDay = {};
    for (const h of helpCategoryFiltered) {
      const key = dateKeyOf(h.created_at);
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(h);
    }

    return Object.entries(byDay)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([dateKey, requests]) => {
        let label;
        if (dateKey === todayKey) label = 'Today';
        else if (dateKey === yesterdayKey) label = 'Yesterday';
        else label = new Date(requests[0].created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return { dateKey, label, requests };
      });
  }, [helpCategoryFiltered]);

  function toggleHelpDay(dateKey) {
    setExpandedHelpDays((prev) => (prev.includes(dateKey) ? prev.filter((k) => k !== dateKey) : [...prev, dateKey]));
  }

  async function confirmHelpDelete() {
    if (!pendingHelpDelete) return;
    setHelpDeleteBusy(true);
    try {
      await api.deleteHelpRequest(pendingHelpDelete, token);
      setHelpRequests((prev) => prev.filter((h) => h.id !== pendingHelpDelete));
      setPendingHelpDelete(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setHelpDeleteBusy(false);
    }
  }

  const activityGroups = useMemo(() => {
    const todayKey = dateKeyOf(new Date());
    const yesterdayKey = dateKeyOf(new Date(Date.now() - 86400000));

    const byDay = {};
    for (const log of activityLog) {
      const key = dateKeyOf(log.created_at);
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(log);
    }

    return Object.entries(byDay)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([dateKey, logs]) => {
        let label;
        if (dateKey === todayKey) label = 'Today';
        else if (dateKey === yesterdayKey) label = 'Yesterday';
        else label = new Date(logs[0].created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return { dateKey, label, logs };
      });
  }, [activityLog]);

  const [pendingActivityDelete, setPendingActivityDelete] = useState(null); // { type: 'entry' | 'day', id/dateKey }
  const [activityDeleteBusy, setActivityDeleteBusy] = useState(false);

  function toggleActivityDay(dateKey) {
    setExpandedActivityDays((prev) => (prev.includes(dateKey) ? prev.filter((k) => k !== dateKey) : [...prev, dateKey]));
  }

  // FIX ("anywhere anything gets deleted should have a second
  // confirmation - sometimes they tap them by mistake"): these two
  // used a bare window.confirm() before, which is one accidental tap
  // away from wiping activity history. Both now route through the
  // same styled ConfirmDialog used everywhere else in the app.
  function handleDeleteActivityEntry(logId) {
    setPendingActivityDelete({ type: 'entry', id: logId, label: 'Delete this log entry?' });
  }

  function handleDeleteActivityDay(dateKey) {
    setPendingActivityDelete({ type: 'day', dateKey, label: `Delete ALL activity logs for ${dateKey}? This cannot be undone.` });
  }

  async function confirmActivityDelete() {
    if (!pendingActivityDelete) return;
    setActivityDeleteBusy(true);
    try {
      if (pendingActivityDelete.type === 'entry') {
        await api.deleteActivityLogEntry(pendingActivityDelete.id, token);
        setActivityLog((prev) => prev.filter((l) => l.id !== pendingActivityDelete.id));
      } else {
        await api.deleteActivityLogsForDay(pendingActivityDelete.dateKey, token);
        setActivityLog((prev) => prev.filter((l) => dateKeyOf(l.created_at) !== pendingActivityDelete.dateKey));
      }
      setPendingActivityDelete(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setActivityDeleteBusy(false);
    }
  }

  // Drill-down state for the clickable summary cards
  const [drillDown, setDrillDown] = useState(null); // 'tenants' | 'units' | 'revenue' | 'expiring' | null
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [drillDownData, setDrillDownData] = useState(null);
  const [selectedExpiring, setSelectedExpiring] = useState([]);

  // Help requests tab
  const [helpFilter, setHelpFilter] = useState('open');
  const [helpLoading, setHelpLoading] = useState(false);
  // FIX (direct request): "help requests should be categorized under
  // different users - landlords, tenants, managers and caretakers
  // under their own ui." requester_type distinguishes landlord/
  // tenant/guest already; manager vs caretaker both come through as
  // requester_type 'manager' so requester_role_level (see
  // help.controller.js submitHelpRequest) splits them further.
  const [expandedHelpDays, setExpandedHelpDays] = useState([]);
  const [pendingHelpDelete, setPendingHelpDelete] = useState(null); // help request id | null
  const [helpDeleteBusy, setHelpDeleteBusy] = useState(false);

  const LOCKDOWN_REASON_PRESETS = {
    maintenance: 'The platform is temporarily paused for scheduled technical maintenance. Service will resume shortly.',
    security: 'The platform has been temporarily suspended as a precaution while we investigate a security concern. Your data is safe.',
    billing: 'The platform is temporarily paused while we resolve a billing system issue. We apologize for the inconvenience.',
    custom: null, // uses customReason below
  };

  const [landlordsLoaded, setLandlordsLoaded] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);

  // PERFORMANCE FIX (direct request: "dashboards take so long to
  // load"): this used to eagerly fetch the ENTIRE landlords table and
  // the ENTIRE activity log on every single admin page load, even
  // when landing on Overview - which only ever needs the summary
  // counts already included in getAdminDashboard. As the platform
  // grows ("someday we're gonna have many people using the
  // platform"), those two lists only get bigger and slower to fetch,
  // for tabs the admin might never even open this session. Now only
  // the actual Overview data loads up front; the Landlords and
  // Activity Log tabs fetch their own (much heavier) data lazily, the
  // first time each tab is opened - exactly like the Help Requests
  // tab already did.
  function load() {
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    // Named jobs rather than a plain array - conditionally including
    // landlords/activity would otherwise shift array positions around
    // depending on which combination is loaded, silently swapping
    // which result lands in which state setter.
    const jobs = { metrics: api.getAdminDashboard(token), lockdown: api.getLockdownStatus(token) };
    if (landlordsLoaded) jobs.landlords = api.listAllLandlords(token);
    if (activityLoaded) jobs.activity = api.getActivityLog(token);

    const keys = Object.keys(jobs);
    Promise.all(keys.map((k) => jobs[k]))
      .then((results) => {
        const byKey = Object.fromEntries(keys.map((k, i) => [k, results[i]]));
        setMetrics(byKey.metrics);
        setLockdownStatus(byKey.lockdown);
        if (byKey.landlords) setLandlords(byKey.landlords.landlords || []);
        if (byKey.activity) setActivityLog(byKey.activity.logs || []);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          sessionStorage.removeItem('rentapay_token');
          sessionStorage.removeItem('rentapay_role');
          navigate('/login');
          return;
        }
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'help') loadHelpRequests(helpFilter);
    if (activeTab === 'landlords' && !landlordsLoaded) {
      setLandlordsLoaded(true); // set eagerly so a fast double-click doesn't fire two requests
      api.listAllLandlords(token).then((res) => setLandlords(res.landlords || [])).catch((err) => setError(err.message));
    }
    if (activeTab === 'activity' && !activityLoaded) {
      setActivityLoaded(true);
      api.getActivityLog(token).then((res) => setActivityLog(res.logs || [])).catch((err) => setError(err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function loadHelpRequests(filter) {
    setHelpLoading(true);
    api
      .listHelpRequestsAdmin(filter === 'all' ? null : filter, token)
      .then((res) => setHelpRequests(res.helpRequests || []))
      .catch((err) => setError(err.message))
      .finally(() => setHelpLoading(false));
  }

  async function handleResolveHelp(requestId) {
    setBusy(true);
    try {
      await api.resolveHelpRequest(requestId, {}, token);
      loadHelpRequests(helpFilter);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('rentapay_token');
    sessionStorage.removeItem('rentapay_role');
    navigate('/login');
  }

  // FIX (direct request): suspending or reactivating a landlord now
  // requires the admin password, same as deleting one or locking down
  // the platform - routed through the same confirmation modal instead
  // of firing on a single click.
  function handleSetStatus(landlordId, status, landlordName) {
    setDangerError('');
    setDangerPassword('');
    setPendingDangerAction({
      type: 'set-landlord-status',
      landlordId,
      status,
      label: `${status === 'suspended' ? 'Suspend' : 'Activate'} ${landlordName || 'this landlord'}'s account`,
    });
  }

  async function handleDelete(landlordId, landlordName) {
    setDangerError('');
    setDangerPassword('');
    setPendingDangerAction({ type: 'delete-landlord', landlordId, label: `Permanently delete ${landlordName}'s account` });
  }

  async function handleLockdown() {
    setDangerError('');
    setDangerPassword('');
    const reason = lockdownReason === 'custom' ? customReason : LOCKDOWN_REASON_PRESETS[lockdownReason];
    setPendingDangerAction({ type: 'lockdown', reason, label: 'Lock down the entire platform' });
  }

  async function confirmDangerAction() {
    if (!pendingDangerAction) return;
    if (!dangerPassword) {
      setDangerError('Enter the admin password to continue.');
      return;
    }
    setBusy(true);
    setDangerError('');
    try {
      if (pendingDangerAction.type === 'delete-landlord') {
        await api.deleteLandlordAccount(pendingDangerAction.landlordId, dangerPassword, token);
        setNotice('Landlord account deleted.');
        load();
      } else if (pendingDangerAction.type === 'lockdown') {
        const res = await api.emergencyLockdown({ reason: pendingDangerAction.reason, password: dangerPassword }, token);
        setNotice(res.message);
        setShowLockdownConfirm(false);
        load();
      } else if (pendingDangerAction.type === 'set-landlord-status') {
        await api.setLandlordStatus(pendingDangerAction.landlordId, { status: pendingDangerAction.status, password: dangerPassword }, token);
        setNotice(`Landlord ${pendingDangerAction.status}.`);
        load();
      } else if (pendingDangerAction.type === 'resume-lockdown') {
        const res = await api.resumeFromLockdown({ password: dangerPassword }, token);
        setNotice(res.message);
        load();
      }
      setPendingDangerAction(null);
      setDangerPassword('');
    } catch (err) {
      setDangerError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // FIX (direct request): lifting a platform lockdown now requires the
  // admin password too, same as triggering one.
  function handleResume() {
    setDangerError('');
    setDangerPassword('');
    setPendingDangerAction({ type: 'resume-lockdown', label: 'Resume the platform — restore all access' });
  }

  // ---------------------------------------------------------------
  // Clickable summary cards -> drill-down (item B)
  // ---------------------------------------------------------------
  async function openDrillDown(kind) {
    setDrillDown(kind);
    setDrillDownLoading(true);
    setDrillDownData(null);
    setSelectedExpiring([]);
    try {
      let data;
      if (kind === 'tenants') data = (await api.listAllTenantsAdmin(token)).tenants;
      if (kind === 'units') data = (await api.listAllUnitsAdmin(token)).units;
      if (kind === 'revenue') data = await api.getRevenueBreakdown('month', token);
      if (kind === 'revenue-year') data = await api.getRevenueBreakdown('year', token);
      if (kind === 'expiring') data = (await api.getExpiringLandlords(null, token)).landlords;
      setDrillDownData(data);
    } catch (err) {
      setError(err.message);
      setDrillDown(null);
    } finally {
      setDrillDownLoading(false);
    }
  }

  function toggleExpiringSelection(landlordId) {
    setSelectedExpiring((prev) => (prev.includes(landlordId) ? prev.filter((id) => id !== landlordId) : [...prev, landlordId]));
  }

  async function handleSendReminders() {
    if (selectedExpiring.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.sendRenewalReminders({ landlordIds: selectedExpiring }, token);
      const sentCount = res.results.filter((r) => r.sent).length;
      setNotice(`Renewal reminder sent to ${sentCount} of ${res.results.length} landlord(s).`);
      setSelectedExpiring([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const filteredLandlords = useMemo(() => {
    const q = landlordSearch.trim().toLowerCase();
    let list = landlords;
    if (landlordStatusFilter !== 'all') list = list.filter((l) => l.subscription_status === landlordStatusFilter);
    if (!q) return list;
    return list.filter((l) =>
      [l.full_name, l.phone, l.email, l.estate_name, l.location, l.county].filter(Boolean).some((field) => field.toLowerCase().includes(q))
    );
  }, [landlords, landlordSearch, landlordStatusFilter]);

  if (loading) return <div className="admin-page admin-page--center">Loading admin panel…</div>;
  if (error && !metrics) {
    return (
      <div className="admin-page admin-page--center">
        <p>{error}</p>
        <Button variant="ghost" onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PortalSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey={activeTab}
        brandName="RentaPay Admin"
        items={[
          { key: 'overview', label: 'Overview', icon: '📊', onClick: () => setActiveTab('overview') },
          { key: 'statistics', label: 'Financial Statistics', icon: '📈', onClick: () => setActiveTab('statistics') },
          { key: 'landlords', label: 'Landlords', icon: '🏢', onClick: () => setActiveTab('landlords') },
          { key: 'help', label: 'Help Requests', icon: '❓', onClick: () => setActiveTab('help') },
          { key: 'credentials', label: 'First-Time Credentials', icon: '🔑', onClick: () => setActiveTab('credentials') },
          { key: 'sql', label: 'SQL', icon: '🗄️', onClick: () => setActiveTab('sql') },
          { key: 'messages', label: 'Messages', icon: '💬', onClick: () => setActiveTab('messages') },
          { key: 'broadcast', label: 'Broadcast', icon: '📢', onClick: () => setShowBroadcastModal(true) },
          { key: 'activity', label: 'Activity Log', icon: '🕒', onClick: () => setActiveTab('activity') },
          { key: 'faq', label: 'FAQs', icon: '📚', onClick: () => setActiveTab('faq') },
        ]}
      />

      <header className="admin-header">
        <div className="admin-header__left">
          <button type="button" className="portal-topbar__hamburger admin-header__hamburger" aria-label="Menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="admin-header__brand">RentaPay <span>Admin</span></div>
        </div>
        <div className="admin-header__right">
          <button className="admin-header__logout" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      {showBroadcastModal && (
        <div className="modal-overlay" onClick={() => setShowBroadcastModal(false)}>
          <div className="modal-shell" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2>Broadcast</h2>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              Tagged "RentaPay" everywhere it shows up - not scoped to one landlord's account.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!broadcastMessage.trim()) return;
                setBroadcastSending(true);
                setError('');
                try {
                  await api.broadcastPlatformAnnouncement(broadcastMessage.trim(), broadcastTargetGroup, token);
                  setNotice('Announcement sent.');
                  setBroadcastMessage('');
                  setShowBroadcastModal(false);
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : 'Failed to send broadcast.');
                } finally {
                  setBroadcastSending(false);
                }
              }}
            >
              <div className="form-field">
                <label className="form-field__label">Send to</label>
                <select value={broadcastTargetGroup} onChange={(e) => setBroadcastTargetGroup(e.target.value)}>
                  <option value="all">Everyone (all landlords, managers, caretakers, and tenants)</option>
                  <option value="tenants">Tenants only</option>
                  <option value="landlord_team">Landlords, managers, and caretakers only</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-field__label">Message</label>
                <textarea
                  required
                  rows={4}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="e.g. RentaPay will be undergoing scheduled maintenance on Saturday from 1am to 3am."
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
                />
              </div>
              <div className="settings-manager-row__actions">
                <Button type="submit" variant="primary" loading={broadcastSending}>Send</Button>
                <button type="button" className="ghost-link" onClick={() => setShowBroadcastModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingDangerAction && (
        <div className="modal-overlay" onClick={() => { if (!busy) { setPendingDangerAction(null); setDangerPassword(''); setDangerError(''); } }}>
          <div className="modal-shell" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2>Confirm with your admin password</h2>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              {pendingDangerAction.label}
              {pendingDangerAction.type === 'delete-landlord'
                ? '. This is irreversible - re-enter your admin password to proceed.'
                : '. Re-enter your admin password to proceed.'}
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); confirmDangerAction(); }}
            >
              <div className="form-field">
                <label className="form-field__label" htmlFor="danger-password">Admin password</label>
                <input
                  id="danger-password"
                  type="password"
                  autoFocus
                  required
                  value={dangerPassword}
                  onChange={(e) => setDangerPassword(e.target.value)}
                />
              </div>
              {dangerError && <p className="form-error">{dangerError}</p>}
              <div className="settings-manager-row__actions">
                <Button type="submit" variant="primary" loading={busy}>Confirm</Button>
                <button
                  type="button"
                  className="ghost-link"
                  onClick={() => { setPendingDangerAction(null); setDangerPassword(''); setDangerError(''); }}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingActivityDelete}
        title={pendingActivityDelete?.type === 'day' ? 'Delete all logs for this day?' : 'Delete this log entry?'}
        message={pendingActivityDelete?.label}
        confirmLabel="Yes, delete"
        busy={activityDeleteBusy}
        onConfirm={confirmActivityDelete}
        onCancel={() => setPendingActivityDelete(null)}
      />

      <main className="admin-main">
        {notice && <div className="admin-banner admin-banner--ok">{notice}</div>}
        {error && <div className="admin-banner admin-banner--error">{error}</div>}

        <nav className="admin-tabs">
          <button className={activeTab === 'overview' ? 'is-active' : ''} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={activeTab === 'statistics' ? 'is-active' : ''} onClick={() => setActiveTab('statistics')}>Financial Statistics</button>
          <button className={activeTab === 'landlords' ? 'is-active' : ''} onClick={() => setActiveTab('landlords')}>Landlords</button>
          <button className={activeTab === 'help' ? 'is-active' : ''} onClick={() => setActiveTab('help')}>Help Requests</button>
          <button className={activeTab === 'credentials' ? 'is-active' : ''} onClick={() => setActiveTab('credentials')}>First-Time Credentials</button>
          <button className={activeTab === 'sql' ? 'is-active' : ''} onClick={() => setActiveTab('sql')}>SQL</button>
          <button className={activeTab === 'messages' ? 'is-active' : ''} onClick={() => setActiveTab('messages')}>Messages</button>
          <button className={activeTab === 'activity' ? 'is-active' : ''} onClick={() => setActiveTab('activity')}>Activity Log</button>
          <button className={activeTab === 'faq' ? 'is-active' : ''} onClick={() => setActiveTab('faq')}>FAQs</button>
        </nav>

        {activeTab === 'statistics' && <AdminStatistics token={token} />}
        {activeTab === 'faq' && <Faq audience="admin" />}
        {activeTab === 'credentials' && <AdminCredentialsPanel token={token} />}
        {activeTab === 'sql' && <AdminSqlPanel token={token} />}


        {activeTab === 'overview' && (
          <>
            <section className="admin-metrics">
              <button type="button" className="admin-metric-card admin-metric-card--clickable" onClick={() => openDrillDown('tenants')}>
                <span className="admin-metric-card__label">Total tenants</span>
                <span className="admin-metric-card__value">{metrics.totalTenants}</span>
                <span className="admin-metric-card__hint">View list →</span>
              </button>
              <button type="button" className="admin-metric-card admin-metric-card--clickable" onClick={() => openDrillDown('units')}>
                <span className="admin-metric-card__label">Total units</span>
                <span className="admin-metric-card__value">{metrics.totalUnits}</span>
                <span className="admin-metric-card__hint">View list →</span>
              </button>
              <button
                type="button"
                className="admin-metric-card admin-metric-card--clickable admin-metric-card--good"
                onClick={() => openDrillDown('revenue')}
              >
                <span className="admin-metric-card__label">Revenue this month</span>
                <span className="admin-metric-card__value">KES {Number(metrics.revenueThisMonth || 0).toLocaleString()}</span>
                <span className="admin-metric-card__hint">View breakdown →</span>
              </button>
              <button
                type="button"
                className="admin-metric-card admin-metric-card--clickable admin-metric-card--good"
                onClick={() => openDrillDown('revenue-year')}
              >
                <span className="admin-metric-card__label">Revenue this year</span>
                <span className="admin-metric-card__value">KES {Number(metrics.revenueThisYear || 0).toLocaleString()}</span>
                <span className="admin-metric-card__hint">View breakdown →</span>
              </button>
              <button type="button" className="admin-metric-card admin-metric-card--clickable" onClick={() => setActiveTab('landlords')}>
                <span className="admin-metric-card__label">Total landlords</span>
                <span className="admin-metric-card__value">{metrics.totalLandlords}</span>
                <span className="admin-metric-card__sub">{metrics.activeLandlords} active · {metrics.suspendedLandlords} suspended</span>
                <span className="admin-metric-card__hint">View details →</span>
              </button>
              <button
                type="button"
                className="admin-metric-card admin-metric-card--clickable admin-metric-card--warn"
                onClick={() => { setLandlordStatusFilter('suspended'); setLandlordSearch(''); setActiveTab('landlords'); }}
              >
                <span className="admin-metric-card__label">Suspended landlords</span>
                <span className="admin-metric-card__value">{metrics.suspendedLandlords}</span>
                <span className="admin-metric-card__hint">View list →</span>
              </button>
              <button
                type="button"
                className="admin-metric-card admin-metric-card--clickable admin-metric-card--warn"
                onClick={() => openDrillDown('expiring')}
              >
                <span className="admin-metric-card__label">Expiring soon (≤7 days)</span>
                <span className="admin-metric-card__value">{metrics.expiringSoon?.length || 0}</span>
                <span className="admin-metric-card__hint">Contact & remind →</span>
              </button>
            </section>

            {drillDown && (
              <section className="admin-section admin-drilldown">
                <div className="admin-drilldown__header">
                  <h2>
                    {drillDown === 'tenants' && 'All tenants'}
                    {drillDown === 'units' && 'All units'}
                    {drillDown === 'revenue' && 'Revenue this month — breakdown'}
                    {drillDown === 'revenue-year' && 'Revenue this year — breakdown'}
                    {drillDown === 'expiring' && 'Subscriptions expiring soon'}
                  </h2>
                  <div className="admin-drilldown__header-actions">
                    {!drillDownLoading && drillDownData && (
                      <button
                        className="ghost-link"
                        onClick={() => {
                          if (drillDown === 'tenants') {
                            downloadCsv(
                              'rentapay-tenants',
                              ['Name', 'Phone', 'Landlord', 'Unit', 'Location', 'Balance (KES)', 'Status'],
                              (drillDownData || []).map((t) => [
                                t.full_name,
                                t.primary_phone,
                                t.landlords?.full_name || '',
                                t.units?.unit_name || '',
                                [t.units?.properties?.location || t.landlords?.location, t.units?.properties?.county || t.landlords?.county].filter(Boolean).join(', '),
                                t.balance_due,
                                t.is_active ? 'Active' : 'Inactive',
                              ])
                            );
                          } else if (drillDown === 'units') {
                            downloadCsv(
                              'rentapay-units',
                              ['Unit', 'Type', 'Landlord', 'Location', 'Rent (KES)', 'Status'],
                              (drillDownData || []).map((u) => [
                                u.unit_name,
                                u.unit_type || '',
                                u.landlords?.full_name || '',
                                [u.properties?.location || u.landlords?.location, u.properties?.county || u.landlords?.county].filter(Boolean).join(', '),
                                u.rent_amount,
                                u.status,
                              ])
                            );
                          } else if (drillDown === 'revenue' || drillDown === 'revenue-year') {
                            downloadCsv(
                              `rentapay-revenue-${drillDown === 'revenue-year' ? 'year' : 'month'}`,
                              ['Date', 'Landlord', 'Amount (KES)'],
                              (drillDownData.payments || []).map((p) => [
                                p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '',
                                p.landlords?.full_name || '',
                                p.amount,
                              ])
                            );
                          } else if (drillDown === 'expiring') {
                            downloadCsv(
                              'rentapay-expiring-subscriptions',
                              ['Landlord', 'Estate', 'Phone', 'Email', 'Location', 'Expires'],
                              (drillDownData || []).map((l) => [
                                l.full_name,
                                l.estate_name || '',
                                l.phone,
                                l.email || '',
                                [l.location, l.county].filter(Boolean).join(', '),
                                l.subscription_expires_at ? new Date(l.subscription_expires_at).toLocaleDateString('en-GB') : '',
                              ])
                            );
                          }
                        }}
                      >
                        Download
                      </button>
                    )}
                    <button className="admin-drilldown__close" onClick={() => setDrillDown(null)}>Close ✕</button>
                  </div>
                </div>

                {drillDownLoading && <p>Loading…</p>}

                {!drillDownLoading && drillDown === 'tenants' && (
                  <table className="admin-table">
                    <thead><tr><th></th><th>Name</th><th>Phone</th><th>Landlord</th><th>Unit</th><th>Location</th><th>Balance</th><th>Status</th></tr></thead>
                    <tbody>
                      {(drillDownData || []).map((t) => (
                        <tr key={t.id}>
                          <td><TenantContactCard tenant={{ ...t, unit_name: t.units?.unit_name }} size={30} /></td>
                          <td>{t.full_name}</td>
                          <td>{t.primary_phone}</td>
                          <td>{t.landlords?.full_name || '—'}</td>
                          <td>{t.units?.unit_name || '—'}</td>
                          <td>{[t.units?.properties?.location || t.landlords?.location, t.units?.properties?.county || t.landlords?.county].filter(Boolean).join(', ') || '—'}</td>
                          <td className={Number(t.balance_due) > 0 ? 'admin-balance--owing' : ''}>
                            KES {Number(t.balance_due || 0).toLocaleString()}
                          </td>
                          <td>{t.is_active ? 'Active' : 'Inactive'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {!drillDownLoading && drillDown === 'units' && (
                  <table className="admin-table">
                    <thead><tr><th>Unit</th><th>Type</th><th>Landlord</th><th>Location</th><th>Rent</th><th>Status</th></tr></thead>
                    <tbody>
                      {(drillDownData || []).map((u) => (
                        <tr key={u.id}>
                          <td>{u.unit_name}</td>
                          <td>{u.unit_type || '—'}</td>
                          <td>{u.landlords?.full_name || '—'}</td>
                          <td>{[u.properties?.location || u.landlords?.location, u.properties?.county || u.landlords?.county].filter(Boolean).join(', ') || '—'}</td>
                          <td>KES {Number(u.rent_amount || 0).toLocaleString()}</td>
                          <td>{u.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {!drillDownLoading && (drillDown === 'revenue' || drillDown === 'revenue-year') && drillDownData && (
                  <>
                    <p className="admin-section__hint">Total: KES {Number(drillDownData.total || 0).toLocaleString()} from {drillDownData.payments?.length || 0} payment(s) this {drillDown === 'revenue-year' ? 'year' : 'month'}.</p>
                    <table className="admin-table">
                      <thead><tr><th>Date</th><th>Landlord</th><th>Amount</th></tr></thead>
                      <tbody>
                        {(drillDownData.payments || []).map((p) => (
                          <tr key={p.id}>
                            <td>{new Date(p.paid_at).toLocaleDateString('en-GB')}</td>
                            <td>{p.landlords?.full_name || '—'}</td>
                            <td>KES {Number(p.amount).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {!drillDownLoading && drillDown === 'expiring' && (
                  <>
                    {(drillDownData || []).length === 0 && <p>No subscriptions expiring soon.</p>}
                    {(drillDownData || []).length > 0 && (
                      <>
                        <div className="admin-drilldown__actions">
                          <Button variant="primary" loading={busy} disabled={selectedExpiring.length === 0} onClick={handleSendReminders}>
                            Send renewal reminder to {selectedExpiring.length || ''} selected
                          </Button>
                        </div>
                        <table className="admin-table">
                          <thead><tr><th></th><th>Landlord</th><th>Contact</th><th>Property location</th><th>Expires</th><th>Draft reminder</th></tr></thead>
                          <tbody>
                            {drillDownData.map((l) => (
                              <tr key={l.id}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedExpiring.includes(l.id)}
                                    onChange={() => toggleExpiringSelection(l.id)}
                                  />
                                </td>
                                <td>{l.full_name} <span className="admin-table__estate-name">{l.estate_name}</span></td>
                                <td>{l.phone}{l.email ? ` · ${l.email}` : ''}</td>
                                <td>{[l.location, l.county].filter(Boolean).join(', ') || '—'}</td>
                                <td>{l.daysLeft} day{l.daysLeft === 1 ? '' : 's'}</td>
                                <td className="admin-table__draft-message">{l.draftMessage}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </>
                )}
              </section>
            )}

            <section className="admin-section admin-section--danger">
              <h2>Emergency lockdown</h2>

              {lockdownStatus?.is_locked_down ? (
                <div className="lockdown-active">
                  <span className="lockdown-active__badge">⚠ PLATFORM CURRENTLY LOCKED DOWN</span>
                  <p className="lockdown-active__reason">"{lockdownStatus.lockdown_reason}"</p>
                  <p className="admin-section__hint">
                    Locked down since {new Date(lockdownStatus.lockdown_started_at).toLocaleString('en-GB')}. No landlord, property manager, caretaker, or tenant can access the platform until you resume.
                  </p>
                  <Button variant="primary" loading={busy} onClick={handleResume}>Resume platform — restore all access</Button>
                </div>
              ) : (
                <>
                  <p className="admin-section__hint">Blocks every landlord, property manager, caretaker, and tenant platform-wide — including anyone already logged in right now. Use only in a genuine emergency.</p>
                  {!showLockdownConfirm ? (
                    <Button variant="ghost" onClick={() => setShowLockdownConfirm(true)}>Lock down platform</Button>
                  ) : (
                    <div className="lockdown-confirm">
                      <label className="form-field__label">Reason to show anyone trying to log in</label>
                      <select className="lockdown-reason-select" value={lockdownReason} onChange={(e) => setLockdownReason(e.target.value)}>
                        <option value="maintenance">Scheduled technical maintenance</option>
                        <option value="security">Security precaution</option>
                        <option value="billing">Billing system issue</option>
                        <option value="custom">Custom reason…</option>
                      </select>
                      {lockdownReason === 'custom' && (
                        <textarea
                          className="lockdown-custom-reason"
                          placeholder="Type the exact message landlords/tenants will see"
                          value={customReason}
                          onChange={(e) => setCustomReason(e.target.value)}
                          rows={2}
                        />
                      )}
                      <p><strong>Are you sure?</strong> This immediately blocks every landlord, manager, caretaker, and tenant — including anyone currently logged in. You'll be asked to confirm your admin password on the next step.</p>
                      <div className="lockdown-confirm__actions">
                        <button className="lockdown-confirm__cancel" onClick={() => setShowLockdownConfirm(false)}>Cancel</button>
                        <button
                          className="lockdown-confirm__confirm"
                          disabled={busy || (lockdownReason === 'custom' && !customReason.trim())}
                          onClick={handleLockdown}
                        >
                          Yes, lock down now
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}

        {activeTab === 'landlords' && (
          <section className="admin-section">
            <div className="admin-section__header-row">
              <h2>All landlords</h2>
              <select
                className="admin-search-input"
                style={{ maxWidth: 160 }}
                value={landlordStatusFilter}
                onChange={(e) => setLandlordStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="suspended">Suspended only</option>
              </select>
              <input
                type="search"
                className="admin-search-input"
                placeholder="Search by name, phone, email, or location…"
                value={landlordSearch}
                onChange={(e) => setLandlordSearch(e.target.value)}
              />
              {filteredLandlords.length > 0 && (
                <button
                  className="ghost-link"
                  onClick={() =>
                    downloadCsv(
                      'rentapay-landlords',
                      ['Name', 'Estate', 'Phone', 'Email', 'Location', 'County', 'Plan', 'Unit Limit', 'Status', 'Expires'],
                      filteredLandlords.map((l) => [
                        l.full_name,
                        l.estate_name || '',
                        l.phone,
                        l.email || '',
                        l.location || '',
                        l.county || '',
                        l.subscription_plan,
                        l.unit_limit,
                        l.subscription_status,
                        l.subscription_expires_at ? new Date(l.subscription_expires_at).toLocaleDateString('en-GB') : '',
                      ])
                    )
                  }
                >
                  Download
                </button>
              )}
            </div>
            {filteredLandlords.length === 0 && <p className="admin-section__hint">No landlords match "{landlordSearch}".</p>}
            <table className="admin-table">
              <thead>
                <tr><th></th><th>Name</th><th>Contact</th><th>Location</th><th>Plan</th><th>Units</th><th>Status</th><th>Expires</th><th></th></tr>
              </thead>
              <tbody>
                {filteredLandlords.map((l) => (
                  <tr key={l.id}>
                    <td><Avatar name={l.full_name} photoUrl={l.photo_url} size={32} /></td>
                    <td>
                      <div className="admin-table__name-cell">
                        <span>{l.full_name}</span>
                        {l.estate_name && <span className="admin-table__estate-name">{l.estate_name}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="admin-table__contact-cell">
                        <span>{l.phone}</span>
                        {l.email && <span className="admin-table__email">{l.email}</span>}
                      </div>
                    </td>
                    <td>{[l.location, l.county].filter(Boolean).join(', ') || '—'}</td>
                    <td>{l.subscription_plan}</td>
                    <td>{l.unit_limit}</td>
                    <td><span className={`admin-status admin-status--${l.subscription_status}`}>{l.subscription_status}</span></td>
                    <td>{l.subscription_expires_at ? new Date(l.subscription_expires_at).toLocaleDateString('en-GB') : '—'}</td>
                    <td className="admin-table__actions">
                      <button disabled={busy} onClick={() => setEditingLandlord({ id: l.id, name: l.full_name })}>Edit</button>
                      {l.subscription_status === 'suspended' ? (
                        <button disabled={busy} onClick={() => handleSetStatus(l.id, 'active', l.full_name)}>Activate</button>
                      ) : (
                        <button disabled={busy} onClick={() => handleSetStatus(l.id, 'suspended', l.full_name)}>Suspend</button>
                      )}
                      <button disabled={busy} className="admin-table__delete" onClick={() => handleDelete(l.id, l.full_name)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === 'help' && (
          <section className="admin-section">
            <div className="admin-section__header-row">
              <h2>Help requests</h2>
              <select
                className="lockdown-reason-select"
                value={helpFilter}
                onChange={(e) => {
                  setHelpFilter(e.target.value);
                  loadHelpRequests(e.target.value);
                }}
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="all">All</option>
              </select>
              {helpCategoryFiltered.length > 0 && (
                <button
                  className="ghost-link"
                  onClick={() =>
                    downloadCsv(
                      'rentapay-help-requests',
                      ['When', 'From', 'Type', 'Phone', 'Message', 'Status'],
                      helpCategoryFiltered.map((h) => [
                        new Date(h.created_at).toLocaleString('en-GB'),
                        h.name,
                        helpCategoryOf(h),
                        h.phone || '',
                        h.message,
                        h.status,
                      ])
                    )
                  }
                >
                  Download
                </button>
              )}
            </div>

            {/* Categorized under their own tab, per direct request -
                landlords, tenants, managers, and caretakers are easy
                to mix up when they're all in one flat list. */}
            <div className="ppc-status-tabs" style={{ marginBottom: 16 }}>
              {['all', 'tenant', 'landlord', 'manager', 'caretaker', 'guest'].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`ppc-status-tabs__item ${helpCategory === c ? 'is-active' : ''}`}
                  onClick={() => setHelpCategory(c)}
                >
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                  {c !== 'all' && ` (${helpRequests.filter((h) => helpCategoryOf(h) === c).length})`}
                </button>
              ))}
            </div>

            {helpLoading && <p>Loading…</p>}
            {!helpLoading && helpGroups.length === 0 && (
              <p className="admin-section__hint">No {helpFilter !== 'all' ? helpFilter : ''} help requests{helpCategory !== 'all' ? ` from ${helpCategory}s` : ''}.</p>
            )}
            {!helpLoading && helpGroups.map((group) => (
              <div key={group.dateKey} className="activity-day">
                <div className="activity-day__header" onClick={() => toggleHelpDay(group.dateKey)}>
                  <span className="activity-day__toggle">{expandedHelpDays.includes(group.dateKey) ? '▾' : '▸'}</span>
                  <span className="activity-day__label">{group.label}</span>
                  <span className="activity-day__count">{group.requests.length} request{group.requests.length === 1 ? '' : 's'}</span>
                </div>
                {expandedHelpDays.includes(group.dateKey) && (
                  <table className="admin-table">
                    <thead><tr><th>When</th><th>From</th><th>Phone</th><th>Message</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {group.requests.map((h) => (
                        <tr key={h.id}>
                          <td>{new Date(h.created_at).toLocaleString('en-GB')}</td>
                          <td>{h.name} <span className="admin-table__estate-name">{helpCategoryOf(h)}</span></td>
                          <td>{h.phone || '—'}</td>
                          <td className="admin-table__draft-message">{h.message}</td>
                          <td><span className={`admin-status admin-status--${h.status === 'resolved' ? 'active' : 'suspended'}`}>{h.status}</span></td>
                          <td className="admin-table__actions">
                            {h.status !== 'resolved' && (
                              <button disabled={busy} onClick={() => handleResolveHelp(h.id)}>Mark resolved</button>
                            )}
                            <button disabled={busy} className="admin-table__delete" onClick={() => setPendingHelpDelete(h.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}

            <ConfirmDialog
              open={!!pendingHelpDelete}
              title="Delete this help request?"
              message="This permanently removes the help request. This cannot be undone."
              confirmLabel="Yes, delete"
              danger
              busy={helpDeleteBusy}
              onConfirm={confirmHelpDelete}
              onCancel={() => setPendingHelpDelete(null)}
            />
          </section>
        )}

        {activeTab === 'messages' && (
          <section className="admin-section">
            <h2>Messages</h2>
            <p className="admin-section__hint">
              Live "Chat with an agent" conversations from landlords and tenants land here - reply to any
              bubble the same way you would on WhatsApp, and it lands greyed-out/quoted above your reply
              in their portal.
            </p>
            <div className="admin-messages-layout">
              <div className="admin-messages-layout__list">
                <ChatThreadList token={token} onSelect={setSelectedThread} selectedKey={selectedThread ? `${selectedThread.threadType}:${selectedThread.landlordId || ''}:${selectedThread.tenantId || ''}` : null} />
              </div>
              <div className="admin-messages-layout__conversation">
                {selectedThread ? (
                  <ChatConversation token={token} role="admin" thread={selectedThread} />
                ) : (
                  <p className="admin-section__hint">Select a conversation on the left to view and reply.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'activity' && (
          <section className="admin-section">
            <div className="admin-section__header-row">
              <h2>Platform activity log</h2>
              {activityGroups.length > 0 && (
                <button
                  className="ghost-link"
                  onClick={() =>
                    downloadCsv(
                      'rentapay-activity-log',
                      ['Date', 'Time', 'Actor', 'Action', 'Target'],
                      activityGroups.flatMap((group) =>
                        group.logs.map((log) => [
                          group.label,
                          new Date(log.created_at).toLocaleTimeString('en-GB'),
                          log.actor_type,
                          log.action,
                          log.target_type || '',
                        ])
                      )
                    )
                  }
                >
                  Download
                </button>
              )}
            </div>
            {activityGroups.length === 0 && <p className="admin-section__hint">No activity recorded yet.</p>}
            {activityGroups.map((group) => (
              <div key={group.dateKey} className="activity-day">
                <div className="activity-day__header" onClick={() => toggleActivityDay(group.dateKey)}>
                  <span className="activity-day__toggle">{expandedActivityDays.includes(group.dateKey) ? '▾' : '▸'}</span>
                  <span className="activity-day__label">{group.label}</span>
                  <span className="activity-day__count">{group.logs.length} event{group.logs.length === 1 ? '' : 's'}</span>
                  <button
                    className="activity-day__delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteActivityDay(group.dateKey);
                    }}
                  >
                    Delete this day
                  </button>
                </div>
                {expandedActivityDays.includes(group.dateKey) && (
                  <table className="admin-table">
                    <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th></th></tr></thead>
                    <tbody>
                      {group.logs.map((log) => (
                        <tr key={log.id}>
                          <td>{new Date(log.created_at).toLocaleTimeString('en-GB')}</td>
                          <td>{log.actor_type}</td>
                          <td>{log.action}</td>
                          <td>{log.target_type || '—'}</td>
                          <td><button onClick={() => handleDeleteActivityEntry(log.id)}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </section>
        )}
      </main>

      {editingLandlord && (
        <LandlordEditModal
          landlordId={editingLandlord.id}
          landlordName={editingLandlord.name}
          token={token}
          onClose={() => setEditingLandlord(null)}
          onSaved={() => {
            setEditingLandlord(null);
            setNotice('Landlord details updated.');
            load();
          }}
        />
      )}
    </div>
  );
}
