import React from 'react';
import './Button.css';

/**
 * variant="primary"  - RentaPay's own actions (Continue, Save, etc)
 * variant="mpesa"    - the M-Pesa moment specifically (per design plan,
 *                      kept visually distinct from RentaPay's own UI
 *                      so the person always knows when they're about
 *                      to be asked for their M-Pesa PIN)
 * variant="ghost"    - secondary/back actions
 */
export default function Button({ variant = 'primary', loading, children, ...props }) {
  return (
    <button className={`btn btn--${variant}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : null}
      <span>{loading ? 'Please wait…' : children}</span>
    </button>
  );
}
