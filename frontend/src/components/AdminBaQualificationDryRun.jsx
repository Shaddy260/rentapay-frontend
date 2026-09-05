import { useState } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import './AdminBaQualificationDryRun.css';
import InfoTip from './InfoTip.jsx';

/**
 * BUILD SPEC PHASE 19 - Qualification Job Dry-Run Mode.
 *
 * Admin-triggered manual run of the Phase 10 qualification job in
 * dry-run mode - runs the exact same lookup/eligibility logic as the
 * live scheduled job but writes nothing, so admin can sanity-check a
 * full cycle against real data (especially right after a payout
 * rate/tier change) before the next real run executes. Lives next to
 * BA Payout Review since this app doesn't have a separate Payout
 * Rules screen yet.
 */
export default function AdminBaQualificationDryRun({ token }) {
  const [running, setRunning] = useState(false);
  const [runningLive, setRunningLive] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState(null);
  const [liveResult, setLiveResult] = useState(null);
  const [error, setError] = useState('');

  async function handleRun() {
    setRunning(true);
    setError('');
    try {
      const res = await api.runQualificationDryRun(token);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to run the dry-run.');
    } finally {
      setRunning(false);
    }
  }

  // FIX: landlords can get stuck showing "Pending"/"0 qualifying" in a
  // BA's dashboard until the nightly cron (00:05) catches up - this
  // triggers the SAME check for real, right now, so a BA doesn't have
  // to wait until the next scheduled run to see already-paid
  // landlords qualify (and any commission that was missed backfilled).
  async function handleRunLive() {
    setRunningLive(true);
    setError('');
    setLiveResult(null);
    try {
      const res = await api.runQualificationNow(token);
      setLiveResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to run the qualification check.');
    } finally {
      setRunningLive(false);
    }
  }

  async function handleDownloadCsv() {
    setDownloading(true);
    setError('');
    try {
      await api.downloadQualificationDryRunCsv(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download the dry-run report.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="admin-ba-dry-run">
      <div className="admin-ba-dry-run__header">
        <div>
          <h3>Qualification dry-run</h3>
          <InfoTip text={<>
            Runs the qualification check against real data - nothing is written, no BA is notified. Use this right after changing payout rates or commission tiers to see what
            WOULD happen on the next real run.
          </>} />
        </div>
        <div className="admin-ba-dry-run__actions">
          <Button onClick={handleRun} disabled={running}>
            {running ? 'Running…' : 'Run dry-run now'}
          </Button>
          <Button onClick={handleRunLive} disabled={runningLive} variant="mpesa">
            {runningLive ? 'Running…' : 'Run now (live)'}
          </Button>
          {result && (
            <Button onClick={handleDownloadCsv} data-download-fx variant="ghost" disabled={downloading}>
              {downloading ? 'Preparing…' : 'Download CSV'}
            </Button>
          )}
        </div>
      </div>

      {error && <p className="admin-ba-dry-run__error">{error}</p>}

      {liveResult && (
        <div className="admin-ba-dry-run__summary">
          <div>
            <span className="admin-ba-dry-run__summary-value">{liveResult.checked}</span>
            <span className="admin-ba-dry-run__summary-label">Pending landlords checked</span>
          </div>
          <div>
            <span className="admin-ba-dry-run__summary-value">{liveResult.qualified}</span>
            <span className="admin-ba-dry-run__summary-label">Qualified just now</span>
          </div>
          <div>
            <span className="admin-ba-dry-run__summary-value">{liveResult.skippedInactiveBa}</span>
            <span className="admin-ba-dry-run__summary-label">Skipped (inactive BA)</span>
          </div>
        </div>
      )}

      {result && (
        <>
          <div className="admin-ba-dry-run__summary">
            <div>
              <span className="admin-ba-dry-run__summary-value">{result.checked}</span>
              <span className="admin-ba-dry-run__summary-label">Pending landlords checked</span>
            </div>
            <div>
              <span className="admin-ba-dry-run__summary-value">{result.qualified}</span>
              <span className="admin-ba-dry-run__summary-label">Would qualify</span>
            </div>
            <div>
              <span className="admin-ba-dry-run__summary-value">{result.skippedInactiveBa}</span>
              <span className="admin-ba-dry-run__summary-label">Skipped (inactive BA)</span>
            </div>
          </div>

          <div className="admin-ba-dry-run__table-scroll">
          <table className="admin-ba-dry-run__table">
            <thead>
              <tr>
                <th>BA</th>
                <th>Landlord</th>
              </tr>
            </thead>
            <tbody>
              {(result.report || []).length === 0 && (
                <tr>
                  <td colSpan={2}>Nothing would qualify right now.</td>
                </tr>
              )}
              {(result.report || []).map((r) => (
                <tr key={r.landlordId}>
                  <td>{r.baName} {r.baCode ? `(${r.baCode})` : ''}</td>
                  <td>{r.landlordName}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  );
}
