// Site-wide "tap to reveal" behavior for secondary explanatory text.
//
// Rather than deleting hint/desc/note captions (which in a few places,
// like admin totals and empty-state messages, are actually functional),
// every element matching HINT_CLASSES gets collapsed behind a small
// "i" button. Tapping it reveals the original text in place. This runs
// once per matching element (marked with data-hint-wrapped) and is
// re-run on DOM mutations so it also catches content rendered later
// (modals, admin drilldowns, tab switches, etc.) for every role.

const HINT_CLASSES = [
  'add-charge-form__hint',
  'add-tenant-subtitle',
  'admin-ba-dry-run__hint',
  'admin-ba-reconcile__hint',
  'admin-ba-rules__note',
  'admin-ba-security__hint',
  'admin-metric-card__hint',
  'admin-metric-card__sub',
  'admin-rating-flags__resolution-note',
  'admin-section__hint',
  'admin-sql-panel__note',
  'apply-photos-modal__hint',
  'ba-leaderboard-panel__hint',
  'ba-referral-card__hint',
  'broadcast-panel__hint',
  'bulk-rent-modal__hint',
  'chat-conversation__hint',
  'chat-thread-list__hint',
  'community-panel__hint',
  'dispute-charge-prompt__hint',
  'download-app__desc',
  'form-field__hint',
  'glance__chip-sub',
  'landing__features-sub',
  'landing__hero-note',
  'landing__hero-sub',
  'landing__hero-sub--gold',
  'landlord-edit-modal__hint',
  'maintenance-manage-panel__desc',
  'manual-payment-help__note',
  'manual-payment-help__note--urgent',
  'metric-card__sub',
  'onboarding-link-bar__hint',
  'onboarding-requests__resolved-hint',
  'payment-details-card__note',
  'ppc-card__expired-hint',
  'property-switcher__item-sub',
  'public-listings__description',
  'settings-card__hint',
  'statistics-panel__card-note',
  'statistics-panel__chart-note',
  'status-page__hint',
  'step-rail__subtitle',
  'support-analytics__subtitle',
  'tenant-contact-card__rep-note',
  'tenant-onboarding-field-hint',
  'tenant-portal-hint',
  'tenant-rating-panel__note',
  'unit-detail-hint',
  'unit-detail-hint--scheduled',
  'units-empty__search-hint',
];

const SELECTOR = HINT_CLASSES.map((c) => `.${c}`).join(', ');

function wrapOne(el) {
  if (!el || el.dataset.hintWrapped === '1') return;
  if (!el.textContent || !el.textContent.trim()) return;

  el.dataset.hintWrapped = '1';
  el.classList.add('hint-toggle__content');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hint-toggle__btn';
  btn.setAttribute('aria-label', 'Show details');
  btn.setAttribute('aria-expanded', 'false');
  btn.textContent = 'i';

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = el.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  el.parentNode.insertBefore(btn, el);
}

function scan(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll(SELECTOR).forEach(wrapOne);
}

export function initHintToggles() {
  if (typeof document === 'undefined') return;

  scan(document);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (HINT_CLASSES.some((c) => node.classList && node.classList.contains(c))) {
          wrapOne(node);
        }
        scan(node);
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
