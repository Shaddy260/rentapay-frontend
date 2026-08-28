import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HEALTH_URL } from '../api/client.js';
import './StatusPage.css';

// Direct request: "a status/health page tenants and landlords can
// check themselves ('is RentaPay down or is it my internet') - cheap
// to build, cuts support noise a lot." No auth needed - anyone should
// be able to load this even if they can't log in.
//
// FEATURE (direct request): broadened from two checks (API,
// Database) to every subsystem the app actually depends on, each
// with a plain description of what it covers, so someone can tell at
// a glance which part of RentaPay is affected instead of just "it's
// broken somewhere."
// REDESIGN (direct request: "arrange this page in a well and nice
// manner, tables and rows that are nice and appealing to the eyes and
// still serve their function"): each check now also carries a
// `group` - the same seventeen checks and the same underlying
// /health response, just organised into labelled tables instead of
// one long flat list, so someone can scan by area of the app rather
// than reading top to bottom every time.
const CHECK_LABELS = {
  api: { label: 'API', description: 'The core RentaPay server that every screen in the app talks to.', group: 'Core platform' },
  database: { label: 'Database', description: 'Stores accounts, units, tenants, payments, and every other record in RentaPay.', group: 'Core platform' },
  authentication: { label: 'Sign in and accounts', description: 'Signing in, account lookups, and session handling for every role.', group: 'Core platform' },
  fileStorage: { label: 'File storage', description: 'Unit photos, payment proof screenshots, and uploaded documents.', group: 'Core platform' },
  backgroundJobs: { label: 'Background jobs', description: 'Rent reminders, monthly billing, subscription reminders, and vacating notice processing that run on a schedule.', group: 'Core platform' },
  errorTracking: { label: 'Error tracking', description: "Behind-the-scenes monitoring that alerts RentaPay's team to unexpected errors.", group: 'Core platform' },

  payments: { label: 'Payments (M-Pesa)', description: 'M-Pesa STK push used for landlord subscription billing and, where enabled, tenant rent collection.', group: 'Payments & billing' },
  exportQueue: { label: 'Report & export downloads', description: 'Annual reports, tax summaries, financial CSVs, and receipt ZIPs generated for download.', group: 'Payments & billing' },
  utilitySubmetering: { label: 'Utility submetering', description: 'Shared water and electricity meter readings, and the invoices generated from them.', group: 'Payments & billing' },
  disputesAndComplaints: { label: 'Disputes & complaints', description: 'Disputing a charge and the help/complaints inbox available to every role.', group: 'Payments & billing' },

  email: { label: 'Email delivery', description: 'One time codes, password resets, receipts, reminders, and digest emails.', group: 'Notifications' },
  smsWhatsapp: { label: 'SMS & WhatsApp alerts', description: 'Text-message-style notifications sent alongside email for the same events.', group: 'Notifications' },
  pushNotifications: { label: 'Push notifications', description: 'Live alerts sent to a browser or device when the RentaPay tab is not open.', group: 'Notifications' },
  supportChat: { label: 'Support chat', description: 'The in app chat used to reach RentaPay support and, for landlords, tenant to landlord messaging.', group: 'Notifications' },

  publicListings: { label: 'Public listings', description: 'The public vacant unit listings page anyone can browse without an account.', group: 'Community & property' },
  maintenanceRequests: { label: 'Maintenance requests', description: 'Reporting, tracking, and updating maintenance issues on a unit.', group: 'Community & property' },
  communityBoard: { label: 'Community board', description: 'Shared posts and announcements visible to tenants and landlords within a property.', group: 'Community & property' },
};

// Display order for the grouped tables. A group only renders if the
// /health response actually includes at least one check for it, so
// this stays correct even if a future check is added to a new group.
const GROUP_ORDER = ['Core platform', 'Payments & billing', 'Notifications', 'Community & property'];

// Grouping purely for the "exactly where the problem is" summary line
// below - which everyday area of the app a broken check actually
// affects, in plain words rather than the internal subsystem name.
const AREA_OF_IMPACT = {
  api: 'the whole app',
  database: 'the whole app',
  authentication: 'signing in',
  payments: 'making or confirming a payment',
  email: 'emailed codes, receipts, and reminders',
  smsWhatsapp: 'SMS/WhatsApp alerts',
  pushNotifications: 'browser/device push alerts',
  fileStorage: 'photos and uploaded documents',
  backgroundJobs: 'scheduled reminders and billing',
  exportQueue: 'downloading reports and exports',
  supportChat: 'the support/messages chat',
  publicListings: 'the public vacant-unit listings page',
  maintenanceRequests: 'maintenance requests',
  disputesAndComplaints: 'disputing a charge or filing a complaint',
  communityBoard: 'the community board',
  utilitySubmetering: 'utility meter readings and invoices',
  errorTracking: "RentaPay's own error monitoring (invisible to you)",
};

