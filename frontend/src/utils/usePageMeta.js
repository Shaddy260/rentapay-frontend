import { useEffect } from 'react';

// SEO (direct request: "when I search rentapay on google mine doesn't
// appear... or when one searches rental/vacant houses sites"). This is
// a client-rendered SPA with one static index.html, so every route
// shares the same <title>/<meta description> unless a page sets its
// own at runtime. Google does render JS and will pick this up, but
// only the pages that actually call this get a title/description
// matched to what someone's actually searching for (e.g. "vacant
// houses Nairobi" should land on /find-a-house's own title, not the
// generic homepage one). Resets back to the default on unmount so
// navigating away doesn't leave a stale title/description behind.
const DEFAULT_TITLE = 'RentaPay - Property & Rent Management for Landlords in Kenya | Find Vacant Houses';
const DEFAULT_DESCRIPTION = "RentaPay is Kenya's property management platform for landlords, property managers, and caretakers - collect rent via M-Pesa, track tenants and units, and manage every property from one dashboard.";

export function usePageMeta(title, description) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    let descTag = document.querySelector('meta[name="description"]');
    const prevDescription = descTag?.getAttribute('content') || null;
    if (description && descTag) descTag.setAttribute('content', description);

    return () => {
      document.title = prevTitle || DEFAULT_TITLE;
      if (descTag && prevDescription) descTag.setAttribute('content', prevDescription);
      else if (descTag) descTag.setAttribute('content', DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}
