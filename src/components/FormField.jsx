import React from 'react';
import './FormField.css';

export default function FormField({ label, hint, error, children, htmlFor }) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor} className="form-field__label">{label}</label>
      {children}
      {hint && !error && <p className="form-field__hint">{hint}</p>}
      {error && <p className="form-field__error" role="alert">{error}</p>}
    </div>
  );
}
