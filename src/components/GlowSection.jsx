import React from 'react';
import GlowCard from './GlowCard';
import HeroStat from './HeroStat';
import KpiMiniGrid from './KpiMiniGrid';
import TrendCardMini from './TrendCardMini';
import RecentActivityList from './RecentActivityList';
import Skeleton from './Skeleton';
import './GlowSection.css';

/**
 * Full dashboard section - one outer hero GlowCard containing the
 * hero stat + KPI mini-grid + trend card + recent-activity list, laid
 * out per RentaPay-Glow-Dashboard-Build-Spec.md §1.9 responsive rules
 * (3-col at desktop: hero+kpis span 2, trend sits in col 3; stacks
 * below that). This is what each Overview tab section (§2's table)
 * renders as.
 *
 * Pass `loading` to show a skeleton in place of the body while data
 * is still in flight, so the section chrome (title, accent) appears
 * immediately.
 */
export default function GlowSection({
  title,
  accent = 'blue',
  hero,
  kpis,
  trend,
  recent,
  emptyRecentLabel,
  loading = false,
  headerAction,
}) {
  return (
    <GlowCard accent={accent} className="glow-section" title={title}>
      <div className="glow-section__header">
        <h3 className="glow-section__title">{title}</h3>
        {headerAction}
      </div>
      {loading ? (
        <Skeleton rows={4} />
      ) : (
        <div className="glow-section__body">
          <div className="glow-section__main">
            {hero && <HeroStat {...hero} />}
            {kpis && <KpiMiniGrid items={kpis} accent={accent} />}
          </div>
          <div className="glow-section__side">
            {trend && <TrendCardMini title={trend.title} data={trend.data} accent={accent} variant={trend.variant} formatValue={trend.formatValue} />}
            {recent && <RecentActivityList items={recent} emptyLabel={emptyRecentLabel} />}
          </div>
        </div>
      )}
    </GlowCard>
  );
}
