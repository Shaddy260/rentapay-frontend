import { useState, useEffect, useRef } from 'react';
import { api, ApiError } from '../api/client.js';
import './AnnualReportPanel.css';
import InfoTip from './InfoTip.jsx';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear, currentYear - 1, currentYear - 2];
const MAX_POLL_ATTEMPTS = 72; // ~3 minutes at 2.5s intervals

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'rentapay-export';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * "Once someone has a full year of data" - a portfolio-wide annual
 * PDF (all properties, 12 months) plus a KRA-filing-shaped tax
 * summary, both built on the same year aggregation
 * (annualReport.controller.js). Lives alongside the existing monthly
 * "Download PDF" button on the Financial Statistics tab.
 *
 * Phase 2: the reports now run as queued background exports (POST
 * /api/export-jobs/... -> worker -> Supabase Storage -> signed URL)
 * instead of blocking the request while pdfkit renders. The buttons
 * show preparing / ready / failed states while the worker builds the
 * file. If the deployment has no worker configured, the API answers
 * 503 and the panel surfaces that message.
 *
 * DIRECT REQUEST: caretakers should not see the tax summary report -
 * it's landlord/manager-facing filing paperwork, not something a
 * caretaker needs or should have access to.
 */
export default function AnnualReportPanel({ token, propertyId, isCaretaker = false }) {
  const effectivePropertyId = propertyId && propertyId !== 'unassigned' ? propertyId : undefined;
  const [year, setYear] = useState(currentYear);
  const [kraPin, setKraPin] = useState('');
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [jobs, setJobs] = useState({}); // kind -> { status, exportJobId, error, file_name }
  const pollTimers = useRef({});

  useEffect(() => () => {
    Object.values(pollTimers.current).forEach((t) => clearInterval(t));
    pollTimers.current = {};
  }, []);

  function statusFor(kind) {
    return jobs[kind]?.status || 'idle';
  }

  function isRunning(kind) {
    const st = statusFor(kind);
    return st === 'creating' || st === 'queued' || st === 'processing';
  }

  function labelFor(kind, idleLabel) {
    const st = statusFor(kind);
    if (st === 'creating' || st === 'queued' || st === 'processing') return 'Preparing…';
    if (st === 'completed') return '✓ Ready - download started';
    if (st === 'failed' || st === 'timeout') return `Retry ${idleLabel}`;
    return idleLabel;
  }

  async function handleJob(kind) {
    setJobs((j) => ({ ...j, [kind]: { status: 'creating' } }));
    clearInterval(pollTimers.current[kind]);
    let exportJobId;
    try {
      const params = { year, propertyId: effectivePropertyId };
      if (kind === 'tax') params.kraPin = kraPin.trim() || undefined;
      const created =
        kind === 'annual'
          ? await api.createAnnualReportJob(params, token)
          : kind === 'csv'
            ? await api.createFinancialCsvJob(params, token)
            : await api.createTaxSummaryJob(params, token);
      exportJobId = created.exportJobId;
      setJobs((j) => ({ ...j, [kind]: { status: 'queued', exportJobId } }));
    } catch (err) {
      setJobs((j) => ({
        ...j,
        [kind]: { status: 'failed', error: err instanceof ApiError ? err.message : 'Failed to start the export.' },
      }));
      return;
    }
    poll(kind, exportJobId);
  }

  function poll(kind, exportJobId) {
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const res = await api.getExportJobStatus(exportJobId, token);
        if (res.status === 'completed') {
          clearInterval(pollTimers.current[kind]);
          const download = await api.getExportJobDownload(exportJobId, token);
          triggerDownload(download.downloadUrl, download.file_name);
          setJobs((j) => ({ ...j, [kind]: { status: 'completed', exportJobId, file_name: download.file_name } }));
        } else if (res.status === 'failed') {
          clearInterval(pollTimers.current[kind]);
          setJobs((j) => ({ ...j, [kind]: { status: 'failed', error: res.error_message || 'The export failed. Please try again.' } }));
        } else if (attempts >= MAX_POLL_ATTEMPTS) {
          clearInterval(pollTimers.current[kind]);
          setJobs((j) => ({ ...j, [kind]: { status: 'timeout', error: 'This export is taking longer than expected. Check back shortly.' } }));
        }
      } catch (err) {
        clearInterval(pollTimers.current[kind]);
        setJobs((j) => ({
          ...j,
          [kind]: { status: 'failed', error: err instanceof ApiError ? err.message : 'Could not check the export status.' },
        }));
      }
    };
    pollTimers.current[kind] = setInterval(tick, 2500);
    tick();
  }

  const firstError = ['annual', 'csv', 'tax'].map((k) => jobs[k]).find((j) => j && (j.status === 'failed' || j.status === 'timeout'));

  return (
    <div className="annual-report-panel">
      <div className="annual-report-panel__row">
        <label className="annual-report-panel__year-label">
          Year
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <button className="ghost-link" data-download-fx onClick={() => handleJob('annual')} disabled={isRunning('annual')}>
          {labelFor('annual', `⬇ Annual report (${year}, all properties)`)}
        </button>
        <button className="ghost-link" data-download-fx onClick={() => handleJob('csv')} disabled={isRunning('csv')}>
          {labelFor('csv', `⬇ P&L report (Excel/CSV)${effectivePropertyId ? ' - this property' : ''}`)}
        </button>
        {!isCaretaker && (
          <button className="ghost-link" onClick={() => setShowTaxForm((s) => !s)}>
            {showTaxForm ? 'Cancel' : 'Tax summary for filing…'}
          </button>
        )}
      </div>
      <InfoTip text={<>
        The P&L report includes expected vs. collected rent, expenses, and net income per month - opens directly in Excel or Google Sheets.
      </>} />

      {showTaxForm && !isCaretaker && (
        <div className="annual-report-panel__tax-form">
          <input
            type="text"
            placeholder="KRA PIN (optional, printed on the report)"
            value={kraPin}
            onChange={(e) => setKraPin(e.target.value)}
          />
          <button className="ghost-link" data-download-fx onClick={() => handleJob('tax')} disabled={isRunning('tax')}>
            {labelFor('tax', `⬇ Tax summary (${year})`)}
          </button>
          <InfoTip text={<>
            Reports gross rent collected and logged expenses only - confirm the actual filing figure and rate with KRA or your accountant.
          </>} />
        </div>
      )}

      {firstError && <p className="modal-error">{firstError.error}</p>}
    </div>
  );
}
