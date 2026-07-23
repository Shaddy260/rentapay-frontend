import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import './AuditLogPanel.css';

const ACTION_LABELS = {
  expense_created: 'logged an expense',
  expense_updated: 'edited an expense',
  expense_deleted: 'deleted an expense',
  document_uploaded: 'uploaded a document',
  document_deleted: 'deleted a document',
};

function describeLog(log) {
  const meta = log.metadata || {};
  if (log.target_type === 'expense') {
    const amount = meta.amount != null ? `KES ${Number(meta.amount).toLocaleString()}` : '';
    return [meta.category, amount].filter(Boolean).join(' · ');
  }
  if (log.target_type === 'document') {
    return meta.label || '';
  }
  return '';
}

/**
 * "Who deleted this expense?" / "who uploaded that lease?" - a
 * landlord-facing view of activity_logs scoped to expense/document
 * actions (see auditLog.controller.js). Collapsed by default since
 * most landlords won't need it most of the time; expands into a
 * simple reverse-chronological list.
 */
export default function AuditLogPanel({ token, propertyId, targetType }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Reset so switching property/tab re-fetches next time it's opened.
    setLoaded(false);
    setLogs([]);
  }, [token, propertyId, targetType]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      setError('');
      const params = { targetType };
      if (propertyId && propertyId !== 'unassigned') params.propertyId = propertyId;
      api.getAuditLog(params, token)
        .then((res) => {
          setLogs(res.logs || []);
          setLoaded(true);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }

  return (
    <div className="audit-log-panel">
      <button type="button" className="ghost-link audit-log-panel__toggle" onClick={toggle}>
        {open ? 'Hide activity' : 'View activity'}
      </button>

      {open && (
        <div className="audit-log-panel__body">
          {loading && <p className="tenant-portal-hint">Loading…</p>}
          {error && <p className="modal-error">{error}</p>}
          {!loading && !error && logs.length === 0 && (
            <p className="tenant-portal-hint">No activity recorded yet.</p>
          )}
          {!loading && logs.length > 0 && (
            <ul className="audit-log-panel__list">
              {logs.map((log) => (
                <li key={log.id} className="audit-log-panel__item">
                  <span className="audit-log-panel__line">
                    <strong>{log.actorName}</strong> {ACTION_LABELS[log.action] || log.action}
                    {describeLog(log) && <> — {describeLog(log)}</>}
                  </span>
                  <span className="audit-log-panel__time">{new Date(log.created_at).toLocaleString('en-GB')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
