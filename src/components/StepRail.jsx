import React from 'react';
import './StepRail.css';

/**
 * The persistent step-tracker rail. This genuinely IS a sequence
 * (registration -> payment -> verify -> 5-step setup wizard), so
 * numbering communicates real information here, not decoration.
 */
export default function StepRail({ steps, currentIndex }) {
  return (
    <nav className="step-rail" aria-label="Registration progress">
      <ol>
        {steps.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'upcoming';
          return (
            <li key={step.key} className={`step-rail__item step-rail__item--${state}`}>
              <span className="step-rail__marker" aria-hidden="true">
                {state === 'done' ? '✓' : String(i + 1).padStart(2, '0')}
              </span>
              <span className="step-rail__label">
                <span className="step-rail__title">{step.title}</span>
                {step.subtitle && <span className="step-rail__subtitle">{step.subtitle}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
