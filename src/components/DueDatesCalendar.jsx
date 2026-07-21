import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import './DueDatesCalendar.css';

// Direct request: "a calendar/timeline view of rent due dates - you
// have per-unit due days and a payments-this-month figure, but no
// single view answering 'what's due this week across all my units.'"
// Grouped by day-of-month and sorted, with today highlighted - a
// landlord scans down the list instead of opening each unit.
export default function DueDatesCalendar({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.getDueDatesCalendar(token).then(setData).catch((err) => setError(err.message));
  }, [token]);

  const grouped = useMemo(() => {
    if (!data?.dueDates) return [];
    const byDay = new Map();
    for (const d of data.dueDates) {
      if (!byDay.has(d.dueDay)) byDay.set(d.dueDay, []);
      byDay.get(d.dueDay).push(d);
    }
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);

  const todayDay = new Date().getDate();

  if (error) return <p className="due-dates-error">{error}</p>;
  if (!data) return <p>Loading...</p>;
  if (grouped.length === 0) return <p>No active tenants with a due date set yet.</p>;

  return (
    <div className="due-dates-calendar">
      <p className="due-dates-calendar__intro">Every active tenant's rent due day this month, at a glance.</p>
      {grouped.map(([day, tenants]) => (
        <div key={day} className={`due-dates-calendar__day ${day === todayDay ? 'due-dates-calendar__day--today' : ''}`}>
          <div className="due-dates-calendar__day-label">
            Day {day} {day === todayDay ? '(today)' : ''}
          </div>
          <ul className="due-dates-calendar__list">
            {tenants.map((t) => (
              <li
                key={t.tenantId}
                className={`due-dates-calendar__item ${t.isPaid ? 'is-paid' : t.isPast ? 'is-overdue' : 'is-upcoming'}`}
                onClick={() => navigate(`/units/${t.unitId}`)}
              >
                <span>{t.tenantName} - {t.unitName}</span>
                <span className="due-dates-calendar__amount">
                  {t.isPaid ? 'Paid' : `KES ${t.amountDue.toLocaleString()}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
