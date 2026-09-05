import React from 'react';
import { Link } from 'react-router-dom';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Avatar from './Avatar.jsx';
import TenantContactCard from './TenantContactCard.jsx';
import { computeUnitStatus } from '../utils/unitStatus.js';
import './UnitTile.css';

/**
 * Section 4 (Status-Square Indicator System): neutral white/light
 * tile with a small coloured square (top-left, near the unit code)
 * carrying the status signal instead of a full-colour background fill.
 * Colour mapping: red/orange = overdue, green = paid, yellow/amber =
 * due soon (upcoming) or pending confirmation, grey = vacant. All
 * existing data on the tile (tenant name, amount, rating, avatar) is
 * unchanged - only the colour treatment changed.
 */
export default function UnitTile({ unit, token }) {
  const navigate = useNavigate();

  if (unit.is_frozen) {
    return (
      <div
        className="unit-tile unit-tile--frozen"
        title="Frozen. Your current subscription covers fewer units than you have. Renew or upgrade to unlock."
      >
        <span className="unit-tile__status-square unit-tile__status-square--frozen" aria-hidden="true" />
        <span className="unit-tile__code">{unit.unit_name}</span>
        <span className="unit-tile__status-line">🔒 Frozen</span>
        <span className="unit-tile__tenant">Locked by your subscription</span>
        <Link to="/subscription" className="unit-tile__cta" onClick={(e) => e.stopPropagation()}>
          Renew to unlock →
        </Link>
      </div>
    );
  }

  // FREE TRIAL: a vacant unit beyond the trial's first
  // TRIAL_TENANT_UNIT_LIMIT units (see the backend's tenantLocked flag
  // on this same unit object) can be created freely, but cannot take
  // a tenant yet. Shown the same greyed out, non-clickable way a
  // frozen unit is above, so the pattern stays consistent, just with
  // its own wording and its own path (subscribe, not renew).
  if (unit.tenantLocked) {
    return (
      <div
        className="unit-tile unit-tile--frozen"
        title="Available once you subscribe. Your free trial covers tenants on your first units only."
      >
        <span className="unit-tile__status-square unit-tile__status-square--frozen" aria-hidden="true" />
        <span className="unit-tile__code">{unit.unit_name}</span>
        <span className="unit-tile__status-line">Vacant</span>
        <span className="unit-tile__tenant">Tenants open once you subscribe</span>
        <Link to="/subscription" className="unit-tile__cta" onClick={(e) => e.stopPropagation()}>
          Subscribe to unlock →
        </Link>
      </div>
    );
  }

  const { status, activeTenant, dueInDays } = computeUnitStatus(unit);

  const statusLine = {
    overdue: `Owes KES ${Number(activeTenant?.balance_due || 0).toLocaleString()}`,
    paid: 'Paid ✓',
    upcoming: dueInDays === 0 ? 'Due today' : `Due in ${dueInDays} day${dueInDays === 1 ? '' : 's'}`,
    vacant: '+ Add Tenant',
  }[status];

  const statusSquareLabel = {
    overdue: 'Overdue',
    paid: 'Paid',
    upcoming: 'Due soon',
    vacant: 'Vacant',
  }[status];

  return (
    <Link to={`/units/${unit.id}`} className={`unit-tile unit-tile--${status}`}>
      <span
        className={`unit-tile__status-square unit-tile__status-square--${status}`}
        aria-hidden="true"
        title={statusSquareLabel}
      />
      <div className="unit-tile__top">
        {status !== 'vacant' && (
          <span className="unit-tile__avatar">
            <Avatar name={activeTenant?.full_name} photoUrl={activeTenant?.photo_url} size={34} className="unit-tile__avatar-img" />
          </span>
        )}
        <span className="unit-tile__code">{unit.unit_name}</span>
      </div>

      <span className="unit-tile__tenant">{activeTenant ? activeTenant.full_name : 'Vacant'}</span>

      {status === 'vacant' ? (
        <span
          className="unit-tile__status-line unit-tile__status-line--cta"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/units/${unit.id}/add-tenant`); }}
        >
          {statusLine}
        </span>
      ) : (
        <span className="unit-tile__status-line">{statusLine}</span>
      )}

      <div className="unit-tile__bottom">
        <span className="unit-tile__rent">KES {Number(unit.rent_amount).toLocaleString()}</span>
        {status !== 'vacant' && activeTenant && (
          <span className="unit-tile__rating" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <TenantContactCard tenant={{ ...activeTenant, unit_name: unit.unit_name }} size={18} token={token} canRate />
          </span>
        )}
      </div>
    </Link>
  );
}
