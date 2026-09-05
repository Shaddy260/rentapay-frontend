// FEATURE (direct request - "literally anything on the platform
// should show, including settings and UIs"): Global Search only ever
// searched accounts (landlords/tenants/managers/GMs/BAs) via the
// backend. Searching for a *screen* - "payment settings", "audit
// log", "FAQ" - found nothing, because there was nothing to search.
//
// This is a small, hand-maintained index of every tab/screen on the
// Admin and General Manager dashboards, each with a few extra
// `keywords` so a person can find a screen by what they'd actually
// call it, not just its exact sidebar label ("mpesa" -> Subscription
// Payment Method, "audit" -> Activity Log, etc). It's filtered
// entirely client-side in AdminGlobalSearch.jsx and merged in
// alongside the account results the backend returns.
//
// Keeping this in sync with the sidebar: whenever a new tab/key is
// added to PortalSidebar's `sections` in AdminDashboard.jsx or
// ManagerAccountDashboard.jsx, add a matching entry here (or it just
// won't be searchable - nothing breaks, it's additive).

export const ADMIN_PAGE_INDEX = [
  { id: 'overview', label: 'Overview', tab: 'overview', keywords: ['dashboard', 'home', 'metrics'] },
  { id: 'statistics', label: 'Financial Statistics', tab: 'statistics', keywords: ['stats', 'numbers'] },
  { id: 'revenue-dashboard', label: 'Revenue Dashboard', tab: 'revenue-dashboard', keywords: ['revenue', 'income', 'earnings'] },
  { id: 'financial-overview', label: 'Financial Overview', tab: 'financial-overview', keywords: ['finance', 'money', 'profit'] },
  { id: 'landlords', label: 'Landlords', tab: 'landlords', keywords: ['apartments', 'properties', 'estates', 'suspend landlord', 'activate landlord'] },
  { id: 'incomplete-signups', label: 'Incomplete Signups', tab: 'incomplete-signups', keywords: ['abandoned signup', 'onboarding wizard'] },
  { id: 'onboarded-landlords', label: "Today's Onboarded Landlords", tab: 'onboarded-landlords', keywords: ['new landlords', 'signups today'] },
  { id: 'landlord-leads', label: 'Landlord Leads', tab: 'landlord-leads', keywords: ['leads', 'prospects'] },
  { id: 'manual-subscription-payments', label: 'Landlord Manual Payments', tab: 'manual-subscription-payments', keywords: ['manual payment', 'confirm payment', 'subscription payment'] },
  { id: 'subscription-pricing', label: 'Subscription Fee', tab: 'subscription-pricing', keywords: ['pricing', 'subscription price', 'fee'] },
  { id: 'platform-payment-settings', label: 'Subscription Payment Method', tab: 'platform-payment-settings', keywords: ['mpesa', 'paybill', 'till number', 'receiving method', 'payment settings', 'daraja'] },
  { id: 'loyalty-discounts', label: 'Loyalty Discounts', tab: 'loyalty-discounts', keywords: ['discount', 'loyalty'] },
  { id: 'brand-ambassadors', label: 'Brand Ambassadors', tab: 'brand-ambassadors', keywords: ['ba', 'ambassadors', 'referral'] },
  { id: 'ba-rewards', label: 'BA Rewards & Leaderboard', tab: 'ba-rewards', keywords: ['leaderboard', 'rewards', 'commission'] },
  { id: 'ba-payout-review', label: 'Payout Run', tab: 'ba-payout-review', keywords: ['ba payout', 'commission payout'] },
  { id: 'ba-reconciliation', label: 'BA Reconciliation', tab: 'ba-reconciliation', keywords: ['reconciliation'] },
  { id: 'ba-security-report', label: 'BA Security Report', tab: 'ba-security-report', keywords: ['fraud', 'security'] },
  { id: 'general-managers', label: 'General Managers', tab: 'general-managers', keywords: ['gm', 'general manager'] },
  { id: 'gm-pending-actions', label: 'GM Pending Actions', tab: 'gm-pending-actions', keywords: ['pending', 'approvals'] },
  { id: 'help', label: 'Help Requests', tab: 'help', keywords: ['support requests', 'tickets'] },
  { id: 'rating-flags', label: 'Rating Flags', tab: 'rating-flags', keywords: ['flagged ratings', 'reviews'] },
  { id: 'reported-accounts', label: 'Reported Accounts', tab: 'reported-accounts', keywords: ['moderation', 'reports', 'warn', 'suspend', 'ban'] },
  { id: 'faq', label: 'FAQs', tab: 'faq', keywords: ['faq', 'questions'] },
  { id: 'help-contact-settings', label: 'Help & Contact Details', tab: 'help-contact-settings', keywords: ['contact settings', 'support contact'] },
  { id: 'support-analytics', label: 'Support Analytics', tab: 'support-analytics', keywords: ['ai chat analytics', 'support chat'] },
  { id: 'credentials', label: 'First-Time Credentials / Change Password', tab: 'credentials', keywords: ['password', 'change password', 'credentials'] },
  { id: 'activity', label: 'Activity Log', tab: 'activity', keywords: ['audit log', 'audit trail', 'history'] },
];

