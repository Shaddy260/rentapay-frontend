import React, { useState } from 'react';
import Avatar from './Avatar.jsx';
import './TenantContactCard.css';

/**
 * Shows a tenant's avatar. Tapping it expands into a small card with
 * their photo (larger), name, and contact details - phone, secondary
 * phone, email, and emergency contact - so a landlord/admin doesn't
 * have to open the full unit/tenant page just to get a phone number.
 *
 * Deliberately self-contained (owns its own open/close state) so it
 * can be dropped into any table row or unit card without the parent
 * needing to track which tenant's modal is open.
 */
export default function TenantContactCard({ tenant, size = 32 }) {
  const [open, setOpen] = useState(false);

  if (!tenant) return <Avatar name="—" size={size} />;

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        className="tenant-contact-trigger"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
        title={`View ${tenant.full_name}'s contact details`}
      >
        <Avatar name={tenant.full_name} photoUrl={tenant.photo_url} size={size} />
      </span>

      {open && (
        <div
          className="tenant-contact-overlay"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <div className="tenant-contact-card" onClick={(e) => e.stopPropagation()}>
            <button className="tenant-contact-card__close" onClick={() => setOpen(false)}>×</button>
            <Avatar name={tenant.full_name} photoUrl={tenant.photo_url} size={72} />
            <h3 className="tenant-contact-card__name">{tenant.full_name}</h3>
            {tenant.unit_name && <p className="tenant-contact-card__unit">{tenant.unit_name}</p>}

            <div className="tenant-contact-card__details">
              {tenant.primary_phone && (
                <a className="tenant-contact-card__row" href={`tel:${tenant.primary_phone}`}>
                  <span className="tenant-contact-card__label">Phone</span>
                  <span>{tenant.primary_phone}</span>
                </a>
              )}
              {tenant.secondary_phone && (
                <a className="tenant-contact-card__row" href={`tel:${tenant.secondary_phone}`}>
                  <span className="tenant-contact-card__label">Alt. phone</span>
                  <span>{tenant.secondary_phone}</span>
                </a>
              )}
              {tenant.email && (
                <a className="tenant-contact-card__row" href={`mailto:${tenant.email}`}>
                  <span className="tenant-contact-card__label">Email</span>
                  <span>{tenant.email}</span>
                </a>
              )}
              {(tenant.emergency_contact_name || tenant.emergency_contact_phone) && (
                <div className="tenant-contact-card__row tenant-contact-card__row--static">
                  <span className="tenant-contact-card__label">Emergency contact</span>
                  <span>
                    {tenant.emergency_contact_name || '—'}
                    {tenant.emergency_contact_phone ? ` — ${tenant.emergency_contact_phone}` : ''}
                  </span>
                </div>
              )}
              {!tenant.primary_phone && !tenant.email && !tenant.emergency_contact_name && (
                <p className="tenant-contact-card__empty">No contact details on file.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
