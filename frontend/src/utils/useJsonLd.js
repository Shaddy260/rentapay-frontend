import { useEffect } from 'react';

// SEO (direct request: schema markup for listings, to help Google
// show rich results). Injects a <script type="application/ld+json">
// tag into <head> with the given schema.org object, and removes it
// again on unmount/when data changes - so navigating away (or a
// re-search that changes the listings) doesn't leave stale or
// duplicate structured data behind. Pass `null`/`undefined` as data
// to skip injecting anything (e.g. while listings are still loading).
export function useJsonLd(data) {
  useEffect(() => {
    if (!data) return undefined;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [data]);
}
