import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PhotoLightbox from '../components/PhotoLightbox.jsx';
import ModalShell from '../components/ModalShell.jsx';
import HeroPhotoBackground from '../components/HeroPhotoBackground.jsx';
import { usePageMeta } from '../utils/usePageMeta.js';
import { useJsonLd } from '../utils/useJsonLd.js';
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
  // DIRECT REQUEST: show county/constituency/location directly on the
  // photo banner itself, not just once in the property group header -
  // useful when scrolling through many cards, or if a card is shared/
  // screenshotted on its own.
  const locationLine = [u.location, u.constituency, u.county].filter(Boolean).join(', ');
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
        {locationLine && <span className="public-listings__photo-location">📍 {locationLine}</span>}
      </button>
      {u.mapsLink && (
        <a
          href={u.mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="public-listings__maps-link"
          onClick={(e) => e.stopPropagation()}
        >
          🗺️ View on map
        </a>
      )}
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
        {u.listingDescription && (
          <p className="public-listings__description">{u.listingDescription}</p>
        )}
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
  usePageMeta(
    'Vacant Houses & Rental Units for Rent in Kenya | RentaPay',
    'Browse vacant houses and rental units across Kenya, free and with no account needed. Search by county and constituency, and message the landlord or caretaker directly on WhatsApp.'
  );
  // FIX (bug report: "everything should show existing data and only
  // update in the background... nothing should show a white screen
  // while loading"): this page always started from listings=null and
  // loading=true, so it blanked to a full skeleton on first visit AND
  // re-blanked on every single keystroke search (once the 350ms
  // debounce fired) even though the previous results were still
  // perfectly valid to keep showing while the new ones loaded. Same
  // fix as Dashboard.jsx/TenantPortal.jsx: seed from the last-loaded
  // results synchronously (this is a public, no-login page, so the
  // cache is intentionally just "whatever this browser tab last saw"
  // - nothing account-specific), and only show the skeleton on the
  // genuine first-ever load with nothing cached at all.
  const listingsCache = (() => {
    try {
      const raw = localStorage.getItem('rentapay_public_listings_cache');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const [searchText, setSearchText] = useState('');
  const [listings, setListings] = useState(() => listingsCache?.listings ?? null);
  const [loading, setLoading] = useState(() => listingsCache?.listings == null);
  const [error, setError] = useState('');
  const [contactingId, setContactingId] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { photos, index, title }
  const [openKey, setOpenKey] = useState(null); // only one property group open at a time

  useEffect(() => {
    setError('');
    // Debounced live search: fires ~350ms after the user stops typing,
    // so results narrow down as they type rather than requiring an
    // explicit submit. loading is only surfaced in the UI when there's
    // nothing on screen yet (see the render gate below) - the grid
    // keeps showing the previous results the whole time a new search
    // is in flight, never a blank/skeleton mid-typing.
    setLoading(true);
    const handle = setTimeout(() => {
      api
        .getPublicListings({ q: searchText })
        .then((res) => {
          const list = res.listings || [];
          setListings(list);
          try {
            localStorage.setItem('rentapay_public_listings_cache', JSON.stringify({ listings: list }));
          } catch {
            // non-fatal - just means the next visit won't have a head start
          }
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load listings.'))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [searchText]);

  // Public, unauthenticated page - visitors must explicitly accept the
  // Terms & Conditions before any listing content is shown. Persisted in
  // localStorage so it only prompts once per browser, not every visit.
  const [termsAccepted, setTermsAccepted] = useState(() => {
    try {
      return localStorage.getItem('rentapay_public_listings_terms_accepted') === 'true';
    } catch {
      return false;
    }
  });
  const [termsChecked, setTermsChecked] = useState(false);

  function handleAcceptTerms() {
    if (!termsChecked) return;
    try {
      localStorage.setItem('rentapay_public_listings_terms_accepted', 'true');
    } catch {
      // non-fatal - worst case it asks again next visit
    }
    setTermsAccepted(true);
  }

  const [contactPicker, setContactPicker] = useState(null); // { unitId, options } while choosing who to message
  // FIX (spec item 9.2): replaces the old copy/paste share-link box -
  // the tenant just types their email, and the backend resolves it to
  // a reputation share link (only if that email is a registered
  // tenant) right when they pick who to message. Purely optional, and
  // the landlord only ever receives a link, never this raw address.
  const [reputationEmail, setReputationEmail] = useState('');
  const [resolvingReputation, setResolvingReputation] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  const emailIsValid = isValidEmail(reputationEmail);

  async function handleContact(unitId) {
    setContactingId(unitId);
    setContactPicker(null);
    try {
      const res = await api.getPublicListingContact(unitId);
      const options = res.options || [];
      if (options.length === 0) {
        setError('No contact number is available for this unit yet.');
      } else {
        // DIRECT REQUEST: let the tenant choose who to message
        // (landlord / manager / caretaker) instead of always being
        // silently routed to whichever one the backend used to pick
        // first - see public.controller.js's getUnitContact. Always
        // routes through the picker now (even for a single option) so
        // there's a consistent place to offer the optional reputation
        // link, rather than sometimes skipping straight to WhatsApp.
        setContactPicker({ unitId, options });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open WhatsApp for this unit.');
    } finally {
      setContactingId(null);
    }
  }

  async function openContactOption(link) {
    const email = reputationEmail.trim();
    if (!isValidEmail(email)) {
      setEmailTouched(true);
      return;
    }
    let finalLink = link;

    setResolvingReputation(true);
    try {
      const res = await api.getReputationShareLinkByEmail(email);
      if (res.found && res.shareUrl) {
        finalLink = `${link}${encodeURIComponent(`\n\nMy RentaPay tenancy reputation: ${res.shareUrl}`)}`;
      }
      // Not found (or lookup failed) - proceed with the plain
      // message, per spec: never block or reveal anything either way.
    } catch {
      // Fails soft - the message still goes out normally.
    } finally {
      setResolvingReputation(false);
    }

    window.open(finalLink, '_blank', 'noopener,noreferrer');
    setContactPicker(null);
    setReputationEmail('');
    setEmailTouched(false);
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

  // SEO (direct request: structured data for Google rich results).
  // Maps currently-loaded, still-active listings to schema.org's
  // RealEstateListing type inside an ItemList, so Google can
  // potentially surface these as rich property results rather than a
  // plain blue link. Only "active" units are included - booked/planned
  // ones aren't real open vacancies, and shouldn't be presented to
  // Google as available. Address fields use Kenya's county/
  // constituency/estate naming rather than forcing a Western
  // street-address shape that doesn't fit the data collected here.
  const listingsSchema = useMemo(() => {
    if (!listings || listings.length === 0) return null;
    const activeUnits = listings.filter((u) => (u.listingStatus || 'active') === 'active');
    if (activeUnits.length === 0) return null;
    // Framed as schema.org "Product" (rent = price, unit = product) rather
    // than "RealEstateListing" - Google's Rich Results only recognises a
    // fixed set of types for visible rich results (price/availability
    // badges), and RealEstateListing isn't one of them. "Product" is,
    // and is a common, accepted pattern rental/listing sites use to get
    // real search-result visibility for otherwise-invisible listing data.
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: activeUnits.map((u, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: [u.unitType, u.unitName].filter(Boolean).join(' · ') || 'Rental unit',
          url: `https://rentapay.co.ke/find-a-house`,
          image: (u.photoUrls && u.photoUrls[0]) || undefined,
          category: 'Rental Property',
          brand: { '@type': 'Brand', name: 'RentaPay' },
          areaServed: u.county || undefined,
          // FEATURE (direct request): the landlord's own Google Maps
          // share link, when they've provided one - lets Google (and
          // anyone reading the raw structured data) resolve exactly
          // where this unit is, not just a text location string.
          hasMap: u.mapsLink || undefined,
          description:
            u.listingDescription || [u.location, u.constituency, u.county].filter(Boolean).join(', ') || undefined,
          offers: {
            '@type': 'Offer',
            price: u.rentAmount || undefined,
            priceCurrency: 'KES',
            availability: 'https://schema.org/InStock',
            url: `https://rentapay.co.ke/find-a-house`,
          },
        },
      })),
    };
  }, [listings]);

  useJsonLd(listingsSchema);

  if (!termsAccepted) {
    return (
      <div className="public-listings-gate">
        <HeroPhotoBackground
          wrapClassName="public-listings-gate__photo-bg"
          photoClassName="public-listings-gate__photo"
          overlayClassName="public-listings-gate__photo-overlay"
        />
        <div className="public-listings-gate__panel">
          <Link to="/login" className="public-listings-gate__brand">RentaPay</Link>
          <h1>Before you browse</h1>
          <p>Please accept our <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</Link> to continue.</p>
          <label className="public-listings-gate__checkbox">
            <input
              type="checkbox"
              checked={termsChecked}
              onChange={(e) => setTermsChecked(e.target.checked)}
            />
            <span>I accept the Terms &amp; Conditions.</span>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!termsChecked}
            onClick={handleAcceptTerms}
          >
            Continue
          </button>
        </div>
      </div>
    );
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

      {loading && listings === null ? (
        <div className="public-listings__grid"><Skeleton rows={6} /></div>
      ) : !listings || listings.length === 0 ? (
        <EmptyState icon="🏠" title="No vacant units found" message="Try a different search term or clear it to see everything." />
      ) : (
        <div className="public-listings__groups">
          {groups.map((group) => {
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

      {contactPicker && (
        <ModalShell title="Who would you like to message?" onClose={() => { setContactPicker(null); setReputationEmail(''); setEmailTouched(false); }}>
          {/* Email is now mandatory: checked against an existing
              RentaPay tenancy reputation to attach if found. */}
          <div className="public-listings__email-box">
            <label htmlFor="reputation-email">📩 Enter your email</label>
            <input
              id="reputation-email"
              type="email"
              required
              value={reputationEmail}
              onChange={(e) => setReputationEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              placeholder="you@example.com"
              className={emailTouched && !emailIsValid ? 'public-listings__email-input--error' : ''}
            />
            {emailTouched && !emailIsValid && (
              <span className="public-listings__email-error">Enter a valid email.</span>
            )}
          </div>

          <div className="public-listings__contact-picker">
            {contactPicker.options.map((opt) => (
              <button
                key={opt.role}
                type="button"
                className="public-listings__contact-option"
                disabled={resolvingReputation || !emailIsValid}
                onClick={() => openContactOption(opt.whatsappLink)}
              >
                <span aria-hidden="true">💬</span> {resolvingReputation ? 'Preparing message…' : `Message the ${opt.label}`}
              </button>
            ))}
          </div>
        </ModalShell>
      )}
    </div>
  );
}

