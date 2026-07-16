// src/api/client.js
//
// Thin fetch wrapper for talking to the RentaPay backend.
// In dev, Vite proxies /api/* to http://localhost:5000 (see vite.config.js).

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Typed error so callers (Login.jsx, RegisterFlow.jsx, etc.) can branch
 * on `error.kind` instead of parsing strings:
 *   'network'  - fetch() itself threw (backend unreachable, ECONNREFUSED,
 *                CORS block, DNS failure, offline). error.status is undefined.
 *   'http'     - backend responded with a non-2xx status. error.status is set.
 *   'parse'    - backend responded but body wasn't valid JSON (rare, usually
 *                means you hit the wrong server - e.g. Vite itself returning
 *                index.html for an unmatched /api/* route).
 */
export class ApiError extends Error {
  constructor(message, { kind, status, details, accountRevoked, lockedDown, raw } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.details = details;
    this.accountRevoked = accountRevoked;
    this.lockedDown = lockedDown;
    this.raw = raw; // full parsed response body, for endpoint-specific fields
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch (networkErr) {
    throw new ApiError(
      'Could not reach the server. Is the backend running on port 5000?',
      { kind: 'network' }
    );
  }

  const contentType = response.headers.get('content-type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      throw new ApiError('Server returned malformed JSON.', { kind: 'parse', status: response.status });
    }
  } else {
    throw new ApiError(
      `Expected JSON but got "${contentType || 'unknown content-type'}". Check that the Vite proxy is forwarding to a running backend.`,
      { kind: 'parse', status: response.status }
    );
  }

  if (!response.ok) {
    // FIX ("lockdown should immediately block everyone, including
    // people already mid-session"): the backend now returns this on
    // EVERY authenticated request once locked down, not just at
    // login. Handled once, here, so every page in the app benefits
    // without each one needing its own lockdown-detection code.
    if (response.status === 503 && data.lockedDown) {
      sessionStorage.removeItem('rentapay_token');
      sessionStorage.removeItem('rentapay_role');
      sessionStorage.removeItem('rentapay_role_level');
      sessionStorage.setItem('rentapay_logout_message', data.error || 'The platform has been temporarily locked down.');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    throw new ApiError(data.error || `Request failed with status ${response.status}`, {
      kind: 'http',
      status: response.status,
      details: data.details,
      accountRevoked: data.accountRevoked,
      lockedDown: data.lockedDown,
      raw: data,
    });
  }

  return data;
}

async function requestMultipart(path, { method = 'POST', formData, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  // Deliberately NOT setting Content-Type here - the browser sets it
  // itself (multipart/form-data; boundary=...) when the body is a
  // FormData instance. Setting it manually strips the boundary and
  // breaks the upload.

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { method, headers, body: formData });
  } catch (networkErr) {
    throw new ApiError('Could not reach the server. Is the backend running on port 5000?', { kind: 'network' });
  }

  const contentType = response.headers.get('content-type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      throw new ApiError('Server returned malformed JSON.', { kind: 'parse', status: response.status });
    }
  }

  if (!response.ok) {
    throw new ApiError(data.error || `Request failed with status ${response.status}`, { kind: 'http', status: response.status });
  }

  return data;
}

