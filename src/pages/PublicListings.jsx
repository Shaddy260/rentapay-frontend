import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PhotoLightbox from '../components/PhotoLightbox.jsx';
import './TenantPortal.css';
import './PublicListings.css';

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
 */
export default function PublicListings() {
  const [searchText, setSearchText] = useState('');
  const [listings, setListings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contactingId, setContactingId] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { photos, index, title }

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
        <div className="public-listings__grid">
          {listings.map((u) => {
            const photos = u.photoUrls || [];
            return (
              <div className="public-listings__card" key={u.unitId}>
                <button
                  type="button"
                  className="public-listings__photo"
                  onClick={() => photos.length && setLightbox({ photos, index: 0, title: u.unitName })}
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
                  <h3>{u.unitType || 'Unit'} {u.estateName ? `· ${u.estateName}` : ''}</h3>
                  <p className="public-listings__location">
                    {[u.location, u.constituency, u.county].filter(Boolean).join(', ') || 'Location not specified'}
                  </p>
                  <p className="public-listings__rent">KES {Number(u.rentAmount).toLocaleString()} / month</p>
                  <button
                    className="public-listings__contact-btn"
                    disabled={contactingId === u.unitId}
                    onClick={() => handleContact(u.unitId)}
                  >
                    {contactingId === u.unitId ? 'Opening…' : '💬 Contact on WhatsApp'}
                  </button>
                </div>
              </div>
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
