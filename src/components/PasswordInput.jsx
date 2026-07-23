import React, { useState } from 'react';
import './PasswordInput.css';

/**
 * A password <input> with a show/hide toggle button.
 * Accepts the same props you'd give a plain <input>, plus forwards
 * everything else (id, required, autoComplete, placeholder, etc).
 */
export default function PasswordInput({ id, className = '', ...rest }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className={`password-input__field ${className}`}
        {...rest}
      />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        tabIndex={-1}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M10.58 10.58a2 2 0 002.83 2.83" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M9.36 5.24A10.6 10.6 0 0112 5c5.5 0 9 5 9 7-.32.66-1 1.8-2.1 2.94M6.5 6.6C4.2 8.06 2.6 10.1 2 12c.6 2 4.5 7 10 7 1.14 0 2.22-.2 3.2-.55" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.8" fill="none" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
          </svg>
        )}
      </button>
    </div>
  );
}
