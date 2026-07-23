import { useState, useEffect, useMemo } from 'react';
import { api, ApiError } from '../api/client.js';
import Avatar from './Avatar.jsx';
import './StatisticsPanel.css';

const ROLE_LABELS = { landlord: 'Landlords', tenant: 'Tenants', manager: 'Managers', caretaker: 'Caretakers', scout: 'Scouts' };
const FIRST_LOGIN_ROLES = ['tenant', 'manager', 'caretaker'];
const PASSWORD_RESET_ROLES = ['landlord', 'tenant', 'manager', 'caretaker', 'scout'];

function dateKeyOf(dateString) {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Direct request: same "arrange based on days" idea as the platform
// Activity Log, but for first-time credentials, extended one level
// further - once a group of same-day entries starts spanning a full
// month or year, fold it up into a Month / Year heading instead of an
// ever-growing flat list of individual days. Nesting: Year -> Month ->
// Day, each independently collapsible, exactly like the Activity Log's
// existing day toggle.
function buildDateTree(rows) {
  const now = new Date();
  const todayKey = dateKeyOf(now);
  const yesterdayKey = dateKeyOf(new Date(Date.now() - 86400000));

  const byYear = {};
  for (const row of rows) {
    const d = new Date(row.created_at || row.requested_at);
    const year = d.getFullYear();
    const monthKey = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const dayKey = dateKeyOf(row.created_at || row.requested_at);

    byYear[year] = byYear[year] || { months: {}, sameYearAsNow: year === now.getFullYear() };
    byYear[year].months[monthKey] = byYear[year].months[monthKey] || { label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), days: {} };
    byYear[year].months[monthKey].days[dayKey] = byYear[year].months[monthKey].days[dayKey] || [];
    byYear[year].months[monthKey].days[dayKey].push(row);
  }

  return Object.entries(byYear)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, yearData]) => {
      const months = Object.entries(yearData.months)
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([monthKey, monthData]) => {
          const days = Object.entries(monthData.days)
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .map(([dayKey, dayRows]) => {
              let label;
              if (dayKey === todayKey) label = 'Today';
              else if (dayKey === yesterdayKey) label = 'Yesterday';
              else label = new Date(dayRows[0].created_at || dayRows[0].requested_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
              return { dayKey, label, rows: dayRows };
            });
          return { monthKey, label: monthData.label, days, count: days.reduce((n, d) => n + d.rows.length, 0) };
        });
      return { year, months, count: months.reduce((n, m) => n + m.count, 0) };
    });
}

