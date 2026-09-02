import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import './AdminBaPayoutQualificationReport.css';

/**
 * Consolidated Change Instructions - Section F: "Payout Run".
 *
 * Generated for one billing cycle (e.g. "2026-08"), grouped by Brand
 * Ambassador. Per BA: how many onboarded landlords qualify AND paid
 * this cycle, how many don't (visibility only), the rate applied per
 * landlord's payment (can differ within the same BA if a rate changed
 * mid-cycle or a BA override exists), and the resulting commission -
 * plus CSV / combined PDF / per-BA PDF export, same trigger as before
 * (POST .../payout-qualification-reports/generate).
 */
function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function fmtKes(amount) {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminBaPayoutQualificationReport({ token }) {
  const [reports, setReports] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState(null); // 'csv' | 'pdf' | `ba:<id>`
  const [periodKey, setPeriodKey] = useState(currentMonthKey());
  const [expandedBaId, setExpandedBaId] = useState(null);

  const loadReports = useCallback(() => {
    api
      .listBaPayoutQualificationReports(token)
      .then((res) => {
        setReports(res.reports || []);
        if (!selectedId && res.reports && res.reports.length > 0) setSelectedId(res.reports[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load past payout runs.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (!selectedId) {
      setReport(null);
      return;
    }
    setReport(null);
    api
      .getBaPayoutQualificationReport(selectedId, token)
      .then((res) => setReport(res))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load this payout run.'));
  }, [selectedId, token]);

  async function generateReport() {
    setGenerating(true);
    setError('');
    try {
      const res = await api.generateBaPayoutQualificationReport({ periodKey }, token);
      setSelectedId(res.id);
      setReport(res);
      loadReports();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate the payout run.');
    } finally {
      setGenerating(false);
    }
  }

  async function downloadCsv() {
    if (!report) return;
    setDownloadingKey('csv');
    setError('');
    try {
      await api.downloadBaPayoutQualificationReportCsv(report.id, report.periodKey, token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download the CSV.');
    } finally {
      setDownloadingKey(null);
    }
  }

  async function downloadCombinedPdf() {
    if (!report) return;
    setDownloadingKey('pdf');
    setError('');
    try {
      await api.downloadBaPayoutQualificationReportPdf(report.id, report.periodKey, token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download the combined PDF.');
    } finally {
      setDownloadingKey(null);
    }
  }

  async function downloadBaPdf(baId) {
    if (!report) return;
    setDownloadingKey(`ba:${baId}`);
    setError('');
    try {
      await api.downloadBaPayoutQualificationReportBaPdf(report.id, baId, report.periodKey, token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download this Brand Ambassador's PDF.");
    } finally {
      setDownloadingKey(null);
    }
  }

  return (
    <section className="admin-ba-qr">
      <div className="admin-ba-qr__generate-bar">
        <label className="admin-ba-qr__period-label" htmlFor="admin-ba-qr-cycle">
          Billing cycle
        </label>
        <input
          id="admin-ba-qr-cycle"
          type="month"
          value={periodKey}
          onChange={(e) => setPeriodKey(e.target.value)}
          className="admin-ba-qr__period-input"
        />
        <Button onClick={generateReport} disabled={generating || !periodKey}>
          {generating ? 'Generating…' : 'Generate Payout Run'}
        </Button>
      </div>

      {error && <p className="admin-ba-qr__error">{error}</p>}

      <div className="admin-ba-qr__body">
        <aside className="admin-ba-qr__sidebar">
          <h4>Past Payout Runs</h4>
          {!reports && <Skeleton height="60px" />}
          {reports && reports.length === 0 && <p className="admin-ba-qr__empty">No payout runs generated yet.</p>}
          {reports && reports.length > 0 && (
            <ul className="admin-ba-qr__report-list">
              {reports.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`admin-ba-qr__report-btn ${selectedId === r.id ? 'admin-ba-qr__report-btn--active' : ''}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <strong>Cycle {r.periodKey}</strong>
                    <span>{r.totals.qualifying}/{r.totals.landlordsOnboarded} qualifying · {fmtKes(r.totals.amountOwed)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="admin-ba-qr__main">
          {selectedId && !report && !error && <Skeleton height="200px" />}

          {report && (
            <>
              <div className="admin-ba-qr__summary">
                <div className="admin-ba-qr__summary-totals">
                  <div><strong>{report.totals.baCount}</strong> Brand Ambassadors</div>
                  <div><strong>{report.totals.landlordsOnboarded}</strong> onboarded</div>
                  <div className="admin-ba-qr__qualifies"><strong>{report.totals.qualifying}</strong> qualifying &amp; paid</div>
                  <div className="admin-ba-qr__not-qualifies"><strong>{report.totals.notQualifying}</strong> not qualifying</div>
                  <div className="admin-ba-qr__amount-owed"><strong>{fmtKes(report.totals.amountOwed)}</strong> owed</div>
                </div>
                <div className="admin-ba-qr__export-actions">
                  <Button onClick={downloadCsv} data-download-fx disabled={downloadingKey === 'csv'} variant="ghost">
                    {downloadingKey === 'csv' ? 'Downloading…' : 'Download CSV'}
                  </Button>
                  <Button onClick={downloadCombinedPdf} data-download-fx disabled={downloadingKey === 'pdf'}>
                    {downloadingKey === 'pdf' ? 'Downloading…' : 'Download Combined PDF'}
                  </Button>
                </div>
              </div>

              {report.brandAmbassadors.length === 0 && <p className="admin-ba-qr__empty">No onboarded landlords for this cycle.</p>}

              {report.brandAmbassadors.map((ba) => {
                const isExpanded = expandedBaId === ba.baId;
                const busyKey = `ba:${ba.baId}`;
                return (
                  <div key={ba.baId} className="admin-ba-qr__ba-block">
                    <div className="admin-ba-qr__ba-row" onClick={() => setExpandedBaId(isExpanded ? null : ba.baId)}>
                      <div>
                        <strong>{ba.baName}</strong> {ba.baCode && <span className="admin-ba-qr__code">({ba.baCode})</span>}
                        <div className="admin-ba-qr__ba-stats">
                          {ba.totalLandlordsOnboarded} onboarded · <span className="admin-ba-qr__qualifies">{ba.qualifyingLandlordsWithPayment} qualifying</span> · <span className="admin-ba-qr__not-qualifies">{ba.notQualifyingLandlords} not qualifying</span> · <strong>{fmtKes(ba.totalOwed)}</strong> owed
                        </div>
                      </div>
                      <Button
                        onClick={(e) => { e.stopPropagation(); downloadBaPdf(ba.baId); }}
                        data-download-fx
                        disabled={downloadingKey === busyKey}
                        variant="ghost"
                      >
                        {downloadingKey === busyKey ? 'Downloading…' : 'PDF'}
                      </Button>
                    </div>
                    {isExpanded && (
                      <ul className="admin-ba-qr__landlords">
                        {ba.landlords.map((l) => (
                          <li key={l.landlordId} className={`admin-ba-qr__landlord admin-ba-qr__landlord--${l.qualifiesThisCycle ? 'qualifies' : 'not-qualifies'}`}>
                            <span className="admin-ba-qr__landlord-name">{l.name}</span>
                            <span className="admin-ba-qr__landlord-phone">{l.maskedPhone}</span>
                            <span className="admin-ba-qr__landlord-rate">{l.percentageApplied != null ? `${l.percentageApplied}%` : '-'}</span>
                            <span className="admin-ba-qr__landlord-amount">{l.paymentAmount ? fmtKes(l.paymentAmount) : '-'}</span>
                            <span className="admin-ba-qr__landlord-commission">{l.commissionAmount ? fmtKes(l.commissionAmount) : '-'}</span>
                            <span className="admin-ba-qr__landlord-status">{l.qualifiesThisCycle ? (l.commissionAmount ? 'Paid out' : 'Qualifying · no payment this cycle') : (l.reason || 'Not qualifying')}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
