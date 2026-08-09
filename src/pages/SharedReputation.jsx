// src/pages/SharedReputation.jsx
//
// FEATURE (direct request #4 - tenant reputation flow): the no-login
// landing page a landlord sees when they open the reputation link a
// tenant pasted into a WhatsApp inquiry message. Deliberately shows
// only the aggregate score + role breakdown - never raw ratings,
// comments, or which landlords left them (see public.controller.js's
// getSharedReputation for the same rule enforced server-side).
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';

const ROLE_LABELS = { landlord: 'Landlord ratings', manager: 'Manager ratings', caretaker: 'Caretaker ratings' };

// FIX (direct request: "the shareable reputation link should show
// according to which fields the tenant has been rated and the
// general one... currently it only does the general one"): the
// backend (getSharedReputation) already returned byCategory - this
// page just never rendered it, only byRole. Same category keys used
// in the actual rating form (TenantContactCard.jsx).
const CATEGORY_LABELS = {
  overall: 'Overall',
  payment: 'Payment reliability',
  property_care: 'Property care',
  communication: 'Communication',
  conduct: 'Conduct',
};

export default function SharedReputation() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getSharedReputation(token);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err.message || 'This reputation link is invalid or has expired.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 16px', fontFamily: 'inherit' }}>
      <Link to="/" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>&larr; RentaPay</Link>

      {loading && <p style={{ marginTop: 24 }}>Loading reputation…</p>}

      {!loading && error && (
        <div style={{ marginTop: 24, padding: 16, background: '#fff3f3', border: '1px solid #f3c9c9', borderRadius: 10 }}>
          <p style={{ margin: 0, color: '#a33' }}>{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 4 }}>{data.tenantName}'s RentaPay Reputation</h2>
          <p style={{ color: '#666', fontSize: 14, marginTop: 0 }}>Portable tenancy score, shared by the tenant.</p>

          {data.reputation.totalRatings === 0 ? (
            <div style={{ padding: 20, background: '#f7f7f7', borderRadius: 10, textAlign: 'center' }}>
              <p style={{ margin: 0 }}>No ratings yet - this tenant is new to RentaPay.</p>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', padding: 24, background: '#f7fbf8', border: '1px solid #dceee1', borderRadius: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 40, fontWeight: 700, color: '#1f7a3f' }}>{data.reputation.averageRating} / 5</div>
                <div style={{ color: '#666', fontSize: 13 }}>
                  from {data.reputation.totalRatings} rating(s) across {data.reputation.priorLandlordCount} landlord(s)
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {Object.entries(data.reputation.byRole || {})
                  .filter(([, v]) => v.count > 0)
                  .map(([role, v]) => (
                    <div key={role} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#fafafa', borderRadius: 8 }}>
                      <span>{ROLE_LABELS[role] || role}</span>
                      <strong>{v.average} / 5 ({v.count})</strong>
                    </div>
                  ))}
              </div>

              {Object.entries(data.reputation.byCategory || {}).filter(([, v]) => v.count > 0).length > 0 && (
                <>
                  <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: 15 }}>By category</h3>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {Object.entries(data.reputation.byCategory || {})
                      .filter(([, v]) => v.count > 0)
                      .map(([category, v]) => (
                        <div key={category} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#fafafa', borderRadius: 8 }}>
                          <span>{CATEGORY_LABELS[category] || category}</span>
                          <strong>{v.average} / 5 ({v.count})</strong>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </>
          )}

          <p style={{ marginTop: 24, fontSize: 12, color: '#999' }}>
            This summary is shown at the tenant's own choice. Individual comments and landlord identities are never shared here.
          </p>
        </div>
      )}
    </div>
  );
}
