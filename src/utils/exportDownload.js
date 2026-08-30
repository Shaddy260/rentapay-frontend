// src/utils/exportDownload.js
//
// Phase 2 - shared helper for the async export UX: create a job (the
// caller does that), poll GET /api/export-jobs/status/:id until the
// worker finishes, then download the signed Storage URL. Used by
// Settings.jsx, TenantSettings.jsx and PaymentHistoryPanel.jsx so all
// three export surfaces behave identically (preparing -> download ->
// done / failed with a retryable error).

import { api, ApiError } from '../api/client.js';

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 72; // ~3 minutes

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'rentapay-export';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Polls an export job and triggers the browser download when the worker
 * reports completion. Resolves with the final job record; throws an
 * ApiError when the job fails or times out.
 */
export async function pollExportAndDownload(exportJobId, token, { onStatus } = {}) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const res = await api.getExportJobStatus(exportJobId, token);
    if (onStatus) onStatus(res.status);
    if (res.status === 'completed') {
      const download = await api.getExportJobDownload(exportJobId, token);
      triggerDownload(download.downloadUrl, download.file_name);
      return res;
    }
    if (res.status === 'failed') {
      throw new ApiError(res.error_message || 'The export failed. Please try again.', { kind: 'http', status: 500, raw: res });
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new ApiError('This export is taking longer than expected. Check back shortly.', { kind: 'http', status: 408 });
}

export default pollExportAndDownload;
