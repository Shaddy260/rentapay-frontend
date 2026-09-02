import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import GlowCard from './GlowCard.jsx';
import RecentActivityList from './RecentActivityList.jsx';
import Skeleton from './Skeleton.jsx';
import EmptyState from './EmptyState.jsx';
import './InvestorSnapshotPanel.css';

const KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

/**
 * "Solo Investor Snapshot" - RentaPay-Glow-Dashboard-Build-Spec.md
 * Phase 5. Four compact single-stat Glow Cards on the landlord
 * dashboard: Occupancy (blue), Collection Rate this month (green),
 * Top Late Payers (red), Vacant-No-Photo nudge (amber).
 *
 * Per §5 item 2, this is deliberately the *lighter* single-stat card
 * per item, not the full hero+KPI+trend GlowSection used on the
 * Admin/GM Overview tab - it needs to fit the landlord dashboard's
 * existing density, sitting just under AtAGlanceSummary.
 *
 * Data comes from GET /landlord/portfolio-snapshot, which the backend
 * spec (§5 item 1) derives from the same portfolioStats.service.js
 * computation `portfolioDigest.job.js` already uses for the monthly
 * digest email, so this live view and that email can never drift.
 * Self-fetching component (token prop only, same pattern as
 * DisputesPanel.jsx) so it can drop in without wiring into
 * Dashboard.jsx's central summary load.
 */
export default function InvestorSnapshotPanel({ token, onOpenLatePayer, onOpenVacantUnits }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getPortfolioSnapshot(token)
      .then((res) => {
        if (!cancelled) setSnapshot(res || null);
      })
      .catch((err) => {
        if (cancelled) return;
        // Quiet failure, matching the rest of the dashboard's
        // secondary-panel convention (e.g. MissingPhotosBanner) -
        // a broken snapshot tile shouldn't block the rest of the
        // page, just fold away.
        setError(err instanceof ApiError ? err.message : 'Could not load portfolio snapshot');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <section className="investor-snapshot" aria-label="Investor Snapshot">
        <Skeleton variant="card" count={4} />
      </section>
    );
  }

  if (error || !snapshot) {
    // Don't show an alarming error block for what's a nice-to-have
    // summary strip - just fold away quietly like MissingPhotosBanner
    // does when it has nothing to show.
    return null;
  }

  const occupancyPct = snapshot.occupancyRate != null ? Math.round(snapshot.occupancyRate) : null;
  const collectionPct = snapshot.collectionRate != null ? Math.round(snapshot.collectionRate) : null;
  const latePayers = snapshot.topLatePayers || [];
  const vacantNoPhotoCount = snapshot.vacantNoPhotoCount ?? 0;

  return (
    <section className="investor-snapshot" aria-label="Investor Snapshot">
      <h3 className="investor-snapshot__title">Investor Snapshot</h3>
      <div className="investor-snapshot__grid">
        <GlowCard accent="blue" quiet className="investor-snapshot__card" title="Occupancy">
          <span className="investor-snapshot__label">Occupancy</span>
          <span className="investor-snapshot__value">{occupancyPct != null ? `${occupancyPct}%` : '—'}</span>
          <span className="investor-snapshot__caption">
            {snapshot.occupiedUnits ?? 0} of {snapshot.totalUnits ?? 0} units occupied
          </span>
        </GlowCard>

        <GlowCard accent="green" quiet className="investor-snapshot__card" title="Collection rate this month">
          <span className="investor-snapshot__label">Collection rate (this month)</span>
          <span className="investor-snapshot__value">{collectionPct != null ? `${collectionPct}%` : '—'}</span>
          <span className="investor-snapshot__caption">
            {KES(snapshot.collectedThisMonth)} of {KES(snapshot.expectedThisMonth)} expected
          </span>
        </GlowCard>

        <GlowCard
          accent="red"
          quiet
          className="investor-snapshot__card investor-snapshot__card--list"
          title="Top late payers"
        >
          <span className="investor-snapshot__label">Top late payers</span>
          {latePayers.length === 0 ? (
            <EmptyState message="No late payers right now" compact />
          ) : (
            <RecentActivityList
              items={latePayers.slice(0, 5).map((p) => ({
                id: p.tenantId || p.id,
                label: p.tenantName,
                meta: p.unitLabel,
                status: `${p.daysLate}d late`,
                statusTone: p.daysLate >= 14 ? 'bad' : 'warn',
                value: KES(p.amountDue),
              }))}
              emptyLabel="No late payers right now"
            />
          )}
          {onOpenLatePayer && latePayers.length > 0 && (
            <button type="button" className="ghost-link investor-snapshot__link" onClick={onOpenLatePayer}>
              View all overdue →
            </button>
          )}
        </GlowCard>

        <GlowCard accent="amber" quiet className="investor-snapshot__card" title="Vacant units without photos">
          <span className="investor-snapshot__label">Vacant, no photos</span>
          <span className="investor-snapshot__value">{vacantNoPhotoCount}</span>
          <span className="investor-snapshot__caption">
            {vacantNoPhotoCount > 0
              ? 'Add photos to attract tenants faster'
              : 'Every vacant unit has photos'}
          </span>
          {onOpenVacantUnits && vacantNoPhotoCount > 0 && (
            <button type="button" className="ghost-link investor-snapshot__link" onClick={onOpenVacantUnits}>
              Add photos →
            </button>
          )}
        </GlowCard>
      </div>
    </section>
  );
}
