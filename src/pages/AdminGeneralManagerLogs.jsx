import React, { useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import GmActivityLogView from '../components/GmActivityLogView.jsx';
import { api } from '../api/client.js';
import './AdminDashboard.css';

// RentaPay — General Manager Sectioned Build Spec, Section 8.
//
// Admin's dedicated log page for ONE General Manager - reached from
// GeneralManagersPanel.jsx's "View activity" link (not a shared feed
// mixed with other managers' activity). Section 10's revert
// affordances (bulk + individual) hang off this same page: canRevert
// enables the per-entry Revert button in GmActivityLogView.jsx, and
// onRevertRange enables the "Revert all in range" bulk control.
export default function AdminGeneralManagerLogs() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const token = sessionStorage.getItem('rentapay_token');
  const managerName = location.state?.managerName;

  const fetchLogs = useCallback(({ view, date }) => api.getGeneralManagerLogs(id, { view, date }, token), [id, token]);
  // SECTION 9 — styled PDF export, date-range selectable from the toolbar below.
  const exportPdf = useCallback(({ from, to }) => api.downloadGeneralManagerLogsPdf(id, { from, to }, token), [id, token]);
  // SECTION 10 — revert a single log entry, or every eligible entry in a date range.
  const revertOne = useCallback((log) => api.revertGeneralManagerLog(id, log.id, token), [id, token]);
  const revertRange = useCallback(({ from, to }) => api.revertGeneralManagerLogsInRange(id, { from, to }, token), [id, token]);

  return (
    <div className="admin-page">
      <main className="admin-main">
        <button type="button" className="gm-log-view__nav-btn" style={{ width: 'auto', padding: '4px 10px', marginBottom: 12 }} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2>{managerName ? `${managerName} — activity log` : 'General Manager activity log'}</h2>
        <p className="tenant-portal-hint">Every PIN-confirmed action this General Manager has taken, with reason, before/after state, and affected record.</p>
        <GmActivityLogView fetchLogs={fetchLogs} canRevert onRevert={revertOne} onRevertRange={revertRange} onExportPdf={exportPdf} />
      </main>
    </div>
  );
}