export const api = {
  registerLandlord: (payload) => request('/auth/landlord/register', { method: 'POST', body: payload }),
  verifyOTP: (payload) => request('/auth/verify-otp', { method: 'POST', body: payload }),
  resendOTP: (payload) => request('/auth/resend-otp', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  requestPasswordReset: (payload) => request('/auth/forgot-password/request', { method: 'POST', body: payload }),
  resetPassword: (payload) => request('/auth/forgot-password/reset', { method: 'POST', body: payload }),
  adminLogin: (payload) => request('/auth/admin/login', { method: 'POST', body: payload }),
  adminVerifyOtp: (payload) => request('/auth/admin/verify-otp', { method: 'POST', body: payload }),
  completeSetupWizard: (payload, token) => request('/auth/landlord/complete-setup-wizard', { method: 'POST', body: payload, token }),
  updatePropertyDetails: (payload, token) => request('/auth/landlord/property', { method: 'PATCH', body: payload, token }),
  getMyLandlordProfile: (token) => request('/auth/landlord/me', { token }),
  getPaymentMethod: (token, propertyId) => request(`/auth/payment-method${propertyId ? `?propertyId=${propertyId}` : ''}`, { token }),
  updateMyContact: (payload, token) => request('/auth/landlord/contact', { method: 'PATCH', body: payload, token }),
  updatePaymentMethod: (payload, token) => request('/auth/landlord/payment-method', { method: 'PATCH', body: payload, token }),

  // Announcements
  listAnnouncements: (token) => request('/announcements', { token }),
  createAnnouncement: (payload, token) => request('/announcements', { method: 'POST', body: payload, token }),
  markAnnouncementRead: (announcementId, token) => request(`/announcements/${announcementId}/read`, { method: 'POST', token }),
  deleteAnnouncement: (announcementId, scope, token) => request(`/announcements/${announcementId}`, { method: 'DELETE', body: { scope }, token }),
  broadcastPlatformAnnouncement: (message, targetGroup, token) => request('/admin/announcements/broadcast', { method: 'POST', body: { message, targetGroup }, token }),
  getSubscriptionStatus: (token) => request('/subscriptions/status', { token }),
  renewSubscription: (payload, token) => request('/subscriptions/renew', { method: 'POST', body: payload, token }),
  addUnitsMidPeriod: (payload, token) => request('/subscriptions/add-units', { method: 'POST', body: payload, token }),
  getDashboard: (token, propertyId) => request(`/dashboard${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  getLandlordStatistics: (token, propertyId) => request(`/dashboard/statistics${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  getPaymentHistoryFull: (token, propertyId) => request(`/payments/history${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  getPaymentsThisMonth: (token, propertyId) => request(`/dashboard/payments-this-month${propertyId ? `?propertyId=${propertyId}` : ''}`, { token }),

  // Units
  listUnits: (token, propertyId) => request(`/units${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  getUnit: (unitId, token) => request(`/units/${unitId}`, { token }),
  createUnit: (payload, token) => request('/units', { method: 'POST', body: payload, token }),
  updateRent: (unitId, payload, token) => request(`/units/${unitId}/rent`, { method: 'PATCH', body: payload, token }),
  renameUnit: (unitId, payload, token) => request(`/units/${unitId}/name`, { method: 'PATCH', body: payload, token }),
  updateDueDate: (unitId, payload, token) => request(`/units/${unitId}/due-date`, { method: 'PATCH', body: payload, token }),
  updateUnitPaymentOverride: (unitId, payload, token) => request(`/units/${unitId}/payment-override`, { method: 'PATCH', body: payload, token }),
  updateUnitStatus: (unitId, payload, token) => request(`/units/${unitId}/status`, { method: 'PATCH', body: payload, token }),
  removeUnit: (unitId, token) => request(`/units/${unitId}`, { method: 'DELETE', token }),
  addExtraCharge: (unitId, payload, token) => request(`/units/${unitId}/extra-charges`, { method: 'POST', body: payload, token }),

  // Tenants
  addTenant: (payload, token) => request('/tenants', { method: 'POST', body: payload, token }),
  getTenant: (tenantId, token) => request(`/tenants/${tenantId}`, { token }),
  editTenantDetails: (tenantId, payload, token) => request(`/tenants/${tenantId}`, { method: 'PATCH', body: payload, token }),
  editTenantBalance: (tenantId, payload, token) => request(`/tenants/${tenantId}/balance`, { method: 'PATCH', body: payload, token }),
  remindTenant: (tenantId, token) => request(`/tenants/${tenantId}/remind`, { method: 'POST', token }),
  sendBulkReminders: (token) => request('/tenants/bulk-remind', { method: 'POST', token }),
  transferTenant: (tenantId, payload, token) => request(`/tenants/${tenantId}/transfer`, { method: 'POST', body: payload, token }),
  revokeVacatingNotice: (tenantId, payload, token) => request(`/tenants/${tenantId}/vacating-notice/revoke`, { method: 'POST', body: payload, token }),
  deleteTenant: (tenantId, token) => request(`/tenants/${tenantId}`, { method: 'DELETE', token }),
  listArchivedTenants: (token) => request('/tenants/archived', { token }),
  listFirstTimeCredentials: (role, token, search) => {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (search) params.set('search', search);
    const qs = params.toString();
    return request(`/first-time-credentials${qs ? `?${qs}` : ''}`, { token });
  },
  listAllFirstTimeCredentialsForAdmin: (token, search) =>
    request(`/admin/first-time-credentials${search ? `?search=${encodeURIComponent(search)}` : ''}`, { token }),
  listPasswordResetRequests: (role, token, search) => {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (search) params.set('search', search);
    const qs = params.toString();
    return request(`/first-time-credentials/password-reset-requests${qs ? `?${qs}` : ''}`, { token });
  },
  listAllPasswordResetRequestsForAdmin: (token, search) =>
    request(`/admin/password-reset-requests${search ? `?search=${encodeURIComponent(search)}` : ''}`, { token }),
  restoreTenant: (tenantId, payload, token) => request(`/tenants/${tenantId}/restore`, { method: 'POST', body: payload, token }),
  deletePayment: (paymentId, token) => request(`/payments/history/${paymentId}`, { method: 'DELETE', token }),

  // Tenant-self (blueprint section 12 - tenant portal)
  getBalance: (token) => request('/tenants/balance', { token }),
  getPaymentHistory: (token) => request('/tenants/payment-history', { token }),
  getProfile: (token) => request('/tenants/profile', { token }),
  submitVacatingNotice: (payload, token) => request('/tenants/vacating-notice', { method: 'POST', body: payload, token }),
  cancelVacatingNotice: (token) => request('/tenants/vacating-notice', { method: 'DELETE', token }),
  initiateRentSTKPush: (payload, token) => request('/payments/stk-push', { method: 'POST', body: payload, token }),
  checkRentPaymentStatus: (checkoutRequestId, token) => request(`/payments/rent-status/${checkoutRequestId}`, { token }),
  checkSubscriptionPaymentStatus: (checkoutRequestId) => request(`/payments/subscription-status/${checkoutRequestId}`),
  submitPaybillTransaction: (payload, token) => request('/payments/paybill-submit', { method: 'POST', body: payload, token }),
  // payload: { transactionCode, amountPaid, mpesaPayerName, mpesaSmsTimestamp }
  getMyLatestPaybillConfirmation: (token) => request('/payments/my-latest-confirmation', { token }),
  // payload: { transactionCode, amountPaid, mpesaPayerName, mpesaSmsTimestamp? }

  // Payments
  recordManualPayment: (payload, token) => request('/payments/manual', { method: 'POST', body: payload, token }),

  // Pending Paybill payment confirmations (landlord/manager side of the
  // manual Paybill flow above)
  getPendingPaymentConfirmations: (status, token, propertyId) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (propertyId) params.set('propertyId', propertyId);
    const qs = params.toString();
    return request(`/payments/pending-confirmations${qs ? `?${qs}` : ''}`, { token });
  },
  confirmPendingPayment: (id, token) => request(`/payments/pending-confirmations/${id}/confirm`, { method: 'PATCH', token }),
  rejectPendingPayment: (id, payload, token) => request(`/payments/pending-confirmations/${id}/reject`, { method: 'PATCH', body: payload, token }),
  deletePendingPaymentConfirmation: (id, token) => request(`/payments/pending-confirmations/${id}`, { method: 'DELETE', token }),

  // Help
  submitHelpRequest: (payload, token) => request('/help', { method: 'POST', body: payload, token }),
  getMyHelpRequests: (token) => request('/help/mine', { token }),

  // Chat ("Chat with an agent" / "Text your landlord" / "Text your tenant")
  listChatThreads: (token) => request('/chat/threads', { token }),
  listChatMessages: ({ threadType, landlordId, tenantId }, token) => {
    const params = new URLSearchParams({ threadType });
    if (landlordId) params.set('landlordId', landlordId);
    if (tenantId) params.set('tenantId', tenantId);
    return request(`/chat/messages?${params.toString()}`, { token });
  },
  sendChatMessage: (payload, token) => request('/chat/messages', { method: 'POST', body: payload, token }),
  deleteChatMessage: (messageId, scope, token) => request(`/chat/messages/${messageId}`, { method: 'DELETE', body: { scope }, token }),

  // Super Admin (blueprint section 13)
  getAdminDashboard: (token) => request('/admin/dashboard', { token }),
  // Admin "SQL" tab (safe table-by-table viewer/editor - see adminSql.controller.js)
  listAdminSqlTables: (token) => request('/admin/sql/tables', { token }),
  listAdminSqlRows: (table, { limit, offset, search } = {}, token) => {
    const params = new URLSearchParams();
    if (limit != null) params.set('limit', limit);
    if (offset != null) params.set('offset', offset);
    if (search) params.set('search', search);
    const qs = params.toString();
    return request(`/admin/sql/${table}${qs ? `?${qs}` : ''}`, { token });
  },
  updateAdminSqlRow: (table, id, payload, token) => request(`/admin/sql/${table}/${id}`, { method: 'PATCH', body: payload, token }),
  listAllLandlords: (token) => request('/admin/landlords', { token }),
  listAllTenantsAdmin: (token) => request('/admin/tenants', { token }),
  listAllUnitsAdmin: (token) => request('/admin/units', { token }),
  getRevenueBreakdown: (period, token) => request(`/admin/revenue${period ? `?period=${period}` : ''}`, { token }),
  getRevenueTrend: (token) => request('/admin/revenue-trend', { token }),
  getExpiringLandlords: (days, token) => request(`/admin/expiring-landlords${days ? `?days=${days}` : ''}`, { token }),
  sendRenewalReminders: (payload, token) => request('/admin/expiring-landlords/remind', { method: 'POST', body: payload, token }),
  setLandlordStatus: (landlordId, payload, token) => request(`/admin/landlords/${landlordId}/status`, { method: 'PATCH', body: payload, token }),
  deleteLandlordAccount: (landlordId, password, token) => request(`/admin/landlords/${landlordId}`, { method: 'DELETE', body: { password }, token }),
  editLandlordSubscription: (landlordId, payload, token) => request(`/admin/landlords/${landlordId}/subscription`, { method: 'PATCH', body: payload, token }),
  getLandlordProperties: (landlordId, token) => request(`/admin/landlords/${landlordId}/properties`, { token }),
  getActivityLog: (token) => request('/admin/activity-log', { token }),
  deleteActivityLogEntry: (logId, token) => request(`/admin/activity-log/${logId}`, { method: 'DELETE', token }),
  deleteActivityLogsForDay: (date, token) => request(`/admin/activity-log/day?date=${date}`, { method: 'DELETE', token }),
  getLockdownStatus: (token) => request('/admin/lockdown-status', { token }),
  emergencyLockdown: (payload, token) => request('/admin/emergency-lockdown', { method: 'POST', body: payload, token }),
  resumeFromLockdown: (payload, token) => request('/admin/resume-lockdown', { method: 'POST', body: payload, token }),
  listHelpRequestsAdmin: (status, token) => request(`/help${status ? `?status=${status}` : ''}`, { token }),
  resolveHelpRequest: (requestId, payload, token) => request(`/help/${requestId}/resolve`, { method: 'PATCH', body: payload, token }),
  deleteHelpRequest: (requestId, token) => request(`/help/${requestId}`, { method: 'DELETE', token }),

  // Properties (multi-property support)
  listProperties: (token) => request('/properties', { token }),
  createProperty: (payload, token) => request('/properties', { method: 'POST', body: payload, token }),
  updateProperty: (propertyId, payload, token) => request(`/properties/${propertyId}`, { method: 'PATCH', body: payload, token }),
  assignUnitToProperty: (unitId, payload, token) => request(`/properties/units/${unitId}/assign`, { method: 'PATCH', body: payload, token }),
  purchaseProperty: (payload, token) => request('/properties/purchase', { method: 'POST', body: payload, token }),
  checkPropertyPurchaseStatus: (checkoutRequestId, token) => request(`/properties/purchase-status/${checkoutRequestId}`, { token }),

  // Property Managers (second-party portal access, landlord-managed)
  listPropertyManagers: (token) => request('/property-managers', { token }),
  getMyManagerAccess: (token) => request('/property-managers/me', { token }),
  addPropertyManager: (payload, token) => request('/property-managers', { method: 'POST', body: payload, token }),
  updatePropertyManager: (managerId, payload, token) => request(`/property-managers/${managerId}`, { method: 'PATCH', body: payload, token }),
  updatePropertyManagerAssignments: (managerId, payload, token) => request(`/property-managers/${managerId}/assignments`, { method: 'PATCH', body: payload, token }),
  removePropertyManager: (managerId, token) => request(`/property-managers/${managerId}`, { method: 'DELETE', token }),

  // Tenant list export (Excel download / WhatsApp group tabs)
  listTenantsForExport: (params, token) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')));
    return request(`/tenants/export-list?${qs.toString()}`, { token });
  },
  addTenantListToWhatsAppGroup: (payload, token) => request('/tenants/export-list/whatsapp-group', { method: 'POST', body: payload, token }),


  // Account (both roles)
  changePassword: (payload, token) => request('/auth/change-password', { method: 'POST', body: payload, token }),
  uploadProfilePhoto: (formData, token) => requestMultipart('/upload/profile-photo', { method: 'POST', formData, token }),
  removeProfilePhoto: (token) => request('/upload/profile-photo', { method: 'DELETE', token }),

  // Live push (Web Push / VAPID) - "urgent tier" notifications
  // (payment-confirmation requests, vacate notices, tenant messages).
  getVapidPublicKey: () => request('/push/vapid-public-key'),
  subscribePush: (subscription, token) => request('/push/subscribe', { method: 'POST', body: { subscription }, token }),
  unsubscribePush: (endpoint, token) => request('/push/unsubscribe', { method: 'POST', body: { endpoint }, token }),
};
