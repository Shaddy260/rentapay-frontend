import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import './AuditLogPanel.css';

/**
 * "Rent escalation... so it's not a manual edit someone forgets" -
 * scheduling itself already exists (updateRent/bulkUpdateRent with a
 * future effectiveDate, applied automatically by a daily cron job -
 * see unit.controller.js's applyScheduledRentChanges). What was
 * missing was a way to see every upcoming change across the
 * portfolio in one place instead of opening each unit individually.
 * Read-only - scheduling is still done from the unit page or the
 * "Bulk rent change" action.
 */
export default function PendingRentChangesPanel({ token, propertyId }) {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listPendingRentChanges(token, propertyId)
      .then((res) => { if (!cancelled) setChanges(res.changes || []); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load scheduled rent changes.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, propertyId]);

  if (loading) return null;
  if (error) return <p className="modal-error">{error}</p>;
  if (changes.length === 0) return null;

  return (
    <div className="audit-log-panel">
      <h3 style={{ marginBottom: 6 }}>Scheduled Rent Changes</h3>
      <ul className="audit-log-panel__list" style={{ maxHeight: 220 }}>
        {changes.map((c) => (
          <li key={c.id} className="audit-log-panel__item">
            <span className="audit-log-panel__line">
              <strong>{c.unitName || 'Unit'}</strong>{c.propertyName ? ` (${c.propertyName})` : ''} — KES {Number(c.old_amount).toLocaleString()} → KES {Number(c.new_amount).toLocaleString()}
            </span>
            <span className="audit-log-panel__time">Takes effect {new Date(c.effective_date).toLocaleDateString('en-GB')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
