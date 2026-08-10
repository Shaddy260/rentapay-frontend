// src/utils/maskPhone.js
//
// Used by the BA Regions & Payout Qualification Report (see
// AdminBaRegionsReport.jsx): landlord phone numbers are shown with
// their middle 3 digits starred out before the report is downloaded/
// shared outside the app, e.g. "2547XX***XX7" style masking on
// "254712345678" -> "254712***678". Kept as a small pure function so
// it can be unit tested and reused wherever else a masked phone is
// needed.
export function maskPhoneMiddle(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (digits.length < 7) return phone || '';
  const visibleStart = Math.ceil((digits.length - 3) / 2);
  const start = digits.slice(0, visibleStart);
  const end = digits.slice(visibleStart + 3);
  return `${start}***${end}`;
}
