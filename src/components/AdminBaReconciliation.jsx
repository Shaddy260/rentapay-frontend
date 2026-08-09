import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import './AdminBaReconciliation.css';

/**
 * BUILD SPEC PHASE 11 - Part B: Reconciliation ("compare the list the
 * BA sent me"). Pick a BA and a date, paste text into a textarea,
 * submit, see the three result buckets clearly separated with counts.
 *
 * prefillBaId/prefillDate let Part C's security report jump straight
 * into this tool for a specific BA/date (see AdminBaSecurityReport.jsx's
 * "review" links).
 */
export default function AdminBaReconciliation({ token, prefill, onPrefillConsumed }) {
  const [roster, setRoster] = useState(null);
  const [baId, setBaId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pastedText, setPastedText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .listBrandAmbassadors('', token)
      .then((res) => setRoster(res.brandAmbassadors || []))
      .catch(() => setRoster([]));
  }, [token]);

  useEffect(() => {
    if (prefill?.baId) {
      setBaId(prefill.baId);
      if (prefill.date) setDate(prefill.date);
      onPrefillConsumed?.();
    }
  }, [prefill, onPrefillConsumed]);

  const submit = useCallback(
    async (e) => {
      e?.preventDefault();
      if (!baId || !date || !pastedText.trim()) {
        setError('Pick a Brand Ambassador, a date, and paste in the list first.');
        return;
      }
      setLoading(true);
      setError('');
      setResult(null);
      try {
        const res = await api.reconcileBaList({ baId, date, pastedText }, token);
        setResult(res);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to reconcile this list.');
      } finally {
        setLoading(false);
      }
    },
    [baId, date, pastedText, token]
  );

  return (
    <section className="admin-ba-reconcile">
      <form className="admin-ba-reconcile__form" onSubmit={submit}>
        <label>
          Brand Ambassador
          <select value={baId} onChange={(e) => setBaId(e.target.value)}>
            <option value="">Select…</option>
            {(roster || []).map((ba) => (
              <option key={ba.id} value={ba.id}>
                {ba.full_name} ({ba.ba_code})
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="admin-ba-reconcile__textarea-label">
          Paste the BA's list (one name/number per line, any format)
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={8}
            placeholder={'e.g.\nJohn Mwangi 0712345678\nMary Wanjiru - 0723 456 789'}
          />
        </label>
        {error && <p className="admin-ba-reconcile__error">{error}</p>}
        <Button type="submit" loading={loading}>
          Compare
        </Button>
      </form>

      {result && (
        <div className="admin-ba-reconcile__results">
          <div className="admin-ba-reconcile__summary">
            <span>Pasted: {result.counts.totalPasted}</span>
            <span>Matched: {result.counts.matched}</span>
            <span>Missing: {result.counts.missing}</span>
            <span>Edited: {result.counts.edited}</span>
          </div>

          <div className="admin-ba-reconcile__bucket">
            <h3>Matched in system ({result.counts.matched})</h3>
            {result.matchedInSystem.length === 0 && <p className="admin-ba-reconcile__empty">None.</p>}
            <ul>
              {result.matchedInSystem.map((m, i) => (
                <li key={m.claim.id || i}>
                  {m.pasted.name || m.pasted.raw} — matches claim for {m.claim.submitted_name} ({m.claim.submitted_phone})
                </li>
              ))}
            </ul>
          </div>

          <div className="admin-ba-reconcile__bucket admin-ba-reconcile__bucket--flagged">
            <h3>Claimed but missing from system ({result.counts.missing})</h3>
            <p className="admin-ba-reconcile__hint">Potential inflation — these appear in the pasted list with no corresponding claim.</p>
            {result.claimedButMissingFromSystem.length === 0 && <p className="admin-ba-reconcile__empty">None.</p>}
            <ul>
              {result.claimedButMissingFromSystem.map((e, i) => (
                <li key={i}>{e.name ? `${e.name} — ${e.phoneRaw || 'no phone found'}` : e.raw}</li>
              ))}
            </ul>
          </div>

          <div className="admin-ba-reconcile__bucket admin-ba-reconcile__bucket--flagged">
            <h3>Edited after submission ({result.counts.edited})</h3>
            <p className="admin-ba-reconcile__hint">Name or phone number was changed after the claim was first logged — worth a manual look.</p>
            {result.editedAfterSubmission.length === 0 && <p className="admin-ba-reconcile__empty">None.</p>}
            <ul>
              {result.editedAfterSubmission.map((c) => (
                <li key={c.id}>
                  {c.submitted_name} ({c.submitted_phone}) — {c.edit_history.length} edit{c.edit_history.length === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
