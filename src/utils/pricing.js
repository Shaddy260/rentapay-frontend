// Shared subscription-pricing math - used by both RegisterFlow.jsx
// (first property, at signup) and AddPropertyModal.jsx (any
// additional property, purchased independently later) so the two
// flows can never quote a different price for the exact same
// unitsCount/periodMonths combination.
//
// FIX (direct request): this used to hardcode BASE_RATE=50 and a
// fixed PERIOD_DISCOUNTS object, so a brand-new landlord signing up
// was always quoted the original price even after admin changed it
// from the admin portal (renewals/AddUnits already read live from the
// backend via calculateSubscriptionCost in utils/pricing.js on the
// server, so only this client-side preview was stale). Now this
// fetches the current settings from the same public endpoint
// (/api/settings/public/subscription-pricing) that's backed by
// subscription_pricing_settings in the DB - the exact table admin
// edits - and caches them in memory for the session.

import { api } from '../api/client.js';

let cachedSettings = null; // { baseRatePerUnitPerMonth, periodDiscounts }
let inFlight = null;

const FALLBACK = { baseRatePerUnitPerMonth: 50, periodDiscounts: { 1: 0, 3: 0.05, 6: 0.10, 12: 0.15 } };

/**
 * Fetches (and caches) the live pricing settings. Call this once when
 * a signup/add-property flow mounts, before the user can see any
 * price preview. Safe to call multiple times - subsequent calls
 * reuse the same in-flight request or the cached result.
 */
export async function loadPricingSettings() {
  if (cachedSettings) return cachedSettings;
  if (inFlight) return inFlight;

  inFlight = api.getPublicSubscriptionPricing()
    .then((res) => {
      cachedSettings = {
        baseRatePerUnitPerMonth: Number(res.baseRatePerUnitPerMonth),
        periodDiscounts: res.periodDiscounts || {},
      };
      return cachedSettings;
    })
    .catch((err) => {
      // Never block signup over a pricing-fetch hiccup - fall back to
      // last-known defaults so the form still works, and let the
      // backend (which always re-checks live pricing itself at
      // charge time) be the actual source of truth for what's billed.
      console.error('[pricing] Failed to load live subscription pricing, using fallback:', err.message);
      cachedSettings = FALLBACK;
      return cachedSettings;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Synchronous read of whatever's cached (or the fallback if nothing loaded yet). */
export function getCachedPricingSettings() {
  return cachedSettings || FALLBACK;
}

export function previewCost(unitsCount, periodMonths) {
  const { baseRatePerUnitPerMonth, periodDiscounts } = getCachedPricingSettings();

  const tiers = Object.entries(periodDiscounts || {})
    .map(([months, discount]) => [Number(months), Number(discount)])
    .filter(([months, discount]) => Number.isFinite(months) && Number.isFinite(discount))
    .sort((a, b) => b[0] - a[0]);

  let discount = 0;
  for (const [months, d] of tiers) {
    if (periodMonths >= months) { discount = d; break; }
  }

  const rate = Math.round(baseRatePerUnitPerMonth * (1 - discount) * 100) / 100;
  const total = Math.round(rate * unitsCount * periodMonths * 100) / 100;
  return { rate, discount, total };
}
