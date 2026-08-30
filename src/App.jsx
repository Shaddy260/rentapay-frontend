import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast.jsx';
import InactivityLogout from './components/InactivityLogout.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import ApkInstallRedirect from './components/ApkInstallRedirect.jsx';
import UpdateChecker from './components/UpdateChecker.jsx';
import ForceUpdateGate from './components/ForceUpdateGate.jsx';
import VacancyAlertOptIn from './components/VacancyAlertOptIn.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
// FIX (direct request: "when i open the login page, it also loads
// instead of taking me to the login page directly... nothing should
// load while a user sees"). Landing (/) and Login (/login) were
// React.lazy-loaded along with every other page, which is right for
// pages most people never visit in a given session (code-splitting's
// whole point), but wrong for the two screens that are almost always
// the very first thing that loads - lazy-loading them just guarantees
// the Suspense fallback ("Loading…", see RouteFallback below) flashes
// on the one visit that matters most, every time, for everyone. Eager,
// regular imports put them in the main bundle instead, so they render
// immediately with no chunk to wait for and no fallback ever shown.
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import DownloadEffect from './components/DownloadEffect.jsx';

// DIRECT REQUEST: "random browser popups... to receive browser
// notifications when a unit goes vacant around them, or just when a
// unit goes vacant" + generic service promo popups. Scoped to the
// PUBLIC marketing/browsing surfaces only - never inside a logged-in
// portal (Dashboard, TenantPortal, Settings, Messages, etc.), where a
// promotional popup would just be noise for someone already using the
// product.
//
// FIX (direct request: "I want this 'a unit just went vacant' popups
// to be removed and converted to push browser messages instead, and
// should only appear to a user once in a day - it should be app push
// notifications"): the in-page toast (EngagementToast.jsx) that faked
// this with a looping on-screen banner has been removed entirely.
// VacancyAlertOptIn below is the real thing - an explicit opt-in into
// actual OS-level browser push notifications (see
// vacancyAlertPush.service.js on the backend), which now also
// enforces a once-per-24h cap per subscriber so an active rental
// market doesn't spam someone with a push every time any unit
// anywhere goes vacant.
const PUBLIC_ENGAGEMENT_PATHS = ['/', '/login', '/find-a-house', '/register', '/terms', '/privacy', '/status'];

function PublicEngagementWidgets() {
  const location = useLocation();
  if (!PUBLIC_ENGAGEMENT_PATHS.includes(location.pathname)) return null;
  return <VacancyAlertOptIn />;
}

