import React, { useState, useEffect, useCallback } from 'react';
import Skeleton from './Skeleton.jsx';
import './GmActivityLogView.css';

// RentaPay - General Manager Sectioned Build Spec, Section 8.
//
// Shared log-browsing UI reused by both:
//   - AdminGeneralManagerLogs.jsx (admin viewing a specific manager's
//     full history, with the Section 10 revert affordances: canRevert
//     + onRevert for a single entry, onRevertRange for bulk)
//   - ManagerAccountDashboard.jsx's "My Activity" tab (a General
//     Manager viewing their own history, read-only - no revert button
//     is ever rendered there since `canRevert` stays false).
//
// `fetchLogs({ view, date })` is the one thing that differs between
// those two callers (admin's api.getGeneralManagerLogs(managerId, ...)
// vs a GM's own api.getMyGeneralManagerLogs(...)) - everything else
// (the day/week/month tabs, the per-entry card, empty states) is
// identical, matching the spec's own note that this page should be
// "consistent with how other activity logs already function elsewhere
// on the platform" / "same card-based layout, spacing, and component
// styling already used elsewhere on the platform."
export default function GmActivityLogView({ fetchLogs, onRevert, canRevert = false, onRevertRange, emptyLabel, onExportPdf }) {
  const [view, setView] = useState('day');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revertingId, setRevertingId] = useState(null);
  const today = new Date().toISOString().slice(0, 10);

  // SECTION 10 - bulk revert: "Admin selects a date range... Revert
  // all actions in that range at once." Only rendered when the caller
  // passes onRevertRange (AdminGeneralManagerLogs.jsx) - same
  // admin-only gating as the individual Revert button below, and
  // reuses the same from/to inputs pattern as the PDF export toolbar.
  const [revertFrom, setRevertFrom] = useState(today);
  const [revertTo, setRevertTo] = useState(today);
  const [revertingRange, setRevertingRange] = useState(false);
  const [rangeResult, setRangeResult] = useState(null);

  async function handleRevertRange() {
    if (!onRevertRange) return;
    if (!window.confirm('Revert every eligible action for this General Manager in the selected range? This restores each affected record to its exact prior state and cannot be undone from here.')) return;
    setRevertingRange(true);
    setRangeResult(null);
    setError('');
    try {
      const res = await onRevertRange({ from: revertFrom, to: revertTo });
      setRangeResult(res);
      load();
    } catch (err) {
      setError(err.message || 'Failed to revert actions in this range.');
    } finally {
      setRevertingRange(false);
    }
  }

  // SECTION 9 - Styled PDF Export of Logs. Only rendered when a
  // caller passes onExportPdf (AdminGeneralManagerLogs.jsx) - a
  // General Manager's own "My Activity" tab never gets an export
  // button, same as it never gets revert.
  const [exportFrom, setExportFrom] = useState(today);
  const [exportTo, setExportTo] = useState(today);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  async function handleExport() {
    if (!onExportPdf) return;
    setExporting(true);
    setExportError('');
    try {
      await onExportPdf({ from: exportFrom, to: exportTo });
    } catch (err) {
      setExportError(err.message || 'Failed to export PDF.');
    } finally {
      setExporting(false);
    }
  }

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetchLogs({ view, date })
      .then((res) => setData(res))
      .catch((err) => setError(err.message || 'Failed to load activity log.'))
      .finally(() => setLoading(false));
  }, [fetchLogs, view, date]);

  useEffect(() => { load(); }, [load]);

  function step(direction) {
    const d = new Date(date);
    if (view === 'day') d.setDate(d.getDate() + direction);
    else if (view === 'week') d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    setDate(d.toISOString().slice(0, 10));
  }

  async function handleRevert(log) {
    if (!onRevert) return;
    setRevertingId(log.id);
    try {
      await onRevert(log);
      load();
    } catch (err) {
      setError(err.message || 'Failed to revert this action.');
    } finally {
      setRevertingId(null);
    }
  }

  return (
    <div className="gm-log-view">
      <div className="gm-log-view__toolbar">
        <div className="gm-log-view__tabs" role="tablist">
          {['day', 'week', 'month'].map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`gm-log-view__tab${view === v ? ' gm-log-view__tab--active' : ''}`}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="gm-log-view__nav">
          <button type="button" className="gm-log-view__nav-btn" onClick={() => step(-1)} aria-label="Previous period">←</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="gm-log-view__date-input" />
          <button type="button" className="gm-log-view__nav-btn" onClick={() => step(1)} aria-label="Next period">→</button>
        </div>
      </div>

      {onExportPdf && (
        <div className="gm-log-view__export">
          <span className="gm-log-view__export-label">Export as PDF:</span>
          <input type="date" value={exportFrom} max={exportTo} onChange={(e) => setExportFrom(e.target.value)} className="gm-log-view__date-input" aria-label="Export from date" />
          <span className="gm-log-view__export-to">to</span>
          <input type="date" value={exportTo} min={exportFrom} onChange={(e) => setExportTo(e.target.value)} className="gm-log-view__date-input" aria-label="Export to date" />
          <button type="button" className="gm-log-view__nav-btn" data-download-fx disabled={exporting} onClick={handleExport}>
            {exporting ? 'Exporting…' : 'Download PDF'}
          </button>
        </div>
      )}
      {exportError && <p className="admin-banner admin-banner--error">{exportError}</p>}

      {onRevertRange && (
        <div className="gm-log-view__export">
          <span className="gm-log-view__export-label">Bulk revert:</span>
          <input type="date" value={revertFrom} max={revertTo} onChange={(e) => setRevertFrom(e.target.value)} className="gm-log-view__date-input" aria-label="Revert from date" />
          <span className="gm-log-view__export-to">to</span>
          <input type="date" value={revertTo} min={revertFrom} onChange={(e) => setRevertTo(e.target.value)} className="gm-log-view__date-input" aria-label="Revert to date" />
          <button type="button" className="admin-table__action admin-table__action--danger" disabled={revertingRange} onClick={handleRevertRange}>
            {revertingRange ? 'Reverting…' : 'Revert all in range'}
          </button>
        </div>
      )}
      {rangeResult && (
        <p className={`admin-banner ${rangeResult.failedCount ? 'admin-banner--error' : 'admin-banner--ok'}`}>
          Reverted {rangeResult.revertedCount} action{rangeResult.revertedCount === 1 ? '' : 's'}
          {rangeResult.failedCount ? `, ${rangeResult.failedCount} failed.` : '.'}
        </p>
      )}

      {loading && <Skeleton rows={5} />}
      {error && <p className="admin-banner admin-banner--error">{error}</p>}

      {!loading && !error && data && (
        <>
          <p className="gm-log-view__range">
            {new Date(data.rangeStart).toLocaleDateString('en-GB')} - {new Date(new Date(data.rangeEnd).getTime() - 1).toLocaleDateString('en-GB')}
            {' · '}{data.logs.length} action{data.logs.length === 1 ? '' : 's'}
          </p>

          {data.logs.length === 0 && <p className="tenant-portal-hint">{emptyLabel || 'No activity in this period.'}</p>}

          <div className="gm-log-view__list">
            {data.logs.map((log) => (
              <GmLogEntry key={log.id} log={log} canRevert={canRevert} reverting={revertingId === log.id} onRevert={() => handleRevert(log)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function fmtValue(v) {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function GmLogEntry({ log, canRevert, reverting, onRevert }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="gm-log-entry">
      <div className="gm-log-entry__header">
        <div>
          <h4 className="gm-log-entry__title">{log.data_type}</h4>
          <p className="gm-log-entry__meta">
            {new Date(log.created_at).toLocaleString('en-GB')}
            {log.affected_role ? ` · ${log.affected_role}` : ''}
            {log.affected_person_label ? ` · ${log.affected_person_label}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* ADMIN CONFIRMATION QUEUE: this is the same review admin
              also does one-by-one/bulk from the dedicated "GM Pending
              Actions" page - shown here too so a manager's full log
              always reflects whether admin has signed off yet. */}
          {log.admin_review_status === 'pending' && <span className="gm-log-entry__badge" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-warning)' }}>Awaiting admin review</span>}
          {log.admin_review_status === 'confirmed' && <span className="gm-log-entry__badge" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>Admin confirmed</span>}
          {log.admin_review_status === 'rejected' && <span className="gm-log-entry__badge" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>Admin rejected</span>}
          {log.reverted_at ? (
            <span className="gm-log-entry__badge gm-log-entry__badge--reverted">Reverted</span>
          ) : (
            canRevert && log.is_revertible && (
              <button type="button" className="admin-table__action admin-table__action--danger" disabled={reverting} onClick={onRevert}>
                {reverting ? 'Reverting…' : 'Revert'}
              </button>
            )
          )}
        </div>
      </div>

      <p className="gm-log-entry__reason"><strong>Reason:</strong> {log.reason}</p>

      <button type="button" className="gm-log-entry__toggle" onClick={() => setExpanded((v) => !v)}>
        {expanded ? 'Hide details' : 'Show details'}
      </button>

      {expanded && (
        <div className="gm-log-entry__details">
          {log.initial_data && (
            <div>
              <span className="gm-log-entry__details-label">Before</span>
              <pre className="gm-log-entry__pre">{fmtValue(log.initial_data)}</pre>
            </div>
          )}
          {log.corrected_data && (
            <div>
              <span className="gm-log-entry__details-label">After</span>
              <pre className="gm-log-entry__pre">{fmtValue(log.corrected_data)}</pre>
            </div>
          )}
          {log.context && (
            <div>
              <span className="gm-log-entry__details-label">Other context</span>
              <pre className="gm-log-entry__pre">{fmtValue(log.context)}</pre>
            </div>
          )}
          {log.reverted_at && (
            <p className="gm-log-entry__meta">Reverted {new Date(log.reverted_at).toLocaleString('en-GB')} by {log.reverted_by}</p>
          )}
        </div>
      )}
    </article>
  );
}
