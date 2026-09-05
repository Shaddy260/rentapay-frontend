import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import GlowCard from './GlowCard.jsx';
import HeroStat from './HeroStat.jsx';
import KpiMiniGrid from './KpiMiniGrid.jsx';
import { useToast } from './Toast.jsx';
import './AdminFinancialOverview.css';

const KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Premium Redesign Plan - Phase 9: Admin Financial Overview & Expense
 * Tracking. Always scoped to one month at a time: earned -> owed to
 * BAs -> remaining -> expenses -> profit, so the math is traceable at
 * a glance.
 */
export default function AdminFinancialOverview({ token }) {
  // PRODUCTION ERROR HANDLING FIX: replaced a blocking window.alert()
  // with the app's standard toast.error() convention.
  const toast = useToast();
  const [month, setMonth] = useState(currentMonthKey);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);

  const load = useCallback(() => {
    setOverview(null);
    setError('');
    api
      .getAdminFinancialOverview(month, token)
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the financial overview.'));
  }, [month, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStop(expenseId) {
    try {
      await api.stopAdminExpense(expenseId, month, token);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update the expense.');
    }
  }

  return (
    <div className="admin-financial-overview">
      <div className="admin-financial-overview__header">
        <h2 className="admin-financial-overview__title">Financial Overview</h2>
        <div className="admin-financial-overview__month-switcher">
          <button aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            ◂
          </button>
          <span>{monthLabel(month)}</span>
          <button aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            ▸
          </button>
        </div>
      </div>

      {error && <p className="admin-financial-overview__error">{error}</p>}
      {!overview && !error && (
        <div className="admin-financial-overview__skeleton">
          <Skeleton height={80} />
          <Skeleton height={220} />
        </div>
      )}

      {overview && (
        <>
          <GlowCard accent="purple" title="Financial summary" className="admin-financial-overview__glow-summary">
            <HeroStat
              eyebrow="Earned this month"
              value={KES(overview.earned)}
              delta={{ value: `− ${KES(overview.owedToBas)} owed to BAs`, positive: false }}
            />
            <KpiMiniGrid
              accent="purple"
              items={[
                { label: 'Owed to BAs', value: KES(overview.owedToBas) },
                { label: 'Remaining', value: KES(overview.remaining) },
                { label: 'Expenses', value: KES(overview.totalExpenses) },
                { label: 'Profit', value: KES(overview.profit), caption: overview.profit >= 0 ? 'In the black' : 'Running at a loss' },
              ]}
            />
          </GlowCard>

          <div className="admin-financial-overview__expenses">
            {overview.expenses.length === 0 && <p className="admin-financial-overview__empty">No expenses logged for this month.</p>}
            {overview.expenses.map((e) => (
              <div key={e.id} className="admin-financial-overview__expense-row">
                <span className="admin-financial-overview__expense-name">{e.label}</span>
                <span className={`admin-financial-overview__expense-pill${e.recurrence === 'recurring' ? ' admin-financial-overview__expense-pill--recurring' : ''}`}>
                  {e.recurrence === 'recurring' ? 'Recurring' : 'One-time'}
                </span>
                <span className="admin-financial-overview__expense-amount">− {KES(e.amount)}</span>
                {e.recurrence === 'recurring' && !e.recurrenceEndsAt && (
                  <button className="admin-financial-overview__stop-btn" onClick={() => handleStop(e.id)}>
                    Stop
                  </button>
                )}
              </div>
            ))}
          </div>

          <Button variant="ghost" className="admin-financial-overview__add-btn" onClick={() => setShowAddExpense(true)}>
            + Add expense
          </Button>
        </>
      )}

      {showAddExpense && (
        <AddExpenseModal
          token={token}
          month={month}
          onClose={() => setShowAddExpense(false)}
          onSaved={() => {
            setShowAddExpense(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddExpenseModal({ token, month, onClose, onSaved }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [recurrence, setRecurrence] = useState('one_time');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setError('');
    if (!label.trim()) {
      setError('Enter a description for this expense.');
      return;
    }
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSaving(true);
    try {
      await api.addAdminExpense({ label: label.trim(), amount: amt, recurrence, month }, token);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add the expense.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-financial-overview__modal-overlay" onClick={onClose}>
      <div className="admin-financial-overview__modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add expense</h3>
        <label className="admin-financial-overview__field">
          <span>Description</span>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Office rent" />
        </label>
        <label className="admin-financial-overview__field">
          <span>Amount (KES)</span>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 15000" />
        </label>
        <div className="admin-financial-overview__field">
          <span>Type</span>
          <div className="admin-financial-overview__recurrence-toggle">
            <button className={recurrence === 'one_time' ? 'active' : ''} onClick={() => setRecurrence('one_time')} type="button">
              One-time
            </button>
            <button className={recurrence === 'recurring' ? 'active' : ''} onClick={() => setRecurrence('recurring')} type="button">
              Recurring
            </button>
          </div>
        </div>
        {error && <p className="admin-financial-overview__error">{error}</p>}
        <div className="admin-financial-overview__modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            Save expense
          </Button>
        </div>
      </div>
    </div>
  );
}
