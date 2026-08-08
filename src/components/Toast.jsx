import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import './Toast.css';

// Lightweight, dependency-free toast/snackbar system.
//
// PROBLEM: success/error feedback across the app was all inline
// <p className="...__error"> blocks that appear and just sit there
// forever until the next action - easy to miss (especially for admin
// actions like confirm/reject payment or delete unit, where the only
// feedback used to be the row changing in the table below) and once
// noticed, never goes away on its own.
//
// FIX: a single ToastProvider mounted once at the very top of the app
// (see App.jsx) renders a fixed-position stack of small pill
// notifications. Any component anywhere calls the `useToast()` hook to
// fire one - no prop drilling, no per-page setup. Each toast
// auto-dismisses after a few seconds (dismiss time is longer for
// errors, since those are more important to actually read), can be
// dismissed early by clicking it, and is announced via aria-live so
// screen reader users get the same feedback sighted users do.
//
// Deliberately NOT a replacement for every inline message - persistent
// state (e.g. "this apartment's subscription has expired") should stay
// inline where it's contextually anchored. Toasts are for one-off
// "here's what just happened" feedback after an action.

const ToastContext = createContext(null);

const DEFAULT_DURATION = { success: 3200, error: 5000, info: 3200 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, opts = {}) => {
      const type = opts.type || 'success';
      const duration = opts.duration ?? DEFAULT_DURATION[type] ?? DEFAULT_DURATION.info;
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  // Convenience shorthands - covers the vast majority of call sites
  // (`toast.success('Payment confirmed')` reads better than
  // `toast('Payment confirmed', { type: 'success' })` everywhere).
  toast.success = (message, opts) => toast(message, { ...opts, type: 'success' });
  toast.error = (message, opts) => toast(message, { ...opts, type: 'error' });
  toast.info = (message, opts) => toast(message, { ...opts, type: 'info' });

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast--${t.type}`}
            role={t.type === 'error' ? 'alert' : 'status'}
            onClick={() => dismiss(t.id)}
          >
            <span className="toast__icon" aria-hidden="true">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="toast__message">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Returns a callable `toast(message, { type: 'success'|'error'|'info', duration })`
// function, with `.success()`, `.error()`, `.info()` shorthands attached.
// Falls back to a harmless no-op (rather than throwing) if a page ever
// renders outside the provider, e.g. in isolated tests.
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    const noop = () => {};
    noop.success = noop;
    noop.error = noop;
    noop.info = noop;
    return noop;
  }
  return ctx;
}
