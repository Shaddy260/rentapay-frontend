import { useState } from 'react';
import './PropertyRulesCard.css';

// FEATURE (direct request): landlord can optionally type in property
// rules & regulations per property; every tenant under that property
// sees them here, visible upon opening the portal. Entirely optional -
// if the landlord hasn't set anything (rulesText is empty/null) this
// renders nothing at all, so no one sees an empty "Rules" box.
export default function PropertyRulesCard({ rulesText }) {
  const [expanded, setExpanded] = useState(true);

  if (!rulesText) return null;

  return (
    <section className="property-rules-card">
      <button
        type="button"
        className="property-rules-card__header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span>📋 Property Rules & Regulations</span>
        <span className="property-rules-card__chevron">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && <p className="property-rules-card__body">{rulesText}</p>}
    </section>
  );
}
