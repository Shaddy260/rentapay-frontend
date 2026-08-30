import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import { api, ApiError } from '../api/client.js';
import Button from '../components/Button.jsx';
import HelpButton from '../components/HelpButton.jsx';
import { rememberActiveProperty } from '../utils/activeProperty.js';
import TopRefreshBar from '../components/TopRefreshBar.jsx';
import PullToRefresh from '../components/PullToRefresh.jsx';
import AccountMenu from '../components/AccountMenu.jsx';
import TenantContactCard from '../components/TenantContactCard.jsx';
import Countdown from '../components/Countdown.jsx';
import PortalSidebar from '../components/PortalSidebar.jsx';
import BottomNav from '../components/BottomNav.jsx';
import GlobalSearch from '../components/GlobalSearch.jsx';
import Skeleton from '../components/Skeleton.jsx';
import OnboardingChecklist from '../components/OnboardingChecklist.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { MissingPhotosBanner, MissingPhotosBadge } from '../components/MissingPhotosNudge.jsx';
import { downloadCsv } from '../utils/downloadCsv.js';
import { useBadgeAlert } from '../utils/useBadgeAlert.js';
import AddPropertyModal from '../components/AddPropertyModal.jsx';
import BulkRentChangeModal from '../components/BulkRentChangeModal.jsx';
import BulkDueDateChangeModal from '../components/BulkDueDateChangeModal.jsx';
import LandlordStatistics from '../components/LandlordStatistics.jsx';
import RateTenantReminderPopup from '../components/RateTenantReminderPopup.jsx';
import LoyaltyDiscountReminderPopup from '../components/LoyaltyDiscountReminderPopup.jsx';
import PaymentHistoryPanel from '../components/PaymentHistoryPanel.jsx';
import DisputesPanel from '../components/DisputesPanel.jsx';
import UtilityMetersPanel from '../components/UtilityMetersPanel.jsx';
import PaymentPlanRequestsPanel from '../components/PaymentPlanRequestsPanel.jsx';
import Faq from '../components/Faq.jsx';
import AnnouncementBell from '../components/AnnouncementBell.jsx';
import SupportChatWidget from '../components/SupportChatWidget.jsx';
import { useSharedPoll } from '../utils/sharedPoll.js';
import PendingPaymentsBell from '../components/PendingPaymentsBell.jsx';
import IncomingItemsBanner from '../components/IncomingItemsBanner.jsx';
import VirtualAssistant, { buildLandlordAssistantSteps } from '../components/VirtualAssistant.jsx';
import PaymentMethodBadge from '../components/PaymentMethodBadge.jsx';
// PERFORMANCE FIX (direct request: audit for slow-loading code):
// TenantListExport pulls in the `xlsx` library, which is large
// (several hundred KB) and was previously a static import here -
// meaning every landlord's dashboard bundle included it on first
// load, even though it's only used on the "tenant-lists" tab and only
// if the landlord actually exports. Lazy-loading it means that cost
// is only paid by someone who opens that specific tab.
const TenantListExport = lazy(() => import('../components/TenantListExport.jsx'));
import { initPushSubscription } from '../utils/push.js';
import { roleLabel } from '../utils/roleLabel.js';
import BroadcastPanel from '../components/BroadcastPanel.jsx';
import ArchivedTenantsPanel from '../components/ArchivedTenantsPanel.jsx';
import TenantReputationsPanel from '../components/TenantReputationsPanel.jsx';
import FirstTimeCredentialsPanel from '../components/FirstTimeCredentialsPanel.jsx';
import PendingPaymentConfirmations from '../components/PendingPaymentConfirmations.jsx';
import PendingPaymentConfirmationsCard from '../components/PendingPaymentConfirmationsCard.jsx';
import ComplaintsPanel from '../components/ComplaintsPanel.jsx';
import CommunityPanel from '../components/CommunityPanel.jsx';
import MyOwnRatingPanel from '../components/MyOwnRatingPanel.jsx';
import PropertyReputationPanel from '../components/PropertyReputationPanel.jsx';
import AttentionFeed from '../components/AttentionFeed.jsx';
import AtAGlanceSummary from '../components/AtAGlanceSummary.jsx';
import MaintenanceManagePanel from '../components/MaintenanceManagePanel.jsx';
import ExpensesPanel from '../components/ExpensesPanel.jsx';
import DueDatesCalendar from '../components/DueDatesCalendar.jsx';
import TenantOnboardingPanel from '../components/TenantOnboardingPanel.jsx';
import UnitTile from '../components/UnitTile.jsx';
import { prefetchLandlordPortal } from '../utils/prefetchPortal.js';
import { computeUnitStatus, countByStatus, STATUS_META } from '../utils/unitStatus.js';
import { openWhatsAppReminder } from '../utils/whatsapp.js';
import '../components/Countdown.css';
import '../components/SubscriptionLockGate.css';
import './Dashboard.css';
import InfoTip from '../components/InfoTip.jsx';

// How many tiles to preview per status group on the "All" overview page
// before handing off to that status's own dedicated page (spec section 2).
const GROUP_PREVIEW_SIZE = 6;

const STATUS_LABELS = {
  occupied: { label: 'Occupied', dotClass: 'status-dot--occupied' },
  notice_given: { label: 'Notice given', dotClass: 'status-dot--notice' },
  vacant: { label: 'Vacant', dotClass: 'status-dot--vacant' },
  maintenance: { label: 'Maintenance', dotClass: 'status-dot--maintenance' },
};