export const GM_PAGE_INDEX = [
  { id: 'overview', label: 'Overview', tab: 'overview', keywords: ['dashboard', 'home', 'metrics'] },
  { id: 'landlords', label: 'Landlords', tab: 'landlords', keywords: ['apartments', 'properties', 'estates', 'suspend landlord', 'activate landlord'] },
  { id: 'onboarded-landlords', label: "Today's Onboarded Landlords", tab: 'onboarded-landlords', keywords: ['new landlords', 'signups today'] },
  { id: 'incomplete-signups', label: 'Incomplete Signups', tab: 'incomplete-signups', keywords: ['abandoned signup', 'onboarding wizard'] },
  { id: 'tenants', label: 'Tenants', tab: 'tenants', keywords: ['renters'] },
  { id: 'units', label: 'Units', tab: 'units', keywords: ['apartments', 'vacant units'] },
  { id: 'brand-ambassadors', label: 'Brand Ambassadors', tab: 'brand-ambassadors', keywords: ['ba', 'ambassadors', 'referral'] },
  { id: 'expiring', label: 'Expiring Soon', tab: 'expiring', keywords: ['subscription expiring', 'renewal'] },
  { id: 'loyalty-discounts', label: 'Loyalty Discounts', tab: 'loyalty-discounts', keywords: ['discount', 'loyalty'] },
  { id: 'manual-payments', label: 'Landlord Manual Payments', tab: 'manual-payments', keywords: ['manual payment', 'confirm payment'] },
  { id: 'pricing', label: 'Pricing & Commission', tab: 'pricing', keywords: ['pricing', 'commission', 'subscription price'] },
  { id: 'help', label: 'Help Requests', tab: 'help', keywords: ['support requests', 'tickets'] },
  { id: 'rating-flags', label: 'Rating Flags', tab: 'rating-flags', keywords: ['flagged ratings', 'reviews'] },
  { id: 'reported-accounts', label: 'Reported Accounts', tab: 'reported-accounts', keywords: ['moderation', 'reports'] },
  { id: 'faq', label: 'FAQs', tab: 'faq', keywords: ['faq', 'questions'] },
  { id: 'help-contact-settings', label: 'Help & Contact Details', tab: 'help-contact-settings', keywords: ['contact settings', 'support contact'] },
  { id: 'my-activity', label: 'My Activity', tab: 'my-activity', keywords: ['audit log', 'my actions', 'history'] },
  { id: 'messages', label: 'Messages', route: '/messages', keywords: ['chat', 'inbox'] },
  { id: 'settings', label: 'Settings', route: '/manager-account/settings', keywords: ['operations pin', 'my settings', 'account settings'] },
];

/**
 * Filters a page index against a query. Matches on the label itself
 * or any keyword, case-insensitive substring - deliberately simple
 * (no fuzzy matching) since the index is small and hand-curated.
 */
export function filterPageIndex(pageIndex, query, limit = 6) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return pageIndex
    .filter((p) => p.label.toLowerCase().includes(q) || (p.keywords || []).some((k) => k.toLowerCase().includes(q)))
    .slice(0, limit);
}
