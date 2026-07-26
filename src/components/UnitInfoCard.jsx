import React, { useState } from 'react';
import './UnitInfoCard.css';

/**
 * Mirrors the reference screenshot's "Hostel info" card, but shows
 * this tenant's actual unit instead. Tapping it expands into a modal
 * with the occupant, due date, rent, and status.
 */
export default function UnitInfoCard({ unit, profile, dueDate }) {
  const [open, setOpen] = useState(false);

  if (!unit) return null;

  return (
    <>
      <button type="button" className="unit-info-card" onClick={() => setOpen(true)}>
        <span className="unit-info-card__icon">🏢</span>
        <div className="unit-info-card__text">
          <h3>Unit information</h3>
          <p>{unit.unit_name} · {unit.unit_type || 'Unit'}</p>
        </div>
        <span className="unit-info-card__chevron">›</span>
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <h3>Unit {unit.unit_name}</h3>
              <button className="modal-card__close" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="unit-info-modal__grid">
              <div><span className="unit-info-modal__label">Unit type</span><span>{unit.unit_type || '—'}</span></div>
              <div><span className="unit-info-modal__label">Unit code</span><span>{unit.unit_payment_code || '—'}</span></div>
              <div><span className="unit-info-modal__label">Monthly rent</span><span>KES {Number(unit.rent_amount || 0).toLocaleString()}</span></div>
              <div><span className="unit-info-modal__label">Rent due day</span><span>{unit.due_day_of_month ? `${unit.due_day_of_month} of each month` : '—'}</span></div>
              <div><span className="unit-info-modal__label">Next due date</span><span>{dueDate ? dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span></div>
              <div><span className="unit-info-modal__label">Status</span><span>{unit.status ? unit.status.replace('_', ' ') : '—'}</span></div>
            </div>

            <h4 className="unit-info-modal__subhead">Occupant</h4>
            <div className="unit-info-modal__grid">
              <div><span className="unit-info-modal__label">Name</span><span>{profile?.full_name || '—'}</span></div>
              <div><span className="unit-info-modal__label">Phone</span><span>{profile?.primary_phone || '—'}</span></div>
              <div><span className="unit-info-modal__label">Move-in date</span><span>{profile?.move_in_date || '—'}</span></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