export default function StatusPage() {
  const [state, setState] = useState('checking'); // checking | ok | degraded | unreachable
  const [checks, setChecks] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  function runCheck() {
    setState('checking');
    fetch(HEALTH_URL)
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        setChecks(body.checks || null);
        setState(ok ? 'ok' : 'degraded');
        setLastChecked(new Date());
      })
      .catch(() => {
        setState('unreachable');
        setLastChecked(new Date());
      });
  }

  useEffect(() => {
    runCheck();
    const interval = setInterval(runCheck, 30000);
    return () => clearInterval(interval);
  }, []);

  const labels = {
    checking: { text: 'Checking...', className: 'status-page__badge--checking' },
    ok: { text: 'All systems operational', className: 'status-page__badge--ok' },
    degraded: { text: 'Partial outage', className: 'status-page__badge--degraded' },
    unreachable: { text: "Can't reach RentaPay", className: 'status-page__badge--down' },
  };
  const current = labels[state];

  // "when one breaks it should show exactly where the problem is" -
  // pull out the specific broken components by name (not just a
  // generic "degraded" badge) so the affected area is obvious at a
  // glance, both here and in the hint text below.
  const brokenKeys = checks
    ? Object.keys(CHECK_LABELS).filter((key) => key in checks && checks[key] !== 'ok')
    : [];

  // Group the checks that are actually present in this /health
  // response into their labelled tables, preserving GROUP_ORDER and
  // the within-group order the keys were declared in above.
  const groups = checks
    ? GROUP_ORDER.map((groupName) => ({
        name: groupName,
        keys: Object.keys(CHECK_LABELS).filter((key) => CHECK_LABELS[key].group === groupName && key in checks),
      })).filter((g) => g.keys.length > 0)
    : [];

  const totalCount = checks ? Object.keys(CHECK_LABELS).filter((key) => key in checks).length : 0;

  return (
    <div className="status-page">
      <div className="status-page__card">
        <header className="status-page__header">
          <h1>RentaPay Status</h1>
          <div className={`status-page__badge ${current.className}`}>
            <span className="status-page__badge-dot" aria-hidden="true" />
            {current.text}
          </div>
        </header>

        {state === 'degraded' && brokenKeys.length > 0 && (
          <div className="status-page__broken-summary" role="alert">
            <strong>{brokenKeys.length === 1 ? 'Affected:' : `${brokenKeys.length} components affected:`}</strong>
            <ul>
              {brokenKeys.map((key) => (
                <li key={key}>
                  <span className="status-page__broken-name">{CHECK_LABELS[key].label}</span>
                  {' — '}affects {AREA_OF_IMPACT[key] || 'part of the app'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {groups.length > 0 && (
          <div className="status-page__groups">
            {groups.map((group) => (
              <section className="status-page__group" key={group.name}>
                <h2 className="status-page__group-title">{group.name}</h2>
                <table className="status-page__table">
                  <tbody>
                    {group.keys.map((key) => {
                      const meta = CHECK_LABELS[key];
                      const isOk = checks[key] === 'ok';
                      return (
                        <tr key={key} className={isOk ? '' : 'status-page__row--bad'}>
                          <td className="status-page__cell-name">
                            <span className="status-page__check-label">{meta.label}</span>
                            <span className="status-page__check-description">{meta.description}</span>
                          </td>
                          <td className="status-page__cell-status">
                            <span className={`status-page__pill ${isOk ? 'status-page__pill--ok' : 'status-page__pill--bad'}`}>
                              <span className="status-page__pill-dot" aria-hidden="true" />
                              {isOk ? 'Operational' : 'Issue detected'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}

        {state === 'unreachable' && (
          <p className="status-page__hint">
            We can't reach RentaPay's servers from here at all. If other websites are loading fine for you, the
            problem is very likely on our end, so please try again shortly. If nothing else is loading either, it's
            probably your internet connection.
          </p>
        )}
        {state === 'degraded' && (
          <p className="status-page__hint">RentaPay is reachable but something isn't working normally. Some features may be slow or unavailable, and the tables above show which ones.</p>
        )}
        {state === 'ok' && (
          <p className="status-page__hint">If you're still having trouble loading a specific page, it's more likely your connection or that specific request, so try refreshing.</p>
        )}

        <footer className="status-page__footer">
          <div className="status-page__meta">
            {totalCount > 0 && <span>{totalCount} components monitored</span>}
            {lastChecked && <span>Last checked: {lastChecked.toLocaleTimeString()}</span>}
          </div>
          <div className="status-page__actions">
            <button className="status-page__refresh" onClick={runCheck}>Check again</button>
            <Link to="/login" className="status-page__back">Back to login</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
