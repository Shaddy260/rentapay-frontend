import React, { useMemo } from 'react';
import MiniBarChart from './MiniBarChart.jsx';
import MiniDonutChart from './MiniDonutChart.jsx';
import './StatisticsPanel.css';

/**
 * "Statistics" tab from the reference design - built from the same
 * payment history the Financials tab already has, so no new backend
 * endpoint was needed. Pure client-side aggregation + the
 * dependency-free chart components.
 */
export default function StatisticsPanel({ payments }) {
  const monthly = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-GB', { month: 'short' }), value: 0 });
    }
    payments
      .filter((p) => p.status === 'completed' && p.paid_at)
      .forEach((p) => {
        const d = new Date(p.paid_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const bucket = months.find((m) => m.key === key);
        if (bucket) bucket.value += Number(p.amount);
      });
    return months;
  }, [payments]);

  const statusCounts = useMemo(() => {
    const counts = { completed: 0, pending: 0, failed: 0 };
    payments.forEach((p) => {
      if (counts[p.status] !== undefined) counts[p.status] += 1;
      else counts[p.status] = 1;
    });
    return counts;
  }, [payments]);

  const totalPaid = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0);
  const completedCount = payments.filter((p) => p.status === 'completed').length;
  const avgPayment = completedCount > 0 ? totalPaid / completedCount : 0;

  const donutSegments = [
    { label: 'Completed', value: statusCounts.completed || 0, color: 'var(--color-mpesa)' },
    { label: 'Pending', value: statusCounts.pending || 0, color: 'var(--color-accent)' },
    { label: 'Failed', value: statusCounts.failed || 0, color: 'var(--color-error)' },
  ].filter((s) => s.value > 0);

  return (
    <section className="statistics-panel">
      <h2>Statistics</h2>

      <div className="statistics-panel__cards">
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Total paid</span>
          <span className="statistics-panel__card-value">KES {totalPaid.toLocaleString()}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Payments made</span>
          <span className="statistics-panel__card-value">{payments.length}</span>
        </div>
        <div className="statistics-panel__card">
          <span className="statistics-panel__card-label">Average payment</span>
          <span className="statistics-panel__card-value">KES {Math.round(avgPayment).toLocaleString()}</span>
        </div>
      </div>

      <div className="statistics-panel__chart-block">
        <h3>Rent paid, last 6 months</h3>
        {monthly.every((m) => m.value === 0) ? (
          <p className="tenant-portal-hint">No completed payments yet to chart.</p>
        ) : (
          <MiniBarChart data={monthly} />
        )}
      </div>

      {donutSegments.length > 0 && (
        <div className="statistics-panel__chart-block">
          <h3>Payment outcomes</h3>
          <MiniDonutChart segments={donutSegments} centerLabel={`${payments.length} total`} />
        </div>
      )}
    </section>
  );
}
