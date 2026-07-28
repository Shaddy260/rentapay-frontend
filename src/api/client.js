// src/api/client.js
//
// Thin fetch wrapper for talking to the RentaPay backend.
// In dev, Vite proxies /api/* to http://localhost:5000 (see vite.config.js).

import { cacheKeyFor, getCached, setCached, enqueueAction, flushQueuedActions } from '../utils/offlineDb.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
// FIX: StatusPage.jsx used to fetch('/health') as a bare relative
// path, completely bypassing BASE_URL. That works only by coincidence
// when the frontend and backend share an origin with no VITE_API_
// BASE_URL override; the moment a deployment sets VITE_API_BASE_URL
// to point at a separately-hosted backend (a very normal setup), that
// bare fetch hits the FRONTEND's own origin instead - which has no
// /health route at all - and status always reports "can't reach
// RentaPay" regardless of whether the backend is actually fine. /health
// is mounted on the Express app root (see server.js), not under /api,
// so this strips a trailing /api off BASE_URL rather than reusing it directly.
const HEALTH_URL = `${BASE_URL.replace(/\/api\/?$/, '')}/health`;
export { HEALTH_URL };

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

async function request(path, { method = 'GET', body, token, queueable, queueDescription } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const cacheKey = method === 'GET' ? cacheKeyFor(path, token) : null;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch (networkErr) {
    // OFFLINE FIX (direct request: "resilience outside Nairobi's core,
    // where connectivity is patchy"). Two different fallbacks depending
    // on what kind of request this was:
    //
    //  - GET: serve the last successful response for this exact
    //    endpoint+user from IndexedDB, if we have one, clearly flagged
    //    as stale (`_offline`/`_cachedAt`) so screens can show a "last
    //    updated" banner instead of pretending the data is live.
    //  - queueable mutation (payment confirmations, chat messages,
    //    maintenance requests, etc.): persist it and return a synthetic
    //    "queued" response instead of throwing, so the UI can say
    //    "saved - will sync once you're back online" rather than losing
    //    the action entirely. It's replayed automatically by
    //    flushQueuedActions() on the next 'online' event, in order.
    //
    // Anything else (login, STK push, non-queueable writes) still
    // throws as before - those genuinely need a live round trip.
    if (cacheKey) {
      const cached = await getCached(cacheKey);
      if (cached) {
        return { ...cached.data, _offline: true, _cachedAt: cached.cachedAt };
      }
    }
    if (queueable) {
      await enqueueAction({ path, method, body, token, description: queueDescription });
      return { queued: true, _offline: true };
    }
    throw new ApiError(
      'Could not reach the server. Please check your internet connection and try again.',
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

  // Cache every successful GET so it's available as a fallback next
  // time this exact endpoint is hit with no network (see catch block above).
  if (cacheKey) setCached(cacheKey, data);

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
    throw new ApiError('Could not reach the server. Please check your internet connection and try again.', { kind: 'network' });
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

// Replays a single queued item using a real network request (bypassing
// the offline fallback above - if this one fails too, flushQueuedActions
// leaves it queued and stops, rather than looping forever).
async function sendQueuedItem(item) {
  return request(item.path, { method: item.method, body: item.body, token: item.token });
}

/**
 * Call this after regaining connectivity (main.jsx wires it to the
 * browser's 'online' event, plus once at startup) to replay anything
 * that was queued while offline, in the order it was created.
 */
export function syncOfflineQueue() {
  return flushQueuedActions(sendQueuedItem);
}

export { onQueueChange, listQueuedActions, queuedActionCount } from '../utils/offlineDb.js';

export const api = {
  registerLandlord: (payload) => request('/auth/landlord/register', { method: 'POST', body: payload }),
  verifyOTP: (payload) => request('/auth/verify-otp', { method: 'POST', body: payload }),
  resendOTP: (payload) => request('/auth/resend-otp', { method: 'POST', body: payload }),
  verifyLandlordEmailOTP: (payload) => request('/auth/verify-landlord-email', { method: 'POST', body: payload }),
  resendLandlordEmailOTP: (payload) => request('/auth/resend-landlord-email-otp', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  loginWithGoogle: (payload) => request('/auth/google', { method: 'POST', body: payload }),
  sessionCheck: (token) => request('/auth/session-check', { token }),
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

  listNotifications: (token, propertyId) => request(`/notifications${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  markNotificationRead: (id, token) => request(`/notifications/${id}/read`, { method: 'POST', token }),
  markAllNotificationsRead: (token, propertyId) => request(`/notifications/read-all${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { method: 'POST', token }),
  // Tapping a notification, or "Read all", now deletes it for this
  // user only (see NotificationsBell/AnnouncementBell) rather than
  // just marking it read.
  deleteNotification: (id, token) => request(`/notifications/${id}`, { method: 'DELETE', token }),
  deleteAllNotifications: (token, propertyId) => request(`/notifications${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { method: 'DELETE', token }),

  // Announcements
  listAnnouncements: (token, propertyId) => request(`/announcements${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  createAnnouncement: (payload, token) => request('/announcements', { method: 'POST', body: payload, token }),
  markAnnouncementRead: (announcementId, token) => request(`/announcements/${announcementId}/read`, { method: 'POST', token }),
  deleteAnnouncement: (announcementId, scope, token) => request(`/announcements/${announcementId}`, { method: 'DELETE', body: { scope }, token }),
  broadcastPlatformAnnouncement: (message, targetGroup, token) => request('/admin/announcements/broadcast', { method: 'POST', body: { message, targetGroup }, token }),

  // Community board + marketplace (tenant<->tenant, scoped to a property)
  listCommunityPosts: (kind, token, propertyId) => request(`/community?kind=${kind}${propertyId ? `&propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  createCommunityPost: (payload, token) => request('/community', { method: 'POST', body: payload, token }),
  // FEATURE (direct request): posts can attach photos. Used instead
  // of createCommunityPost whenever at least one file is selected -
  // same endpoint, just sent as multipart/form-data so the files can
  // ride along with the text fields.
  createCommunityPostWithPhotos: (payload, files, token) => {
    const formData = new FormData();
    if (payload.kind) formData.append('kind', payload.kind);
    if (payload.title) formData.append('title', payload.title);
    formData.append('body', payload.body);
    if (payload.price != null) formData.append('price', payload.price);
    if (payload.propertyId) formData.append('propertyId', payload.propertyId);
    for (const file of files) formData.append('photos', file);
    return requestMultipart('/community', { method: 'POST', formData, token });
  },
  deleteCommunityPost: (postId, token) => request(`/community/${postId}`, { method: 'DELETE', token }),
  pinCommunityPost: (postId, pinned, token) => request(`/community/${postId}/pin`, { method: 'PATCH', body: { pinned }, token }),
  replyToCommunityPost: (postId, body, token) => request(`/community/${postId}/replies`, { method: 'POST', body: { body }, token }),
  deleteCommunityReply: (replyId, token) => request(`/community/replies/${replyId}`, { method: 'DELETE', token }),
  getSubscriptionStatus: (token, propertyId) => request(`/subscriptions/status${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  renewSubscription: (payload, token) => request('/subscriptions/renew', { method: 'POST', body: payload, token }),
  addUnitsMidPeriod: (payload, token) => request('/subscriptions/add-units', { method: 'POST', body: payload, token }),
  submitManualSubscriptionPayment: (payload, token) => request('/subscriptions/manual-payment', { method: 'POST', body: payload, token }),
  getMyLatestManualSubscriptionPayment: (token) => request('/subscriptions/manual-payment/mine', { token }),
  listManualSubscriptionPayments: (status, token) => request(`/admin/landlord-manual-subscription-payments?status=${encodeURIComponent(status || 'pending')}`, { token }),
  confirmManualSubscriptionPayment: (id, token) => request(`/admin/landlord-manual-subscription-payments/${id}/confirm`, { method: 'POST', token }),
  rejectManualSubscriptionPayment: (id, reason, token) => request(`/admin/landlord-manual-subscription-payments/${id}/reject`, { method: 'POST', body: { reason }, token }),
  deleteManualSubscriptionPayment: (id, token) => request(`/admin/landlord-manual-subscription-payments/${id}`, { method: 'DELETE', token }),
  // Tenant reputation - landlord rates a tenant; rating is portable
  // by email so it follows the tenant to their next landlord too.
  rateTenant: (tenantId, payload, token) => request(`/tenants/${tenantId}/rate`, { method: 'POST', body: payload, token }),
  getTenantReputation: (tenantId, token) => request(`/tenants/${tenantId}/reputation`, { token }),
  flagTenantRating: (ratingId, payload, token) => request(`/tenants/my-ratings/${ratingId}/flag`, { method: 'POST', body: payload, token }),
  listTenantReputations: (token) => request('/tenants/reputations', { token }),
  rateLandlord: (payload, token) => request('/tenants/rate-landlord', { method: 'POST', body: payload, token }),
  getMyLandlordReputation: (token) => request('/tenants/landlord-reputation', { token }),
  // direct request #8: landlord's own aggregate rating, and the
  // manager/caretaker rating flow (tenant rates -> staff views own).
  getMyReputationAsLandlord: (token) => request('/tenants/my-reputation', { token }),
  listRateableStaff: (token) => request('/tenants/rateable-staff', { token }),
  rateStaff: (staffId, payload, token) => request(`/tenants/rate-staff/${staffId}`, { method: 'POST', body: payload, token }),
  getMyStaffReputation: (token) => request('/tenants/my-staff-reputation', { token }),
  // Property reputation - rated by current tenants of that property.
  rateProperty: (payload, token) => request('/tenants/rate-property', { method: 'POST', body: payload, token }),
  getMyPropertyReputation: (token) => request('/tenants/property-reputation', { token }),
  // Rating flags: a landlord's recourse against a bad-faith rating.
  // `table` is one of landlord_ratings | staff_ratings | property_ratings.
  listMyRatings: (table, token, propertyId) => request(`/ratings/${table}/mine${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  getPropertyReputationForLandlord: (propertyId, token) => request(`/properties/${propertyId}/reputation`, { token }),
  flagRating: (table, id, reason, token) => request(`/ratings/${table}/${id}/flag`, { method: 'POST', body: { reason }, token }),
  listRatingFlags: (status, token) => request(`/admin/rating-flags?status=${encodeURIComponent(status || 'flagged')}`, { token }),
  resolveRatingFlag: (table, id, resolution, note, token) => request(`/admin/rating-flags/${table}/${id}/resolve`, { method: 'PATCH', body: { resolution, note }, token }),

  getDashboard: (token, propertyId) => request(`/dashboard${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  getAttentionFeed: (token) => request('/dashboard/attention', { token }),
  getDueDatesCalendar: (token) => request('/dashboard/due-dates', { token }),
  globalSearch: (query, token) => request(`/dashboard/search?q=${encodeURIComponent(query)}`, { token }),
  getLandlordStatistics: (token, propertyId) => request(`/dashboard/statistics${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  getPaymentHistoryFull: (token, propertyId) => request(`/payments/history${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  getPaymentsThisMonth: (token, propertyId) => request(`/dashboard/payments-this-month${propertyId ? `?propertyId=${propertyId}` : ''}`, { token }),

  // Units
  listUnits: (token, propertyId) => request(`/units${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  getUnit: (unitId, token) => request(`/units/${unitId}`, { token }),
  createUnit: (payload, token) => request('/units', { method: 'POST', body: payload, token }),
  createUnitsBulk: (payload, token) => request('/units/bulk', { method: 'POST', body: payload, token }),
  updateRent: (unitId, payload, token) => request(`/units/${unitId}/rent`, { method: 'PATCH', body: payload, token }),
  renameUnit: (unitId, payload, token) => request(`/units/${unitId}/name`, { method: 'PATCH', body: payload, token }),
  updateDueDate: (unitId, payload, token) => request(`/units/${unitId}/due-date`, { method: 'PATCH', body: payload, token }),
  updateUnitPaymentOverride: (unitId, payload, token) => request(`/units/${unitId}/payment-override`, { method: 'PATCH', body: payload, token }),
  updateUnitStatus: (unitId, payload, token) => request(`/units/${unitId}/status`, { method: 'PATCH', body: payload, token }),
  verifyUnit: (unitId, token) => request(`/units/${unitId}/verify`, { method: 'PATCH', token }),
  updatePublicListing: (unitId, isPubliclyListed, token) => request(`/units/${unitId}/public-listing`, { method: 'PATCH', body: { isPubliclyListed }, token }),
  updateListingStatus: (unitId, listingStatus, token) => request(`/units/${unitId}/listing-status`, { method: 'PATCH', body: { listingStatus }, token }),
  updateDepositSettings: (unitId, payload, token) => request(`/units/${unitId}/deposit-settings`, { method: 'PATCH', body: payload, token }),
  removeUnit: (unitId, token) => request(`/units/${unitId}`, { method: 'DELETE', token }),
  addExtraCharge: (unitId, payload, token) => request(`/units/${unitId}/extra-charges`, { method: 'POST', body: payload, token }),
  bulkUpdateRent: (payload, token) => request('/units/bulk-rent', { method: 'POST', body: payload, token }),

  // Tenants
  addTenant: (payload, token) => request('/tenants', { method: 'POST', body: payload, token }),
  getTenant: (tenantId, token) => request(`/tenants/${tenantId}`, { token }),
  editTenantDetails: (tenantId, payload, token) => request(`/tenants/${tenantId}`, { method: 'PATCH', body: payload, token }),
  editTenantBalance: (tenantId, payload, token) => request(`/tenants/${tenantId}/balance`, { method: 'PATCH', body: payload, token }),
  settleTenantDeposit: (tenantId, payload, token) => request(`/tenants/${tenantId}/deposit`, { method: 'PATCH', body: payload, token }),
  remindTenant: (tenantId, token) => request(`/tenants/${tenantId}/remind`, { method: 'POST', token, queueable: true, queueDescription: 'Send rent reminder' }),
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
  updateOwnProfile: (payload, token) => request('/tenants/profile', { method: 'PATCH', body: payload, token }),
  submitVacatingNotice: (payload, token) => request('/tenants/vacating-notice', { method: 'POST', body: payload, token, queueable: true, queueDescription: 'Submit vacating notice' }),
  cancelVacatingNotice: (token) => request('/tenants/vacating-notice', { method: 'DELETE', token }),
  initiateRentSTKPush: (payload, token) => request('/payments/stk-push', { method: 'POST', body: payload, token }),
  checkRentPaymentStatus: (checkoutRequestId, token) => request(`/payments/rent-status/${checkoutRequestId}`, { token }),
  checkSubscriptionPaymentStatus: (checkoutRequestId) => request(`/payments/subscription-status/${checkoutRequestId}`),
  submitRegistrationManualPayment: (payload) => request('/payments/subscription-manual/register', { method: 'POST', body: payload }),
  checkRegistrationManualPaymentStatus: (landlordId) => request(`/payments/subscription-manual/register/${landlordId}/status`),
  submitPaybillTransaction: (payload, token) => request('/payments/paybill-submit', { method: 'POST', body: payload, token, queueable: true, queueDescription: `Submit payment confirmation (${payload?.transactionCode || ''})` }),
  // payload: { transactionCode, amountPaid, mpesaPayerName, mpesaSmsTimestamp }
  getMyLatestPaybillConfirmation: (token) => request('/payments/my-latest-confirmation', { token }),
  // payload: { transactionCode, amountPaid, mpesaPayerName, mpesaSmsTimestamp? }

  // Payments
  recordManualPayment: (payload, token) => request('/payments/manual', { method: 'POST', body: payload, token, queueable: true, queueDescription: 'Record manual payment' }),

  // Pending Paybill payment confirmations (landlord/manager side of the
  // manual Paybill flow above)
  getPendingPaymentConfirmations: (status, token, propertyId) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (propertyId) params.set('propertyId', propertyId);
    const qs = params.toString();
    return request(`/payments/pending-confirmations${qs ? `?${qs}` : ''}`, { token });
  },
  confirmPendingPayment: (id, token) => request(`/payments/pending-confirmations/${id}/confirm`, { method: 'PATCH', token, queueable: true, queueDescription: 'Confirm pending payment' }),
  rejectPendingPayment: (id, payload, token) => request(`/payments/pending-confirmations/${id}/reject`, { method: 'PATCH', body: payload, token, queueable: true, queueDescription: 'Reject pending payment' }),
  deletePendingPaymentConfirmation: (id, token) => request(`/payments/pending-confirmations/${id}`, { method: 'DELETE', token }),

  // Help
  submitHelpRequest: (payload, token) => request('/help', { method: 'POST', body: payload, token, queueable: true, queueDescription: 'Submit help request' }),
  submitMaintenanceRequest: (payload, token) => request('/maintenance', { method: 'POST', body: payload, token, queueable: true, queueDescription: 'Submit maintenance request' }),
  getMyMaintenanceRequests: (token) => request('/maintenance/mine', { token }),
  getMaintenanceRequests: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/maintenance${qs ? `?${qs}` : ''}`, { token });
  },
  updateMaintenanceStatus: (requestId, payload, token) => request(`/maintenance/${requestId}/status`, { method: 'PATCH', body: payload, token }),
  getMyHelpRequests: (token) => request('/help/mine', { token }),

  // Chat ("Chat with an agent" / "Text your landlord" / "Text your tenant")
  listChatThreads: (token) => request('/chat/threads', { token }),
  listChatMessages: ({ threadType, landlordId, tenantId }, token) => {
    const params = new URLSearchParams({ threadType });
    if (landlordId) params.set('landlordId', landlordId);
    if (tenantId) params.set('tenantId', tenantId);
    return request(`/chat/messages?${params.toString()}`, { token });
  },
  sendChatMessage: (payload, token) => request('/chat/messages', { method: 'POST', body: payload, token, queueable: true, queueDescription: 'Send message' }),
  deleteChatMessage: (messageId, scope, token) => request(`/chat/messages/${messageId}`, { method: 'DELETE', body: { scope }, token }),

  // "Dispute a charge" - flags a payment line item and posts a
  // pre-filled context message into the landlord_tenant chat thread.
  raiseDispute: (paymentId, reason, token) => request('/disputes', { method: 'POST', body: { paymentId, reason }, token, queueable: true, queueDescription: 'Raise payment dispute' }),
  listDisputes: (params = {}, token) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/disputes${qs ? `?${qs}` : ''}`, { token });
  },
  resolveDispute: (disputeId, resolutionNote, token) => request(`/disputes/${disputeId}/resolve`, { method: 'PATCH', body: { resolutionNote }, token }),
  getPublicListings: (params) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request(`/public/listings${qs ? `?${qs}` : ''}`);
  },
  getPublicListingAreas: () => request('/public/listings/counties'),
  getPublicListingContact: (unitId) => request(`/public/listings/${unitId}/contact`),
  createPaymentPlanRequest: (payload, token) => request('/payment-plans', { method: 'POST', body: payload, token }),
  listPaymentPlanRequests: (params, token) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request(`/payment-plans${qs ? `?${qs}` : ''}`, { token });
  },
  decidePaymentPlanRequest: (requestId, decision, note, token) => request(`/payment-plans/${requestId}/decide`, { method: 'PATCH', body: { decision, note }, token }),
  cancelPaymentPlanRequest: (requestId, token) => request(`/payment-plans/${requestId}/cancel`, { method: 'PATCH', token }),

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
  getRevenueDashboard: (token) => request('/admin/revenue-dashboard', { token }),
  getGrowthStatistics: (token) => request('/admin/growth-statistics', { token }),
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
  getHelpReplyThread: (requestId, token) => request(`/help/${requestId}/reply-thread`, { token }),

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
  sendBulkSmsToSelected: (payload, token) => request('/tenants/bulk-sms', { method: 'POST', body: payload, token }),


  // Account (both roles)
  changePassword: (payload, token) => request('/auth/change-password', { method: 'POST', body: payload, token }),
  dismissOnboarding: (token) => request('/auth/dismiss-onboarding', { method: 'POST', token }),
  uploadProfilePhoto: (formData, token) => requestMultipart('/upload/profile-photo', { method: 'POST', formData, token }),
  uploadUnitPhotos: (unitId, formData, token) => requestMultipart(`/units/${unitId}/photos`, { method: 'POST', formData, token }),
  removeUnitPhoto: (unitId, photoUrl, token) => request(`/units/${unitId}/photos`, { method: 'DELETE', body: { photoUrl }, token }),
  removeProfilePhoto: (token) => request('/upload/profile-photo', { method: 'DELETE', token }),

  // Expenses (property-level cost tracking, feeds net profit on the
  // Financial Statistics tab and PDF collection summary)
  listExpenses: (token, params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))).toString();
    return request(`/expenses${qs ? `?${qs}` : ''}`, { token });
  },
  createExpense: (formData, token) => requestMultipart('/expenses', { method: 'POST', formData, token }),
  updateExpense: (expenseId, payload, token) => request(`/expenses/${expenseId}`, { method: 'PATCH', body: payload, token }),
  deleteExpense: (expenseId, token) => request(`/expenses/${expenseId}`, { method: 'DELETE', token }),

  // Documents (lease/ID storage on tenant/unit detail pages)
  listDocuments: (params, token) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''))).toString();
    return request(`/documents${qs ? `?${qs}` : ''}`, { token });
  },
  uploadDocument: (formData, token) => requestMultipart('/documents', { method: 'POST', formData, token }),
  deleteDocument: (documentId, token) => request(`/documents/${documentId}`, { method: 'DELETE', token }),

  // Audit trail (who created/edited/deleted an expense or document -
  // including ones since deleted, since the log entry outlives the row)
  getAuditLog: (params, token) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''))).toString();
    return request(`/audit-log/expenses-documents${qs ? `?${qs}` : ''}`, { token });
  },

  // PDF reports - downloads a blob rather than JSON, so this bypasses
  // the shared `request` helper (which always expects application/json).
  downloadStatisticsPdf: async (token, propertyId) => {
    const qs = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : '';
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(`${BASE_URL}/dashboard/statistics/pdf${qs}`, { headers });
    } catch (networkErr) {
      throw new ApiError('Could not reach the server. Please check your internet connection and try again.', { kind: 'network' });
    }
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch { /* non-JSON error body */ }
      throw new ApiError(data.error || `Request failed with status ${response.status}`, { kind: 'http', status: response.status });
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentapay-collection-summary-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  downloadReceiptPdf: async (paymentId, token) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(`${BASE_URL}/payments/${paymentId}/receipt`, { headers });
    } catch (networkErr) {
      throw new ApiError('Could not reach the server. Please check your internet connection and try again.', { kind: 'network' });
    }
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch { /* non-JSON error body */ }
      throw new ApiError(data.error || `Request failed with status ${response.status}`, { kind: 'http', status: response.status });
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentapay-receipt-${paymentId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  listPendingRentChanges: (token, propertyId) => {
    const qs = propertyId && propertyId !== 'unassigned' ? `?propertyId=${encodeURIComponent(propertyId)}` : '';
    return request(`/units/pending-rent-changes${qs}`, { token });
  },
  downloadAnnualReportPdf: async (token, { year, propertyId } = {}) => {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (propertyId) params.set('propertyId', propertyId);
    const qs = params.toString();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(`${BASE_URL}/annual-report/portfolio/pdf${qs ? `?${qs}` : ''}`, { headers });
    } catch (networkErr) {
      throw new ApiError('Could not reach the server. Please check your internet connection and try again.', { kind: 'network' });
    }
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch { /* non-JSON error body */ }
      throw new ApiError(data.error || `Request failed with status ${response.status}`, { kind: 'http', status: response.status });
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentapay-annual-report-${year || new Date().getFullYear()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  downloadTaxSummaryPdf: async (token, { year, propertyId, kraPin } = {}) => {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (propertyId) params.set('propertyId', propertyId);
    if (kraPin) params.set('kraPin', kraPin);
    const qs = params.toString();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(`${BASE_URL}/annual-report/tax-summary/pdf${qs ? `?${qs}` : ''}`, { headers });
    } catch (networkErr) {
      throw new ApiError('Could not reach the server. Please check your internet connection and try again.', { kind: 'network' });
    }
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch { /* non-JSON error body */ }
      throw new ApiError(data.error || `Request failed with status ${response.status}`, { kind: 'http', status: response.status });
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentapay-tax-summary-${year || new Date().getFullYear()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  downloadFinancialReportCsv: async (token, { year, propertyId } = {}) => {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (propertyId) params.set('propertyId', propertyId);
    const qs = params.toString();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(`${BASE_URL}/annual-report/financial-report/csv${qs ? `?${qs}` : ''}`, { headers });
    } catch (networkErr) {
      throw new ApiError('Could not reach the server. Please check your internet connection and try again.', { kind: 'network' });
    }
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch { /* non-JSON error body */ }
      throw new ApiError(data.error || `Request failed with status ${response.status}`, { kind: 'http', status: response.status });
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentapay-financial-report-${year || new Date().getFullYear()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  exportMyData: async (token) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(`${BASE_URL}/data-export/me`, { headers });
    } catch (networkErr) {
      throw new ApiError('Could not reach the server. Please check your internet connection and try again.', { kind: 'network' });
    }
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch { /* non-JSON error body */ }
      throw new ApiError(data.error || `Request failed with status ${response.status}`, { kind: 'http', status: response.status });
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentapay-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Live push (Web Push / VAPID) - "urgent tier" notifications
  // (payment-confirmation requests, vacate notices, tenant messages).
  getVapidPublicKey: () => request('/push/vapid-public-key'),
  subscribePush: (subscription, token) => request('/push/subscribe', { method: 'POST', body: { subscription }, token }),
  unsubscribePush: (endpoint, token) => request('/push/unsubscribe', { method: 'POST', body: { endpoint }, token }),
};
