import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Skeleton from './Skeleton.jsx';
import './AdminBaSecurityReport.css';
import InfoTip from './InfoTip.jsx';

function dateOnly(iso) {
  return iso ? iso.slice(0, 10) : '';
}

/**
 * BUILD SPEC PHASE 11 - Part C: Cross-BA security report (standing, no
 * BA selection required).
 *
 * REBUILT (Section A of the 2026-08-remove-manual-ba-claims migration):
 * two of the original four signals (duplicate phone attempts,
 * not-referred-but-matched) policed the old manual claim-submission
 * flow, which no longer exists - attribution is now automatic via the
 * referral link/code at signup, so per direct request those two
 * fields are removed outright rather than kept as a "retired" note.
 * The other two (rapid-fire onboarding, disputed attributions) are
 * still live checks, rebuilt against `landlords` directly.
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
        <h3>Rapid-fire onboarding ({report.rapidFireOnboarding.length})</h3>
        <InfoTip text={<>Landlords onboarded unusually close together in time by one Brand Ambassador - a rough proxy for signups logged without an actual field visit.</>} />
        {report.rapidFireOnboarding.length === 0 && <p className="admin-ba-security__empty">None found.</p>}
        <ul className="admin-ba-security__cards">
          {report.rapidFireOnboarding.map((r) => (
            <li key={r.baId} className="admin-ba-security__card">
              {r.baName} - {r.count} landlords within {r.windowMinutes} minutes
              <button type="button" className="admin-ba-security__review-link" onClick={() => onReview?.({ baId: r.baId, date: dateOnly(r.from) })}>
                Review
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-ba-security__section">
        <h3>Disputed attributions ({report.disputedAttributions.length})</h3>
        <InfoTip text={<>The linked landlord has disputed this Brand Ambassador's attribution - internal review only, never shown to the landlord.</>} />
        {report.disputedAttributions.length === 0 && <p className="admin-ba-security__empty">None found.</p>}
        <ul className="admin-ba-security__cards">
          {report.disputedAttributions.map((d) => (
            <li key={d.landlordId} className="admin-ba-security__card">
              {d.baName} - {d.landlordName}
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
