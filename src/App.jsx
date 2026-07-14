import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import VerifyAccount from './pages/VerifyAccount.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import RegisterFlow from './pages/RegisterFlow.jsx';
import AdminPortalAccess from './pages/AdminPortalAccess.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TenantPortal from './pages/TenantPortal.jsx';
import UnitDetail from './pages/UnitDetail.jsx';
import AddUnit from './pages/AddUnit.jsx';
import AddTenant from './pages/AddTenant.jsx';
import SubscriptionManage from './pages/SubscriptionManage.jsx';
import Settings from './pages/Settings.jsx';
import Terms from './pages/Terms.jsx';
import Privacy from './pages/Privacy.jsx';

// The admin path is read from an env var rather than hardcoded, so the
// secret URL isn't sitting in plain sight in the source/bundle as a
// string literal that anyone reading the JS could grep for. Set
// VITE_ADMIN_PATH in frontend/.env (gitignored) - it must start with '/'.
// Falls back to a placeholder if unset, but you should always set your
// own value before deploying; never ship the fallback to production.
const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || '/admin-portal-access-secret';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-account" element={<VerifyAccount />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<RegisterFlow />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
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
    </BrowserRouter>
  );
}
