import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import InfoTip from './InfoTip.jsx';
import Skeleton from './Skeleton.jsx';
import { downloadCsv } from '../utils/downloadCsv.js';

/**
 * Landlords who started creating an account but haven't finished the
 * setup wizard yet, and which step they stopped at. Extracted out of
 * AdminDashboard.jsx's inline "incomplete-signups" tab so the General
 * Manager dashboard can show the exact same view (same data, same
 * columns, same call-to-follow-up) without duplicating the fetch/table
 * logic - purely read-only in both places, so there was nothing to gate.
 */
export default function IncompleteSignupsPanel({ token }) {
  const [signups, setSignups] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getIncompleteSignups(token).then((res) => setSignups(res.signups || [])).catch((err) => setError(err.message));
  }, [token]);

  return (
    <section className="admin-section">
      <div className="admin-section__header-row">
        <h2>Incomplete signups</h2>
        {signups && signups.length > 0 && (
          <button
            className="ghost-link"
            data-download-fx
            onClick={() =>
              downloadCsv(
                'rentapay-incomplete-signups',
                ['Name', 'Phone', 'Email', 'Stopped at', 'Started'],
                signups.map((s) => [s.fullName, s.phone, s.email || '', s.stepLabel, new Date(s.createdAt).toLocaleString('en-GB')])
              )
            }
          >
            Download
          </button>
        )}
      </div>
      <InfoTip text={<>
        Landlords who started creating an account but haven't finished the setup wizard yet, and which step they stopped at.
      </>} />
      {error && <p className="admin-banner admin-banner--error">{error}</p>}
      {!signups && !error && <Skeleton rows={4} />}
      {signups && signups.length === 0 && <p className="admin-section__hint">No incomplete signups right now.</p>}
      {signups && signups.length > 0 && (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Contact</th><th>Stopped at</th><th>Started</th><th></th></tr>
            </thead>
            <tbody>
              {signups.map((s) => (
                <tr key={s.id}>
                  <td>{s.fullName}</td>
                  <td>
                    <div className="admin-table__contact-cell">
                      <span>{s.phone}</span>
                      {s.email && <span className="admin-table__email">{s.email}</span>}
                    </div>
                  </td>
                  <td><span className="admin-status">{s.stepLabel}</span></td>
                  <td>{new Date(s.createdAt).toLocaleString('en-GB')}</td>
                  <td className="admin-table__actions">
                    <a className="ghost-link" href={`tel:${s.phone}`}>📞 Call</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
