import { useEffect } from 'react';
import './DownloadEffect.css';

/**
 * Mounted once near the app root. Adds a short animated confirmation
 * badge next to ANY existing download/export trigger, but only when
 * dark mode is active - light mode is completely untouched.
 *
 * Deliberately NOT a wrapper component: it doesn't touch the DOM tree
 * of any button/link at all. Every existing download control keeps
 * its exact markup, classes, and click handlers. To opt an element
 * in, just add `data-download-fx` to it - nothing else changes.
 *
 * How it works: listens for clicks anywhere in the document (capture
 * phase, passive - never calls preventDefault/stopPropagation, so the
 * real click and its onClick/href always fire normally). If the
 * clicked element (or an ancestor) has `data-download-fx` and the app
 * is currently in dark mode, it positions a small fixed badge over
 * that element's top-right corner and lets a CSS animation play it
 * out, then removes itself.
 */
export default function DownloadEffectHost() {
  useEffect(() => {
    function onClick(e) {
      const target = e.target.closest && e.target.closest('[data-download-fx]');
      if (!target) return;
      if (document.documentElement.getAttribute('data-theme') !== 'dark') return;

      const rect = target.getBoundingClientRect();
      const badge = document.createElement('span');
      badge.className = 'download-effect-badge';
      badge.style.top = `${rect.top - 8 + window.scrollY}px`;
      badge.style.left = `${rect.right - 10 + window.scrollX}px`;
      badge.innerHTML =
        '<span class="download-effect-badge__ring">' +
        '<svg class="download-effect-badge__arrow" viewBox="0 0 24 24" width="14" height="14">' +
        '<path d="M12 4v11M12 15l-4.5-4.5M12 15l4.5-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
        '</svg>' +
        '<svg class="download-effect-badge__check" viewBox="0 0 24 24" width="14" height="14">' +
        '<path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
        '</svg>' +
        '</span>';

      document.body.appendChild(badge);
      setTimeout(() => badge.remove(), 1200);
    }

    // Capture phase so this always sees the click even if a deeper
    // handler later stops propagation - but it never blocks anything
    // itself.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
