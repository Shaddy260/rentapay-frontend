// Shared subscription-pricing math - used by both RegisterFlow.jsx
// (first property, at signup) and AddPropertyModal.jsx (any
// additional property, purchased independently later) so the two
// flows can never quote a different price for the exact same
// unitsCount/periodMonths combination.
export const BASE_RATE = 50; // KES per unit per month
export const PERIOD_DISCOUNTS = { 1: 0, 3: 0.05, 6: 0.10, 12: 0.15 };

export function previewCost(unitsCount, periodMonths) {
  const discount = PERIOD_DISCOUNTS[periodMonths] ?? 0;
  const rate = Math.round(BASE_RATE * (1 - discount) * 100) / 100;
  const total = Math.round(rate * unitsCount * periodMonths * 100) / 100;
  return { rate, discount, total };
}