// PERFORMANCE FIX (direct request: "reduce how long the code takes to
// load"). Every page used to be imported eagerly at the top of this
// file, which means the FIRST thing anyone's browser downloaded - even
// just to see the login screen - was one giant bundle containing the
// entire app: every portal, the whole admin dashboard (including the
// SQL browser), every settings/unit/tenant page, all of it, all at
// once. React.lazy + dynamic import splits each route into its own
// small file that only gets downloaded the moment someone actually
// navigates there. A tenant logging in never downloads a single byte
// of the admin dashboard's code; a landlord never downloads the
// tenant portal's code. As the app keeps growing this keeps every
// individual page load small instead of it all getting slower and
// slower together.
const VerifyAccount = lazy(() => import('./pages/VerifyAccount.jsx'));
const VerifyLoginTotp = lazy(() => import('./pages/VerifyLoginTotp.jsx'));
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const PublicListings = lazy(() => import('./pages/PublicListings.jsx'));
const SharedReputation = lazy(() => import('./pages/SharedReputation.jsx'));
const ReceiptVerify = lazy(() => import('./pages/ReceiptVerify.jsx'));
const TenantOnboarding = lazy(() => import('./pages/TenantOnboarding.jsx'));
const BaOnboarding = lazy(() => import('./pages/BaOnboarding.jsx'));
const GmOnboarding = lazy(() => import('./pages/GmOnboarding.jsx'));
const BaPayoutSubmit = lazy(() => import('./pages/BaPayoutSubmit.jsx'));
const LandlordLeadForm = lazy(() => import('./pages/LandlordLeadForm.jsx'));
const BaTerms = lazy(() => import('./pages/BaTerms.jsx'));
const RegisterFlow = lazy(() => import('./pages/RegisterFlow.jsx'));
const AdminPortalAccess = lazy(() => import('./pages/AdminPortalAccess.jsx'));
// SECTION 3 (General Manager dedicated login) - own screen, own URL,
// separate from AdminPortalAccess and from the shared Login above.
const ManagerAccountAccess = lazy(() => import('./pages/ManagerAccountAccess.jsx'));
const ManagerAccountDashboard = lazy(() => import('./pages/ManagerAccountDashboard.jsx'));
// SECTION 4 (Operations PIN)
const ManagerAccountPinSetup = lazy(() => import('./pages/ManagerAccountPinSetup.jsx'));
const ManagerAccountSettings = lazy(() => import('./pages/ManagerAccountSettings.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const AdminGeneralManagerLogs = lazy(() => import('./pages/AdminGeneralManagerLogs.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const UnitsStatusPage = lazy(() => import('./pages/UnitsStatusPage.jsx'));
const TenantPortal = lazy(() => import('./pages/TenantPortal.jsx'));
const BaPortal = lazy(() => import('./pages/BaPortal.jsx'));
const UnitDetail = lazy(() => import('./pages/UnitDetail.jsx'));
const AddUnit = lazy(() => import('./pages/AddUnit.jsx'));
const AddTenant = lazy(() => import('./pages/AddTenant.jsx'));
const SubscriptionManage = lazy(() => import('./pages/SubscriptionManage.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const TenantSettings = lazy(() => import('./pages/TenantSettings.jsx'));
const Messages = lazy(() => import('./pages/Messages.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));
const Resources = lazy(() => import('./pages/Resources.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const StatusPage = lazy(() => import('./pages/StatusPage.jsx'));
const SubscriptionLockGate = lazy(() => import('./components/SubscriptionLockGate.jsx'));

// The admin path is read from an env var rather than hardcoded, so the
// secret URL isn't sitting in plain sight in the source/bundle as a
// string literal that anyone reading the JS could grep for. Set
// VITE_ADMIN_PATH in frontend/.env (gitignored) - it must start with '/'.
// Falls back to a placeholder if unset, but you should always set your
// own value before deploying; never ship the fallback to production.
const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || '/admin-portal-access-secret';

// SECTION 3 (General Manager dedicated login) - same idea as
// ADMIN_PATH above, but this one is meant to be a known, shareable
// URL rather than a hidden one, so it defaults to the literal
// '/manager-account' from the spec instead of an obscure placeholder.
// Still overridable via VITE_MANAGER_PATH in frontend/.env if you
// ever need to change it (e.g. rotating it, or running a second
// environment) without a code change - see scripts/write-manager-path.js,
// which keeps index.html and manifest-manager.json in sync with
// whatever this resolves to, exactly like write-admin-path.js does
// for the admin path.
const MANAGER_PATH = import.meta.env.VITE_MANAGER_PATH || '/manager-account';

// Deliberately minimal and dependency-free (no spinner library, no
// image) so this fallback itself never adds to what has to download
// before something appears on screen - it shows instantly while the
// actual page's chunk is still being fetched.
function RouteFallback() {
  return (
    <div className="app-loading-fallback">
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <ToastProvider>
      <BrowserRouter>
        <OfflineBanner />
        {/* FEATURE (direct request): plays a small animated confirmation
            badge next to any element marked data-download-fx, but only
            while dark mode is active - light mode is untouched. See
            DownloadEffect.jsx for how it stays out of every download
            button's own markup/handlers. */}
        <DownloadEffect />
        {/* Intercepts Chrome's native beforeinstallprompt (PWA install
            banner) app-wide and redirects it to the APK download - see
            ApkInstallRedirect.jsx. Does not affect manifest.json/sw.js,
            which still need to work for the TWA build. */}
        <ApkInstallRedirect />
        <UpdateChecker />
        <InactivityLogout />
        <PublicEngagementWidgets />
        <ForceUpdateGate>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-account" element={<VerifyAccount />} />
          <Route path="/verify-login-totp" element={<VerifyLoginTotp />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/find-a-house" element={<PublicListings />} />
          <Route path="/reputation/:token" element={<SharedReputation />} />
          {/* FIX (spec item 2.1): destination of the QR code printed on
              every payment receipt - previously unregistered, so
              scanning it fell through to the catch-all -> /login. */}
          <Route path="/verify/:paymentId" element={<ReceiptVerify />} />
          <Route path="/onboard/:token" element={<TenantOnboarding />} />
          {/* BUILD SPEC PHASE 2: the one generic, always-live public
              "Become a Brand Ambassador" link - no token in the URL. */}
          <Route path="/become-a-ba" element={<BaOnboarding />} />
          <Route path="/onboard-general-manager" element={<GmOnboarding />} />
          {/* BA Monthly Payment Details & Payout Workflow - Phase 2:
              public, token-carrying "submit your payout M-Pesa
              details" link admin shares each month. */}
          <Route path="/ba-payout-submit" element={<BaPayoutSubmit />} />
          <Route path="/ba-payout-edit" element={<BaPayoutSubmit />} />
          <Route path="/partner-with-us" element={<LandlordLeadForm />} />
          <Route path="/ba-terms" element={<BaTerms />} />
          <Route path="/register" element={<RegisterFlow />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/learn" element={<Navigate to="/resources" replace />} />
          <Route path="/privacy" element={<Privacy />} /><Route path="/status" element={<StatusPage />} />
          <Route path="/dashboard" element={<SubscriptionLockGate><Dashboard /></SubscriptionLockGate>} />
          <Route path="/units-status/:status" element={<SubscriptionLockGate><UnitsStatusPage /></SubscriptionLockGate>} />
          <Route path="/portal" element={<TenantPortal />} />
          <Route path="/ba-portal" element={<BaPortal />} />
          <Route path="/subscription" element={<SubscriptionManage />} />
          <Route path="/settings" element={<SubscriptionLockGate><Settings /></SubscriptionLockGate>} />
          <Route path="/tenant-settings" element={<TenantSettings />} />
          <Route path="/messages" element={<SubscriptionLockGate><Messages /></SubscriptionLockGate>} />
          <Route path="/units/new" element={<SubscriptionLockGate><AddUnit /></SubscriptionLockGate>} />
          <Route path="/units/:unitId" element={<SubscriptionLockGate><UnitDetail /></SubscriptionLockGate>} />
          <Route path="/units/:unitId/add-tenant" element={<SubscriptionLockGate><AddTenant /></SubscriptionLockGate>} />

          {/* Hidden admin route - intentionally not linked from any
              public nav or button (blueprint 13.3). Knowing the exact
              path is the only way in; nothing on /login references it.
              FIX: React Router matches paths as exact strings, so a
              trailing slash on the URL (very easy to pick up from a
              bookmark, a shared link, or just habit) used to fail to
              match ADMIN_PATH and fall through to the catch-all below,
              bouncing straight to the normal /login page on refresh -
              both variants are registered here so either form works. */}
          <Route path={ADMIN_PATH} element={<AdminPortalAccess />} />
          <Route path={`${ADMIN_PATH}/`} element={<AdminPortalAccess />} />
          {/* SECTION 3: General Manager's own dedicated login URL -
              rentapay.co.ke/manager-account by default, changeable via
              VITE_MANAGER_PATH (see MANAGER_PATH above and
              scripts/write-manager-path.js) the same way ADMIN_PATH is. */}
          <Route path={MANAGER_PATH} element={<ManagerAccountAccess />} />
          <Route path={`${MANAGER_PATH}/`} element={<ManagerAccountAccess />} />
          <Route path="/manager-account/dashboard" element={<ManagerAccountDashboard />} />
          {/* SECTION 4: Operations PIN onboarding + settings. Not
              gated on MANAGER_PATH like the login screen above - these
              are reached only via an authenticated redirect (see
              ManagerAccountAccess.jsx / ChangePassword.jsx), so a
              fixed sub-path is fine even if MANAGER_PATH itself is
              customized via VITE_MANAGER_PATH. */}
          <Route path="/manager-account/setup-pin" element={<ManagerAccountPinSetup />} />
          <Route path="/manager-account/settings" element={<ManagerAccountSettings />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          {/* SECTION 8: a specific General Manager's own dedicated log
              page (day/week/month), reached from GeneralManagersPanel. */}
          <Route path="/admin-dashboard/general-managers/:id/logs" element={<AdminGeneralManagerLogs />} />

          {/* Catch-all so unknown routes don't show a blank white screen */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
      </ForceUpdateGate>
    </BrowserRouter>
    </ToastProvider>
    </ErrorBoundary>
  );
}
