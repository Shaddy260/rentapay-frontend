import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Skeleton from './Skeleton.jsx';
import './AdminBaSecurityReport.css';

function dateOnly(iso) {
  return iso ? iso.slice(0, 10) : '';
}

/**
 * BUILD SPEC PHASE 11 - Part C: Cross-BA security report (standing, no
 * BA selection required). Four sections matching the four signals,
 * each a simple list/table with counts and a "review" link into the
 * reconciliation tool (Part B) pre-filled with that BA and date.
 * Visible on a normal admin visit via the sidebar tab, not something
 * admin has to know to search for.
 */
export default function AdminBaSecurityReport({ token, onReview }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setReport(null);
    setError('');
    api
      .getBaSecurityReport(token)
      .then((res) => setReport(res))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the security report.'));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="admin-ba-security__error">{error}</p>;

  if (!report) {
    return (
      <div className="admin-ba-security__list">
        <Skeleton height="100px" />
        <Skeleton height="100px" />
      </div>
    );
  }

  return (
    <section className="admin-ba-security">
      <p className="admin-ba-security__window">Scanning the last {report.windowDays} days across all Brand Ambassadors.</p>

      <div className="admin-ba-security__section">
        <h3>Duplicate phone attempts ({report.duplicatePhoneAttempts.length})</h3>
        <p className="admin-ba-security__hint">More than one Brand Ambassador has tried to claim the same phone number — includes rejected/conflicting attempts.</p>
        {report.duplicatePhoneAttempts.length === 0 && <p className="admin-ba-security__empty">None found.</p>}
        <ul className="admin-ba-security__cards">
          {report.duplicatePhoneAttempts.map((d) => (
            <li key={d.phone} className="admin-ba-security__card">
              <strong>{d.phone}</strong>
              <ul>
                {d.bas.map((b) => (
                  <li key={b.baId}>
                    {b.baName} ({b.baCode}) — {b.claimIds.length} attempt{b.claimIds.length === 1 ? '' : 's'}
                    <button type="button" className="admin-ba-security__review-link" onClick={() => onReview?.({ baId: b.baId })}>
                      Review
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-ba-security__section">
        <h3>Not referred but matched ({report.notReferredButMatched.length})</h3>
        <p className="admin-ba-security__hint">Matched purely via a post-hoc phone lookup, not the referral link at signup. Not automatically wrong — a weaker signal worth a glance.</p>
        {report.notReferredButMatched.length === 0 && <p className="admin-ba-security__empty">None found.</p>}
        <ul className="admin-ba-security__cards">
          {report.notReferredButMatched.map((c) => (
            <li key={c.claimId} className="admin-ba-security__card">
              {c.baName} — {c.submittedName} ({c.submittedPhone})
              <button type="button" className="admin-ba-security__review-link" onClick={() => onReview?.({ baId: c.baId, date: dateOnly(c.createdAt) })}>
                Review
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-ba-security__section">
        <h3>Rapid-fire submissions ({report.rapidFireSubmissions.length})</h3>
        <p className="admin-ba-security__hint">Claims logged unusually close together in time — a rough proxy for claims logged without the actual field visit.</p>
        {report.rapidFireSubmissions.length === 0 && <p className="admin-ba-security__empty">None found.</p>}
        <ul className="admin-ba-security__cards">
          {report.rapidFireSubmissions.map((r) => (
            <li key={r.baId} className="admin-ba-security__card">
              {r.baName} — {r.count} claims within {r.windowMinutes} minutes
              <button type="button" className="admin-ba-security__review-link" onClick={() => onReview?.({ baId: r.baId, date: dateOnly(r.from) })}>
                Review
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-ba-security__section">
        <h3>Disputed attributions ({report.disputedAttributions.length})</h3>
        <p className="admin-ba-security__hint">The linked landlord has disputed this Brand Ambassador's attribution — internal review only, never shown to the landlord.</p>
        {report.disputedAttributions.length === 0 && <p className="admin-ba-security__empty">None found.</p>}
        <ul className="admin-ba-security__cards">
          {report.disputedAttributions.map((d) => (
            <li key={d.claimId} className="admin-ba-security__card">
              {d.baName} — {d.landlordName}
              <button type="button" className="admin-ba-security__review-link" onClick={() => onReview?.({ baId: d.baId, date: dateOnly(d.disputedAt) })}>
                Review
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
