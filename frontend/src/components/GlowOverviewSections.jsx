import React from 'react';
import GlowSection from './GlowSection';

/**
 * The Overview tab's Glow Card section list - shared between
 * AdminDashboard.jsx and ManagerAccountDashboard.jsx (RentaPay-Glow-
 * Dashboard-Build-Spec.md Phase 2: "same section list, but each
 * section only renders if the underlying route/permission is
 * actually reachable by a GM").
 *
 * `showFinancial` is the one section that's actually gated - GM never
 * sees platform revenue at all (see admin.controller.js stripping
 * revenueThisMonth/revenueThisYear server-side for that role, and
 * ManagerAccountDashboard's own pre-existing "no revenue/profit card
 * here, on purpose" comment). Acquisition/Onboarding/Help
 * Queue/BA Pipeline/System Health are all read-only aggregate counts
 * with no GM-restricted data in them, so both roles get the same
 * cards for those - only the click-through target differs (admin
 * drills down inline, GM navigates to its own full tab), which is why
 * the nav callbacks are passed in rather than hardcoded here.
 */
export default function GlowOverviewSections({
  metrics,
  systemHealth,
  disputesReports: disputesReportsProp,
  tenantGrowth: tenantGrowthProp,
  showFinancial,
  onGoToLandlords,
  onGoToHelp,
  onGoToBrandAmbassadors,
  onRevenueClick,
  onExpiringClick,
  onGoToReportedAccounts,
  onGoToTenants,
}) {
  if (!metrics) return null;
  const gs = metrics.glowSections || {};
  const acquisition = gs.acquisition || {};
  const onboarding = gs.onboarding || {};
  const helpQueue = gs.helpQueue || {};
  const baPipeline = gs.baPipeline || {};
  // Disputes & Reports / Tenant Growth come from their own endpoints
  // (GET /admin/disputes-reports-summary, GET /admin/tenant-growth),
  // not from getDashboardMetrics' glowSections - passed in as props.
  const disputesReports = disputesReportsProp || {};
  const tenantGrowth = tenantGrowthProp || {};
  const heartbeats = systemHealth?.heartbeats || [];
  const anyStale = !!systemHealth?.anyStale;
  // Both summary endpoints return trend rows keyed by `date` with
  // their own count field(s), not TrendCardMini's [{ label, value }]
  // shape - map them here rather than changing the shared chart prop.
  const disputesTrendData = (disputesReports.trend || []).map((row) => ({ label: row.date, value: row.total }));
  const tenantGrowthTrendData = (tenantGrowth.trend || []).map((row) => ({ label: row.date, value: row.newSignups }));

  return (
    <>
      <GlowSection
        title="Landlord Acquisition"
        accent="blue"
        hero={{
          eyebrow: 'New landlord signups (30d)',
          value: acquisition.newLandlordsThisMonth ?? 0,
          action: onGoToLandlords ? { label: 'View landlords →', onClick: onGoToLandlords } : undefined,
        }}
        kpis={[
          { label: 'Incomplete signups', value: acquisition.incompleteSignups ?? 0 },
          { label: 'New leads (7d)', value: acquisition.newLeadsThisWeek ?? 0 },
          { label: 'Total landlords', value: metrics.totalLandlords ?? 0 },
          { label: 'Suspended', value: metrics.suspendedLandlords ?? 0 },
        ]}
        trend={{ title: 'Signups, last 7 days', data: acquisition.trend || [] }}
        recent={acquisition.recent}
        emptyRecentLabel="No recent leads"
      />

      <GlowSection
        title="Onboarding Funnel"
        accent="teal"
        hero={{
          eyebrow: 'Setup completed (30d)',
          value: onboarding.completed ?? 0,
          delta: onboarding.avgDaysToActive != null
            ? { value: `${onboarding.avgDaysToActive}d avg to active`, positive: true }
            : undefined,
        }}
        kpis={[
          { label: 'Still onboarding', value: onboarding.stillPending ?? 0 },
          { label: 'Avg days to active', value: onboarding.avgDaysToActive != null ? `${onboarding.avgDaysToActive}d` : '—' },
        ]}
        trend={{ title: 'Activated, last 7 days', data: onboarding.trend || [] }}
        recent={onboarding.recent}
        emptyRecentLabel="Everyone's onboarded"
      />

      <GlowSection
        title="Help & Support Queue"
        accent="amber"
        hero={{
          eyebrow: 'Open help requests',
          value: helpQueue.open ?? 0,
          action: onGoToHelp ? { label: 'View help →', onClick: onGoToHelp } : undefined,
        }}
        kpis={[
          { label: 'Overdue (>48h)', value: helpQueue.overdue ?? 0 },
          { label: 'Avg resolution', value: helpQueue.avgResolutionHours != null ? `${helpQueue.avgResolutionHours}h` : '—' },
        ]}
        recent={helpQueue.recent}
        emptyRecentLabel="No open requests"
      />

      {showFinancial && (
        <GlowSection
          title="Financial Overview"
          accent="purple"
          hero={{
            eyebrow: 'Revenue this month',
            value: `KES ${Number(metrics.revenueThisMonth || 0).toLocaleString()}`,
            action: onRevenueClick ? { label: 'View breakdown →', onClick: onRevenueClick } : undefined,
          }}
          kpis={[
            { label: 'Revenue this year', value: `KES ${Number(metrics.revenueThisYear || 0).toLocaleString()}` },
            { label: 'Expiring ≤7 days', value: metrics.expiringSoon?.length || 0 },
          ]}
          headerAction={
            onExpiringClick ? (
              <button type="button" className="ghost-link" onClick={onExpiringClick}>
                Expiring →
              </button>
            ) : undefined
          }
        />
      )}

      <GlowSection
        title="Brand Ambassador Pipeline"
        accent="green"
        hero={{
          eyebrow: 'Pending approval',
          value: baPipeline.pendingApproval ?? 0,
          action: onGoToBrandAmbassadors ? { label: 'View BAs →', onClick: onGoToBrandAmbassadors } : undefined,
        }}
        kpis={[
          { label: 'Active BAs', value: baPipeline.active ?? 0 },
          { label: 'Rejected (30d)', value: baPipeline.rejectedThisMonth ?? 0 },
        ]}
        recent={baPipeline.recent}
        emptyRecentLabel="No recent applications"
      />

      <GlowSection
        title="System Health"
        accent={anyStale ? 'red' : 'teal'}
        loading={!systemHealth}
        hero={{
          eyebrow: 'Background jobs',
          value: anyStale ? 'Attention needed' : 'All healthy',
        }}
        recent={heartbeats.map((h) => ({
          id: h.job_name,
          label: h.job_name.replace(/_/g, ' '),
          meta: h.last_run_at ? `Last run ${new Date(h.last_run_at).toLocaleString('en-GB')}` : 'Never run',
          status: h.isStale ? 'Stale' : 'OK',
          statusTone: h.isStale ? 'bad' : 'good',
        }))}
        emptyRecentLabel="No job heartbeats yet"
      />

      <GlowSection
        title="Disputes & Reports"
        accent="red"
        loading={!disputesReportsProp}
        hero={{
          eyebrow: 'Open disputes & reports',
          value: disputesReports.totalOpen ?? 0,
          action: onGoToReportedAccounts ? { label: 'View reports →', onClick: onGoToReportedAccounts } : undefined,
        }}
        kpis={[
          { label: 'Open disputes', value: disputesReports.byStatus?.disputesOpen ?? 0 },
          { label: 'Open reports', value: disputesReports.byStatus?.reportsOpen ?? 0 },
          { label: 'Disputes resolved', value: disputesReports.byStatus?.disputesResolved ?? 0 },
          { label: 'Reports reviewed', value: disputesReports.byStatus?.reportsReviewed ?? 0 },
        ]}
        trend={{ title: 'Volume, last 7 days', data: disputesTrendData }}
        recent={(disputesReports.recent || []).map((r) => ({
          id: `${r.type}-${r.id}`,
          label: r.label,
          meta: r.meta,
          status: r.status,
          statusTone: r.status === 'open' ? 'warn' : 'good',
        }))}
        emptyRecentLabel="No open disputes or reports"
      />

      <GlowSection
        title="Tenant Growth"
        accent="blue"
        loading={!tenantGrowthProp}
        hero={{
          eyebrow: `New tenants (${tenantGrowth.period === 'week' ? '7d' : '30d'})`,
          value: tenantGrowth.newSignups ?? 0,
          action: onGoToTenants ? { label: 'View tenants →', onClick: onGoToTenants } : undefined,
        }}
        kpis={[
          { label: 'Activated', value: tenantGrowth.activated ?? 0 },
          { label: 'Archived', value: tenantGrowth.archived ?? 0 },
        ]}
        trend={{ title: 'New signups, last 14 days', data: tenantGrowthTrendData }}
        emptyRecentLabel="No new tenants yet"
      />
    </>
  );
}
