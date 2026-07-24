import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AuditLogPanel from './AuditLogPanel.jsx';
import './MaintenanceManagePanel.css';
import './ExpensesPanel.css';

const CATEGORIES = ['Repairs', 'Utilities', 'Staff', 'Insurance', 'Taxes', 'Supplies', 'Other'];

const emptyDraft = { category: 'Repairs', amount: '', date: new Date().toISOString().slice(0, 10), note: '', receipt: null };

/**
 * "Expenses" tab (new: property-level cost tracking - repairs,
 * utilities, staff, etc.) - modeled on MaintenanceManagePanel.jsx's
 * layout. Feeds the net-profit figures on the Financial Statistics
 * tab and the PDF collection summary (see dashboard.controller.js's
 * computeLandlordStatistics).
 */
export default function ExpensesPanel({ token, propertyId, canEdit = true }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  // FEATURE (direct request: "search bars on long lists"): expenses
  // had no filter at all - a landlord tracking costs for a while would
  // have to scroll the whole history to find, say, every "Repairs"
  // entry or a specific note.
  const [expenseSearch, setExpenseSearch] = useState('');
  const filteredExpenses = expenses.filter((e) => {
    const needle = expenseSearch.trim().toLowerCase();
    if (!needle) return true;
    return [e.category, e.note].some((f) => (f || '').toLowerCase().includes(needle));
  });

  function load() {
    setLoading(true);
    const params = {};
    if (propertyId && propertyId !== 'unassigned') params.propertyId = propertyId;
    api.listExpenses(token, params)
      .then((res) => setExpenses(res.expenses || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, propertyId]);

  const totalThisMonth = expenses
    .filter((e) => {
      const d = new Date(e.date);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!propertyId || propertyId === 'unassigned') {
      setError('Pick a specific property before logging an expense.');
      return;
    }
    if (!draft.amount || Number(draft.amount) <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('propertyId', propertyId);
      formData.append('category', draft.category);
      formData.append('amount', draft.amount);
      formData.append('date', draft.date);
      if (draft.note) formData.append('note', draft.note);
      if (draft.receipt) formData.append('receipt', draft.receipt);
      await api.createExpense(formData, token);
      setDraft(emptyDraft);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    setDeletingId(id);
    setError('');
    try {
      await api.deleteExpense(id, token);
      setExpenses((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="maintenance-manage-panel">
      <div className="maintenance-manage-panel__header">
        <h2>Expenses</h2>
        {canEdit && (
          <button className="ghost-link" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : '+ Log expense'}
          </button>
        )}
      </div>

      {canEdit && <AuditLogPanel token={token} propertyId={propertyId} targetType="expense" />}

      <p className="expenses-panel__summary">This month: <strong>KES {totalThisMonth.toLocaleString()}</strong></p>

      {error && <p className="modal-error">{error}</p>}

      {showForm && (
        <form className="expenses-panel__form" onSubmit={handleSubmit}>
          <div className="expenses-panel__form-row">
            <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number"
              placeholder="Amount (KES)"
              min="0.01"
              step="0.01"
              value={draft.amount}
              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              required
            />
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            />
          </div>
          <textarea
            placeholder="Note (optional)"
            rows={2}
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          />
          <div className="expenses-panel__form-row">
            <label className="expenses-panel__file-label">
              Receipt (optional)
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setDraft((d) => ({ ...d, receipt: e.target.files?.[0] || null }))} />
            </label>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save expense'}</button>
          </div>
        </form>
      )}

      {expenses.length > 0 && (
        <div className="form-field" style={{ maxWidth: 280, marginBottom: 12 }}>
          <input
            type="search"
            placeholder="Search category or note…"
            value={expenseSearch}
            onChange={(e) => setExpenseSearch(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <p className="tenant-portal-hint">Loading…</p>
      ) : expenses.length === 0 ? (
        <p className="tenant-portal-hint">No expenses logged yet.</p>
      ) : filteredExpenses.length === 0 ? (
        <p className="tenant-portal-hint">No expenses match "{expenseSearch}".</p>
      ) : (
        <ul className="maintenance-manage-panel__list">
          {filteredExpenses.map((e) => (
            <li key={e.id} className="maintenance-manage-panel__item">
              <div className="maintenance-manage-panel__item-header">
                <strong>{e.category}</strong>
                <span>KES {Number(e.amount).toLocaleString()}</span>
              </div>
              <p className="maintenance-manage-panel__meta">
                {e.properties?.name || 'Property'} · {new Date(e.date).toLocaleDateString('en-GB')}
              </p>
              {e.note && <p className="maintenance-manage-panel__desc">{e.note}</p>}
              {e.receipt_photo_url && (
                <a href={e.receipt_photo_url} target="_blank" rel="noreferrer" className="ghost-link">View receipt</a>
              )}
              {canEdit && (
                <div className="maintenance-manage-panel__actions">
                  <button disabled={deletingId === e.id} onClick={() => handleDelete(e.id)} style={{ color: '#b3261e' }}>
                    {deletingId === e.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
