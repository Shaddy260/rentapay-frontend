import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './StatusPage.css';

// Direct request: "a status/health page tenants and landlords can
// check themselves ('is RentaPay down or is it my internet') - cheap
// to build, cuts support noise a lot." No auth needed - anyone should
// be able to load this even if they can't log in.
export default function StatusPage() {
  const [state, setState] = useState('checking'); // checking | ok | degraded | unreachable
  const [checks, setChecks] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  function runCheck() {
    setState('checking');
    fetch('/health')
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

  return (
    <div className="status-page">
      <div className="status-page__card">
        <h1>RentaPay Status</h1>
        <div className={`status-page__badge ${current.className}`}>{current.text}</div>

        {checks && (
          <ul className="status-page__checks">
            <li><span>API</span><span className={checks.api === 'ok' ? 'status-page__ok' : 'status-page__bad'}>{checks.api === 'ok' ? 'Operational' : 'Issue detected'}</span></li>
            <li><span>Database</span><span className={checks.database === 'ok' ? 'status-page__ok' : 'status-page__bad'}>{checks.database === 'ok' ? 'Operational' : 'Issue detected'}</span></li>
          </ul>
        )}

        {state === 'unreachable' && (
          <p className="status-page__hint">
            We can't reach RentaPay's servers from here at all. If other websites are loading fine for you, the
            problem is very likely on our end - please try again shortly. If nothing else is loading either, it's
            probably your internet connection.
          </p>
        )}
        {state === 'degraded' && (
          <p className="status-page__hint">RentaPay is reachable but something isn't working normally - some features may be slow or unavailable.</p>
        )}
        {state === 'ok' && (
          <p className="status-page__hint">If you're still having trouble loading a specific page, it's more likely your connection or that specific request - try refreshing.</p>
        )}

        {lastChecked && <p className="status-page__timestamp">Last checked: {lastChecked.toLocaleTimeString()}</p>}
        <button className="status-page__refresh" onClick={runCheck}>Check again</button>
        <Link to="/login" className="status-page__back">← Back to login</Link>
      </div>
    </div>
  );
}
