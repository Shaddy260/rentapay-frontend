import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client.js';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';
import './AdminLoyaltyDiscounts.css';

/**
 * Detects landlords whose subscription has run for consecutive
 * months without a gap (default: at least 4), and lets an admin
 * bulk-grant them a discount percentage. A granted discount is stored
 * per landlord and applied automatically the next time their
 * subscription is charged (renewal, add-units, etc.) - no further
 * admin action needed. See landlordLoyalty.service.js on the backend.
 */
export default function AdminLoyaltyDiscounts({ token, readOnly = false, onGrantRequest, onRevokeRequest }) {
  const [minMonths, setMinMonths] = useState(4);
  const [candidates, setCandidates] = useState(null);
  const [candidatesError, setCandidatesError] = useState('');

  const [active, setActive] = useState(null);
  const [activeError, setActiveError] = useState('');

  const [selected, setSelected] = useState(() => new Set());
  const [discountPercent, setDiscountPercent] = useState('');
  const [expiryDays, setExpiryDays] = useState('30');
  const [note, setNote] = useState('');

  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState('');
  const [grantResult, setGrantResult] = useState(null);

  const [revokingId, setRevokingId] = useState(null);

  // P4: full audit trail - active + consumed + revoked + expired, not
  // just what's currently usable. Loaded on-demand (admin taps "Show
  // history") rather than on mount, since this table can grow large
  // and isn't needed for the day-to-day grant/revoke workflow above.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');

  const loadHistory = useCallback(() => {
    setHistory(null);
    setHistoryError('');
    api
      .getLoyaltyDiscountHistory(null, token)
      .then((res) => setHistory(res.history || []))
      .catch((err) => setHistoryError(err instanceof ApiError ? err.message : 'Failed to load discount history.'));
  }, [token]);

  useEffect(() => { if (historyOpen) loadHistory(); }, [historyOpen, loadHistory]);

  const filteredHistory = (history || []).filter((h) => historyStatusFilter === 'all' || h.status === historyStatusFilter);

  const HISTORY_STATUS_LABELS = { active: 'Active', consumed: 'Consumed', revoked: 'Revoked', expired: 'Expired', inactive: 'Inactive' };
  const CONSUMED_BY_LABELS = { subscription_payment: 'M-Pesa renewal', manual_payment: 'Manual payment', property_payment: 'Property purchase/renewal' };

  const loadCandidates = useCallback(() => {
    // Skip while the "minimum consecutive months" field is mid-edit
    // (briefly empty as the user clears it to type a new value) -
    // firing a request with '' would error and flash the error state.
    if (minMonths === '') return;
    setCandidates(null);
    setCandidatesError('');
    setSelected(new Set());
    api
      .getLoyaltyDiscountCandidates(minMonths, token)
      .then((res) => setCandidates(res.candidates || []))
      .catch((err) => setCandidatesError(err instanceof ApiError ? err.message : 'Failed to load candidates.'));
  }, [minMonths, token]);

  const loadActive = useCallback(() => {
    setActive(null);
    setActiveError('');
    api
      .getActiveLoyaltyDiscounts(token)
      .then((res) => setActive(res.discounts || []))
      .catch((err) => setActiveError(err instanceof ApiError ? err.message : 'Failed to load active discounts.'));
  }, [token]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);
  useEffect(() => { loadActive(); }, [loadActive]);

  function toggleOne(landlordId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(landlordId)) next.delete(landlordId);
      else next.add(landlordId);
      return next;
    });
  }

  function toggleAll() {
    if (!candidates) return;
    setSelected((prev) => (prev.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.landlordId))));
  }

  async function grant() {
    setGranting(true);
    setGrantError('');
    setGrantResult(null);
    try {
      const pct = Number(discountPercent);
      if (discountPercent === '' || Number.isNaN(pct) || pct < 0 || pct > 100) {
        setGrantError('Enter a discount percentage between 0 and 100.');
        setGranting(false);
        return;
      }
      if (selected.size === 0) {
        setGrantError('Select at least one landlord.');
        setGranting(false);
        return;
      }
      let expiryDaysNum;
      if (expiryDays !== '') {
        expiryDaysNum = Number(expiryDays);
        if (Number.isNaN(expiryDaysNum) || expiryDaysNum < 1) {
          setGrantError('Expiry (days) must be a whole number, 1 or more.');
          setGranting(false);
          return;
        }
      }
      const payload = { landlordIds: Array.from(selected), discountPercentage: pct, note: note || undefined, expiryDays: expiryDaysNum };
      // GM dashboard passes onGrantRequest so this routes through its
      // Operations PIN + reason confirmation modal instead of calling
      // the API directly - admin usage (no prop passed) is unchanged.
      const res = onGrantRequest ? await onGrantRequest(payload) : await api.bulkGrantLoyaltyDiscount(payload, token);
      setGrantResult(res);
      setDiscountPercent('');
      setExpiryDays('30');
      setNote('');
      loadCandidates();
      loadActive();
      if (historyOpen) loadHistory();
    } catch (err) {
      setGrantError(err instanceof ApiError ? err.message : 'Failed to grant the discount.');
    } finally {
      setGranting(false);
    }
  }

  async function revoke(landlordId) {
    setRevokingId(landlordId);
    try {
      if (onRevokeRequest) await onRevokeRequest(landlordId);
      else await api.revokeLoyaltyDiscount(landlordId, token);
      loadActive();
      loadCandidates();
      if (historyOpen) loadHistory();
    } catch (err) {
      setActiveError(err instanceof ApiError ? err.message : 'Failed to revoke the discount.');
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="admin-loyalty">
      <InfoTip text={<>
        Landlords who've paid for consecutive subscription periods without a gap show up below once they hit the
        threshold. Select who to reward, set a discount %, and it's applied automatically on that landlord's next
        subscription charge — no need to remember or re-apply it later.
      </>} />

      <section className="admin-loyalty__card">
        <h3>Consecutive-subscription candidates</h3>
        <div className="admin-loyalty__threshold-row">
          <label>
            Minimum consecutive months
            <input
              type="number"
              min="1"
              value={minMonths}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  // Let the field go empty while typing instead of
                  // snapping back to 1, which previously made the old
                  // digit stick around (e.g. clearing "1" then typing
                  // "2" produced "12" instead of "2").
                  setMinMonths('');
                  return;
                }
                const parsed = Number(raw);
                if (!Number.isNaN(parsed)) setMinMonths(parsed);
              }}
              onBlur={() => {
                // Only fall back to the default once the user is done
                // editing, not on every keystroke.
                if (minMonths === '' || minMonths < 1) setMinMonths(1);
              }}
            />
          </label>
          <Button variant="ghost" onClick={loadCandidates}>Refresh</Button>
        </div>

        {candidatesError && <p className="admin-loyalty__error">{candidatesError}</p>}

        {!candidates ? (
          <Skeleton rows={3} />
        ) : candidates.length === 0 ? (
          <p className="admin-loyalty__meta">No landlords currently meet this threshold.</p>
        ) : (
          <>
            <div className="admin-loyalty__table-scroll">
            <table className="admin-loyalty__table">
              <thead>
                <tr>
                  <th>
                    {!readOnly && <input type="checkbox" checked={selected.size === candidates.length} onChange={toggleAll} />}
                  </th>
                  <th>Landlord</th>
                  <th>Consecutive months</th>
                  <th>Already has a discount</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.landlordId}>
                    <td>
                      {!readOnly && (
                        <input
                          type="checkbox"
                          checked={selected.has(c.landlordId)}
                          onChange={() => toggleOne(c.landlordId)}
                        />
                      )}
                    </td>
                    <td>
                      {c.fullName}
                      <div className="admin-loyalty__sub">{c.email || c.phone}</div>
                    </td>
                    <td>{c.consecutiveMonths}</td>
                    <td>{c.alreadyHasDiscount ? 'Yes (streak grew — eligible again)' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {!readOnly && (
              <>
                <div className="admin-loyalty__form-row">
                  <label>
                    Discount %
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      placeholder="e.g. 10"
                    />
                  </label>
                  <label>
                    Note (optional)
                    <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Loyalty reward Q3" />
                  </label>
                  <label>
                    Expires after (days)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={expiryDays}
                      onChange={(e) => setExpiryDays(e.target.value)}
                      placeholder="30"
                    />
                  </label>
                </div>
                {grantError && <p className="admin-loyalty__error">{grantError}</p>}
                {grantResult && (
                  <p className="admin-loyalty__success">
                    Granted to {grantResult.granted.length} landlord{grantResult.granted.length === 1 ? '' : 's'}
                    {grantResult.errors.length > 0 ? `, ${grantResult.errors.length} failed` : ''}.
                  </p>
                )}
                <div className="admin-loyalty__actions">
                  <Button onClick={grant} loading={granting}>
                    Apply Bulk Discount to {selected.size} Selected
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </section>

      <section className="admin-loyalty__card">
        <h3>Active loyalty discounts</h3>
        {activeError && <p className="admin-loyalty__error">{activeError}</p>}
        {!active ? (
          <Skeleton rows={3} />
        ) : active.length === 0 ? (
          <p className="admin-loyalty__meta">No landlord currently has an active loyalty discount.</p>
        ) : (
          <div className="admin-loyalty__table-scroll">
          <table className="admin-loyalty__table">
            <thead>
              <tr>
                <th>Landlord</th>
                <th>Discount</th>
                <th>Streak at grant</th>
                <th>Granted</th>
                <th>Expires</th>
                {!readOnly && <th />}
              </tr>
            </thead>
            <tbody>
              {active.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.landlords?.full_name || d.landlord_id}
                    <div className="admin-loyalty__sub">{d.landlords?.email || d.landlords?.phone}</div>
                  </td>
                  <td>{Number(d.discount_percentage)}%</td>
                  <td>{d.consecutive_months_at_grant} mo</td>
                  <td>{new Date(d.granted_at).toLocaleDateString('en-GB')}</td>
                  <td>{d.expires_at ? new Date(d.expires_at).toLocaleDateString('en-GB') : 'Never'}</td>
                  {!readOnly && (
                    <td>
                      <Button variant="ghost" onClick={() => revoke(d.landlord_id)} loading={revokingId === d.landlord_id}>
                        Revoke
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <section className="admin-loyalty__card">
        <div className="admin-loyalty__threshold-row">
          <h3>Discount history</h3>
          <Button variant="ghost" onClick={() => (historyOpen ? loadHistory() : setHistoryOpen(true))}>
            {historyOpen ? 'Refresh' : 'Show history'}
          </Button>
        </div>
        <InfoTip text={<>
          Every grant this landlord base has ever received — active, consumed, revoked, or lapsed unused — including
          which payment consumed it and whether the reminder popup is currently snoozed.
        </>} />

        {historyOpen && (
          <>
            <div className="admin-loyalty__threshold-row">
              <label>
                Status
                <select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="consumed">Consumed</option>
                  <option value="revoked">Revoked</option>
                  <option value="expired">Expired</option>
                </select>
              </label>
            </div>

            {historyError && <p className="admin-loyalty__error">{historyError}</p>}

            {!history ? (
              <Skeleton rows={4} />
            ) : filteredHistory.length === 0 ? (
              <p className="admin-loyalty__meta">No discount grants match this filter.</p>
            ) : (
              <div className="admin-loyalty__table-scroll">
              <table className="admin-loyalty__table">
                <thead>
                  <tr>
                    <th>Landlord</th>
                    <th>Discount</th>
                    <th>Status</th>
                    <th>Granted</th>
                    <th>Consumed / Revoked</th>
                    <th>Reminder</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((h) => (
                    <tr key={h.id}>
                      <td>
                        {h.landlord?.full_name || h.landlordId}
                        <div className="admin-loyalty__sub">{h.landlord?.email || h.landlord?.phone}</div>
                      </td>
                      <td>{h.discountPercentage}%</td>
                      <td>
                        <span className={`admin-loyalty__status-badge admin-loyalty__status-badge--${h.status}`}>
                          {HISTORY_STATUS_LABELS[h.status] || h.status}
                        </span>
                      </td>
                      <td>{new Date(h.grantedAt).toLocaleDateString('en-GB')}{h.note ? <div className="admin-loyalty__sub">{h.note}</div> : null}</td>
                      <td>
                        {h.status === 'consumed' && (
                          <>
                            {new Date(h.consumedAt).toLocaleDateString('en-GB')}
                            <div className="admin-loyalty__sub">{CONSUMED_BY_LABELS[h.consumedByType] || 'Unknown'} · {h.consumedByPaymentId}</div>
                          </>
                        )}
                        {h.status === 'revoked' && new Date(h.revokedAt).toLocaleDateString('en-GB')}
                        {h.status === 'active' && (h.expiresAt ? `Expires ${new Date(h.expiresAt).toLocaleDateString('en-GB')}` : 'No expiry')}
                        {h.status === 'expired' && h.expiresAt && `Lapsed ${new Date(h.expiresAt).toLocaleDateString('en-GB')}`}
                      </td>
                      <td>
                        {h.status === 'active'
                          ? (h.currentlySnoozed
                            ? `Snoozed until ${new Date(h.reminderSnoozedUntil).toLocaleString('en-GB')}`
                            : 'Not snoozed')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
