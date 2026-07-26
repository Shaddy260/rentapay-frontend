// src/utils/roleLabel.js
//
// Direct request: don't assume every landlord is a man - a landlord
// whose set gender is 'female' should read "Landlady" everywhere the
// portal shows their role, not "Landlord". Same idea for anyone else
// the portal labels by role. Falls back to the neutral/default label
// whenever gender hasn't been set yet (nothing forces anyone to
// answer it), so this is purely additive - never a blocker.

export function roleLabel(role, roleLevel, gender) {
  if (role === 'landlord') {
    if (gender === 'female') return 'Landlady';
    return 'Landlord';
  }
  if (role === 'manager') {
    if (roleLevel === 'caretaker') return 'Caretaker';
    return 'Manager';
  }
  if (role === 'tenant') return 'Tenant';
  if (role === 'admin') return 'Admin';
  return '';
}
