import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

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
const Login = lazy(() => import('./pages/Login.jsx'));
const VerifyAccount = lazy(() => import('./pages/VerifyAccount.jsx'));
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const RegisterFlow = lazy(() => import('./pages/RegisterFlow.jsx'));
const AdminPortalAccess = lazy(() => import('./pages/AdminPortalAccess.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const TenantPortal = lazy(() => import('./pages/TenantPortal.jsx'));
const UnitDetail = lazy(() => import('./pages/UnitDetail.jsx'));
const AddUnit = lazy(() => import('./pages/AddUnit.jsx'));
const AddTenant = lazy(() => import('./pages/AddTenant.jsx'));
const SubscriptionManage = lazy(() => import('./pages/SubscriptionManage.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const StatusPage = lazy(() => import('./pages/StatusPage.jsx'));

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#6b6558' }}>
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-account" element={<VerifyAccount />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/register" element={<RegisterFlow />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} /><Route path="/status" element={<StatusPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/portal" element={<TenantPortal />} />
          <Route path="/subscription" element={<SubscriptionManage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/units/new" element={<AddUnit />} />
          <Route path="/units/:unitId" element={<UnitDetail />} />
          <Route path="/units/:unitId/add-tenant" element={<AddTenant />} />

          {/* Hidden admin route - intentionally not linked from any
              public nav or button (blueprint 13.3). Knowing the exact
              path is the only way in; nothing on /login references it. */}
          <Route path={ADMIN_PATH} element={<AdminPortalAccess />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />

          {/* Catch-all so unknown routes don't show a blank white screen */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
