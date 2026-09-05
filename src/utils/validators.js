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

// BUG FIX (direct request, checked repeatedly - "07... rejected as
// invalid Kenyan number, 254... accepted, for the exact same number"):
// this used to be a loose 9-13 digit length check with no awareness of
// Kenyan number shapes at all, which is exactly how a form could end
// up disagreeing with the backend (or with a DIFFERENT form on this
// same site) about whether a given number is valid. Now delegates to
// normalizePhone() (utils/phone.js), the same function the backend
// uses - a number is valid here if and only if the backend will also
// accept it, regardless of which of the supported formats it's typed
// in (07..., 01..., 7..., 254..., +254..., 00254..., 0254...).
import { normalizePhone } from './phone.js';

export function isValidPhone(value) {
  if (value === undefined || value === null || value === '') return false;
  return normalizePhone(value) !== null;
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
