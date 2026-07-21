import { useState } from 'react';
import { api, ApiError } from '../api/client.js';
import './AnnualReportPanel.css';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear, currentYear - 1, currentYear - 2];

/**
 * "Once someone has a full year of data" - a portfolio-wide annual
 * PDF (all properties, 12 months) plus a KRA-filing-shaped tax
 * summary, both built on the same year aggregation
 * (annualReport.controller.js). Lives alongside the existing monthly
 * "Download PDF" button on the Financial Statistics tab.
 */
export default function AnnualReportPanel({ token, propertyId }) {
  const effectivePropertyId = propertyId && propertyId !== 'unassigned' ? propertyId : undefined;
  const [year, setYear] = useState(currentYear);
  const [kraPin, setKraPin] = useState('');
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [error, setError] = useState('');

  async function handleAnnualReport() {
    setDownloading('annual');
    setError('');
    try {
      await api.downloadAnnualReportPdf(token, { year, propertyId: effectivePropertyId });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate the annual report.');
    } finally {
      setDownloading('');
    }
  }

  async function handleTaxSummary() {
    setDownloading('tax');
    setError('');
    try {
      await api.downloadTaxSummaryPdf(token, { year, propertyId: effectivePropertyId, kraPin: kraPin.trim() || undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate the tax summary.');
    } finally {
      setDownloading('');
    }
  }

  return (
    <div className="annual-report-panel">
      <div className="annual-report-panel__row">
        <label className="annual-report-panel__year-label">
          Year
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <button className="ghost-link" onClick={handleAnnualReport} disabled={downloading !== ''}>
          {downloading === 'annual' ? 'Preparing…' : `⬇ Annual report (${year}, all properties)`}
        </button>
        <button className="ghost-link" onClick={() => setShowTaxForm((s) => !s)}>
          {showTaxForm ? 'Cancel' : 'Tax summary for filing…'}
        </button>
      </div>

      {showTaxForm && (
        <div className="annual-report-panel__tax-form">
          <input
            type="text"
            placeholder="KRA PIN (optional, printed on the report)"
            value={kraPin}
            onChange={(e) => setKraPin(e.target.value)}
          />
          <button className="ghost-link" onClick={handleTaxSummary} disabled={downloading !== ''}>
            {downloading === 'tax' ? 'Preparing…' : `⬇ Tax summary (${year})`}
          </button>
          <p className="tenant-portal-hint">
            Reports gross rent collected and logged expenses only - confirm the actual filing figure and rate with KRA or your accountant.
          </p>
        </div>
      )}

      {error && <p className="modal-error">{error}</p>}
    </div>
  );
}
