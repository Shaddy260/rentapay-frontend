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
export default function Button({ variant = 'primary', loading, children, className, ...props }) {
  // className is merged (not overridden) so callers can layer utility/
  // spacing classes onto the button without losing its btn/btn--variant
  // styling - spreading {...props} after a fixed className would
  // otherwise silently drop it if a caller passes their own className.
  return (
    <button className={`btn btn--${variant}${className ? ` ${className}` : ''}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : null}
      <span>{loading ? 'Please wait…' : children}</span>
    </button>
  );
}
