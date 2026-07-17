import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import './StatisticsPanel.css';
import './AdminSqlPanel.css';

// "I also want all things in supabase be shown in admin portal and any
// edit in admin portal reflects in supabase as well - let it have its
// own tab in menu known as SQL." Table-by-table viewer/editor (not raw
// SQL execution - see adminSql.controller.js for why) over a
// whitelisted set of tables. Click any editable cell to change it;
// Enter/blur saves straight to Supabase.
export default function AdminSqlPanel({ token }) {
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { rowId, column }
  const [editValue, setEditValue] = useState('');
  const [savingCell, setSavingCell] = useState(null);
  const [search, setSearch] = useState('');
  const limit = 50;

  useEffect(() => {
    api.listAdminSqlTables(token).then((res) => {
      setTables(res.tables || []);
      if (res.tables?.length) setActiveTable(res.tables[0].name);
    }).catch((err) => setError(err.message));
  }, [token]);

  function loadRows(table, off = 0, searchTerm = search) {
    setError('');
    setRows(null);
    api.listAdminSqlRows(table, { limit, offset: off, search: searchTerm }, token)
      .then((res) => { setRows(res.rows || []); setTotal(res.total || 0); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load rows.'));
  }

  useEffect(() => {
    if (activeTable) { setOffset(0); setSearch(''); loadRows(activeTable, 0, ''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTable]);

  // Debounced so every keystroke doesn't fire its own request.
  useEffect(() => {
    if (!activeTable) return;
    const handle = setTimeout(() => { setOffset(0); loadRows(activeTable, 0, search); }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const activeTableInfo = tables.find((t) => t.name === activeTable);

  function isEditable(column) {
    if (!activeTableInfo) return false;
    return !activeTableInfo.readOnlyColumns.includes(column) && !activeTableInfo.redactedColumns.includes(column);
  }

  function startEdit(rowId, column, currentValue) {
    if (!isEditable(column)) return;
    setEditingCell({ rowId, column });
    setEditValue(currentValue == null ? '' : String(currentValue));
  }

  async function saveEdit(row) {
    if (!editingCell) return;
    const { rowId, column } = editingCell;
    setSavingCell(`${rowId}:${column}`);
    setError('');
    try {
      const updated = await api.updateAdminSqlRow(activeTable, rowId, { [column]: editValue }, token);
      setRows((prev) => prev.map((r) => (r.id === rowId ? updated.row : r)));
      setNotice(`Updated ${column} on ${activeTable}.`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save change.');
    } finally {
      setSavingCell(null);
      setEditingCell(null);
    }
  }

  const columns = rows && rows.length ? Object.keys(rows[0]) : activeTableInfo ? [] : [];

  return (
    <section className="statistics-panel">
      <div className="tenant-section__header-row">
        <h2>SQL — Supabase Tables</h2>
      </div>
      <p className="tenant-portal-hint">
        Live view of your Supabase tables. Click any editable cell to change it — saves straight to Supabase. Greyed cells are read-only or hidden (passwords, OTP codes) for safety.
      </p>
      {activeTable === 'landlords' && (
        <p className="tenant-portal-hint admin-sql-panel__note">
          ⚠️ Each apartment (<code>properties</code> table) can have its own independent <code>subscription_expires_at</code>/<code>unit_limit</code>. Editing a landlord row here only affects apartments still riding the landlord's pooled plan — for an apartment with its own subscription, edit its row in <strong>properties</strong> instead.
        </p>
      )}

      <div className="admin-sql-tabs">
        {tables.map((t) => (
          <button
            key={t.name}
            type="button"
            className={`admin-sql-tabs__item ${activeTable === t.name ? 'is-active' : ''}`}
            onClick={() => setActiveTable(t.name)}
          >
            {t.name}
          </button>
        ))}
      </div>

      {activeTableInfo?.searchable && (
        <input
          type="text"
          className="admin-sql-search"
          placeholder={`Search ${activeTable}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {notice && <p style={{ color: '#1a7a3c' }}>{notice}</p>}
      {error && <p className="modal-error">{error}</p>}
      {rows === null && <p>Loading…</p>}

      {rows && rows.length === 0 && <p className="tenant-portal-hint">No rows in this table.</p>}

      {rows && rows.length > 0 && (
        <>
          <div className="admin-sql-table-wrap">
            <table className="admin-sql-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col}>{col}{!isEditable(col) && ' 🔒'}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {columns.map((col) => {
                      const cellKey = `${row.id}:${col}`;
                      const editing = editingCell?.rowId === row.id && editingCell?.column === col;
                      const editable = isEditable(col);
                      return (
                        <td
                          key={col}
                          className={`admin-sql-table__cell ${editable ? 'admin-sql-table__cell--editable' : 'admin-sql-table__cell--locked'}`}
                          onClick={() => !editing && startEdit(row.id, col, row[col])}
                        >
                          {editing ? (
                            <input
                              autoFocus
                              value={editValue}
                              disabled={savingCell === cellKey}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => saveEdit(row)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(row);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                            />
                          ) : savingCell === cellKey ? (
                            'Saving…'
                          ) : row[col] == null ? (
                            <span className="admin-sql-table__null">—</span>
                          ) : typeof row[col] === 'object' ? (
                            JSON.stringify(row[col])
                          ) : (
                            String(row[col])
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-sql-pagination">
            <button disabled={offset === 0} onClick={() => { const n = Math.max(0, offset - limit); setOffset(n); loadRows(activeTable, n); }}>← Previous</button>
            <span>{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
            <button disabled={offset + limit >= total} onClick={() => { const n = offset + limit; setOffset(n); loadRows(activeTable, n); }}>Next →</button>
          </div>
        </>
      )}
    </section>
  );
}
