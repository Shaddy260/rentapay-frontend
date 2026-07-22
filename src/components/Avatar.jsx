import React from 'react';
import './Avatar.css';

/**
 * Shared avatar component - shows a photo if photoUrl is set, otherwise
 * falls back to colored initials. Used across admin/landlord/tenant
 * views so a person's visual identity is consistent everywhere they
 * appear (blueprint doesn't specify this - added by direct request).
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic color from name, so the same person always gets the
// same fallback color across sessions/devices.
function getColorForName(name) {
  const colors = ['#0F3D3E', '#C1622D', '#4178C2', '#7A4FA0', '#2D7D27', '#A02D5C'];
  if (!name) return colors[0];
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export default function Avatar({ name, photoUrl, size = 40, className = '' }) {
  const dimension = `${size}px`;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name || 'Profile'}
        loading="lazy"
        decoding="async"
        className={`avatar avatar--photo ${className}`}
        style={{ width: dimension, height: dimension }}
      />
    );
  }

  return (
    <div
      className={`avatar avatar--initials ${className}`}
      style={{ width: dimension, height: dimension, background: getColorForName(name), fontSize: `${size * 0.4}px` }}
    >
      {getInitials(name)}
    </div>
  );
}
