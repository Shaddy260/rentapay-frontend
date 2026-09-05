// src/hooks/useJobPolling.js
//
// Phase 2 - polls an export job until it reaches a terminal state
// (completed/failed/timeout). Returns { status, job, error, start,
// reset }. `start(exportJobId)` kicks off polling; status flows through
// 'queued' -> 'processing' -> 'completed' | 'failed'.

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api/client.js';

const DEFAULT_INTERVAL_MS = 2500;
const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000;

export default function useJobPolling({ token, intervalMs = DEFAULT_INTERVAL_MS, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const [exportJobId, setExportJobId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | queued | processing | completed | failed | timeout
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const timerRef = useRef(null);
  const deadlineRef = useRef(0);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (id) => {
      stop();
      setExportJobId(id);
      setStatus('queued');
      setError('');
      deadlineRef.current = Date.now() + timeoutMs;
    },
    [stop, timeoutMs]
  );

  const reset = useCallback(() => {
    stop();
    setExportJobId(null);
    setStatus('idle');
    setJob(null);
    setError('');
  }, [stop]);

  useEffect(() => {
    if (!exportJobId) return undefined;
    let disposed = false;

    async function poll() {
      try {
        const res = await api.getExportJobStatus(exportJobId, token);
        if (disposed) return;
        setJob(res);
        setStatus(res.status);
        if (res.status === 'completed' || res.status === 'failed') {
          if (res.status === 'failed') setError(res.error_message || 'The export failed. Please try again.');
          return; // terminal - stop polling
        }
      } catch (err) {
        if (disposed) return;
        setError(err instanceof Error ? err.message : 'Could not check the export status.');
        return;
      }
      if (Date.now() > deadlineRef.current) {
        setStatus('timeout');
        setError('This export is taking longer than expected. Check back shortly.');
        return;
      }
      timerRef.current = setTimeout(poll, intervalMs);
    }

    timerRef.current = setTimeout(poll, 400);
    return () => {
      disposed = true;
      stop();
    };
  }, [exportJobId, token, intervalMs, stop]);

  useEffect(() => () => stop(), [stop]);

  return { exportJobId, status, job, error, start, stop, reset };
}
