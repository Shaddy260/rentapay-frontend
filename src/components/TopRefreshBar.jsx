// Thin progress sliver shown at the very top of a page while it
// quietly re-fetches data IN THE BACKGROUND (i.e. content is already
// on screen from cache/previous state). This is the visual counterpart
// to the "no more full-page loading screens" fix - something should
// still hint that fresher data is on its way in, without blocking or
// hiding anything already visible.
import './TopRefreshBar.css';

export default function TopRefreshBar({ active }) {
  if (!active) return null;
  return <div className="top-refresh-bar" aria-hidden="true" />;
}
