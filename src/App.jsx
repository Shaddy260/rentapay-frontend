import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast.jsx';
import InactivityLogout from './components/InactivityLogout.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import ApkInstallRedirect from './components/ApkInstallRedirect.jsx';
import UpdateChecker from './components/UpdateChecker.jsx';
import EngagementToast from './components/EngagementToast.jsx';
import VacancyAlertOptIn from './components/VacancyAlertOptIn.jsx';

// DIRECT REQUEST: "random browser popups... to receive browser
// notifications when a unit goes vacant around them, or just when a
// unit goes vacant" + generic service promo popups. Scoped to the
// PUBLIC marketing/browsing surfaces only - never inside a logged-in
// portal (Dashboard, TenantPortal, Settings, Messages, etc.), where a
// promotional popup would just be noise for someone already using the
// product. Both widgets independently no-op for anyone who's already
// subscribed/dismissed-recently/unsupported - this wrapper only
// decides WHERE they're allowed to even try to show themselves.
const PUBLIC_ENGAGEMENT_PATHS = ['/', '/login', '/find-a-house', '/register', '/terms', '/privacy', '/status'];

function PublicEngagementWidgets() {
  const location = useLocation();
  if (!PUBLIC_ENGAGEMENT_PATHS.includes(location.pathname)) return null;
  return (
    <>
      <EngagementToast />
      <VacancyAlertOptIn />
    </>
  );
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
const Landing = lazy(() => import('./pages/Landing.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const VerifyAccount = lazy(() => import('./pages/VerifyAccount.jsx'));
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const PublicListings = lazy(() => import('./pages/PublicListings.jsx'));
const SharedReputation = lazy(() => import('./pages/SharedReputation.jsx'));
const ReceiptVerify = lazy(() => import('./pages/ReceiptVerify.jsx'));
const TenantOnboarding = lazy(() => import('./pages/TenantOnboarding.jsx'));
const BaOnboarding = lazy(() => import('./pages/BaOnboarding.jsx'));
const BaPayoutSubmit = lazy(() => import('./pages/BaPayoutSubmit.jsx'));
const LandlordLeadForm = lazy(() => import('./pages/LandlordLeadForm.jsx'));
const BaTerms = lazy(() => import('./pages/BaTerms.jsx'));
const RegisterFlow = lazy(() => import('./pages/RegisterFlow.jsx'));
const AdminPortalAccess = lazy(() => import('./pages/AdminPortalAccess.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
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
    <ToastProvider>
      <BrowserRouter>
        <OfflineBanner />
        {/* Intercepts Chrome's native beforeinstallprompt (PWA install
            banner) app-wide and redirects it to the APK download - see
            ApkInstallRedirect.jsx. Does not affect manifest.json/sw.js,
            which still need to work for the TWA build. */}
        <ApkInstallRedirect />
        <UpdateChecker />
        <InactivityLogout />
        <PublicEngagementWidgets />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-account" element={<VerifyAccount />} />
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
          {/* BA Monthly Payment Details & Payout Workflow - Phase 2:
              public, token-carrying "submit your payout M-Pesa
              details" link admin shares each month. */}
          <Route path="/ba-payout-submit" element={<BaPayoutSubmit />} />
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
          <Route path="/admin-dashboard" element={<AdminDashboard />} />

          {/* Catch-all so unknown routes don't show a blank white screen */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </ToastProvider>
  );
}
