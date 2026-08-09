import React, { useState } from 'react';
import PlatformReviews from './PlatformReviews.jsx';
import './RateRentaPayCard.css';

/**
 * Settings/Financial Statistics spec, section 2.4: "Rate RentaPay does
 * not belong in Settings... move this block out of Settings entirely -
 * either into a dashboard prompt/banner or a separate 'About/Feedback'
 * page - so Settings remains purely functional." Moved here as a
 * lightweight, collapsed-by-default dashboard card (same bordered-card
 * pattern as Quick Actions / Pending Payment Confirmations) rather
 * than a separate page, since it's a small, occasional-use prompt, not
 * a page someone navigates to on its own. Same PlatformReviews content
 * as before - this only changes WHERE it lives, not what it does.
 */
export default function RateRentaPayCard({ token }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="dashboard-card rate-rentapay-card">
      <button
        type="button"
        className="rate-rentapay-card__toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <h3 className="dashboard-card__header u-m-0">⭐ Rate RentaPay</h3>
        <span className={`rate-rentapay-card__chevron ${open ? 'is-open' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="rate-rentapay-card__body">
          <PlatformReviews token={token} />
        </div>
      )}
    </section>
  );
}
