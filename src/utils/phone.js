// src/utils/phone.js
//
// Mirrors backend src/utils/phone.js EXACTLY. Every phone field in the
// app (landlord/manager signup, add tenant, add manager/caretaker,
// GM onboarding, edit-contact forms) must run through this before
// validating or submitting, so "valid Kenyan number" means the same
// thing on the client as it does on the server - the whole class of
// bug where one form accepts 07... and another only accepts 254...
// for the exact same number comes from each form inventing its own
// ad-hoc check instead of sharing one.
//
// Accepted inputs (whitespace/dashes stripped first):
//   0712345678      -> 254712345678
//   0112345678      -> 254112345678   (Airtel/Telkom-style 011 numbers)
//   712345678       -> 254712345678   (missing leading 0)
//   112345678       -> 254112345678
//   +254712345678   -> 254712345678
//   254712345678    -> 254712345678   (already correct - passthrough)
//   00254712345678  -> 254712345678   (international dial prefix)
//   0254712345678   -> 254712345678   (stray leading 0 before 254)

export function normalizePhone(raw) {
  if (raw == null) return null;
  let digits = String(raw).trim().replace(/[\s\-()]/g, '');

  if (digits.startsWith('+')) digits = digits.slice(1);

  if (digits.startsWith('00254')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0254')) {
    digits = digits.slice(1);
  }

  if (digits.startsWith('254')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!/^[17]\d{8}$/.test(digits)) {
    return null;
  }

  return `254${digits}`;
}

export function isRecognizableKenyanPhone(value) {
  return normalizePhone(value) !== null;
}
