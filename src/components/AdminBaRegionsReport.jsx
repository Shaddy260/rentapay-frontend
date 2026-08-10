import { useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import './AdminBaRegionsReport.css';

/**
 * BA Regions & Payout Qualification Report.
 *
 * Admin taps "Generate report" (typically right after running a BA
 * payout) and gets a snapshot, grouped by region/county then by Brand
 * Ambassador, of every landlord that BA has onboarded - split into
 * "qualifies for payment" (green) and "doesn't qualify" (red) so the
 * whole thing can be downloaded and dropped into a WhatsApp group for
 * the team to see at a glance. Landlord phone numbers are masked
 * (middle 3 digits starred, e.g. 254712***678) since this leaves the
 * app as a shareable file - masking happens server-side in the report
 * response itself, not just visually here.
 *
 * The report is a point-in-time snapshot, not a live view: generating
 * a new one doesn't change any BA's actual qualification status, it
 * just records what qualification currently looks like. Past reports
 * stay listed so admin can pull up "the one sent last month".
 */
function todayIsoMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminBaRegionsReport({ token }) {
  const [periodKey, setPeriodKey] = useState(todayIsoMonth());
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [report, setReport] = useState(null);
  const [pastReports, setPastReports] = useState(null);
  const [error, setError] = useState('');
  const [collapsedRegions, setCollapsedRegions] = useState({});

  function loadPastReports() {
    api
      .listBaPayoutQualificationReports(token)
      .then((res) => setPastReports(res.reports || []))
      .catch(() => setPastReports([]));
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const res = await api.generateBaPayoutQualificationReport({ periodType: 'month', periodKey }, token);
      setReport(res);
      setCollapsedRegions({});
      loadPastReports();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate the report.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleOpenPast(reportId) {
    setError('');
    try {
      const res = await api.getBaPayoutQualificationReport(reportId, token);
      setReport(res);
      setCollapsedRegions({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load that report.');
    }
  }

  async function handleDownloadCsv() {
    if (!report) return;
    setDownloading(true);
    setError('');
    try {
      await api.downloadBaPayoutQualificationReportCsv(report.id, token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download the report.');
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function toggleRegion(region) {
    setCollapsedRegions((prev) => ({ ...prev, [region]: !prev[region] }));
  }

  return (
    <section className="admin-section">
      <div className="ba-regions-report__header ba-regions-report__no-print">
        <div>
          <h2>BA Regions &amp; Payout Qualification Report</h2>
          <p className="ba-regions-report__hint">
            Generate a snapshot of every BA's onboarded landlords by region, split into who qualifies for payment and who doesn't - color coded so it's easy to scan when downloaded and shared with
            the team. Phone numbers are masked automatically. Run this after a payout so the report reflects that run.
          </p>
        </div>
      </div>

      <div className="ba-regions-report__header ba-regions-report__no-print">
        <label>
          Period
          <br />
          <input type="month" className="admin-search-input" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} />
        </label>
        <div className="ba-regions-report__actions">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate report'}
          </Button>
          <button type="button" className="ghost-link" onClick={() => { if (pastReports === null) loadPastReports(); }}>
            {pastReports === null ? 'Show past reports' : 'Refresh past reports'}
          </button>
          {report && (
            <>
              <Button variant="ghost" onClick={handleDownloadCsv} disabled={downloading}>
                {downloading ? 'Preparing…' : 'Download CSV'}
              </Button>
              <Button variant="ghost" onClick={handlePrint}>Download / Share as PDF</Button>
            </>
          )}
        </div>
      </div>

      {error && <p className="ba-regions-report__error">{error}</p>}

      {pastReports !== null && (
        <div className="ba-regions-report__no-print" style={{ marginBottom: 16 }}>
          {pastReports.length === 0 ? (
            <p className="admin-section__hint">No reports generated yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {pastReports.map((r) => (
                <li key={r.id} style={{ marginBottom: 4 }}>
                  <button type="button" className="ghost-link" onClick={() => handleOpenPast(r.id)}>
                    {r.periodKey} — generated {formatDateTime(r.generatedAt)} by {r.generatedByAdminName || 'admin'} ({r.totals?.landlordsOnboarded ?? 0} landlords)
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {generating && <Skeleton rows={6} />}

      {report && (
        <div className="ba-regions-report__print-area">
          <p className="ba-regions-report__meta">
            Period: <strong>{report.periodKey}</strong> · Generated {formatDateTime(report.generatedAt)} by {report.generatedByAdminName || 'admin'} · Report #{report.id}
          </p>

          <div className="ba-regions-report__totals">
            <div className="ba-regions-report__total-card">
              <span className="ba-regions-report__total-value">{report.totals?.regionCount ?? report.regions?.length ?? 0}</span>
              <span className="ba-regions-report__total-label">Regions</span>
            </div>
            <div className="ba-regions-report__total-card">
              <span className="ba-regions-report__total-value">{report.totals?.baCount ?? 0}</span>
              <span className="ba-regions-report__total-label">Brand Ambassadors</span>
            </div>
            <div className="ba-regions-report__total-card">
              <span className="ba-regions-report__total-value">{report.totals?.landlordsOnboarded ?? 0}</span>
              <span className="ba-regions-report__total-label">Landlords onboarded</span>
            </div>
            <div className="ba-regions-report__total-card ba-regions-report__total-card--qualify">
              <span className="ba-regions-report__total-value">{report.totals?.qualifying ?? 0}</span>
              <span className="ba-regions-report__total-label">Qualify for payment</span>
            </div>
            <div className="ba-regions-report__total-card ba-regions-report__total-card--not-qualify">
              <span className="ba-regions-report__total-value">{report.totals?.notQualifying ?? 0}</span>
              <span className="ba-regions-report__total-label">Don't qualify</span>
            </div>
          </div>

          {(report.regions || []).length === 0 && <p className="admin-section__hint">No BA-onboarded landlords found for this period.</p>}

          {(report.regions || []).map((region) => {
            const isCollapsed = collapsedRegions[region.region];
            return (
              <div className="ba-regions-report__region" key={region.region}>
                <button type="button" className="ba-regions-report__region-header" onClick={() => toggleRegion(region.region)}>
                  <span className="ba-regions-report__region-title">{region.region || 'Unspecified region'}</span>
                  <span className="ba-regions-report__pill">{region.baCount} BA{region.baCount === 1 ? '' : 's'}</span>
                  <span className="ba-regions-report__pill">{region.landlordsOnboarded} onboarded</span>
                  <span className="ba-regions-report__pill ba-regions-report__pill--qualify">{region.qualifying} qualify</span>
                  <span className="ba-regions-report__pill ba-regions-report__pill--not-qualify">{region.notQualifying} not qualifying</span>
                </button>

                {!isCollapsed && (
                  <div className="ba-regions-report__region-body">
                    {(region.brandAmbassadors || []).map((ba) => (
                      <div className="ba-regions-report__ba-block" key={ba.baId}>
                        <p className="ba-regions-report__ba-title">
                          {ba.baName} {ba.baCode ? `(${ba.baCode})` : ''} — {ba.landlordsOnboarded} onboarded, {ba.qualifying} qualify, {ba.notQualifying} don't
                        </p>
                        <table className="ba-regions-report__table">
                          <thead>
                            <tr>
                              <th>Landlord</th>
                              <th>Phone</th>
                              <th>County</th>
                              <th>Onboarded</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(ba.landlords || []).map((l) => (
                              <tr key={l.landlordId} className={l.qualifies ? 'ba-regions-report__row--qualify' : 'ba-regions-report__row--not-qualify'}>
                                <td>{l.name}</td>
                                <td>{l.maskedPhone}</td>
                                <td>{l.county || '—'}</td>
                                <td>{formatDateTime(l.onboardedAt)}</td>
                                <td>
                                  <span className="ba-regions-report__status-badge">{l.qualifies ? 'QUALIFIES' : `NOT QUALIFYING${l.reason ? ` — ${l.reason}` : ''}`}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
