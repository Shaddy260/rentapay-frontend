// src/utils/validators.js
//
// Phase 2 - shared client-side validators mirroring the backend Zod
// schemas (backend src/validation/schemas.js). Forms call these inline
// so a field error appears before the round trip, and backend 400
// bodies carrying `fields` (see validate.middleware.js) can be mapped
// onto the same per-field error UI via fieldErrorsFromApi().

export function isRequired(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value) {
  if (value === undefined || value === null || value === '') return false;
  const digits = String(value).replace(/[\s\-()]/g, '');
  return /^\d{9,13}$/.test(digits);
}

export function isValidPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function isValidDueDay(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 31;
}

// Kept in sync with the backend policy in src/utils/password.js: 6+
// characters, no character-class requirements (numbers-only and
// letters-only passwords are both accepted).
export function passwordErrors(password) {
  const errors = [];
  if (!password || password.length < 6) errors.push('At least 6 characters.');
  return errors;
}

// Extracts the per-field error map from a backend 400 produced by
// validate.middleware.js: { fieldName: 'message', ... } or null.
export function fieldErrorsFromApi(err) {
  if (err && err.raw && typeof err.raw.fields === 'object' && err.raw.fields !== null) {
    return err.raw.fields;
  }
  return null;
}
