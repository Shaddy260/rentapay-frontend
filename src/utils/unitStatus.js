// Derives the redesigned dashboard tile status for a unit.
//
// SPEC (rentapay_dashboard_redesign_spec.pdf, sections 1/3/4): every
// unit now reads as exactly one of four states -
//   - "overdue"  : has a tenant, balance owed, due date has passed
//   - "upcoming" : has a tenant, balance owed, due date NOT passed yet
//   - "paid"     : has a tenant, no balance owed for the current cycle
//   - "vacant"   : no active tenant
//
// "Upcoming" (due date) is derived from the unit's existing
// due_day_of_month against today's date - the same field the billing
// cron/heartbeat already uses to flip a unit to overdue, so this stays
// in sync with that logic rather than inventing a second source of
// truth.

/** Clamp a day-of-month to how many days the given month actually has
 * (e.g. due_day_of_month=31 in February -> the 28th/29th). */
function clampDayToMonth(year, monthIndex, day) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(day, daysInMonth);
}

/** Current cycle's due date as a Date at local midnight, or null if no
 * due-day is set on the unit. */
export function getCurrentCycleDueDate(unit, today = new Date()) {
  const dueDay = Number(unit?.due_day_of_month);
  if (!dueDay || Number.isNaN(dueDay)) return null;
  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  const clamped = clampDayToMonth(year, monthIndex, dueDay);
  return new Date(year, monthIndex, clamped);
}

/** Whole days between today and the due date (positive = due date is
 * still ahead, 0 = due today, negative = past due). */
export function daysUntilDue(unit, today = new Date()) {
  const dueDate = getCurrentCycleDueDate(unit, today);
  if (!dueDate) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = dueDate.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Returns { status, activeTenant, dueInDays }.
 * status is one of 'overdue' | 'upcoming' | 'paid' | 'vacant'.
 */
export function computeUnitStatus(unit, today = new Date()) {
  const activeTenant = (unit?.tenants || []).find((t) => t.is_active) || null;

  if (!activeTenant) {
    return { status: 'vacant', activeTenant: null, dueInDays: null };
  }

  const balanceDue = Number(activeTenant.balance_due) || 0;
  if (balanceDue <= 0) {
    return { status: 'paid', activeTenant, dueInDays: null };
  }

  const dueInDays = daysUntilDue(unit, today);
  // No due-day configured on the unit at all - fall back to overdue
  // (there's an unpaid balance and nothing tells us it isn't due yet)
  // rather than silently hiding it in "upcoming".
  if (dueInDays === null) {
    return { status: 'overdue', activeTenant, dueInDays: null };
  }
  if (dueInDays >= 0) {
    return { status: 'upcoming', activeTenant, dueInDays };
  }
  return { status: 'overdue', activeTenant, dueInDays };
}

export const STATUS_META = {
  overdue: { label: 'Overdue', pillLabel: 'Overdue' },
  upcoming: { label: 'Upcoming', pillLabel: 'Upcoming' },
  paid: { label: 'Paid', pillLabel: 'Paid' },
  vacant: { label: 'Vacant', pillLabel: 'Vacant' },
};

/** Counts every status bucket in one pass over a unit list (frozen
 * units excluded - they're rendered as a separate frozen tile, not
 * part of the color-coded heat-map). */
export function countByStatus(units, today = new Date()) {
  const counts = { all: 0, overdue: 0, upcoming: 0, paid: 0, vacant: 0 };
  for (const unit of units || []) {
    if (unit.is_frozen) continue;
    counts.all += 1;
    const { status } = computeUnitStatus(unit, today);
    counts[status] += 1;
  }
  return counts;
}
