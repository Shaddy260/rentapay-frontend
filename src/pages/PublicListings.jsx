import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import './TenantPortal.css';
import './PublicListings.css';

/**
 * FEATURE (direct request): a fully open, free, no login required
 * vacancy feed. Anyone can search
 * vacant units by county -> constituency -> location. "Contact on
 * WhatsApp" resolves server-side to the property manager, then
 * caretaker, then the landlord themself, and opens wa.me directly -
 * the number itself is never rendered on the page.
 */
export default function PublicListings() {
  const [areas, setAreas] = useState([]);
  const [county, setCounty] = useState('');
  const [constituency, setConstituency] = useState('');
  const [location, setLocation] = useState('');
  const [listings, setListings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contactingId, setContactingId] = useState(null);

  useEffect(() => {
    api.getPublicListingAreas().then((res) => setAreas(res.areas || [])).catch(() => {});
  }, []);

  function search(e) {
    e?.preventDefault();
    setLoading(true);
    setError('');
    api
      .getPublicListings({ county, constituency, location })
      .then((res) => setListings(res.listings || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load listings.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const constituencyOptions = areas.find((a) => a.county === county)?.constituencies || [];

  return (
    <div className="public-listings">
      <header className="public-listings__header">
        <Link to="/login" className="public-listings__brand">RentaPay</Link>
        <h1>Find a vacant unit</h1>
        <p>Free to browse. No account needed. Reach out directly on WhatsApp.</p>
      </header>

      <form className="public-listings__search" onSubmit={search}>
        <select value={county} onChange={(e) => { setCounty(e.target.value); setConstituency(''); }}>
          <option value="">All counties</option>
          {areas.map((a) => (
            <option key={a.county} value={a.county}>{a.county}</option>
          ))}
        </select>
        <select value={constituency} onChange={(e) => setConstituency(e.target.value)} disabled={!county}>
          <option value="">{county ? 'All constituencies' : 'Pick a county first'}</option>
          {constituencyOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          placeholder="Estate, street, area…"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {error && <p className="modal-error">{error}</p>}

      {loading ? (
        <div className="public-listings__grid"><Skeleton rows={6} /></div>
      ) : !listings || listings.length === 0 ? (
        <EmptyState icon="🏠" title="No vacant units found" message="Try a different county or clear the filters." />
      ) : (
        <div className="public-listings__grid">
          {listings.map((u) => (
            <div className="public-listings__card" key={u.unitId}>
              <div className="public-listings__photo">
                {u.photoUrls?.[0] ? (
                  <img src={u.photoUrls[0]} alt={u.unitName} loading="lazy" />
                ) : (
                  <div className="public-listings__photo-placeholder">🏠</div>
                )}
              </div>
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
          ))}
        </div>
      )}
    </div>
  );
}
