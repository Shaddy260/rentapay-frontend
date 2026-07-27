import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PhotoLightbox from '../components/PhotoLightbox.jsx';
import './TenantPortal.css';
import './PublicListings.css';

const LISTING_STATUS_LABEL = {
  active: { label: 'Still active', className: 'public-listings__status-badge--active' },
  booked: { label: 'Already booked', className: 'public-listings__status-badge--booked' },
  planned: { label: 'Planned for', className: 'public-listings__status-badge--planned' },
};

/** Star display for a property's aggregate reputation - reviewed by
 * its CURRENT tenants only. Never shows landlord/manager/caretaker
 * reputation - that stays portal-only. */
function PropertyReputationBadge({ reputation }) {
  if (!reputation || !reputation.totalRatings) {
    return <span className="public-listings__reputation public-listings__reputation--none">No tenant reviews yet</span>;
  }
  return (
    <span className="public-listings__reputation">
      ★ {reputation.averageRating} / 5 <em>({reputation.totalRatings} tenant review{reputation.totalRatings === 1 ? '' : 's'})</em>
    </span>
  );
}

/**
 * FEATURE (direct request): a fully open, free, no login required
 * vacancy feed. Anyone can search
 * vacant units by county -> constituency -> location. "Contact on
 * WhatsApp" resolves server-side to the property manager, then
 * caretaker, then the landlord themself, and opens wa.me directly -
 * the number itself is never rendered on the page.
 *
 * FEATURE (direct request): replaced the county/constituency/location
 * dropdown-trio-plus-Search-button with a single search box that
 * narrows results the moment the tenant types anything - a county
 * name narrows to that county, a constituency name narrows to that
 * constituency, a street/estate name narrows to that area - matched
 * against whichever field it fits, with no "enter all 3 and hit
 * Search" step required.
 *
 * FEATURE (direct request): units are grouped into a collapsible
 * section per property. The property's own reputation - reviewed by
 * tenants CURRENTLY living there, aggregate-only - is shown at the
 * property-section level. Landlord/manager/caretaker reputation is
 * never shown here; that stays inside the authenticated portals only.
 * Each unit inside also shows the landlord's own listing-status
 * confirmation (still active / already booked / planned for) and
 * whether a deposit is required.
 */
function UnitCard({ unit: u, showMeta, contactingId, onPhotoClick, onContact }) {
  const photos = u.photoUrls || [];
  const statusInfo = LISTING_STATUS_LABEL[u.listingStatus] || LISTING_STATUS_LABEL.active;
  return (
    <div className="public-listings__card">
      <button
        type="button"
        className="public-listings__photo"
        onClick={() => photos.length && onPhotoClick(photos, u.unitName)}
        disabled={!photos.length}
        aria-label={photos.length ? `View ${photos.length} photo${photos.length > 1 ? 's' : ''} of ${u.unitName}` : 'No photos available'}
      >
        {photos[0] ? (
          <>
            <img src={photos[0]} alt={u.unitName} loading="lazy" />
            {photos.length > 1 && (
              <span className="public-listings__photo-count">📷 {photos.length}</span>
            )}
          </>
        ) : (
          <div className="public-listings__photo-placeholder">🏠</div>
        )}
      </button>
      <div className="public-listings__info">
        {showMeta && (
          <div className="public-listings__card-meta">
            <strong>{u.unitName}</strong>
            {showMeta.location && <span className="public-listings__location">{u.unitName ? ' · ' : ''}{showMeta.location}</span>}
            <PropertyReputationBadge reputation={showMeta.reputation} />
          </div>
        )}
        <div className="public-listings__badges">
          <span className={`public-listings__status-badge ${statusInfo.className}`}>{statusInfo.label}</span>
          <span className={`public-listings__deposit-badge ${u.requiresDeposit ? 'public-listings__deposit-badge--required' : 'public-listings__deposit-badge--none'}`}>
            {u.requiresDeposit
              ? `Deposit required${u.depositAmountExpected ? ` (KES ${Number(u.depositAmountExpected).toLocaleString()})` : ''}`
              : 'No deposit required'}
          </span>
        </div>
        <h3>{u.unitType || 'Unit'}{!showMeta && u.unitName ? ` · ${u.unitName}` : ''}</h3>
        <p className="public-listings__rent">KES {Number(u.rentAmount).toLocaleString()} / month</p>
        <button
          className="public-listings__contact-btn"
          disabled={contactingId === u.unitId}
          onClick={() => onContact(u.unitId)}
        >
          {contactingId === u.unitId ? 'Opening…' : '💬 Contact on WhatsApp'}
        </button>
      </div>
    </div>
  );
}

