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

// FEATURE (Section 8: offline-friendly / low-data mode) - tracks how
// many requests are currently in flight, app-wide, and tells any
// listener (see OfflineBanner.jsx) when at least one has been pending
// for longer than a normal round trip. This is on top of the existing
// offline queueing/caching below - that handles a connection that's
// fully down; this handles one that's just slow, so people on patchy
// connections see "this is taking a while" instead of a screen that
// looks frozen with no explanation.
const SLOW_REQUEST_THRESHOLD_MS = 6000;
let activeRequestCount = 0;
let slowTimer = null;
const slowConnectionListeners = new Set();

function notifySlowConnection(isSlow) {
  slowConnectionListeners.forEach((fn) => fn(isSlow));
}

export function onSlowConnection(fn) {
  slowConnectionListeners.add(fn);
  return () => slowConnectionListeners.delete(fn);
}

function beginTrackedRequest() {
  activeRequestCount += 1;
  if (!slowTimer) {
    slowTimer = setTimeout(() => {
      if (activeRequestCount > 0) notifySlowConnection(true);
    }, SLOW_REQUEST_THRESHOLD_MS);
  }
}

function endTrackedRequest() {
  activeRequestCount = Math.max(0, activeRequestCount - 1);
  if (activeRequestCount === 0) {
    if (slowTimer) {
      clearTimeout(slowTimer);
      slowTimer = null;
    }
    notifySlowConnection(false);
  }
}

