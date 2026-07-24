import { useEffect, useState } from 'react';

// FEATURE (direct request: "dark mode"): a single toggle, reused inside
// AccountMenu so every portal (landlord, tenant, scout, manager) gets
// it for free from one place instead of duplicating a switch per page.
// Preference is explicit and persisted - it does not follow the OS's
// prefers-color-scheme, so it can't change unexpectedly mid-session.
const STORAGE_KEY = 'rentapay_theme';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable - theme still applies for this session
    }
  }, [theme]);

  return [theme, setTheme];
}

export default function ThemeToggleItem({ className }) {
  const [theme, setTheme] = useTheme();
  return (
    <button
      type="button"
      className={className}
      role="menuitem"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
    </button>
  );
}