export default function PublicListings() {
  const [searchText, setSearchText] = useState('');
  const [listings, setListings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contactingId, setContactingId] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { photos, index, title }
  const [openKey, setOpenKey] = useState(null); // only one property group open at a time

  useEffect(() => {
    setLoading(true);
    setError('');
    // Debounced live search: fires ~350ms after the user stops typing,
    // so results narrow down as they type rather than requiring an
    // explicit submit.
    const handle = setTimeout(() => {
      api
        .getPublicListings({ q: searchText })
        .then((res) => setListings(res.listings || []))
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load listings.'))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [searchText]);

  async function handleContact(unitId) {
    setContactingId(unitId);
    try {
      const res = await api.getPublicListingContact(unitId);
      window.open(res.whatsappLink, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open WhatsApp for this unit.');
    } finally {
      setContactingId(null);
    }
  }

  // Group listings by property. Units with no property_id belong to no
  // shared property record - and may well belong to different landlords -
  // so each one gets its own standalone section instead of being lumped
  // into a single "Other units" bucket, which would misleadingly read as
  // one property. (Ungrouped units have no reputation badge since
  // reputation is keyed by property.)
  const groups = useMemo(() => {
    if (!listings) return [];
    const map = new Map();
    for (const u of listings) {
      const key = u.propertyId || `__unit_${u.unitId}__`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          isUngrouped: !u.propertyId,
          estateName: u.propertyId ? u.estateName || 'Property' : u.unitName || 'Unit',
          location: [u.location, u.constituency, u.county].filter(Boolean).join(', '),
          propertyReputation: u.propertyReputation,
          units: [],
        });
      }
      map.get(key).units.push(u);
    }
    return Array.from(map.values());
  }, [listings]);

  function toggleOpen(key) {
    setOpenKey((prev) => (prev === key ? null : key));
  }

  return (
    <div className="public-listings">
      <header className="public-listings__header">
        <Link to="/login" className="public-listings__brand">RentaPay</Link>
        <h1>Find a vacant unit</h1>
        <p>Free to browse. No account needed. Reach out directly on WhatsApp.</p>
      </header>

      <form className="public-listings__search" onSubmit={(e) => e.preventDefault()}>
        <input
          className="public-listings__search-input"
          placeholder="Search by county, constituency, estate or street…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          autoFocus
        />
      </form>

      {error && <p className="modal-error">{error}</p>}

      {loading ? (
        <div className="public-listings__grid"><Skeleton rows={6} /></div>
      ) : !listings || listings.length === 0 ? (
        <EmptyState icon="🏠" title="No vacant units found" message="Try a different search term or clear it to see everything." />
      ) : (
        <div className="public-listings__groups">
          {groups.map((group) => {
            if (group.units.length === 1) {
              // Only one vacant unit here - an accordion header with
              // nothing else behind it just adds an extra tap for no
              // reason, so the name/location/rating that would have
              // gone in the header is shown directly on the card instead.
              const u = group.units[0];
              return (
                <section className="public-listings__property-group public-listings__property-group--single" key={group.key}>
                  <UnitCard
                    unit={u}
                    showMeta={{ location: group.location, reputation: group.propertyReputation }}
                    contactingId={contactingId}
                    onPhotoClick={(photos, title) => setLightbox({ photos, index: 0, title })}
                    onContact={handleContact}
                  />
                </section>
              );
            }

            const isOpen = openKey === group.key;
            return (
              <section className="public-listings__property-group" key={group.key}>
                <button
                  type="button"
                  className="public-listings__property-header"
                  onClick={() => toggleOpen(group.key)}
                  aria-expanded={isOpen}
                >
                  <span className="public-listings__property-header-main">
                    <span className="public-listings__property-toggle">{isOpen ? '▼' : '▶'}</span>
                    <span className="public-listings__property-header-text">
                      <strong>{group.estateName}</strong>
                      {group.location && <span className="public-listings__location">{group.location}</span>}
                      <PropertyReputationBadge reputation={group.propertyReputation} />
                    </span>
                  </span>
                  <span className="public-listings__unit-count">{group.units.length} unit{group.units.length === 1 ? '' : 's'}</span>
                </button>

                {isOpen && (
                  <div className="public-listings__grid">
                    {group.units.map((u) => (
                      <UnitCard
                        key={u.unitId}
                        unit={u}
                        contactingId={contactingId}
                        onPhotoClick={(photos, title) => setLightbox({ photos, index: 0, title })}
                        onContact={handleContact}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          title={lightbox.title}
          onIndexChange={(i) => setLightbox((prev) => ({ ...prev, index: i }))}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