// FIX (direct request: "when i refresh any page... it clears the
// screen and gives the white screen... it should have contents
// already while it loads in the background"). The dashboard already
// avoided RE-showing its full-page loader on a manual reload/switch
// (see `loading && !summary` below), but `summary`/`units` reset to
// null/[] on every fresh mount regardless - which is exactly what a
// hard browser refresh (and, before the useAppNavigate fix, every
// route change too) causes. Mirroring the last-loaded shell into
// sessionStorage and reading it back synchronously as the initial
// state means there's real content on screen the instant this
// component mounts; load() below then quietly fetches the current
// data on top of it.
const DASHBOARD_CACHE_KEY = 'rentapay_dashboard_cache';
function readDashboardCache() {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeDashboardCache(partial) {
  try {
    const prev = readDashboardCache() || {};
    sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ ...prev, ...partial }));
  } catch {
    // non-fatal - just means the next hard refresh won't have a
    // head start, background fetch still works.
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const dashboardCache = readDashboardCache();
  const [summary, setSummary] = useState(() => dashboardCache?.summary || null);
  const [units, setUnits] = useState(() => dashboardCache?.units || []);
  const [unitSearch, setUnitSearch] = useState('');
  // DIRECT REQUEST: Remind/Call buttons on the "View Overdue Tenants" table.
  const [remindingTenantId, setRemindingTenantId] = useState(null);
  async function handleRemindOverdueTenant(tenant) {
    setRemindingTenantId(tenant.id);
    try {
      const res = await api.remindTenant(tenant.id, token);
      window.alert(res.skipped ? res.message : `Reminder sent to ${tenant.full_name}.`);
    } catch (err) {
      window.alert(err.message || 'Failed to send reminder.');
    } finally {
      setRemindingTenantId(null);
    }
  }

  // Section 5: WhatsApp channel for the same "Remind" action - fetches
  // the phone/message, then opens a wa.me deep link on the landlord's
  // own device/number with the text pre-filled. Nothing is sent from
  // the backend; the landlord taps "Send" inside WhatsApp themselves.
  const [whatsappRemindingTenantId, setWhatsappRemindingTenantId] = useState(null);
  async function handleWhatsAppRemindOverdueTenant(tenant) {
    setWhatsappRemindingTenantId(tenant.id);
    try {
      const res = await api.getWhatsAppReminderInfo(tenant.id, token);
      if (res.skipped) {
        window.alert(res.message);
      } else {
        openWhatsAppReminder(res.phone, res.message);
      }
    } catch (err) {
      window.alert(err.message || 'Failed to open WhatsApp reminder.');
    } finally {
      setWhatsappRemindingTenantId(null);
    }
  }

  // Redesign spec sections 1-4: every unit is now exactly one of
  // overdue / upcoming / paid / vacant (frozen units are handled
  // separately, unchanged). Search still narrows by unit or tenant
  // name; grouping/counts are then derived from the (searched) list.
  const [vacantExpanded, setVacantExpanded] = useState(false);
  // Section 4 (Status-Square Indicator System): one-time legend
  // explaining what the coloured squares mean, shown the first time a
  // landlord/manager opens the dashboard and never again after that
  // (per-device, via localStorage).
  const [showStatusLegend, setShowStatusLegend] = useState(false);
  React.useEffect(() => {
    try {
      if (localStorage.getItem('rentapay_status_square_legend_seen') !== '1') {
        setShowStatusLegend(true);
      }
    } catch {
      // localStorage unavailable - just skip the legend rather than
      // risk showing it on every visit.
    }
  }, []);
  function dismissStatusLegend() {
    setShowStatusLegend(false);
    try {
      localStorage.setItem('rentapay_status_square_legend_seen', '1');
    } catch {
      // non-fatal
    }
  }

  const searchFilteredUnits = useMemo(() => {
    if (!units) return [];
    const q = unitSearch.trim().toLowerCase();
    if (!q) return units;
    return units.filter((unit) => {
      const tenantNames = (unit.tenants || []).map((t) => t.full_name || '').join(' ');
      return `${unit.unit_name} ${tenantNames}`.toLowerCase().includes(q);
    });
  }, [units, unitSearch]);

  const groupedUnits = useMemo(() => {
    const groups = { overdue: [], upcoming: [], paid: [], vacant: [] };
    for (const unit of searchFilteredUnits) {
      if (unit.is_frozen) continue;
      const { status } = computeUnitStatus(unit);
      groups[status].push(unit);
    }
    return groups;
  }, [searchFilteredUnits]);

  const statusCounts = useMemo(() => countByStatus(searchFilteredUnits), [searchFilteredUnits]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => !dashboardCache?.summary);
  const [bulkRemindStatus, setBulkRemindStatus] = useState('');
  const [drillDown, setDrillDown] = useState(null);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [paidPayments, setPaidPayments] = useState(null);
  const [paidLoading, setPaidLoading] = useState(false);
  const [properties, setProperties] = useState(() => dashboardCache?.properties || []);
  // FIX (bug report: "on refresh it gives a preview of the getting-
  // started guide, makes it feel like the app reset"): summary/units/
  // properties are all seeded instantly from the sessionStorage cache
  // on mount (see readDashboardCache above) so there's real content
  // on screen right away - but this was left out of that cache, so it
  // always started at null for a moment on every refresh. Since the
  // OnboardingChecklist below only checks `dismissed={!!onboardingDismissedAt}`,
  // that null flashed the "Getting started" checklist for an already-
  // dismissed, well-established account until the real fetch came
  // back a moment later and hid it again. Now seeded from the same
  // cache as everything else.
  const [onboardingDismissedAt, setOnboardingDismissedAt] = useState(() => dashboardCache?.onboardingDismissedAt ?? null);
  const [activePropertyId, setActivePropertyId] = useState(() => dashboardCache?.activePropertyId || null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assistantAutoOpen, setAssistantAutoOpen] = useState(false);
  const assistantRef = useRef(null);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showBulkRentModal, setShowBulkRentModal] = useState(false);
  const [showBulkDueDateModal, setShowBulkDueDateModal] = useState(false);
  // Bumped whenever a due date changes (bulk, from this dashboard) so
  // the independently-fetching DueDatesCalendar below refetches
  // instead of continuing to show the pre-change grouping.
  const [dueDatesRefreshKey, setDueDatesRefreshKey] = useState(0);
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'statistics'
  const [showAnnouncementComposer, setShowAnnouncementComposer] = useState(false);
  const token = localStorage.getItem('rentapay_token');
  const [messagesBadge, setMessagesBadge] = useState(0);
  const [disputesBadge, setDisputesBadge] = useState(0);
  const [planRequestsBadge, setPlanRequestsBadge] = useState(0);
  const [communityBadge, setCommunityBadge] = useState(0);
  const [pendingPaymentsBadge, setPendingPaymentsBadge] = useState(0);

  // FEATURE (direct request): notification banner - same count
  // PendingPaymentsBell already tracks in the header, duplicated here
  // so IncomingItemsBanner can show it as a full-width tap target too.
  const loadPendingPaymentsBadge = useCallback(() => {
    if (!token) return;
    api
      .getPendingPaymentConfirmations('pending', token)
      .then((res) => setPendingPaymentsBadge((res.confirmations || []).filter((c) => !c.duplicate_of).length))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    loadPendingPaymentsBadge();
    window.addEventListener('rentapay:pending-payments-changed', loadPendingPaymentsBadge);
    return () => window.removeEventListener('rentapay:pending-payments-changed', loadPendingPaymentsBadge);
  }, [token, loadPendingPaymentsBadge]);

  const loadPlanRequestsBadge = useCallback(() => {
    if (!token) return;
    api
      .listPaymentPlanRequests({ status: 'pending' }, token)
      .then((res) => setPlanRequestsBadge((res.requests || []).length))
      .catch(() => {});
  }, [token]);

  // PERFORMANCE FIX: see src/utils/prefetchPortal.js - warms up every
  // portal chunk (Settings, Units, Messages, Subscription) right after
  // Dashboard mounts, so navigating anywhere from the sidebar or a
  // unit tile resolves instantly instead of hitting App.jsx's
  // full-screen Suspense fallback (which is what made the nav/menu
  // visibly disappear/reappear on those taps).
  useEffect(() => {
    prefetchLandlordPortal();
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    loadPlanRequestsBadge();
    window.addEventListener('rentapay:pending-payments-changed', loadPlanRequestsBadge);
    return () => window.removeEventListener('rentapay:pending-payments-changed', loadPlanRequestsBadge);
  }, [token, loadPlanRequestsBadge]);

  // Sidebar "Disputed" badge - count of open charge_disputes on the
  // account, so the landlord/manager sees at a glance that something
  // needs a look without opening the worklist.
  const loadDisputesBadge = useCallback(() => {
    if (!token) return;
    api
      .listDisputes({ status: 'open' }, token)
      .then((res) => setDisputesBadge((res.disputes || []).length))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    loadDisputesBadge();
    window.addEventListener('rentapay:pending-payments-changed', loadDisputesBadge);
    return () => window.removeEventListener('rentapay:pending-payments-changed', loadDisputesBadge);
  }, [token, loadDisputesBadge]);

  // Sidebar "Messages" badge - PendingPaymentsBell in the header already
  // covers payments; this covers unread chat threads the same way, so
  // the sidebar item shows something's waiting without opening it.
  const loadMessagesBadge = useCallback(() => {
    if (!token) return;
    api
      .listChatThreads(token)
      .then((res) => {
        const total = (res.threads || []).reduce((sum, t) => sum + (t.unreadCount || 0), 0);
        setMessagesBadge(total);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    loadMessagesBadge();
    window.addEventListener('rentapay:pending-payments-changed', loadMessagesBadge);
    return () => window.removeEventListener('rentapay:pending-payments-changed', loadMessagesBadge);
  }, [token, loadMessagesBadge]);

  // FIX: used to be its own independent setInterval(loadMessagesBadge,
  // 20000) - now rides the shared tick alongside the header bells.
  useSharedPoll(loadMessagesBadge, 20000);
  useBadgeAlert(messagesBadge, 'You have a new message.');

  // Sidebar "Community Board" badge (direct request: "no notification
  // counter on community ui... in all portals"). Same shape as the
  // Messages badge above - unread count from the backend, refreshed on
  // the same shared poll tick and whenever the panel itself marks
  // something read (see CommunityPanel's dispatch of this event).
  const loadCommunityBadge = useCallback(() => {
    if (!token) return;
    api
      .getCommunityUnreadCount(token, activePropertyId)
      .then((res) => setCommunityBadge(res.unreadCount || 0))
      .catch(() => {});
  }, [token, activePropertyId]);

  useEffect(() => {
    if (!token) return undefined;
    loadCommunityBadge();
    window.addEventListener('rentapay:community-read', loadCommunityBadge);
    return () => window.removeEventListener('rentapay:community-read', loadCommunityBadge);
  }, [token, loadCommunityBadge]);

  useSharedPoll(loadCommunityBadge, 20000);
  useBadgeAlert(communityBadge, 'New activity on your community board.');

  // A property manager sees this exact same dashboard, scoped to the
  // landlord who added them, with a handful of landlord-only actions
  // hidden (adding/removing managers, buying more properties/
  // subscription changes) - see auth.middleware.js requireLandlordOnly.
  const role = localStorage.getItem('rentapay_role');
  const isManager = role === 'manager';
  const roleLevel = localStorage.getItem('rentapay_role_level');
  const isCaretaker = isManager && roleLevel === 'caretaker';

  // Virtual Assistant (spec section 1): "auto-launches once for a
  // user's first login". Server-side flag (see
  // assistant.controller.js) rather than localStorage, so this
  // triggers correctly even on a brand-new device/browser and never
  // again after the first time, on any device. Same walkthrough
  // content for Landlord/Manager/Caretaker - buildLandlordAssistantSteps
  // filters it down using the exact isCaretaker flag above, so it can
  // never spotlight something this account's sidebar doesn't show.
  useEffect(() => {
    if (!token) return;
    api
      .getAssistantStatus(token)
      .then((res) => {
        if (!res.hasSeenAssistant) setAssistantAutoOpen(true);
      })
      .catch(() => {});
  }, [token]);

  const assistantSteps = useMemo(() => buildLandlordAssistantSteps({ isCaretaker }), [isCaretaker]);

  function openDrillDown(kind) {
    setDrillDown(kind);
    if (kind === 'paid' && paidPayments === null) {
      setPaidLoading(true);
      api
        .getPaymentsThisMonth(token, activePropertyId)
        .then((res) => setPaidPayments(res.payments || []))
        .catch((err) => setError(err.message))
        .finally(() => setPaidLoading(false));
    }
  }

  function load(propertyId, { retriedAfterNotAssigned = false } = {}) {
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    // FIX (direct request): "when a landlord shifts to another
    // apartment and reloads the page, it brings him back to his first
    // apartment - it should remain there unless he shifts himself."
    // On the very first load of this session (no propertyId argument
    // passed in at all - not even undefined from a manual switch),
    // check for a property the user picked earlier in this browser
    // session before ever falling back to "just pick the first one".
    if (propertyId === undefined) {
      const remembered = localStorage.getItem('rentapay_active_property_id');
      if (remembered) propertyId = remembered;
    }
    Promise.all([api.getDashboard(token, propertyId), api.listUnits(token, propertyId)])
      .then(([dashboardData, unitsData]) => {
        setSummary(dashboardData);
        setProperties(dashboardData.properties || []);
        setOnboardingDismissedAt(dashboardData.onboardingDismissedAt || null);
        // FIX ("there should be nothing like All Apartments - only one
        // at a time"): a landlord with more than one property used to
        // land on a merged "all properties" view by default, which is
        // exactly the mixed-up list the landlord doesn't want. If
        // nothing is selected yet and there's at least one property,
        // pick the first one and reload scoped to just that property.
        let resolvedPropertyId = dashboardData.activePropertyId || null;
        // The remembered ID might belong to a property this account no
        // longer has access to (revoked, or it was a different
        // account's session leftover on a shared browser) - only trust
        // it if it's still actually in this account's property list.
        if (!resolvedPropertyId && propertyId && (dashboardData.properties || []).some((p) => p.id === propertyId)) {
          resolvedPropertyId = propertyId;
        }
        if (!resolvedPropertyId && (dashboardData.properties || []).length > 0) {
          const firstPropertyId = dashboardData.properties[0].id;
          // BUG FIX: this used to just call load(firstPropertyId) and
          // return - but the OUTER promise chain's .finally() below
          // still ran immediately after this .then() finished, flipping
          // loading back to false before the recursive call's own fetch
          // had come back. That let the page render past the loading
          // guard with units still at its initial null, crashing on
          // units.length ("white screen" bug). Returning the recursive
          // call's promise makes the outer .finally() actually wait for
          // it to settle before touching `loading`.
          return load(firstPropertyId);
        }
        setActivePropertyId(resolvedPropertyId);
        if (resolvedPropertyId) {
          localStorage.setItem('rentapay_active_property_id', resolvedPropertyId);
          // Persist past this session too, so the next LOGIN (not just
          // the next reload) reopens this same apartment - see
          // utils/activeProperty.js.
          rememberActiveProperty(localStorage.getItem('rentapay_email') || localStorage.getItem('rentapay_phone'), resolvedPropertyId);
        }
        setUnits(unitsData.units || []);
        writeDashboardCache({
          summary: dashboardData,
          units: unitsData.units || [],
          properties: dashboardData.properties || [],
          activePropertyId: resolvedPropertyId,
          onboardingDismissedAt: dashboardData.onboardingDismissedAt || null,
        });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem('rentapay_token');
          localStorage.removeItem('rentapay_role');
          localStorage.removeItem('rentapay_role_level');
          if (err.accountRevoked) {
            localStorage.setItem('rentapay_logout_message', err.message);
          }
          navigate('/login');
          return;
        }
        // FIX (direct request: "a manager/caretaker keeps seeing 'you
        // don't have access to this property' until they're given
        // access to the first apartment the landlord added" - it
        // should never matter WHICH property they're assigned to):
        // if the requested property was rejected specifically because
        // this account isn't assigned to it (as opposed to some other
        // failure), drop the stale remembered id and retry ONE time
        // with no propertyId at all, which falls through to "resolve
        // my own actually-assigned property" server-side. Guarded by
        // an explicit flag (not by whether propertyId happened to be
        // truthy - that used to mean a request that was ALREADY
        // running with no propertyId, and still got rejected, never
        // got a retry at all) so this always gives one honest retry
        // and never loops a second time.
        if (err instanceof ApiError && err.raw?.notAssigned && !retriedAfterNotAssigned) {
          localStorage.removeItem('rentapay_active_property_id');
          load(undefined, { retriedAfterNotAssigned: true });
          return;
        }
        setError(err.message || 'Failed to load dashboard.');
      })
      .finally(() => setLoading(false));
  }

  function switchProperty(propertyId) {
    setSwitcherOpen(false);
    setPaidPayments(null); // drop cached "who paid" list - it's scoped to the old property
    const identifier = localStorage.getItem('rentapay_email') || localStorage.getItem('rentapay_phone');
    if (propertyId) {
      localStorage.setItem('rentapay_active_property_id', propertyId);
      rememberActiveProperty(identifier, propertyId);
    } else {
      localStorage.removeItem('rentapay_active_property_id');
      rememberActiveProperty(identifier, null);
    }
    load(propertyId || undefined);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Live push" - registers the service worker and subscribes this
  // browser for urgent-tier push notifications (payment-confirmation
  // requests, vacate notices, tenant messages). Safe no-op if the
  // browser doesn't support it or the person declines the permission
  // prompt - see utils/push.js.
  useEffect(() => {
    initPushSubscription(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  
  async function handleBulkRemind() {
    setBulkRemindStatus('Sending…');
    try {
      const res = await api.sendBulkReminders(token);
      setBulkRemindStatus(res.message);
    } catch (err) {
      setBulkRemindStatus(`Failed: ${err.message}`);
    }
  }

  // Section 5: bulk WhatsApp reminders. Fetches the queue of overdue
  // tenants (phone + pre-filled message each), then walks it one at a
  // time - each click opens the next tenant's wa.me chat, the landlord
  // sends and comes back, and taps "Next" to move on. Purely
  // client-side deep links; no WhatsApp Business API.
  const [whatsappBulkQueue, setWhatsappBulkQueue] = useState(null); // null = not started
  const [whatsappBulkIndex, setWhatsappBulkIndex] = useState(0);
  async function handleStartBulkWhatsAppRemind() {
    setBulkRemindStatus('Loading overdue tenants…');
    try {
      const res = await api.getWhatsAppBulkReminderQueue(token);
      if (!res.queue || res.queue.length === 0) {
        setBulkRemindStatus('No overdue tenants with a phone number to remind.');
        return;
      }
      setWhatsappBulkQueue(res.queue);
      setWhatsappBulkIndex(0);
      setBulkRemindStatus('');
      openWhatsAppReminder(res.queue[0].phone, res.queue[0].message);
    } catch (err) {
      setBulkRemindStatus(`Failed: ${err.message}`);
    }
  }
  function handleNextBulkWhatsAppRemind() {
    const nextIndex = whatsappBulkIndex + 1;
    if (!whatsappBulkQueue || nextIndex >= whatsappBulkQueue.length) {
      setWhatsappBulkQueue(null);
      setWhatsappBulkIndex(0);
      setBulkRemindStatus('WhatsApp reminders complete.');
      return;
    }
    setWhatsappBulkIndex(nextIndex);
    openWhatsAppReminder(whatsappBulkQueue[nextIndex].phone, whatsappBulkQueue[nextIndex].message);
  }
  function handleCancelBulkWhatsAppRemind() {
    setWhatsappBulkQueue(null);
    setWhatsappBulkIndex(0);
  }

  function handleDownloadReport() {
    // Builds a CSV client-side from data already loaded - no backend
    // report-generation endpoint exists yet (flagged honestly rather
    // than wiring a button to a 404). Covers the blueprint 11.2 "view
    // payment reports" need today; a real PDF/server-generated report
    // is a reasonable next increment.
    const headers = ['Unit', 'Status', 'Tenant', 'Rent (KES)', 'Balance Due (KES)'];
    const rows = [];
    for (const unit of units) {
      const activeTenant = (unit.tenants || []).find((t) => t.is_active);
      rows.push([unit.unit_name, unit.status, activeTenant?.full_name || '—', unit.rent_amount, activeTenant?.balance_due || 0]);
    }
    downloadCsv('rentapay-report', headers, rows);
  }

  // FIX (direct request - "every action eg back to dashboard, it must
  // load for 6 or so seconds before it opens, feels slow"): load()
  // re-fires on every visit to this page (property switch, remount on
  // navigating back, etc), and it unconditionally set loading=true
  // each time - which re-triggered this full blank-screen gate on
  // EVERY visit, not just the first. Only show the blank "Loading
  // your dashboard..." screen when there's genuinely nothing on
  // screen yet (summary === null, i.e. first-ever load this session).
  // Once it's loaded once, a re-fetch just updates in place with zero
  // loading screen - the data that's already there stays visible the
  // whole time instead of being wiped and redrawn.
  if (loading && !summary) {
    return (
      <div className="dashboard-page dashboard-page--loading">
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="dashboard-page dashboard-page--loading">
        <div className="dashboard-error-card">
          <h2>Couldn't load your dashboard</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }

  const sub = summary.subscription || {};
  const daysLeft = sub.daysLeft;
  // Content above (`summary`) is already on screen at this point,
  // whether from a fresh fetch or from cache - this sliver is the
  // only thing that shows while a background refresh is in flight.
  const showRefreshBar = loading;
  // FIX: was always `daysLeft / 365`, so a 1-month plan's bar barely
  // moved even right after paying. Now scaled against the actual plan
  // length purchased (periodMonths) - a fresh 1-month plan shows a
  // full bar, a fresh 12-month plan also shows a full bar, and both
  // empty out correctly over their own real length.
  const totalPlanDays = (sub.periodMonths || 1) * 30;
  const pctRemaining = daysLeft != null ? Math.max(0, Math.min(100, Math.round((daysLeft / totalPlanDays) * 100))) : null;
  const isUrgent = daysLeft != null && daysLeft <= 14;
  // Distinct, more alarming color once truly close to lockout (<=5
  // days) - separate from the general "urgent" <=14-day amber state.
  const isCritical = daysLeft != null && daysLeft <= 5;
  // Subscription lapsed entirely - the landlord can log in, but the
  // dashboard itself is gated behind a non-dismissible renew prompt
  // (direct request: don't pause any underlying activity - tenants,
  // billing jobs, reminders all keep running exactly as before - this
  // only blocks the LANDLORD's own dashboard view until they renew).
  const subscriptionExpired = sub.status === 'expired' || (daysLeft != null && daysLeft <= 0);

  // FIX (direct request: "everything should be paused... a landlord
  // can still see his dashboard and can still see submitted
  // payments... everything should be paused"): this used to be a
  // banner sitting ABOVE a fully-rendered, fully-functional dashboard
  // - every panel below it (pending payments, units, community,
  // messages, everything) kept mounting and fetching data regardless.
  // This is now a hard early return: once the CURRENTLY SELECTED
  // property/account is expired, nothing else in this component
  // renders at all - no panels, no data fetches from them, nothing
  // reachable underneath. The only ways out are picking a different,
  // still-active property below, renewing, or logging out.
  if (subscriptionExpired) {
    const otherProperties = properties.filter((p) => p.id !== activePropertyId);
    return (
      <div className="subscription-lock-gate">
        <div className="subscription-lock-gate__card">
          <h1>{sub.scopedToPropertyId ? 'This apartment\u2019s subscription has ended' : 'Your RentaPay subscription has ended'}</h1>
          <p>
            {isManager
              ? "The landlord's RentaPay subscription has ended. All access is locked, including yours, until it's renewed - contact them to renew it."
              : sub.scopedToPropertyId
                ? "All access to this apartment is locked until it's renewed - its dashboard, units, and payments are unavailable until then."
                : "All access to RentaPay is locked until you renew - your dashboard, units, messages, and everything else are unavailable until then."}
          </p>
          <InfoTip text={<>
            Everything is saved and waiting exactly as you left it, and your tenants' portals keep working normally in the meantime.
          </>} />

          {otherProperties.length > 0 && (
            <div className="subscription-lock-gate__switcher">
              <p className="subscription-lock-gate__switcher-label">Or switch to one of your other apartments:</p>
              {otherProperties.map((p) => {
                const pExpired = p.subscription_status === 'expired' || (p.subscription_expires_at && new Date(p.subscription_expires_at) <= new Date());
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="subscription-lock-gate__switcher-item"
                    onClick={() => load(p.id)}
                  >
                    <span>{p.name}</span>
                    <span className={pExpired ? 'subscription-lock-gate__switcher-status is-expired' : 'subscription-lock-gate__switcher-status'}>
                      {pExpired ? 'Also expired' : 'Active'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="subscription-lock-gate__actions">
            {!isManager && <Button variant="primary" onClick={() => navigate('/subscription')}>Renew now</Button>}
            <button
              type="button"
              className="ghost-link"
              onClick={() => {
                localStorage.removeItem('rentapay_token');
                localStorage.removeItem('rentapay_role');
                localStorage.removeItem('rentapay_role_level');
                navigate('/login');
              }}
            >
              Log out
            </button>
          </div>

          <div className="subscription-lock-gate__help">
            <p>Having trouble renewing? We're here to help - reach us any of these ways:</p>
            <HelpButton
              role={isManager ? 'manager' : 'landlord'}
              token={token}
              label="Get help"
              renderAs="ghost-link subscription-lock-gate__help-link"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh className="dashboard-page" onRefresh={() => load(activePropertyId)}>
      <TopRefreshBar active={showRefreshBar} />
      <RateTenantReminderPopup token={token} />
      <LoyaltyDiscountReminderPopup token={token} />
      <VirtualAssistant
        ref={assistantRef}
        steps={assistantSteps}
        autoOpen={assistantAutoOpen}
        onAutoOpenHandled={() => {
          setAssistantAutoOpen(false);
          api.markAssistantSeen(token).catch(() => {});
        }}
        onRequestSidebarOpen={() => setSidebarOpen(true)}
        onRequestSidebarClose={() => setSidebarOpen(false)}
      />
      <PortalSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey={activeView}
        notificationCount={disputesBadge + planRequestsBadge + communityBadge + messagesBadge}
        items={[
          {
            group: 'Overview',
            items: [
              { key: 'dashboard', label: 'Dashboard', icon: '🏠', onClick: () => setActiveView('dashboard') },
              { key: 'due-dates', label: 'Due Dates', icon: '📅', onClick: () => setActiveView('due-dates') },
            ],
          },
          {
            // Role Permissions spec (Section 3): Financial Statistics,
            // Payment History, Disputed Charges, and Payment Plan
            // Requests are all in the caretaker "no access at all, not
            // even read-only" list - hiding them here is a UX
            // convenience only, the real enforcement is server-side
            // (see dashboard.routes.js, payment.routes.js,
            // dispute.routes.js, paymentPlan.routes.js). Pending
            // Payments stays visible - caretakers get read-only access
            // to that one.
            group: 'Finances',
            items: [
              ...(!isCaretaker ? [{ key: 'statistics', label: 'Financial Statistics', icon: '📊', onClick: () => setActiveView('statistics') }] : []),
              ...(!isCaretaker ? [{ key: 'payment-history', label: 'Payment History', icon: '📄', onClick: () => setActiveView('payment-history') }] : []),
              ...(!isCaretaker ? [{ key: 'disputes', label: 'Disputed Charges', icon: '🚩', badge: disputesBadge, onClick: () => setActiveView('disputes') }] : []),
              ...(!isCaretaker ? [{ key: 'payment-plans', label: 'Payment Plan Requests', icon: '📋', badge: planRequestsBadge, onClick: () => setActiveView('payment-plans') }] : []),
              { key: 'pending-confirmations', label: 'Pending Payments', icon: '✅', onClick: () => setActiveView('pending-confirmations') },
            ],
          },
          {
            group: 'Tenants',
            items: [
              { key: 'archived-tenants', label: 'Archived Tenants', icon: '🗄️', onClick: () => setActiveView('archived-tenants') },
              { key: 'tenant-reputations', label: 'Tenant Reputations', icon: '⭐', onClick: () => setActiveView('tenant-reputations') },
              // Naming consistency (spec): landlord "My Rating" and
              // tenant "My Reputation" refer to the same concept -
              // unified to "My Reputation" on both sidebars.
              { key: 'my-rating', label: 'My Reputation', icon: '🌟', onClick: () => setActiveView('my-rating') },
              { key: 'tenant-lists', label: 'Tenant Lists', icon: '📋', onClick: () => setActiveView('tenant-lists') },
            ],
          },
          {
            group: 'Operations',
            items: [
              { key: 'maintenance', label: 'Maintenance', icon: '🔧', onClick: () => setActiveView('maintenance') },
              { key: 'utility-meters', label: 'Utility Meters', icon: '🚰', onClick: () => setActiveView('utility-meters') },
              { key: 'expenses', label: 'Expenses', icon: '🧾', onClick: () => setActiveView('expenses') },
              { key: 'community', label: 'Community Board', icon: '🏘️', badge: communityBadge, onClick: () => setActiveView('community') },
              // Messages/Broadcast aren't named in any spec group -
              // Operations is the closest day-to-day fit (kept out of
              // Account so they don't get buried under settings).
              { key: 'messages', label: 'Messages', icon: '💬', badge: messagesBadge, onClick: () => navigate('/messages') },
              { key: 'broadcast', label: 'Broadcast', icon: '📣', onClick: () => setShowAnnouncementComposer(true) },
            ],
          },
          {
            group: 'Account',
            items: [
              { key: 'settings', label: 'Settings', icon: '⚙️', onClick: () => navigate('/settings') },
              // Subscription/billing changes are landlord-only... but
              // per spec Manager and Caretaker both retain access to
              // Manage Subscription; the pre-existing landlord-only
              // gate here is a Manager restriction, which Section 3
              // says must stay exactly as-is (out of scope). Left
              // unchanged for now.
              ...(isManager ? [] : [{ key: 'subscription', label: 'Manage subscription', icon: '💳', onClick: () => navigate('/subscription') }]),
              // Direct request: caretakers should have the First-Time
              // Login Details UI removed entirely (not just narrowed) -
              // only landlord and manager portals keep this nav item.
              ...(!isCaretaker ? [{ key: 'first-time-credentials', label: 'First-Time Login Details', icon: '🔑', onClick: () => setActiveView('first-time-credentials') }] : []),
              { key: 'faq', label: 'FAQs', icon: '❓', onClick: () => setActiveView('faq') },
              // FIX (direct request: "help requests should be available
              // to all roles, not just tenants") - ComplaintsPanel
              // already worked for any role on the backend
              // (submitHelpRequest reads req.user.role/roleLevel,
              // whoever is logged in); it just was never actually
              // rendered anywhere outside TenantPortal.jsx. Same
              // component, same admin-side "Help Requests" tab it
              // already lands in - just wired up here too.
              { key: 'complaints', label: 'Help / Complaints', icon: '🆘', onClick: () => setActiveView('complaints') },
              { key: 'virtual-assistant', label: 'Virtual Assistant', icon: '✦', onClick: () => assistantRef.current?.open() },
            ],
          },
        ]}
      />

      <BottomNav
        activeKey={activeView}
        items={[
          { key: 'dashboard', label: 'Home', icon: '🏠', onClick: () => setActiveView('dashboard') },
          { key: 'pending-confirmations', label: 'Payments', icon: '✅', onClick: () => setActiveView('pending-confirmations') },
          { key: 'maintenance', label: 'Maintenance', icon: '🔧', onClick: () => setActiveView('maintenance') },
          { key: 'messages', label: 'Messages', icon: '💬', onClick: () => navigate('/messages') },
        ]}
      />

      <header className="dashboard-header">
        <div className="dashboard-header__left">
          <button type="button" className="portal-topbar__hamburger" aria-label="Menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="dashboard-header__brand-block">
            <div className="dashboard-header__brand">RentaPay</div>
            <div className="dashboard-header__role-label">{roleLabel(role, roleLevel, summary?.viewerGender)}</div>
          </div>
        </div>

        <div className="property-switcher">
          <button
            type="button"
            className="property-switcher__trigger"
            onClick={() => setSwitcherOpen((o) => !o)}
          >
            <span className="property-switcher__icon">🏢</span>
            <span className="property-switcher__label">
              {properties.find((p) => p.id === activePropertyId)?.name || 'Select property'}
            </span>
            <MissingPhotosBadge units={units} />
            <span className="property-switcher__caret">▾</span>
          </button>
          {switcherOpen && (
            <div className="property-switcher__menu" role="menu">
              {properties.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={`property-switcher__item ${activePropertyId === p.id ? 'is-active' : ''}`}
                  onClick={() => switchProperty(p.id)}
                >
                  <span className="property-switcher__item-name">{p.name}</span>
                  {/* FIX (direct request): the switcher used to show a
                      "12 units paid for · subscription expired" line
                      only for properties that had their own
                      independent subscription (unit_limit set), so
                      one property in the list would show it and
                      another wouldn't - inconsistent and cluttered.
                      Every row now shows just the location, full
                      stop; subscription/unit details live on the
                      property's own settings/subscription screen,
                      not in this quick switcher. */}
                  {p.location && <span className="property-switcher__item-sub">{p.location}</span>}
                </button>
              ))}
              <div className="property-switcher__divider" />
              {!isManager && (
                <button
                  type="button"
                  className="property-switcher__item property-switcher__item--add"
                  onClick={() => { setSwitcherOpen(false); setShowAddProperty(true); }}
                >
                  + Add a property
                </button>
              )}
            </div>
          )}
        </div>

        <GlobalSearch token={token} />

        {summary && (
          <div className="dashboard-header__account">
            {/* Bell sits immediately next to the profile picture/name -
                both live at the extreme top-right now, nothing else
                floating in between. Photo update/removal moved into
                the account menu dropdown itself (see AccountMenu) so
                there's only ever one avatar+name control in the
                header, not two overlapping ones. */}
            <PendingPaymentsBell token={token} onOpenPendingPayments={() => setActiveView('pending-confirmations')} />
            {/* Single canonical (gold) notification bell - already merges
                announcements + per-account notifications into one feed,
                so the separate NotificationsBell that used to sit here
                was a pure duplicate and has been removed for good. */}
            <AnnouncementBell token={token} role={isManager ? 'manager' : 'landlord'} propertyId={activePropertyId} />
            <AccountMenu
              name={summary.viewerName}
              photoUrl={summary.viewerPhotoUrl}
              role={isManager ? 'manager' : 'landlord'}
              token={token}
              onPhotoChange={(newUrl) => setSummary((s) => ({ ...s, viewerPhotoUrl: newUrl }))}
            />
          </div>
        )}
      </header>

      {error && summary && (
        <p className="admin-banner admin-banner--error" style={{ margin: '0 0 1rem' }}>
          {error} <button type="button" className="ghost-link" onClick={() => load(activePropertyId)}>Retry</button>
        </p>
      )}

      {/* FEATURE (direct request - "payments one to be unique and
          prioritized, separate from others - two separate banners"):
          split into two independent IncomingItemsBanner instances.
          Each dismisses independently - tapping the payments banner
          only dismisses itself, the general one (messages/disputes/
          plans/community) is untouched, and vice versa. */}
      <IncomingItemsBanner
        variant="priority"
        items={[
          { key: 'pending-payments', icon: '✅', label: 'Pending payments awaiting confirmation', count: pendingPaymentsBadge, onClick: () => setActiveView('pending-confirmations') },
        ]}
      />

      <IncomingItemsBanner
        items={[
          { key: 'messages', icon: '💬', label: 'Unread messages', count: messagesBadge, onClick: () => navigate('/messages') },
          ...(!isCaretaker ? [{ key: 'disputes', icon: '🚩', label: 'Disputed charges awaiting review', count: disputesBadge, onClick: () => setActiveView('disputes') }] : []),
          ...(!isCaretaker ? [{ key: 'payment-plans', icon: '📋', label: 'Payment plan requests awaiting review', count: planRequestsBadge, onClick: () => setActiveView('payment-plans') }] : []),
          { key: 'community', icon: '📣', label: 'New activity on your community board', count: communityBadge, onClick: () => setActiveView('community') },
        ]}
      />

      {!isManager && (
        <OnboardingChecklist
          token={token}
          dismissed={!!onboardingDismissedAt}
          onDismissed={() => setOnboardingDismissedAt(new Date().toISOString())}
          steps={[
            {
              key: 'add-property',
              label: 'Add your first property',
              done: properties.length > 0,
              actionLabel: 'Add a property',
              onAction: () => setShowAddProperty(true),
            },
            {
              key: 'add-unit',
              label: 'Add a unit',
              done: units.length > 0,
              actionLabel: 'Add a unit',
              onAction: () => navigate('/units/new'),
            },
            {
              key: 'first-tenant',
              label: 'Get your first tenant set up',
              done: units.some((u) => (u.tenants || []).some((t) => t.is_active)),
              actionLabel: units.length > 0 ? 'Add a tenant' : undefined,
              onAction: units.length > 0
                ? () => navigate(`/units/${(units.find((u) => u.status === 'vacant') || units[0]).id}/add-tenant`)
                : undefined,
            },
          ]}
        />
      )}

      {showAnnouncementComposer && (
        <BroadcastPanel
          token={token}
          role={isManager ? 'manager' : 'landlord'}
          properties={summary?.properties || []}
          onClose={() => setShowAnnouncementComposer(false)}
        />
      )}

      {/* Sidebar's "Messages" item opens this with no launcher button of
          its own, same pattern as the tenant portal. */}

      {showAddProperty && !isManager && (
        <AddPropertyModal
          token={token}
          onClose={() => setShowAddProperty(false)}
          onDone={(newPropertyId) => { setShowAddProperty(false); load(newPropertyId); }}
        />
      )}

      {showBulkRentModal && (
        <BulkRentChangeModal
          token={token}
          propertyId={activePropertyId}
          propertyName={properties.find((p) => p.id === activePropertyId)?.name}
          onClose={() => setShowBulkRentModal(false)}
          onDone={() => load(activePropertyId)}
        />
      )}

      {showBulkDueDateModal && (
        <BulkDueDateChangeModal
          token={token}
          propertyId={activePropertyId}
          propertyName={properties.find((p) => p.id === activePropertyId)?.name}
          onClose={() => setShowBulkDueDateModal(false)}
          onDone={() => { load(activePropertyId); setDueDatesRefreshKey((k) => k + 1); }}
        />
      )}

      {activeView === 'due-dates' ? (
        <main className="dashboard-main">
          <DueDatesCalendar token={token} refreshKey={dueDatesRefreshKey} />
        </main>
      ) : activeView === 'statistics' ? (
        <main className="dashboard-main">
          <LandlordStatistics token={token} propertyId={activePropertyId} isCaretaker={isCaretaker} />
        </main>
      ) : activeView === 'payment-history' ? (
        <main className="dashboard-main">
          <PaymentHistoryPanel token={token} role={role} propertyId={activePropertyId} propertyIdReady={!loading} canDelete={!isCaretaker} isCaretaker={isCaretaker} />
        </main>
      ) : activeView === 'disputes' ? (
        <DisputesPanel token={token} role={role} isCaretaker={isCaretaker} />
      ) : activeView === 'utility-meters' ? (
        <main className="dashboard-main">
          <UtilityMetersPanel token={token} propertyId={activePropertyId} propertyName={properties.find((p) => p.id === activePropertyId)?.name} />
        </main>
      ) : activeView === 'payment-plans' ? (
        <PaymentPlanRequestsPanel token={token} isCaretaker={isCaretaker} />
      ) : activeView === 'pending-confirmations' ? (
        <main className="dashboard-main">
          <PendingPaymentConfirmations token={token} canConfirmReject={!isCaretaker} subscriptionExpired={subscriptionExpired} propertyId={activePropertyId} />
        </main>
      ) : activeView === 'archived-tenants' ? (
        <main className="dashboard-main">
          <ArchivedTenantsPanel token={token} />
        </main>
      ) : activeView === 'tenant-reputations' ? (
        <main className="dashboard-main">
          <TenantReputationsPanel token={token} />
        </main>
      ) : activeView === 'my-rating' ? (
        <main className="dashboard-main">
          <MyOwnRatingPanel token={token} viewerRole={isManager || isCaretaker ? 'manager' : 'landlord'} roleLevel={isCaretaker ? 'caretaker' : 'manager'} />
          <PropertyReputationPanel token={token} propertyId={activePropertyId} viewerRole={isManager || isCaretaker ? 'manager' : 'landlord'} />
        </main>
      ) : activeView === 'first-time-credentials' && !isCaretaker ? (
        <main className="dashboard-main">
          <FirstTimeCredentialsPanel token={token} viewerRole={isManager ? 'manager' : 'landlord'} />
        </main>
      ) : activeView === 'tenant-lists' ? (
        <main className="dashboard-main">
          {activePropertyId ? (
            <Suspense fallback={<p className="dashboard-main__empty">Loading export…</p>}>
              <TenantListExport
                token={token}
                propertyId={activePropertyId}
                propertyName={properties.find((p) => p.id === activePropertyId)?.name}
              />
            </Suspense>
          ) : (
            <p className="dashboard-main__empty">Select an apartment above to see its tenant lists.</p>
          )}
        </main>
      ) : activeView === 'maintenance' ? (
        <main className="dashboard-main">
          <MaintenanceManagePanel token={token} propertyId={activePropertyId} />
        </main>
      ) : activeView === 'expenses' ? (
        <main className="dashboard-main">
          <ExpensesPanel token={token} propertyId={activePropertyId} canEdit={!isCaretaker} />
        </main>
      ) : activeView === 'community' ? (
        <main className="dashboard-main">
          <CommunityPanel token={token} canModerate propertyId={activePropertyId} />
        </main>
      ) : activeView === 'complaints' ? (
        <main className="dashboard-main">
          <ComplaintsPanel token={token} name={summary?.viewerName} defaultPhone={localStorage.getItem('rentapay_phone')} />
        </main>
      ) : activeView === 'faq' ? (
        <main className="dashboard-main">
          <Faq audience="landlord" />
        </main>
      ) : (
      <main className="dashboard-main">
        <AtAGlanceSummary
          overdueCount={summary.overdue?.count || 0}
          overdueTotal={summary.overdue?.total || 0}
          paidThisMonthTotal={summary.paidThisMonth?.total || 0}
          paidThisMonthCount={summary.paidThisMonth?.count || 0}
          vacantCount={summary.vacant || 0}
          subscriptionDaysLeft={daysLeft}
          subscriptionUrgent={isUrgent}
          subscriptionExpired={subscriptionExpired}
          expanded={showFullDetails}
          onToggle={() => setShowFullDetails((v) => !v)}
          onOpenOverdue={() => { setShowFullDetails(true); openDrillDown('overdue'); }}
          onOpenSubscription={() => navigate('/subscription')}
        />

        <MissingPhotosBanner
          units={units}
          scopeKey={`dashboard:${activePropertyId || 'all'}`}
          onAddPhotos={(target) => navigate(`/units/${Array.isArray(target) ? target[0].id : target.id}`)}
        />

        {showFullDetails && (
        <>
        <AttentionFeed
          token={token}
          onOpenTenant={(tenantId, unitId) => { if (unitId) navigate(`/units/${unitId}`); }}
          onOpenPendingPayments={() => setActiveView('pending-confirmations')}
        />
        {/* Signature element: subscription countdown */}
        <section className={`subscription-bar ${isUrgent ? 'subscription-bar--urgent' : ''} ${isCritical ? 'subscription-bar--critical' : ''}`}>
          <div className="subscription-bar__info">
            <span className="subscription-bar__plan">{sub.plan ? sub.plan[0].toUpperCase() + sub.plan.slice(1) : 'Plan'} plan</span>
            <span className="subscription-bar__days">
              {sub.expiresAt ? <>{daysLeft != null && daysLeft <= 0 ? 'Expired' : <><Countdown target={sub.expiresAt} expiredLabel="Expired" /> left</>}</> : 'No active subscription'}
            </span>
          </div>
          {pctRemaining != null && (
            <div className="subscription-bar__track">
              <div className={`subscription-bar__fill ${isCritical ? 'subscription-bar__fill--critical' : ''}`} style={{ width: `${pctRemaining}%` }} />
            </div>
          )}
          {isUrgent && (
            <div className="subscription-bar__warning-row">
              <span className={`subscription-bar__warning ${isCritical ? 'subscription-bar__warning--critical' : ''}`}>
                {isCritical ? `⚠️ Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left — renew now to avoid losing access` : 'Renew soon to avoid losing access'}
              </span>
              <Link to="/subscription" className="subscription-bar__renew-link">Renew now →</Link>
            </div>
          )}
        </section>

        {/* Payment method now sits directly under the subscription
            counter (was previously up in the header, where it was easy
            to lose track of / got hidden on narrow screens) so it's
            visible at a glance every time, for landlord, manager, and
            caretaker alike. */}
        <div className="payment-method-row">
          <PaymentMethodBadge token={token} shape="rectangle" propertyId={activePropertyId} />
        </div>

        {/* Metrics row - blueprint 11.1 full set. All six are now
            clickable (item B, extended per request to the landlord
            dashboard too) - each opens a drill-down using data already
            on the page (units + their tenants), except "Paid this
            month" which fetches the actual payment records. */}
        <section className="metrics-row">
          <button type="button" className="metric-card metric-card--clickable" onClick={() => openDrillDown('units')}>
            <span className="metric-card__label">Total units</span>
            <span className="metric-card__value">{summary.activeUnits ?? summary.totalUnits}</span>
            {summary.frozenUnits > 0 && (
              <span className="metric-card__sub">🔒 {summary.frozenUnits} frozen (subscription covers fewer units)</span>
            )}
          </button>
          <button type="button" className="metric-card metric-card--good metric-card--clickable" onClick={() => openDrillDown('paid')}>
            <span className="metric-card__label">Paid this month</span>
            <span className="metric-card__value">KES {Number(summary.paidThisMonth?.total || 0).toLocaleString()}</span>
            <span className="metric-card__sub">{summary.paidThisMonth?.count || 0} payments</span>
          </button>
          <button type="button" className="metric-card metric-card--warn metric-card--clickable" onClick={() => openDrillDown('overdue')}>
            <span className="metric-card__label">Overdue</span>
            <span className="metric-card__value">KES {Number(summary.overdue?.total || 0).toLocaleString()}</span>
            <span className="metric-card__sub">{summary.overdue?.count || 0} tenants</span>
          </button>
          <button type="button" className="metric-card metric-card--clickable" onClick={() => openDrillDown('notice')}>
            <span className="metric-card__label">Notice given</span>
            <span className="metric-card__value">{summary.noticeGiven || 0}</span>
          </button>
          <button type="button" className="metric-card metric-card--clickable" onClick={() => openDrillDown('vacant')}>
            <span className="metric-card__label">Vacant units</span>
            <span className="metric-card__value">{summary.vacant || 0}</span>
          </button>
          <button type="button" className="metric-card metric-card--clickable" onClick={() => openDrillDown('revenue')}>
            <span className="metric-card__label">Expected monthly revenue</span>
            <span className="metric-card__value">KES {Number(summary.expectedRevenue || 0).toLocaleString()}</span>
          </button>
        </section>
        </>
        )}

        {drillDown && (
          <div className="drilldown-panel__backdrop" onClick={() => setDrillDown(null)}>
          <section className="drilldown-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drilldown-panel__header">
              <h2>
                {drillDown === 'units' && 'All units'}
                {drillDown === 'paid' && 'Payments received this month'}
                {drillDown === 'overdue' && 'Tenants with an outstanding balance'}
                {drillDown === 'notice' && 'Units with notice given'}
                {drillDown === 'vacant' && 'Vacant units'}
                {drillDown === 'revenue' && 'Expected monthly revenue - by unit'}
              </h2>
              <div className="drilldown-panel__header-actions">
                <button
                  className="ghost-link"
                  onClick={() => {
                    if (drillDown === 'paid') {
                      downloadCsv(
                        'rentapay-payments-this-month',
                        ['Date', 'Tenant', 'Unit', 'Amount (KES)', 'Method'],
                        (paidPayments || []).map((p) => [
                          p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '',
                          p.tenants?.full_name || '',
                          p.units?.unit_name || '',
                          p.amount,
                          p.payment_method,
                        ])
                      );
                    } else if (drillDown === 'units') {
                      downloadCsv(
                        'rentapay-units',
                        ['Unit', 'Status', 'Tenant', 'Rent (KES)'],
                        units.map((u) => {
                          const activeTenant = (u.tenants || []).find((t) => t.is_active);
                          return [u.unit_name, STATUS_LABELS[u.status]?.label || u.status, activeTenant?.full_name || '', u.rent_amount];
                        })
                      );
                    } else if (drillDown === 'overdue') {
                      downloadCsv(
                        'rentapay-overdue-tenants',
                        ['Tenant', 'Unit', 'Balance Owed (KES)'],
                        units
                          .flatMap((u) => (u.tenants || []).filter((t) => t.is_active && Number(t.balance_due) > 0).map((t) => ({ ...t, unitName: u.unit_name })))
                          .map((t) => [t.full_name, t.unitName, t.balance_due])
                      );
                    } else if (drillDown === 'notice') {
                      downloadCsv(
                        'rentapay-notice-given',
                        ['Unit', 'Tenant'],
                        units
                          .filter((u) => u.status === 'notice_given')
                          .map((u) => [u.unit_name, (u.tenants || []).find((t) => t.is_active)?.full_name || ''])
                      );
                    } else if (drillDown === 'vacant') {
                      downloadCsv(
                        'rentapay-vacant-units',
                        ['Unit', 'Rent (KES)'],
                        units.filter((u) => u.status === 'vacant').map((u) => [u.unit_name, u.rent_amount])
                      );
                    } else if (drillDown === 'revenue') {
                      downloadCsv(
                        'rentapay-expected-revenue',
                        ['Unit', 'Status', 'Counted', 'Rent (KES)'],
                        units.map((u) => {
                          const counted = u.status === 'occupied' || u.status === 'notice_given';
                          return [u.unit_name, STATUS_LABELS[u.status]?.label || u.status, counted ? 'Yes' : 'No', u.rent_amount];
                        })
                      );
                    }
                  }}
                >
                  Download
                </button>
                <button className="drilldown-panel__close" onClick={() => setDrillDown(null)}>Close ✕</button>
              </div>
            </div>

            {drillDown === 'paid' && (
              <>
                {paidLoading && <Skeleton rows={3} />}
                {!paidLoading && (paidPayments || []).length === 0 && <p>No payments received yet this month.</p>}
                {!paidLoading && (paidPayments || []).length > 0 && (
                  <div className="drilldown-table-wrap">
                  <table className="drilldown-table">
                    <thead><tr><th></th><th>Date</th><th>Tenant</th><th>Unit</th><th>Amount</th><th>Method</th></tr></thead>
                    <tbody>
                      {paidPayments.map((p) => (
                        <tr key={p.id}>
                          <td><TenantContactCard tenant={{ ...p.tenants, unit_name: p.units?.unit_name }} size={28} token={token} canRate /></td>
                          <td>{new Date(p.paid_at).toLocaleDateString('en-GB')}</td>
                          <td>{p.tenants?.full_name || '—'}</td>
                          <td>{p.units?.unit_name || '—'}</td>
                          <td>KES {Number(p.amount).toLocaleString()}</td>
                          <td>{p.payment_method}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </>
            )}

            {drillDown === 'units' && (
              <div className="drilldown-table-wrap">
              <table className="drilldown-table">
                <thead><tr><th></th><th>Unit</th><th>Status</th><th>Tenant</th><th>Rent</th></tr></thead>
                <tbody>
                  {units.map((u) => {
                    const activeTenant = (u.tenants || []).find((t) => t.is_active);
                    return (
                      <tr key={u.id}>
                        <td>{activeTenant && <TenantContactCard tenant={{ ...activeTenant, unit_name: u.unit_name }} size={28} token={token} canRate />}</td>
                        <td>{u.unit_name}</td>
                        <td>{STATUS_LABELS[u.status]?.label || u.status}</td>
                        <td>{activeTenant?.full_name || '—'}</td>
                        <td>KES {Number(u.rent_amount).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}

            {drillDown === 'overdue' && (
              <div className="drilldown-table-wrap">
              <table className="drilldown-table">
                <thead><tr><th></th><th>Tenant</th><th>Unit</th><th>Balance owed</th><th>Actions</th></tr></thead>
                <tbody>
                  {units
                    .flatMap((u) => (u.tenants || []).filter((t) => t.is_active && Number(t.balance_due) > 0).map((t) => ({ ...t, unitName: u.unit_name })))
                    .map((t) => (
                      <tr key={t.id}>
                        <td><TenantContactCard tenant={{ ...t, unit_name: t.unitName }} size={28} token={token} canRate /></td>
                        <td>{t.full_name}</td>
                        <td>{t.unitName}</td>
                        <td className="drilldown-table__owing">KES {Number(t.balance_due).toLocaleString()}</td>
                        <td className="drilldown-table__actions">
                          <button
                            type="button"
                            className="ghost-link"
                            disabled={remindingTenantId === t.id}
                            onClick={() => handleRemindOverdueTenant(t)}
                          >
                            {remindingTenantId === t.id ? 'Sending…' : 'Remind'}
                          </button>
                          <button
                            type="button"
                            className="ghost-link"
                            disabled={whatsappRemindingTenantId === t.id}
                            onClick={() => handleWhatsAppRemindOverdueTenant(t)}
                            title="Send this reminder via WhatsApp"
                          >
                            {whatsappRemindingTenantId === t.id ? 'Opening…' : 'WhatsApp'}
                          </button>
                          {t.primary_phone && (
                            <a className="ghost-link" href={`tel:${t.primary_phone}`}>Call</a>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
            )}

            {drillDown === 'notice' && (
              <div className="drilldown-table-wrap">
              <table className="drilldown-table">
                <thead><tr><th></th><th>Unit</th><th>Tenant</th></tr></thead>
                <tbody>
                  {units
                    .filter((u) => u.status === 'notice_given')
                    .map((u) => {
                      const activeTenant = (u.tenants || []).find((t) => t.is_active);
                      return (
                        <tr key={u.id}>
                          <td>{activeTenant && <TenantContactCard tenant={{ ...activeTenant, unit_name: u.unit_name }} size={28} token={token} canRate />}</td>
                          <td>{u.unit_name}</td>
                          <td>{activeTenant?.full_name || '—'}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              </div>
            )}

            {drillDown === 'vacant' && (
              <div className="drilldown-table-wrap">
              <table className="drilldown-table">
                <thead><tr><th>Unit</th><th>Rent</th></tr></thead>
                <tbody>
                  {units
                    .filter((u) => u.status === 'vacant')
                    .map((u) => (
                      <tr key={u.id}>
                        <td>{u.unit_name}</td>
                        <td>KES {Number(u.rent_amount).toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
            )}

            {drillDown === 'revenue' && (
              <div className="drilldown-table-wrap">
              <table className="drilldown-table">
                <thead><tr><th>Unit</th><th>Status</th><th>Counted?</th><th>Rent</th></tr></thead>
                <tbody>
                  {units.map((u) => {
                    const counted = u.status === 'occupied' || u.status === 'notice_given';
                    return (
                      <tr key={u.id}>
                        <td>{u.unit_name}</td>
                        <td>{STATUS_LABELS[u.status]?.label || u.status}</td>
                        <td>{counted ? 'Yes' : 'No - no tenant to pay it'}</td>
                        <td>KES {Number(u.rent_amount).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </section>
          </div>
        )}

        {/* Card-grouped action section (redesign spec section 5):
            Quick Actions / Tenant Onboarding / Onboarding Requests each
            get their own bordered card instead of floating loosely. */}
        <section className="dashboard-card dashboard-card--quick-actions">
          <h3 className="dashboard-card__header">Quick Actions</h3>
          <div className="quick-actions">
            {!isCaretaker && (
              subscriptionExpired ? (
                <button
                  className="quick-action-btn"
                  disabled
                  title="This apartment's subscription has expired - renew it to add units."
                >
                  + Add unit
                </button>
              ) : (
                <Link to="/units/new" className="quick-action-btn">+ Add unit</Link>
              )
            )}
            <Link to="/settings" className="quick-action-btn">Settings</Link>
            <button
              className="quick-action-btn"
              onClick={handleBulkRemind}
              disabled={subscriptionExpired}
              title={subscriptionExpired ? "This apartment's subscription has expired - renew it to send reminders." : undefined}
            >
              Send bulk reminder
            </button>
            <button
              className="quick-action-btn"
              onClick={handleStartBulkWhatsAppRemind}
              disabled={subscriptionExpired || !!whatsappBulkQueue}
              title={subscriptionExpired ? "This apartment's subscription has expired - renew it to send reminders." : 'Send WhatsApp reminders to all overdue tenants, one chat at a time'}
            >
              Send bulk WhatsApp reminder
            </button>
            <button className="quick-action-btn" onClick={handleDownloadReport}>Download report</button>
            {!isCaretaker && (
              <button className="quick-action-btn" onClick={() => setShowBulkRentModal(true)}>Bulk rent change</button>
            )}
            {/* Caretakers ARE allowed to change due dates (see unit.routes.js) - not gated by isCaretaker, unlike bulk rent above. */}
            <button className="quick-action-btn" onClick={() => setShowBulkDueDateModal(true)}>Bulk due date change</button>
            <HelpButton role={isManager ? 'manager' : 'landlord'} token={token} renderAs="quick-action-btn help-button" />
            <button type="button" className="quick-action-btn" onClick={() => navigate('/messages')}>💬 Messages</button>
          </div>
          {bulkRemindStatus && <p className="quick-actions__status">{bulkRemindStatus}</p>}
          {whatsappBulkQueue && (
            <div className="quick-actions__status quick-actions__whatsapp-progress">
              <p>
                Reminder {whatsappBulkIndex + 1} of {whatsappBulkQueue.length} — {whatsappBulkQueue[whatsappBulkIndex].name}.
                {' '}WhatsApp opened with the message ready to send.
              </p>
              <button type="button" className="ghost-link" onClick={handleNextBulkWhatsAppRemind}>
                {whatsappBulkIndex + 1 >= whatsappBulkQueue.length ? 'Finish' : 'Sent — next tenant'}
              </button>
              <button type="button" className="ghost-link" onClick={handleCancelBulkWhatsAppRemind}>Cancel</button>
            </div>
          )}
        </section>

        {/* Pending Payment Confirmations - collapsed/summary card
            (spec: Section 4). Positioned here between Quick Actions
            and Tenant Onboarding, per spec placement. Visible to
            caretaker too - they have read-only access to this list
            (see PendingPaymentConfirmations.jsx's canConfirmReject
            prop), just can't confirm/reject from it. */}
        <PendingPaymentConfirmationsCard token={token} onOpen={() => setActiveView('pending-confirmations')} />

        {/* Tenant Self-Onboarding: persistent link bar + requests review,
            scoped to whichever property is currently selected - each
            property gets its own onboarding link. TenantOnboardingPanel
            itself now renders its "link" and "requests" halves as two
            separate bordered cards (Card 2 / Card 3 of the spec). */}
        {activePropertyId && (
          <TenantOnboardingPanel
            token={token}
            propertyId={activePropertyId}
            propertyName={properties.find((p) => p.id === activePropertyId)?.name}
            canAct={!subscriptionExpired}
            onConfirmed={() => load(activePropertyId)}
          />
        )}

        {/* Unit tiles - full-fill color-coded heat-map grid, grouped by
            status, paginated into their own pages per status (redesign
            spec sections 1 & 2) rather than one long flat scroll. */}
        <section className="units-section">
          <div className="units-section__header">
            <h2>Your units</h2>
            {units.length > 0 && (
              <input
                type="search"
                className="units-search-input"
                placeholder="Search by unit or tenant name…"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
              />
            )}
          </div>

          {units.length > 0 && (
            <div className="units-filter-chips">
              <span className="units-filter-chip units-filter-chip--active" aria-current="page">
                All <span className="units-filter-chip__count">{statusCounts.all}</span>
              </span>
              {[
                { key: 'overdue', label: 'Overdue' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'paid', label: 'Paid' },
                { key: 'vacant', label: 'Vacant' },
              ].map((chip) => (
                <Link
                  key={chip.key}
                  to={`/units-status/${chip.key}`}
                  className="units-filter-chip"
                >
                  {chip.label} <span className="units-filter-chip__count">{statusCounts[chip.key]}</span>
                </Link>
              ))}
            </div>
          )}

          {units.length === 0 && !summary.unitLimit ? (
            <div className="units-empty">
              <EmptyState
                icon="🏠"
                title="No units yet"
                message="Units you added during setup will appear here once they're saved."
                actionLabel="+ Add your first unit"
                onAction={() => navigate('/units/new')}
              />
            </div>
          ) : (
            <>
              {searchFilteredUnits.length === 0 && unitSearch ? (
                <p className="units-empty__search-hint">No units or tenants match "{unitSearch}".</p>
              ) : (
                <div className="units-groups">
                  {showStatusLegend && (
                    <div className="status-square-legend" role="status">
                      <div className="status-square-legend__items">
                        <span className="status-square-legend__item">
                          <span className="unit-tile__status-square unit-tile__status-square--overdue" aria-hidden="true" /> Overdue
                        </span>
                        <span className="status-square-legend__item">
                          <span className="unit-tile__status-square unit-tile__status-square--upcoming" aria-hidden="true" /> Due soon / pending
                        </span>
                        <span className="status-square-legend__item">
                          <span className="unit-tile__status-square unit-tile__status-square--paid" aria-hidden="true" /> Paid
                        </span>
                        <span className="status-square-legend__item">
                          <span className="unit-tile__status-square unit-tile__status-square--vacant" aria-hidden="true" /> Vacant
                        </span>
                      </div>
                      <button type="button" className="status-square-legend__dismiss" onClick={dismissStatusLegend} aria-label="Dismiss legend">
                        Got it
                      </button>
                    </div>
                  )}
                  {['overdue', 'upcoming', 'paid'].map((statusKey) => {
                    const list = groupedUnits[statusKey];
                    const preview = list.slice(0, GROUP_PREVIEW_SIZE);
                    const EMPTY_COPY = {
                      overdue: { icon: '🎉', text: 'No overdue tenants' },
                      upcoming: { icon: '📅', text: 'Nothing due soon right now' },
                      paid: { icon: '💸', text: 'No payments cleared for this cycle yet' },
                    };
                    return (
                      <div className="units-group" key={statusKey}>
                        <div className="units-group__header">
                          <h3 className={`units-group__title units-group__title--${statusKey}`}>
                            {STATUS_META[statusKey].label} <span className="units-group__count">{list.length}</span>
                          </h3>
                          {list.length > GROUP_PREVIEW_SIZE && (
                            <Link to={`/units-status/${statusKey}`} className="units-group__view-all">
                              View all {list.length} →
                            </Link>
                          )}
                        </div>
                        {list.length === 0 ? (
                          // FIX (direct request): the plain gray sentence
                          // sitting under each group's header ("No
                          // overdue tenants" etc.) read as a leftover
                          // placeholder rather than an intentional empty
                          // state. Now a small, self-contained banner
                          // matching each group's own color (same green/
                          // amber/orange used by the status squares
                          // above), so an empty group still looks
                          // designed rather than blank.
                          <div className={`units-group__empty-banner units-group__empty-banner--${statusKey}`}>
                            <span className="units-group__empty-banner-icon" aria-hidden="true">{EMPTY_COPY[statusKey].icon}</span>
                            <span>{EMPTY_COPY[statusKey].text}</span>
                          </div>
                        ) : (
                          <div className="units-tile-grid">
                            {preview.map((unit) => <UnitTile unit={unit} token={token} key={unit.id} />)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Vacant units collapsed by default behind a summary
                      row - a large vacant count shouldn't dominate the
                      page and dilute the color-coding. */}
                  <div className="units-group">
                    <button
                      type="button"
                      className="units-group__vacant-summary"
                      onClick={() => setVacantExpanded((v) => !v)}
                      aria-expanded={vacantExpanded}
                    >
                      {groupedUnits.vacant.length} Vacant {vacantExpanded ? '▴' : '▾'}
                    </button>
                    {vacantExpanded && (
                      groupedUnits.vacant.length === 0 ? (
                        <div className="units-group__empty-banner units-group__empty-banner--vacant">
                          <span className="units-group__empty-banner-icon" aria-hidden="true">🔑</span>
                          <span>No vacant units right now</span>
                        </div>
                      ) : (
                        <>
                          <div className="units-tile-grid">
                            {groupedUnits.vacant.slice(0, GROUP_PREVIEW_SIZE).map((unit) => (
                              <UnitTile unit={unit} token={token} key={unit.id} />
                            ))}
                          </div>
                          {groupedUnits.vacant.length > GROUP_PREVIEW_SIZE && (
                            <Link to="/units-status/vacant" className="units-group__view-all">
                              View all {groupedUnits.vacant.length} vacant →
                            </Link>
                          )}
                        </>
                      )
                    )}
                  </div>

                  {/* Frozen units (subscription covers fewer units than
                      exist) - shown separately, outside the status
                      heat-map, same as before. */}
                  {units.some((u) => u.is_frozen) && (
                    <div className="units-group">
                      <h3 className="units-group__title">Frozen</h3>
                      <div className="units-tile-grid">
                        {units.filter((u) => u.is_frozen).map((unit) => (
                          <UnitTile unit={unit} token={token} key={unit.id} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty placeholder slots for quota the landlord has
                      paid for but not yet used. Not part of the original
                      blueprint - a deliberate addition requested directly,
                      so the subscription's per-unit billing ceiling is
                      visible on the dashboard itself, not just inferred
                      from a number on a billing page. */}
                  {(summary.unitLimit || 0) - units.length > 0 && (
                    <div className="units-group">
                      <h3 className="units-group__title">Unused slots</h3>
                      <div className="units-tile-grid">
                        {Array.from({ length: Math.max(0, (summary.unitLimit || 0) - units.length) }).map((_, i) => (
                          <Link to="/units/new" className="unit-tile unit-tile--placeholder" key={`placeholder-${i}`}>
                            <span className="unit-tile__placeholder-icon">+</span>
                            <span>Unused slot</span>
                            <span className="unit-tile__status-line">Tap to add a unit</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>
      )}
      <SupportChatWidget token={token} />
    </PullToRefresh>
  );
}