async function request(path, { method = 'GET', body, token, queueable, queueDescription, keepalive } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const cacheKey = method === 'GET' ? cacheKeyFor(path, token) : null;

  let response;
  beginTrackedRequest();
  try {
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      // Some fire-and-forget calls (e.g. markAssistantSeen) fire the
      // instant something happens, right before the person is likely
      // to navigate away or background the app. Without `keepalive`,
      // the browser can cancel the request mid-flight when that
      // happens, so the write silently never lands - see markAssistantSeen.
      ...(keepalive ? { keepalive: true } : {}),
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
      "Could not reach the server. Please try again in a moment.",
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

    // FIX (direct request: hard subscription lockout): the backend
    // now returns this on EVERY authenticated landlord/manager
    // request once the subscription lapses, not just a handful of
    // write endpoints. Handled once, here, the same way the lockdown
    // case above is - so a stale tab that's still mid-session gets
    // bounced to the renewal screen the moment it makes its next
    // request, without needing every single page to check for this
    // itself. Deliberately does NOT clear the token/log the person
    // out - they need to stay signed in to actually pay.
    if (response.status === 403 && data.subscriptionExpired) {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/subscription') && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/subscription';
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
  } finally {
    endTrackedRequest();
  }
}

// Shared authenticated-blob download helper - any server-generated
// file (CSV/PDF statements etc.) that needs a real Authorization
// header rather than a plain navigable <a href> URL (verifyToken only
// reads the header, never a query param) goes through this, same
// shape as the original downloadBaPayoutStatement implementation.
async function downloadBaFile(path, queryParams, token, fallbackFilename) {
  const params = new URLSearchParams(queryParams);
  const response = await fetch(`${BASE_URL}${path}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    let message = 'Failed to download the statement.';
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // response wasn't JSON - keep the default message
    }
    throw new ApiError(message, { kind: 'http', status: response.status });
  }
  const disposition = response.headers.get('content-disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match ? match[1] : fallbackFilename || 'download';
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function requestMultipart(path, { method = 'POST', formData, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  // Deliberately NOT setting Content-Type here - the browser sets it
  // itself (multipart/form-data; boundary=...) when the body is a
  // FormData instance. Setting it manually strips the boundary and
  // breaks the upload.

  let response;
  beginTrackedRequest();
  try {
    response = await fetch(`${BASE_URL}${path}`, { method, headers, body: formData });
  } catch (networkErr) {
    throw new ApiError('Could not reach the server. Please check your internet connection and try again.', { kind: 'network' });
  } finally {
    endTrackedRequest();
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
  // DIRECT REQUEST: verify email on the same page as details, before
  // the account exists - see requestLandlordEmailVerification /
  // confirmLandlordEmailVerification on the backend.
  sendLandlordRegistrationEmailOtp: (payload) => request('/auth/landlord/send-registration-email-otp', { method: 'POST', body: payload }),
  verifyLandlordRegistrationEmailOtp: (payload) => request('/auth/landlord/verify-registration-email-otp', { method: 'POST', body: payload }),
  verifyOTP: (payload) => request('/auth/verify-otp', { method: 'POST', body: payload }),
  resendOTP: (payload) => request('/auth/resend-otp', { method: 'POST', body: payload }),
  verifyLandlordEmailOTP: (payload) => request('/auth/verify-landlord-email', { method: 'POST', body: payload }),
  resendLandlordEmailOTP: (payload) => request('/auth/resend-landlord-email-otp', { method: 'POST', body: payload }),
  updateLandlordRegistrationEmail: (payload) => request('/auth/update-landlord-registration-email', { method: 'POST', body: payload }),
  initiateLandlordPayment: (payload) => request('/auth/landlord/initiate-payment', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  loginWithGoogle: (payload) => request('/auth/google', { method: 'POST', body: payload }),
  sessionCheck: (token) => request('/auth/session-check', { token }),
  requestPasswordReset: (payload) => request('/auth/forgot-password/request', { method: 'POST', body: payload }),
  resetPassword: (payload) => request('/auth/forgot-password/reset', { method: 'POST', body: payload }),
  // SECTION 3 (General Manager dedicated login) - hits its own backend
  // endpoint, distinct from login()/adminLogin() above.
  generalManagerLogin: (payload) => request('/auth/manager-account/login', { method: 'POST', body: payload }),
  adminLogin: (payload) => request('/auth/admin/login', { method: 'POST', body: payload }),
  adminVerifyOtp: (payload) => request('/auth/admin/verify-otp', { method: 'POST', body: payload }),
  adminForgotPassword: () => request('/auth/admin/forgot-password', { method: 'POST' }),
  adminResetPassword: (payload) => request('/auth/admin/reset-password', { method: 'POST', body: payload }),
  changeAdminPassword: (payload, token) => request('/auth/admin/change-password', { method: 'POST', body: payload, token }),
  getHelpContacts: () => request('/settings/public/help-contacts'),

  // Live base rate + period discount tiers, no auth - used to preview
  // cost on the signup screen and "add a property" flow so they never
  // show a stale/hardcoded price after admin changes it.
  getPublicSubscriptionPricing: () => request('/settings/public/subscription-pricing'),

  getAdminSettings: (token) => request('/admin/settings', { token }),
  updateHelpEmail: (payload, token) => request('/admin/settings/help-contacts', { method: 'PATCH', body: payload, token }),
  listHelpContactNumbers: (token) => request('/admin/settings/help-contacts/numbers', { token }),
  createHelpContactNumber: (payload, token) => request('/admin/settings/help-contacts/numbers', { method: 'POST', body: payload, token }),
  updateHelpContactNumber: (id, payload, token) => request(`/admin/settings/help-contacts/numbers/${id}`, { method: 'PATCH', body: payload, token }),
  deleteHelpContactNumber: (id, token) => request(`/admin/settings/help-contacts/numbers/${id}`, { method: 'DELETE', token }),

  // Subscription fee (base rate + period discount tiers) - affects
  // signup, adding a property, add-units, and renewals everywhere.
  getSubscriptionPricing: (token) => request('/admin/settings/subscription-pricing', { token }),
  updateSubscriptionPricing: (payload, token) => request('/admin/settings/subscription-pricing', { method: 'PATCH', body: payload, token }),

  // Loyalty discounts for landlords who've subscribed consecutively.
  getLoyaltyDiscountCandidates: (minMonths, token) =>
    request(`/admin/settings/loyalty-discounts/candidates${minMonths ? `?minMonths=${encodeURIComponent(minMonths)}` : ''}`, { token }),
  getActiveLoyaltyDiscounts: (token) => request('/admin/settings/loyalty-discounts/active', { token }),
  getLoyaltyDiscountHistory: (landlordId, token) =>
    request(`/admin/settings/loyalty-discounts/history${landlordId ? `?landlordId=${encodeURIComponent(landlordId)}` : ''}`, { token }),
  bulkGrantLoyaltyDiscount: (payload, token) => request('/admin/settings/loyalty-discounts/bulk-grant', { method: 'POST', body: payload, token }),
  revokeLoyaltyDiscount: (landlordId, token) => request(`/admin/settings/loyalty-discounts/${landlordId}`, { method: 'DELETE', token }),
  completeSetupWizard: (payload, token) => request('/auth/landlord/complete-setup-wizard', { method: 'POST', body: payload, token }),
  updatePropertyDetails: (payload, token) => request('/auth/landlord/property', { method: 'PATCH', body: payload, token }),
  getMyLandlordProfile: (token) => request('/auth/landlord/me', { token }),
  getPaymentMethod: (token, propertyId) => request(`/auth/payment-method${propertyId ? `?propertyId=${propertyId}` : ''}`, { token }),
  updateMyContact: (payload, token) => request('/auth/landlord/contact', { method: 'PATCH', body: payload, token }),
  disputeBaAttribution: (token) => request('/auth/landlord/dispute-ba-attribution', { method: 'POST', token }),
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
  getCommunityUnreadCount: (token, propertyId) => request(`/community/unread-count${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  markCommunityRead: (postIds, token) => request('/community/mark-read', { method: 'POST', body: { postIds }, token }),
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
  hideCommunityPost: (postId, token) => request(`/community/${postId}/hide`, { method: 'POST', token }),
  pinCommunityPost: (postId, pinned, token) => request(`/community/${postId}/pin`, { method: 'PATCH', body: { pinned }, token }),
  replyToCommunityPost: (postId, body, token) => request(`/community/${postId}/replies`, { method: 'POST', body: { body }, token }),
  deleteCommunityReply: (replyId, token) => request(`/community/replies/${replyId}`, { method: 'DELETE', token }),
  hideCommunityReply: (replyId, token) => request(`/community/replies/${replyId}/hide`, { method: 'POST', token }),
  reportCommunityContent: (payload, token) => request('/community/report', { method: 'POST', body: payload, token }),
  getSubscriptionStatus: (token, propertyId) => request(`/subscriptions/status${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  getSubscriptionQuote: (unitsCount, periodMonths, token) =>
    request(`/subscriptions/quote?unitsCount=${encodeURIComponent(unitsCount)}&periodMonths=${encodeURIComponent(periodMonths)}`, { token }),
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
  // DIRECT REQUEST: "rate this tenant" reminder popups - random +
  // triggered right after a tenant payment is confirmed.
  getNextRatingReminder: (token) => request('/tenants/rating-reminders/next', { token }),
  snoozeRatingReminder: (reminderId, mode, token) => request(`/tenants/rating-reminders/${reminderId}/snooze`, { method: 'POST', body: { mode }, token }),
  // DIRECT REQUEST: "sending such landlords whose subscription is not
  // ended that there is a discount to their next renewal... reminding
  // them... should be in app and popup not email."
  getLoyaltyDiscountReminder: (token) => request('/subscriptions/loyalty-discount-reminder', { token }),
  snoozeLoyaltyDiscountReminder: (discountId, mode, token) => request(`/subscriptions/loyalty-discount-reminder/${discountId}/snooze`, { method: 'POST', body: { mode }, token }),
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

  // Virtual Assistant (guided walkthrough) - server-side "has this
  // account ever seen it" flag, so it auto-launches once per account
  // regardless of device/browser, and never again after that.
  getAssistantStatus: (token) => request('/assistant/status', { token }),
  // keepalive: true - this fires the instant the walkthrough
  // auto-opens (see VirtualAssistant.jsx/Dashboard.jsx), which is
  // exactly when someone is most likely to immediately tap Skip or
  // switch apps. Without keepalive, a plain fetch can get cancelled
  // by that navigation before it reaches the server, so the "seen"
  // flag never actually saves - and the walkthrough wrongly
  // auto-opens again on their next login even though they already
  // went through it once.
  markAssistantSeen: (token) => request('/assistant/seen', { method: 'POST', token, keepalive: true }),

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
  updateDueDate: (unitId, payload, token) => request(`/units/${unitId}/due-date`, { method: 'PATCH', body: payload, token }),
  updateUnitPaymentOverride: (unitId, payload, token) => request(`/units/${unitId}/payment-override`, { method: 'PATCH', body: payload, token }),
  updateUnitStatus: (unitId, payload, token) => request(`/units/${unitId}/status`, { method: 'PATCH', body: payload, token }),
  verifyUnit: (unitId, token) => request(`/units/${unitId}/verify`, { method: 'PATCH', token }),
  updatePublicListing: (unitId, isPubliclyListed, token) => request(`/units/${unitId}/public-listing`, { method: 'PATCH', body: { isPubliclyListed }, token }),
  updateListingStatus: (unitId, listingStatus, token) => request(`/units/${unitId}/listing-status`, { method: 'PATCH', body: { listingStatus }, token }),
  updateListingDescription: (unitId, listingDescription, token) => request(`/units/${unitId}/listing-description`, { method: 'PATCH', body: { listingDescription }, token }),
  updateDepositSettings: (unitId, payload, token) => request(`/units/${unitId}/deposit-settings`, { method: 'PATCH', body: payload, token }),
  bulkUpdateDepositSettings: (payload, token) => request('/units/bulk-deposit-settings', { method: 'POST', body: payload, token }),
  removeUnit: (unitId, token) => request(`/units/${unitId}`, { method: 'DELETE', token }),
  addExtraCharge: (unitId, payload, token) => request(`/units/${unitId}/extra-charges`, { method: 'POST', body: payload, token }),
  bulkUpdateRent: (payload, token) => request('/units/bulk-rent', { method: 'POST', body: payload, token }),
  bulkUpdateDueDate: (payload, token) => request('/units/bulk-due-date', { method: 'POST', body: payload, token }),

  // Tenants
  addTenant: (payload, token) => request('/tenants', { method: 'POST', body: payload, token }),
  getTenant: (tenantId, token) => request(`/tenants/${tenantId}`, { token }),
  editTenantDetails: (tenantId, payload, token) => request(`/tenants/${tenantId}`, { method: 'PATCH', body: payload, token }),
  editTenantBalance: (tenantId, payload, token) => request(`/tenants/${tenantId}/balance`, { method: 'PATCH', body: payload, token }),
  settleTenantDeposit: (tenantId, payload, token) => request(`/tenants/${tenantId}/deposit`, { method: 'PATCH', body: payload, token }),
  remindTenant: (tenantId, token) => request(`/tenants/${tenantId}/remind`, { method: 'POST', token, queueable: true, queueDescription: 'Send rent reminder' }),
  sendBulkReminders: (token) => request('/tenants/bulk-remind', { method: 'POST', token }),
  // Section 5: WhatsApp reminders - client-side wa.me deep links only.
  // These GET the phone/message data; nothing is sent server-side.
  getWhatsAppReminderInfo: (tenantId, token) => request(`/tenants/${tenantId}/remind/whatsapp`, { token }),
  getWhatsAppBulkReminderQueue: (token) => request('/tenants/bulk-remind/whatsapp', { token }),
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
  // FEATURE (Section 8: rent history export) - PDF counterpart to the
  // existing client-side CSV download (see downloadCsv.js usage in
  // TenantPortal.jsx). Downloads a blob rather than JSON, same pattern
  // as downloadReceiptPdf/downloadStatisticsPdf below.
  downloadPaymentHistoryPdf: async (token) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(`${BASE_URL}/tenants/payment-history/pdf`, { headers });
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
    a.download = `rentapay-payment-history-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
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
  bulkDeletePendingPaymentConfirmations: (payload, token) => request('/payments/pending-confirmations/bulk-delete', { method: 'POST', body: payload, token }),

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

  // DIRECT REQUEST: anonymous, no-login "notify me when a unit goes
  // vacant" - both the decorative toast and the real push opt-in.
  getToastVacancy: (county) => request(`/public/vacancy-alerts/toast${county ? `?county=${encodeURIComponent(county)}` : ''}`),
  getVacancyAlertVapidPublicKey: () => request('/public/vacancy-alerts/vapid-public-key'),
  subscribeVacancyAlerts: (subscription, county) =>
    request('/public/vacancy-alerts/subscribe', { method: 'POST', body: { subscription, county } }),
  unsubscribeVacancyAlerts: (endpoint) => request('/public/vacancy-alerts/unsubscribe', { method: 'POST', body: { endpoint } }),
  // Tenant reputation sharing (direct request #4): tenant generates a
  // link to their own portable score; anyone can resolve it, no login.
  getMyReputationShareLink: (token) => request('/tenants/reputation-share-link', { token }),
  getSharedReputation: (shareToken) => request(`/public/reputation/${shareToken}`),
  getReputationShareLinkByEmail: (email) => request(`/public/reputation-by-email?email=${encodeURIComponent(email)}`),
  // FIX (spec item 2.1): backs the receipt QR code's /verify/:paymentId
  // page - no auth, matches the getSharedReputation pattern above.
  verifyReceipt: (paymentId) => request(`/public/receipts/${paymentId}/verify`),
  createPaymentPlanRequest: (payload, token) => request('/payment-plans', { method: 'POST', body: payload, token }),
  listPaymentPlanRequests: (params, token) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request(`/payment-plans${qs ? `?${qs}` : ''}`, { token });
  },
  decidePaymentPlanRequest: (requestId, decision, note, token) => request(`/payment-plans/${requestId}/decide`, { method: 'PATCH', body: { decision, note }, token }),
  cancelPaymentPlanRequest: (requestId, token) => request(`/payment-plans/${requestId}/cancel`, { method: 'PATCH', token }),
  // FEATURE (spec item 4): long-press-to-delete one installment entry
  // on the tenant's own approved payment plan.
  deletePaymentPlanInstallment: (requestId, index, token) => request(`/payment-plans/${requestId}/installments/${index}`, { method: 'DELETE', token }),

  // Super Admin (blueprint section 13)
  getAdminDashboard: (token) => request('/admin/dashboard', { token }),
  // SECTION 1 (General Manager spec): the admin "SQL" tab and its
  // client methods (listAdminSqlTables/listAdminSqlRows/
  // updateAdminSqlRow) have been removed outright - no UI on the
  // platform exposes raw or table-scoped database access anymore.
  // SECTION 2 (General Manager spec): admin-only account creation for
  // the new General Manager role.
  listGeneralManagers: (token, search) => request(`/admin/general-managers${search ? `?search=${encodeURIComponent(search)}` : ''}`, { token }),
  createGeneralManager: (payload, token) => request('/admin/general-managers', { method: 'POST', body: payload, token }),
  // Prompt 7 — self-service onboarding link, same shape as the BA link
  // methods above (getBaOnboardingLink / generateBaOnboardingLink).
  getGmOnboardingLink: (token) => request('/admin/general-managers/onboarding-link', { token }),
  generateGmOnboardingLink: (token) => request('/admin/general-managers/onboarding-link/generate', { method: 'POST', token }),
  // Suspend / reactivate a General Manager's own account (admin-only —
  // a General Manager can never manage another General Manager's account).
  setGeneralManagerStatus: (managerId, status, token) => request(`/admin/general-managers/${managerId}/status`, { method: 'PATCH', body: { status }, token }),
  // SECTION 8 — admin browsing a specific General Manager's own log
  // page (day/week/month). `view` is 'day'|'week'|'month', `date`
  // (optional) anchors which day/week/month, defaults to today.
  getGeneralManagerLogs: (managerId, { view, date } = {}, token) => {
    const params = new URLSearchParams();
    if (view) params.set('view', view);
    if (date) params.set('date', date);
    const qs = params.toString();
    return request(`/admin/general-managers/${managerId}/logs${qs ? `?${qs}` : ''}`, { token });
  },
  // SECTION 9 — styled, branded PDF export of a specific General
  // Manager's activity log, for an optional date range (omit both to
  // export their full history). Reuses the shared authenticated-blob
  // download helper above, same as every other server-generated PDF.
  downloadGeneralManagerLogsPdf: (managerId, { from, to } = {}, token) => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return downloadBaFile(`/admin/general-managers/${managerId}/logs/export.pdf`, params, token, `rentapay-gm-activity-${managerId.slice(0, 8)}.pdf`);
  },
  // SECTION 10 — Admin Revert Capability. Individual (one log entry)
  // and bulk (every eligible, not-yet-reverted entry within an
  // optional date range — omit both to revert the manager's entire
  // revertible history) revert, both admin-only.
  revertGeneralManagerLog: (managerId, logId, token) =>
    request(`/admin/general-managers/${managerId}/logs/${logId}/revert`, { method: 'POST', token }),
  revertGeneralManagerLogsInRange: (managerId, { from, to } = {}, token) =>
    request(`/admin/general-managers/${managerId}/logs/revert-range`, { method: 'POST', body: { from, to }, token }),
  // A General Manager browsing their OWN log page (Section 8).
  getMyGeneralManagerLogs: ({ view, date } = {}, token) => {
    const params = new URLSearchParams();
    if (view) params.set('view', view);
    if (date) params.set('date', date);
    const qs = params.toString();
    return request(`/manager-account/my-logs${qs ? `?${qs}` : ''}`, { token });
  },
  listAllLandlords: (token) => request('/admin/landlords', { token }),
  // FEATURE (spec item 10): landlords who started but never finished
  // registration/setup, with which step they stopped at.
  getIncompleteSignups: (token) => request('/admin/landlords/incomplete-signups', { token }),
  // Phase 8 - Today's Onboarded Landlords (system panel): real signups
  // by date/range, "via <BA>" attribution included per row.
  listLandlordsOnboarded: ({ from, to } = {}, token) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return request(`/admin/landlords-onboarded${qs ? `?${qs}` : ''}`, { token });
  },
  listAllTenantsAdmin: (token) => request('/admin/tenants', { token }),
  listAllUnitsAdmin: (token) => request('/admin/units', { token }),
  getRevenueBreakdown: (period, token) => request(`/admin/revenue${period ? `?period=${period}` : ''}`, { token }),
  getRevenueTrend: (token) => request('/admin/revenue-trend', { token }),
  getRevenueDashboard: (token) => request('/admin/revenue-dashboard', { token }),
  // Phase 12 - admin revenue statistics & pricing proposal.
  getPricingProposal: (token, targetMarginPct) =>
    request(`/admin/pricing-proposal${targetMarginPct != null ? `?targetMarginPct=${encodeURIComponent(targetMarginPct)}` : ''}`, { token }),
  getGrowthStatistics: (token) => request('/admin/growth-statistics', { token }),
  getExpiringLandlords: (days, token) => request(`/admin/expiring-landlords${days ? `?days=${days}` : ''}`, { token }),
  sendRenewalReminders: (payload, token) => request('/admin/expiring-landlords/remind', { method: 'POST', body: payload, token }),
  setLandlordStatus: (landlordId, payload, token) => request(`/admin/landlords/${landlordId}/status`, { method: 'PATCH', body: payload, token }),
  deleteLandlordAccount: (landlordId, password, token, extra = {}) => request(`/admin/landlords/${landlordId}`, { method: 'DELETE', body: { password, ...extra }, token }),
  editLandlordSubscription: (landlordId, payload, token) => request(`/admin/landlords/${landlordId}/subscription`, { method: 'PATCH', body: payload, token }),
  getLandlordProperties: (landlordId, token) => request(`/admin/landlords/${landlordId}/properties`, { token }),
  getActivityLog: (token) => request('/admin/activity-log', { token }),
  deleteActivityLogEntry: (logId, token) => request(`/admin/activity-log/${logId}`, { method: 'DELETE', token }),
  deleteActivityLogsForDay: (date, token) => request(`/admin/activity-log/day?date=${date}`, { method: 'DELETE', token }),
  // Admin moderation - "Reported Accounts" screen (warn/suspend
  // accounts flagged via Community's report button).
  listCommunityReports: (status, token) => request(`/admin/moderation/reports?status=${encodeURIComponent(status)}`, { token }),
  listModeratedAccounts: (tab, token) => request(`/admin/moderation/accounts?tab=${encodeURIComponent(tab)}`, { token }),
  getModerationHistory: (accountType, accountId, token) => request(`/admin/moderation/${accountType}/${accountId}/history`, { token }),
  warnAccount: (accountType, accountId, payload, token) => request(`/admin/moderation/${accountType}/${accountId}/warn`, { method: 'POST', body: payload, token }),
  suspendAccountPermanently: (accountType, accountId, payload, token) => request(`/admin/moderation/${accountType}/${accountId}/suspend`, { method: 'POST', body: payload, token }),
  suspendAccountTemporarily: (accountType, accountId, payload, token) => request(`/admin/moderation/${accountType}/${accountId}/suspend-temporary`, { method: 'POST', body: payload, token }),
  unsuspendAccount: (accountType, accountId, token, payload = {}) => request(`/admin/moderation/${accountType}/${accountId}/unsuspend`, { method: 'POST', body: payload, token }),

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
  checkPropertyPurchaseStatusById: (propertyPaymentId, token) => request(`/properties/purchase-status-by-id/${propertyPaymentId}`, { token }),

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
  // SECTION 4 (Operations PIN) - General Manager's own self-service
  // routes, all under /manager-account and all requiring their token.
  setOperationsPin: (payload, token) => request('/manager-account/operations-pin', { method: 'POST', body: payload, token }),
  changeOperationsPin: (payload, token) => request('/manager-account/operations-pin', { method: 'PATCH', body: payload, token }),
  requestOperationsPinReset: (token) => request('/manager-account/operations-pin/forgot', { method: 'POST', token }),
  resetOperationsPin: (payload, token) => request('/manager-account/operations-pin/reset', { method: 'POST', body: payload, token }),
  dismissOnboarding: (token) => request('/auth/dismiss-onboarding', { method: 'POST', token }),
  uploadProfilePhoto: (formData, token) => requestMultipart('/upload/profile-photo', { method: 'POST', formData, token }),
  uploadUnitPhotos: (unitId, formData, token) => requestMultipart(`/units/${unitId}/photos`, { method: 'POST', formData, token }),
  removeUnitPhoto: (unitId, photoUrl, token) => request(`/units/${unitId}/photos`, { method: 'DELETE', body: { photoUrl }, token }),
  applyUnitPhotosToOthers: (unitId, body, token) => request(`/units/${unitId}/photos/apply-to-others`, { method: 'POST', body, token }),
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

  // DIRECT REQUEST: landlord/manager/caretaker bulk-download every
  // completed payment's receipt as one zip, for record-keeping.
  downloadAllReceiptsZip: async (token, { propertyId } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const qs = propertyId && propertyId !== 'unassigned' ? `?propertyId=${encodeURIComponent(propertyId)}` : '';
    let response;
    try {
      response = await fetch(`${BASE_URL}/payments/receipts/bulk-download${qs}`, { headers });
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
    a.download = `rentapay-receipts-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // DIRECT REQUEST: RentaPay itself can be reviewed - by logged-in
  // users AND anonymous visitors. Token is optional here.

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

  // Tenant Self-Onboarding via Shared Link
  getOnboardingLink: (propertyId, token) => request(`/tenant-onboarding/link/${propertyId}`, { token }),
  listOnboardingRequests: (token, propertyId) => request(`/tenant-onboarding/requests${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`, { token }),
  editOnboardingRequest: (requestId, payload, token) => request(`/tenant-onboarding/requests/${requestId}`, { method: 'PATCH', body: payload, token }),
  deleteOnboardingRequest: (requestId, token) => request(`/tenant-onboarding/requests/${requestId}`, { method: 'DELETE', token }),
  confirmOnboardingRequest: (requestId, token) => request(`/tenant-onboarding/requests/${requestId}/confirm`, { method: 'POST', token }),
  // Public - no token, tenant is filling this in with no account at all.
  getPublicOnboardingForm: (linkToken) => request(`/public/onboarding/${linkToken}`),
  checkOnboardingDuplicate: (linkToken, { phone, email } = {}) => request(`/public/onboarding/${linkToken}/check-duplicate`, { method: 'POST', body: { phone, email } }),
  sendOnboardingEmailOtp: (linkToken, email) => request(`/public/onboarding/${linkToken}/email/send-otp`, { method: 'POST', body: { email } }),
  verifyOnboardingEmailOtp: (linkToken, email, otp) => request(`/public/onboarding/${linkToken}/email/verify-otp`, { method: 'POST', body: { email, otp } }),
  submitPublicOnboarding: (linkToken, payload) => request(`/public/onboarding/${linkToken}/submit`, { method: 'POST', body: payload }),

  // Brand Ambassador self-onboarding (build spec Phase 2) - public,
  // no login. The one generic "Become a Brand Ambassador" link, now a
  // 24h-rotating token the applicant's page must carry through every step.
  requestBaEmailOtp: (email, onboardingToken) => request('/brand-ambassadors/email/send-otp', { method: 'POST', body: { email, onboardingToken } }),
  confirmBaEmailOtp: (email, code) => request('/brand-ambassadors/email/verify-otp', { method: 'POST', body: { email, code } }),
  submitBaOnboarding: (payload) => request('/brand-ambassadors/apply', { method: 'POST', body: payload }),

  // PUBLIC — General Manager self-service onboarding (Prompt 7), same
  // shape as the BA methods just above.
  validateGmOnboardingLink: (onboardingToken) => request(`/manager-account/onboarding/link/validate?token=${encodeURIComponent(onboardingToken || '')}`),
  requestGmEmailOtp: (email, onboardingToken) => request('/manager-account/onboarding/email/send-otp', { method: 'POST', body: { email, onboardingToken } }),
  confirmGmEmailOtp: (email, code) => request('/manager-account/onboarding/email/verify-otp', { method: 'POST', body: { email, code } }),
  submitGmOnboarding: (payload) => request('/manager-account/onboarding/apply', { method: 'POST', body: payload }),
  validateBaOnboardingLink: (onboardingToken) => request(`/brand-ambassadors/onboarding-link/validate?token=${encodeURIComponent(onboardingToken || '')}`),

  // BA Payout Submission - BUILD SPEC PHASE 10 (v2): universal links,
  // gated by email + OTP.
  //   /ba-payout-submit          - one static, non-expiring link the
  //                                same for every BA.
  //   /ba-payout-edit?token=...  - one universal, 24h-rotating,
  //                                admin-issued correction link.
  // No resubmission endpoint exists anywhere in this API surface.
  requestBaPayoutSubmitOtp: (email) => request('/brand-ambassadors/payout-link/submit/request-otp', { method: 'POST', body: { email } }),
  verifyBaPayoutSubmitOtp: (email, code) => request('/brand-ambassadors/payout-link/submit/verify-otp', { method: 'POST', body: { email, code } }),
  submitBaPayoutDetails: (payload) => request('/brand-ambassadors/payout-link/submit', { method: 'POST', body: payload }),

  validateBaPayoutEditLink: (token) => request(`/brand-ambassadors/payout-link/edit/validate?token=${encodeURIComponent(token || '')}`),
  requestBaPayoutEditOtp: (token, email) => request('/brand-ambassadors/payout-link/edit/request-otp', { method: 'POST', body: { token, email } }),
  verifyBaPayoutEditOtp: (email, code) => request('/brand-ambassadors/payout-link/edit/verify-otp', { method: 'POST', body: { email, code } }),
  editBaPayoutDetails: (payload) => request('/brand-ambassadors/payout-link/edit', { method: 'POST', body: payload }),

  getMyBaPayoutSubmission: (verificationToken, purpose) => {
    const q = new URLSearchParams({ verificationToken, purpose: purpose || 'edit' }).toString();
    return request(`/brand-ambassadors/payout-link/my-submission?${q}`);
  },
  getBaPayoutLinkCurrent: (token) => request('/brand-ambassadors/payout-link/current', { token }),
  getBaPendingPayments: (token) => request('/brand-ambassadors/payout-link/pending', { token }),
  getBaAwaitingPaymentDetails: (token) => request('/brand-ambassadors/payout-link/awaiting-details', { token }),
  markBaPaymentsPaid: (payoutKeys, token) =>
    request('/brand-ambassadors/payout-link/mark-paid', { method: 'POST', body: { payoutKeys }, token }),
  getBaCompletedPeriods: (token) => request('/brand-ambassadors/payout-link/completed-periods', { token }),
  getBaCompletedPayments: (periodKey, token) =>
    request(`/brand-ambassadors/payout-link/completed${periodKey ? `?periodKey=${encodeURIComponent(periodKey)}` : ''}`, { token }),
  getBaPaymentHistory: (token) => request('/brand-ambassadors/payout-link/history', { token }),
  // ADMIN - manage the one universal 24h correction link (not per-BA).
  getBaPayoutEditLinkStatus: (token) => request('/brand-ambassadors/payout-link/edit-link/status', { token }),
  generateBaPayoutEditLink: (token) =>
    request('/brand-ambassadors/payout-link/edit-link/generate', { method: 'POST', token }),
  downloadBaCompletedPayoutPdf: (periodKey, token) =>
    downloadBaFile(
      '/brand-ambassadors/payout-link/completed/pdf',
      periodKey ? { periodKey } : {},
      token,
      `ba-payout-completed-${periodKey || 'all'}.pdf`
    ),

  // Phase 9 - public marketing landlord-lead capture form. No auth.
  submitLandlordLead: (payload) => request('/public/landlord-leads', { method: 'POST', body: payload }),
  // Admin - landlord leads review queue.
  listLandlordLeads: ({ status, from, to, page, pageSize } = {}, token) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (page) params.set('page', page);
    if (pageSize) params.set('pageSize', pageSize);
    const qs = params.toString();
    return request(`/admin/landlord-leads${qs ? `?${qs}` : ''}`, { token });
  },
  markLandlordLeadContacted: (id, token) => request(`/admin/landlord-leads/${id}/mark-contacted`, { method: 'POST', token }),

  // Admin - the rotating 24h "Become a Brand Ambassador" onboarding link.
  getBaOnboardingLink: (token) => request('/brand-ambassadors/onboarding-link', { token }),
  generateBaOnboardingLink: (token) => request('/brand-ambassadors/onboarding-link/generate', { method: 'POST', token }),

  // Admin - Brand Ambassador applications & roster.
  listPendingBaApplications: (page, token) => request(`/brand-ambassadors/applications${page ? `?page=${page}` : ''}`, { token }),
  approveBaApplication: (id, token, extra = {}) => request(`/brand-ambassadors/applications/${id}/approve`, { method: 'POST', body: extra, token }),
  rejectBaApplication: (id, reason, token, extra = {}) => request(`/brand-ambassadors/applications/${id}/reject`, { method: 'POST', body: { reason, ...extra }, token }),
  listBrandAmbassadors: (status, token) => request(`/brand-ambassadors${status ? `?status=${status}` : ''}`, { token }),
  // FIX (direct request): suspend/reactivate/offboard/restore now all
  // require the admin password, same as a landlord's suspend/activate
  // - each sends it in the body and the backend re-checks it before
  // touching the account.
  // SECTION 6 (General Manager spec): a General Manager calls these
  // same functions but with `extra = { operationsPin, reason }`
  // instead of an admin password - `password` is simply omitted for
  // that role since it plays no role in confirming the action.
  suspendBrandAmbassador: (id, password, token, extra = {}) => request(`/brand-ambassadors/${id}/suspend`, { method: 'POST', body: { password, ...extra }, token }),
  reactivateBrandAmbassador: (id, password, token, extra = {}) => request(`/brand-ambassadors/${id}/reactivate`, { method: 'POST', body: { password, ...extra }, token }),
  offboardBrandAmbassador: (id, password, token, extra = {}) => request(`/brand-ambassadors/${id}/offboard`, { method: 'POST', body: { password, ...extra }, token }),
  restoreBrandAmbassador: (id, password, token, extra = {}) => request(`/brand-ambassadors/${id}/restore`, { method: 'POST', body: { password, ...extra }, token }),
  // BA portal (Phase 3) - the logged-in BA's own profile, scoped server-side to their JWT.
  getMyBaProfile: (token) => request('/brand-ambassadors/me', { token }),
  updateBaProfile: (payload, token) => request('/brand-ambassadors/me', { method: 'PATCH', body: payload, token }),
  updateBaLeaderboardOptIn: (optIn, token) => request('/brand-ambassadors/me/leaderboard-opt-in', { method: 'PATCH', body: { optIn }, token }),
  // Phase 4 - public referral-code resolution (landlord signup form "Referred by <name>").
  resolveBaReferralCode: (code) => request(`/brand-ambassadors/referral/${encodeURIComponent(code)}`),
  // SECTION A/B - manual claim logging removed entirely. "My
  // Onboarded Landlords" is the ONE single live list, sourced directly
  // from landlords.ba_id.
  listMyOnboardedLandlords: ({ from, to } = {}, token) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return request(`/brand-ambassadors/landlords/mine${qs ? `?${qs}` : ''}`, { token });
  },
  getBaStats: (token) => request('/brand-ambassadors/stats/mine', { token }),
  // Phase 18 - Optional BA Leaderboard. period is 'month' | 'quarter' | 'all'.
  getBaLeaderboard: (period, token) => request(`/brand-ambassadors/leaderboard?period=${encodeURIComponent(period)}`, { token }),
  // Phase 7 - "Share with admin": returns { summary, count }; posts the
  // same summary into the admin notifications inbox server-side.
  shareClaimsReport: ({ from, to } = {}, token) => request('/brand-ambassadors/landlords/mine/share', { method: 'POST', body: { from, to }, token }),

  // SECTION E - Admin: recurring percentage commission rate (global +
  // optional per-BA override), each an append-only history. baId is
  // optional on the GET - when present the response also includes
  // that BA's override history (or null), so the UI can show "using
  // global" vs "custom override" without a second round trip. Setting
  // a rate always inserts a new history row (effectiveFrom optional,
  // defaults to now server-side) rather than overwriting the current
  // one - the old fixed-price / commission-tiers / unit-pricing-tiers
  // endpoints are gone (hard cutover).
  getBaPayoutRules: (baId, token) => request(`/brand-ambassadors/payout-rules${baId ? `?baId=${encodeURIComponent(baId)}` : ''}`, { token }),
  updateGlobalBaPayoutRule: (payload, token) => request('/brand-ambassadors/payout-rules/global', { method: 'PATCH', body: payload, token }),
  setBaPayoutOverride: (baId, payload, token) => request(`/brand-ambassadors/${baId}/payout-rule-override`, { method: 'PATCH', body: payload, token }),
  getBaPayoutRuleHistory: (baId, token) => request(`/brand-ambassadors/payout-rules/history${baId ? `?baId=${encodeURIComponent(baId)}` : ''}`, { token }),

  // PREMIUM REDESIGN PLAN - PHASE 8: Admin BA Performance & Rewards
  // Dashboard - leaderboard ranked by net revenue contribution,
  // single/bulk time-bound custom-commission rewards, reward history,
  // and the branded PDF export of a reward batch.
  getBaRewardsLeaderboard: (token) => request('/brand-ambassadors/rewards/leaderboard', { token }),
  rewardBrandAmbassadors: (payload, token) => request('/brand-ambassadors/rewards', { method: 'POST', body: payload, token }),
  getBaRewardHistory: (token) => request('/brand-ambassadors/rewards/history', { token }),
  downloadBaRewardPdf: (batchId, token) => downloadBaFile(`/brand-ambassadors/rewards/${batchId}/pdf`, {}, token, `ba-reward-report-${batchId.slice(0, 8)}.pdf`),
  sendBaChallengeBroadcast: (token) => request('/brand-ambassadors/rewards/challenge-broadcast', { method: 'POST', token }),

  // PREMIUM REDESIGN PLAN - PHASE 9: Admin Financial Overview &
  // Expense Tracking. Scoped to one month at a time.
  getAdminFinancialOverview: (month, token) => request(`/admin/financial-overview${month ? `?month=${encodeURIComponent(month)}` : ''}`, { token }),
  addAdminExpense: (payload, token) => request('/admin/financial-overview/expenses', { method: 'POST', body: payload, token }),
  stopAdminExpense: (id, fromMonth, token) => request(`/admin/financial-overview/expenses/${id}/stop`, { method: 'POST', body: { fromMonth }, token }),
  deleteAdminExpense: (id, token) => request(`/admin/financial-overview/expenses/${id}`, { method: 'DELETE', token }),

  // SECTION E - the logged-in BA's own recurring commission earnings
  // (one row per completed landlord subscription payment). Optional
  // ?cycle=YYYY-MM to filter to one billing cycle.
  getMyCommissionEarnings: (cycle, token) => request(`/brand-ambassadors/earnings/mine${cycle ? `?cycle=${encodeURIComponent(cycle)}` : ''}`, { token }),

  // Phase 11 - Admin: Payout Review, Reconciliation & Cross-BA
  // Security Report.
  getBaPayoutReview: ({ periodType, periodKey }, token) => {
    const params = new URLSearchParams({ periodType, periodKey });
    return request(`/brand-ambassadors/payout-review?${params.toString()}`, { token });
  },
  markBaPeriodPaid: (baId, payload, token) => request(`/brand-ambassadors/${baId}/payout-review/mark-paid`, { method: 'POST', body: payload, token }),
  markBaPeriodNotPaid: (baId, payload, token) => request(`/brand-ambassadors/${baId}/payout-review/mark-not-paid`, { method: 'POST', body: payload, token }),
  // CSV download needs a real Authorization header, so this can't be a
  // plain navigable <a href> URL (verifyToken only reads the header,
  // never a query param) - fetch it as an authenticated blob instead,
  // same shape as PendingPaymentConfirmations.jsx's client-built CSV
  // download, just with server-generated content.
  downloadBaPayoutStatement: async (baId, { periodType, periodKey }, token) => {
    const params = new URLSearchParams({ periodType, periodKey });
    await downloadBaFile(`/brand-ambassadors/${baId}/payout-statement.csv`, Object.fromEntries(params), token, `statement-${periodKey}.csv`);
  },
  reconcileBaList: (payload, token) => request('/brand-ambassadors/reconcile', { method: 'POST', body: payload, token }),
  getBaSecurityReport: (token) => request('/brand-ambassadors/security-report', { token }),

  // ITEM 12 - BA Payout Qualification Report: generate/list/view, plus
  // CSV and the new colored PDF exports (combined + per-BA).
  generateBaPayoutQualificationReport: (payload, token) =>
    request('/brand-ambassadors/payout-qualification-reports/generate', { method: 'POST', body: payload || {}, token }),
  listBaPayoutQualificationReports: (token) => request('/brand-ambassadors/payout-qualification-reports', { token }),
  getBaPayoutQualificationReport: (reportId, token) => request(`/brand-ambassadors/payout-qualification-reports/${reportId}`, { token }),
  downloadBaPayoutQualificationReportCsv: (reportId, periodKey, token) =>
    downloadBaFile(`/brand-ambassadors/payout-qualification-reports/${reportId}.csv`, {}, token, `ba-payout-qualification-report-${periodKey}.csv`),
  downloadBaPayoutQualificationReportPdf: (reportId, periodKey, token) =>
    downloadBaFile(`/brand-ambassadors/payout-qualification-reports/${reportId}/pdf`, {}, token, `ba-payout-qualification-report-${periodKey}.pdf`),
  downloadBaPayoutQualificationReportBaPdf: (reportId, baId, periodKey, token) =>
    downloadBaFile(`/brand-ambassadors/payout-qualification-reports/${reportId}/ba/${baId}/pdf`, {}, token, `ba-payout-qualification-${baId}-${periodKey}.pdf`),

  // Phase 19 - Qualification Job Dry-Run Mode.
  runQualificationDryRun: (token) => request('/brand-ambassadors/qualification/dry-run', { method: 'POST', token }),
  runQualificationNow: (token) => request('/brand-ambassadors/qualification/run-now', { method: 'POST', token }),
  downloadQualificationDryRunCsv: (token) => downloadBaFile('/brand-ambassadors/qualification/dry-run.csv', {}, token, 'ba-qualification-dry-run.csv'),

  // Phase 17 - Downloadable Earnings Statement (Per BA, Per Period).
  // period is either { periodType: 'month', periodKey: 'YYYY-MM' } or
  // { periodType: 'custom', from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }.
  getMyEarningsStatement: (period, token) => {
    const params = new URLSearchParams(period);
    return request(`/brand-ambassadors/me/earnings-statement?${params.toString()}`, { token });
  },
  downloadMyEarningsStatementPdf: (period, token) => downloadBaFile('/brand-ambassadors/me/earnings-statement.pdf', period, token),
  downloadMyEarningsStatementCsv: (period, token) => downloadBaFile('/brand-ambassadors/me/earnings-statement.csv', period, token),
  getBaEarningsStatement: (baId, period, token) => {
    const params = new URLSearchParams(period);
    return request(`/brand-ambassadors/${baId}/earnings-statement?${params.toString()}`, { token });
  },
  downloadBaEarningsStatementPdf: (baId, period, token) => downloadBaFile(`/brand-ambassadors/${baId}/earnings-statement.pdf`, period, token),
  downloadBaEarningsStatementCsv: (baId, period, token) => downloadBaFile(`/brand-ambassadors/${baId}/earnings-statement.csv`, period, token),

  // AI Support Chat
  sendSupportMessage: (message, token) => request('/support-chat/message', { method: 'POST', body: { message }, token }),
  selectSupportMenuOption: (category, token) => request('/support-chat/menu-select', { method: 'POST', body: { category }, token }),
  escalateSupportToAgent: (payload, token) => request('/support-chat/escalate', { method: 'POST', body: payload, token }),
  submitSupportRating: (payload, token) => request('/support-chat/rating', { method: 'POST', body: payload, token }),
  getPendingSupportRating: (token) => request('/support-chat/pending-rating', { token }),
  getSupportChatHistory: (token) => request('/support-chat/history', { token }),
  getSupportAnalytics: (token) => request('/support-chat/analytics', { token }),

  // Utility Sub-Metering - see RentaPay-Utility-Submetering-Spec.pdf,
  // Sections 1-7. Caretaker/manager/landlord may all submit/correct
  // readings and work the review screen (backend allows 'landlord'
  // and 'manager' roles, which covers caretaker - see
  // utilitySubmetering.routes.js).
  uploadMeterReadingPhoto: (formData, token) => requestMultipart('/upload/meter-reading-photo', { method: 'POST', formData, token }),
  listUtilityMeters: (token) => request('/utility-submetering/meters', { token }),
  createUtilityMeter: (payload, token) => request('/utility-submetering/meters', { method: 'POST', body: payload, token }),
  submitUtilityReading: (meterId, payload, token) => request(`/utility-submetering/meters/${meterId}/readings`, { method: 'POST', body: payload, token }),
  listUtilityReadings: (meterId, token) => request(`/utility-submetering/meters/${meterId}/readings`, { token }),
  correctUtilityReading: (readingId, payload, token) => request(`/utility-submetering/readings/${readingId}`, { method: 'PATCH', body: payload, token }),
  getUtilityReadingCorrections: (readingId, token) => request(`/utility-submetering/readings/${readingId}/corrections`, { token }),
  getUtilityReview: (readingId, token) => request(`/utility-submetering/readings/${readingId}/review`, { token }),
  overrideUtilityRunUnit: (runId, runUnitId, payload, token) => request(`/utility-submetering/runs/${runId}/units/${runUnitId}`, { method: 'PATCH', body: payload, token }),
  finalizeUtilityRun: (runId, token) => request(`/utility-submetering/runs/${runId}/finalize`, { method: 'POST', token }),
};