export default function AdminCredentialsPanel({ token }) {
  const [category, setCategory] = useState('first-login'); // 'first-login' | 'password-reset'
  const [activeRole, setActiveRole] = useState('tenant');
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [expandedYears, setExpandedYears] = useState([]);
  const [expandedMonths, setExpandedMonths] = useState([]);
  const [expandedDays, setExpandedDays] = useState([]);

  const isFirstLogin = category === 'first-login';
  const roleOrder = isFirstLogin ? FIRST_LOGIN_ROLES : PASSWORD_RESET_ROLES;

  useEffect(() => {
    // Switching category can leave activeRole pointed at a role that
    // doesn't apply there (e.g. 'landlord' only exists under
    // password-reset) - fall back to the first valid role instead of
    // showing an empty list for no reason.
    if (!roleOrder.includes(activeRole)) setActiveRole(roleOrder[0]);
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handle = setTimeout(() => {
      const fetcher = isFirstLogin ? api.listAllFirstTimeCredentialsForAdmin : api.listAllPasswordResetRequestsForAdmin;
      const emptyGroups = { landlord: [], tenant: [], manager: [], caretaker: [], scout: [] };
      fetcher(token, search)
        .then((res) => setGroups(res.groups || emptyGroups))
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load.'));
    }, 250);
    return () => clearTimeout(handle);
  }, [category, token, search]);

  const rowsForRole = groups ? groups[activeRole] || [] : [];
  const tree = useMemo(() => buildDateTree(rowsForRole), [rowsForRole]);

  function toggleYear(year) {
    setExpandedYears((prev) => (prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]));
  }
  function toggleMonth(monthKey) {
    setExpandedMonths((prev) => (prev.includes(monthKey) ? prev.filter((m) => m !== monthKey) : [...prev, monthKey]));
  }
  function toggleDay(dayKey) {
    setExpandedDays((prev) => (prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]));
  }

  return (
    <section className="statistics-panel">
      <h2>Platform Login &amp; Password-Reset Codes</h2>
      <p className="tenant-portal-hint">
        {isFirstLogin
          ? "Every temp password and OTP issued at account creation, across every landlord on the platform - kept in separate lists per role, just like each landlord's own portal does. Landlords aren't listed here since they set their own password at signup, so there's no first-time credential to recover for them."
          : 'Every password-reset (forgot-password) OTP requested platform-wide, including by landlords themselves this time. Each code disappears automatically the moment it expires - anything shown here is still live.'}
      </p>

      <div className="login-page__toggle" role="tablist" style={{ marginBottom: 12 }}>
        <button type="button" role="tab" aria-selected={isFirstLogin} className={isFirstLogin ? 'is-active' : ''} onClick={() => setCategory('first-login')}>
          First-Time Login
        </button>
        <button type="button" role="tab" aria-selected={!isFirstLogin} className={!isFirstLogin ? 'is-active' : ''} onClick={() => setCategory('password-reset')}>
          Password Resets
        </button>
      </div>

      <div className="login-page__toggle" role="tablist" style={{ marginBottom: 16 }}>
        {roleOrder.map((r) => (
          <button key={r} type="button" role="tab" aria-selected={activeRole === r} className={activeRole === r ? 'is-active' : ''} onClick={() => setActiveRole(r)}>
            {ROLE_LABELS[r]} {groups ? `(${(groups[r] || []).length})` : ''}
          </button>
        ))}
      </div>

      <input
        type="search"
        placeholder={`Search all ${ROLE_LABELS[activeRole].toLowerCase()} platform-wide, by name or phone…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="admin-search-input"
        style={{ marginBottom: 16, maxWidth: 380 }}
        aria-label="Search platform-wide first-time credentials"
      />

      {error && <p className="modal-error">{error}</p>}
      {groups === null && !error && <p>Loading…</p>}
      {groups && rowsForRole.length === 0 && <p className="tenant-portal-hint">No {ROLE_LABELS[activeRole].toLowerCase()} found.</p>}

      {tree.map((yearGroup) => (
        <div key={yearGroup.year} className="activity-day" style={{ marginBottom: 8 }}>
          <div className="activity-day__header" onClick={() => toggleYear(yearGroup.year)}>
            <span className="activity-day__toggle">{expandedYears.includes(yearGroup.year) ? '▾' : '▸'}</span>
            <span className="activity-day__label"><strong>{yearGroup.year}</strong></span>
            <span className="activity-day__count">{yearGroup.count} record{yearGroup.count === 1 ? '' : 's'}</span>
          </div>

          {expandedYears.includes(yearGroup.year) && yearGroup.months.map((monthGroup) => (
            <div key={monthGroup.monthKey} className="activity-day" style={{ marginLeft: 20, marginTop: 6 }}>
              <div className="activity-day__header" onClick={() => toggleMonth(monthGroup.monthKey)}>
                <span className="activity-day__toggle">{expandedMonths.includes(monthGroup.monthKey) ? '▾' : '▸'}</span>
                <span className="activity-day__label">{monthGroup.label}</span>
                <span className="activity-day__count">{monthGroup.count} record{monthGroup.count === 1 ? '' : 's'}</span>
              </div>

              {expandedMonths.includes(monthGroup.monthKey) && monthGroup.days.map((dayGroup) => (
                <div key={dayGroup.dayKey} className="activity-day" style={{ marginLeft: 20, marginTop: 6 }}>
                  <div className="activity-day__header" onClick={() => toggleDay(dayGroup.dayKey)}>
                    <span className="activity-day__toggle">{expandedDays.includes(dayGroup.dayKey) ? '▾' : '▸'}</span>
                    <span className="activity-day__label">{dayGroup.label}</span>
                    <span className="activity-day__count">{dayGroup.rows.length} record{dayGroup.rows.length === 1 ? '' : 's'}</span>
                  </div>

                  {expandedDays.includes(dayGroup.dayKey) && (
                    <div className="payments-table-wrap">
                      <table className="payments-table">
                        <thead>
                          <tr>
                            <th>Photo</th>
                            <th>Name</th>
                            <th>Phone</th>
                            {isFirstLogin && activeRole === 'tenant' && <th>Unit</th>}
                            {isFirstLogin && <th>Property</th>}
                            <th>Landlord</th>
                            {isFirstLogin && <th>Temp password</th>}
                            <th>OTP</th>
                            <th>{isFirstLogin ? 'Created' : 'Requested'}</th>
                            <th>Expires</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayGroup.rows.map((c) => (
                            <tr key={c.id}>
                              <td>
                                <button type="button" onClick={() => setSelectedPerson(c)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} aria-label={`View details for ${c.full_name}`}>
                                  <Avatar name={c.full_name} photoUrl={c.photo_url} size={32} />
                                </button>
                              </td>
                              <td>{c.full_name}</td>
                              <td>{c.phone}</td>
                              {isFirstLogin && activeRole === 'tenant' && <td>{c.unit_name || '—'}</td>}
                              {isFirstLogin && <td>{c.property_name || '—'}</td>}
                              <td>{c.landlord_name || '—'}</td>
                              {isFirstLogin && <td><code>{c.temp_password}</code></td>}
                              <td><code>{c.otp}</code></td>
                              <td>{new Date(c.created_at || c.requested_at).toLocaleString()}</td>
                              <td>{new Date(c.expires_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {selectedPerson && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelectedPerson(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Avatar name={selectedPerson.full_name} photoUrl={selectedPerson.photo_url} size={64} />
              <div>
                <h3 style={{ margin: 0 }}>{selectedPerson.full_name}</h3>
                <p style={{ margin: 0, color: '#666' }}>{ROLE_LABELS[selectedPerson.role] || selectedPerson.role}</p>
              </div>
            </div>
            <p><strong>Phone:</strong> {selectedPerson.phone}</p>
            {selectedPerson.unit_name && <p><strong>Unit:</strong> {selectedPerson.unit_name}</p>}
            {selectedPerson.property_name && <p><strong>Property:</strong> {selectedPerson.property_name}</p>}
            {selectedPerson.landlord_name && <p><strong>Landlord:</strong> {selectedPerson.landlord_name}</p>}
            <p><strong>{isFirstLogin ? 'Created' : 'Requested'}:</strong> {new Date(selectedPerson.created_at || selectedPerson.requested_at).toLocaleString()}</p>
            <p><strong>Expires:</strong> {new Date(selectedPerson.expires_at).toLocaleString()}</p>
            <p className="tenant-portal-hint">This picture is pulled live from their profile, so it always reflects their most recent update.</p>
            <button type="button" className="modal-card__close" onClick={() => setSelectedPerson(null)}>Close</button>
          </div>
        </div>
      )}
    </section>
  );
}
