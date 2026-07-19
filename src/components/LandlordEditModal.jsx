import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { KENYA_COUNTIES } from '../constants/kenyaCounties.js';
import { KENYA_CONSTITUENCIES } from '../constants/kenyaConstituencies.js';
import './LandlordEditModal.css';

// FIX ("I edited the unit count for a landlord and even the name of
// the estate but the changes didn't apply anywhere"): every portal
// reads a landlord's estate name/unit count from their `properties`
// row once they have one (which is effectively every landlord), not
// from the landlords row - the admin SQL tab let you edit either one
// with no indication of which actually matters. This modal fetches
// the landlord's real properties first, always edits the row the
// portal is actually reading, and previews the current value so
// there's no more guessing.
export default function LandlordEditModal({ landlordId, landlordName, token, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [properties, setProperties] = useState([]);
  const [landlord, setLandlord] = useState(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState(''); // '' = editing the landlord row itself (no properties yet)

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [county, setCounty] = useState('');
  const [constituency, setConstituency] = useState('');
  const [unitLimit, setUnitLimit] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [plan, setPlan] = useState('');

  useEffect(() => {
    api
      .getLandlordProperties(landlordId, token)
      .then((res) => {
        setLandlord(res.landlord);
        setProperties(res.properties || []);
        const target = (res.properties || [])[0] || null;
        if (target) {
          setSelectedPropertyId(target.id);
          applyValuesFrom(target, res.landlord, true);
        } else {
          setSelectedPropertyId('');
          applyValuesFrom(null, res.landlord, false);
        }
      })
      .catch((err) => setError(err.message || 'Failed to load landlord details.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landlordId]);

  function applyValuesFrom(property, landlordRow, isProperty) {
    if (isProperty && property) {
      setName(property.name || '');
      setLocation(property.location || '');
      setCounty(property.county || '');
      setConstituency(property.constituency || '');
      setUnitLimit(property.unit_limit ?? '');
      setExpiryDate(property.subscription_expires_at ? property.subscription_expires_at.slice(0, 10) : '');
      setPlan(landlordRow?.subscription_plan || '');
    } else {
      setName(landlordRow?.estate_name || '');
      setLocation(landlordRow?.location || '');
      setCounty(landlordRow?.county || '');
      setConstituency(landlordRow?.constituency || '');
      setUnitLimit(landlordRow?.unit_limit ?? '');
      setExpiryDate(landlordRow?.subscription_expires_at ? landlordRow.subscription_expires_at.slice(0, 10) : '');
      setPlan(landlordRow?.subscription_plan || '');
    }
  }

  function handlePropertyPick(id) {
    setSelectedPropertyId(id);
    const property = properties.find((p) => p.id === id);
    applyValuesFrom(property, landlord, true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name,
        location,
        county,
        constituency,
        newUnitLimit: unitLimit === '' ? undefined : Number(unitLimit),
        newExpiryDate: expiryDate || undefined,
        newPlan: plan || undefined,
        reason: 'Edited via admin portal',
      };
      if (selectedPropertyId) payload.propertyId = selectedPropertyId;

      await api.editLandlordSubscription(landlordId, payload, token);
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="landlord-edit-modal__overlay" onClick={onClose}>
      <div className="landlord-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="landlord-edit-modal__header">
          <h3>Edit {landlordName}</h3>
          <button className="landlord-edit-modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {loading ? (
          <p className="landlord-edit-modal__hint">Loading…</p>
        ) : (
          <>
            {properties.length === 0 && (
              <p className="landlord-edit-modal__hint">
                This landlord has no separate properties yet - these fields edit their account directly.
              </p>
            )}

            {properties.length > 1 && (
              <label className="landlord-edit-modal__field">
                <span>Which apartment/estate?</span>
                <select value={selectedPropertyId} onChange={(e) => handlePropertyPick(e.target.value)}>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="landlord-edit-modal__field">
              <span>Estate / property name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <div className="landlord-edit-modal__row">
              <label className="landlord-edit-modal__field">
                <span>Location</span>
                <input value={location} onChange={(e) => setLocation(e.target.value)} />
              </label>
              <label className="landlord-edit-modal__field">
                <span>County</span>
                <select value={county} onChange={(e) => { setCounty(e.target.value); setConstituency(''); }}>
                  <option value="">Select a county…</option>
                  {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="landlord-edit-modal__field">
                <span>Constituency</span>
                <select value={constituency} disabled={!county} onChange={(e) => setConstituency(e.target.value)}>
                  <option value="">{county ? 'Select a constituency…' : 'Select a county first…'}</option>
                  {(KENYA_CONSTITUENCIES[county] || []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>

            <div className="landlord-edit-modal__row">
              <label className="landlord-edit-modal__field">
                <span>Unit limit</span>
                <input type="number" min="0" value={unitLimit} onChange={(e) => setUnitLimit(e.target.value)} />
              </label>
              <label className="landlord-edit-modal__field">
                <span>Plan</span>
                <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                  <option value="">Unchanged</option>
                  <option value="starter">Starter</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
            </div>

            <label className="landlord-edit-modal__field">
              <span>Subscription expires</span>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </label>

            {error && <p className="landlord-edit-modal__error">{error}</p>}

            <div className="landlord-edit-modal__actions">
              <button className="landlord-edit-modal__cancel" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="landlord-edit-modal__save" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
