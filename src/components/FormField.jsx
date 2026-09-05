import React from 'react';
import InfoTip from './InfoTip.jsx';
import './FormField.css';

// FEATURE (direct request: "replace the always-visible text with a
// small dropdown/info icon next to the UI element - the explanation
// should only appear when the user taps/expands it"). FormField is
// shared across the whole app, so moving the hint into an InfoTip
// here declutters every screen that uses it in one place, instead of
// having to touch each screen individually.
export default function FormField({ label, hint, error, children, htmlFor }) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor} className="form-field__label">
        {label}
        {hint && !error && <InfoTip text={hint} label={`About ${label}`} />}
      </label>
      {children}
      {error && <p className="form-field__error" role="alert">{error}</p>}
    </div>
  );
}
