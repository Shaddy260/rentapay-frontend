import React, { useMemo } from 'react';
import './PasswordStrengthMeter.css';

/**
 * Visual password strength feedback shown under a PasswordInput when a
 * new password is being created (signup, change-password). Purely a
 * UX nudge - it doesn't block submission. The backend's actual
 * requirement is the shared 6-character-minimum policy with no
 * character-class rules (numbers-only and letters-only are both fine),
 * so this only checks length - no uppercase/lowercase/number/special
 * checklist, since none of that is actually required.
 */
const CRITERIA = [
  { key: 'length6', label: '6+ characters', test: (pw) => pw.length >= 6 },
  { key: 'length10', label: '10+ characters (recommended)', test: (pw) => pw.length >= 10 },
  { key: 'length14', label: '14+ characters (recommended)', test: (pw) => pw.length >= 14 },
];

const LEVELS = [
  { max: 0, label: 'Weak', className: 'password-strength__fill--weak' },
  { max: 1, label: 'Fair', className: 'password-strength__fill--fair' },
  { max: 2, label: 'Good', className: 'password-strength__fill--good' },
  { max: 3, label: 'Strong', className: 'password-strength__fill--strong' },
];

export default function PasswordStrengthMeter({ password = '' }) {
  const { passed, score, level } = useMemo(() => {
    const passedSet = new Set(CRITERIA.filter((c) => c.test(password)).map((c) => c.key));
    const s = passedSet.size;
    const lvl = LEVELS.find((l) => s <= l.max) || LEVELS[LEVELS.length - 1];
    return { passed: passedSet, score: s, level: lvl };
  }, [password]);

  const empty = password.length === 0;

  return (
    <div className="password-strength" aria-live="polite">
      <div className="password-strength__header">
        <span className="password-strength__label">Password Strength</span>
        <span className={`password-strength__status ${empty ? 'password-strength__status--muted' : level.className}`}>
          {empty ? 'Enter password' : level.label}
        </span>
      </div>

      <div className="password-strength__bar">
        <div
          className={`password-strength__fill ${empty ? '' : level.className}`}
          style={{ width: empty ? '0%' : `${(score / CRITERIA.length) * 100}%` }}
        />
      </div>

      <ul className="password-strength__checklist">
        {CRITERIA.map((c) => {
          const ok = passed.has(c.key);
          return (
            <li
              key={c.key}
              className={`password-strength__check ${ok ? 'password-strength__check--ok' : ''}`}
            >
              <span className="password-strength__check-icon" aria-hidden="true">
                {ok ? '✓' : '○'}
              </span>
              {c.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
