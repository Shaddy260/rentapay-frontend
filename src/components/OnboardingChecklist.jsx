import { useState } from 'react';
import { api } from '../api/client.js';
import Button from './Button.jsx';
import './OnboardingChecklist.css';

// FEATURE (direct request: "onboarding to all first users despite the
// role"): every portal previously looked identical on day 1 and day
// 500 - a brand-new account landed on a dashboard with zero
// signposting. This is one reusable checklist, given a different set
// of steps per role by the page that renders it.
//
// Design decisions worth keeping in mind if this gets extended:
// - Each step's "done" state is DERIVED from real data the caller
//   already has (e.g. "added a property" = properties.length > 0),
//   never a manually-ticked checkbox - so it can never drift out of
//   sync with what's actually true.
// - Dismissal is explicit (a person closes it, or every step is
//   already done) and persisted server-side via onboarding_dismissed_at
//   - it does not silently reappear on a later visit once dismissed.
//
// Props:
//   steps: [{ key, label, done, actionLabel?, onAction? }]
//   dismissed: whether the account has onboarding_dismissed_at set
//   token: auth token, needed to call the dismiss endpoint
export default function OnboardingChecklist({ steps, dismissed, token, onDismissed }) {
  const [dismissing, setDismissing] = useState(false);
  const [hiddenThisSession, setHiddenThisSession] = useState(false);

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (dismissed || hiddenThisSession) return null;

  async function handleDismiss() {
    setDismissing(true);
    setHiddenThisSession(true); // hide immediately, don't make them wait on the network
    try {
      await api.dismissOnboarding(token);
      onDismissed?.();
    } catch {
      // best-effort - if this fails, it'll just show again next visit,
      // which is a safe failure mode (not worse than not having it)
    } finally {
      setDismissing(false);
    }
  }

  return (
    <section className="onboarding-checklist">
      <div className="onboarding-checklist__header">
        <h2>{allDone ? "You're all set \ud83c\udf89" : 'Getting started'}</h2>
        <button
          type="button"
          className="onboarding-checklist__dismiss"
          aria-label="Dismiss getting-started checklist"
          disabled={dismissing}
          onClick={handleDismiss}
        >
          ✕
        </button>
      </div>

      <div className="onboarding-checklist__progress-track">
        <div className="onboarding-checklist__progress-fill" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <p className="onboarding-checklist__progress-label">{doneCount} of {steps.length} done</p>

      <ul className="onboarding-checklist__steps">
        {steps.map((step) => (
          <li key={step.key} className={`onboarding-checklist__step ${step.done ? 'is-done' : ''}`}>
            <span className="onboarding-checklist__step-icon" aria-hidden="true">{step.done ? '✓' : '○'}</span>
            <span className="onboarding-checklist__step-label">{step.label}</span>
            {!step.done && step.actionLabel && step.onAction && (
              <Button variant="ghost" onClick={step.onAction}>{step.actionLabel}</Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
