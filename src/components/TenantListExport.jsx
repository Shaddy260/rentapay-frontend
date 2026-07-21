import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api, ApiError } from '../api/client.js';
import TenantContactCard from './TenantContactCard.jsx';
import './TenantListExport.css';

const LIST_TABS = [
  { key: 'current', label: 'Current tenants' },
  { key: 'joined', label: 'Joined this month' },
  { key: 'left', label: 'Left this month' },
  { key: 'left_all', label: 'Left (all time)' },
];

function monthLabel(year, month) {
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/**
 * Per-apartment tenant list with a Download tab (Excel) and a "Message
 * selected" tab (direct, tracked SMS - replaces the old "Add to
 * WhatsApp Group" feature, which just dumped numbers into a
 * third-party group chat with no record of what was sent), plus
 * who-joined / who-left views. Every row is unit-specific to the
 * selected apartment and expands on tap into the same
 * TenantContactCard used elsewhere, showing the tenant's photo and
 * full contact details.
 *
 * An archived/removed tenant (tenant.controller.js deleteTenant, which
 * now also stamps left_at) shows up on the "Left" lists automatically
 * - there's no separate "mark as left" step.
 */
export default function TenantListExport({ token, propertyId, propertyName }) {
  const now = new Date();
  const [listType, setListType] = useState('current');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    setError('');
    setNotice('');
    const params = { propertyId, listType };
    if (listType === 'joined' || listType === 'left') Object.assign(params, { year, month });
    api
      .listTenantsForExport(params, token)
      .then((res) => {
        setTenants(res.tenants || []);
        setSelected(new Set());
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load tenant list.'))
      .finally(() => setLoading(false));
  }, [token, propertyId, listType, year, month]);

  function toggleSelected(id) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((s) => (s.size === tenants.length ? new Set() : new Set(tenants.map((t) => t.id))));
  }

  function handleDownload() {
    const rows = tenants.map((t) => ({
      'Full Name': t.fullName,
      Unit: t.unitName,
      Phone: t.phone,
      'Alt. Phone': t.secondaryPhone,
      Email: t.email,
      'ID Number': t.idNumber,
      'Emergency Contact': t.emergencyContactName,
      'Emergency Phone': t.emergencyContactPhone,
      'Move-in Date': t.moveInDate || '',
      'Left Date': t.leftAt ? t.leftAt.slice(0, 10) : '',
      Status: t.isActive ? 'Active' : 'Left',
      'Profile Photo': t.photoUrl || '',
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [
      { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 24 },
      { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 40 },
    ];
    const workbook = XLSX.utils.book_new();
    const tabLabel = LIST_TABS.find((t) => t.key === listType)?.label || 'Tenants';
    XLSX.utils.book_append_sheet(workbook, sheet, tabLabel.slice(0, 31));
    const filenamePart = listType === 'joined' || listType === 'left' ? `-${year}-${String(month).padStart(2, '0')}` : '';
    XLSX.writeFile(workbook, `${(propertyName || 'apartment').replace(/[^a-z0-9]+/gi, '-')}-${listType}${filenamePart}.xlsx`);
  }

  async function handleSendMessage() {
    if (!messageText.trim()) {
      setError('Enter a message to send.');
      return;
    }
    const tenantIds = selected.size > 0 ? Array.from(selected) : tenants.map((t) => t.id);
    if (tenantIds.length === 0) return;
    setSendingMessage(true);
    setError('');
    setNotice('');
    try {
      const res = await api.sendBulkSmsToSelected({ propertyId, tenantIds, message: messageText.trim() }, token);
      setNotice(res.message);
      setMessageText('');
      setMessageOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send message.');
    } finally {
      setSendingMessage(false);
    }
  }

  return (
    <div className="tenant-list-export">
      <div className="tenant-list-export__tabs" role="tablist">
        {LIST_TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={listType === tab.key}
            className={`tenant-list-export__tab ${listType === tab.key ? 'is-active' : ''}`}
            onClick={() => setListType(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(listType === 'joined' || listType === 'left') && (
        <div className="tenant-list-export__month-picker">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{monthLabel(2000, m).split(' ')[0]}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      <div className="tenant-list-export__actions">
        <button type="button" className="tenant-list-export__action-btn" onClick={handleDownload} disabled={tenants.length === 0}>
          ⬇ Download Excel
        </button>
        <button
          type="button"
          className="tenant-list-export__action-btn tenant-list-export__action-btn--message"
          onClick={() => setMessageOpen((o) => !o)}
          disabled={tenants.length === 0}
        >
          ✉️ Message {selected.size > 0 ? selected.size : 'all'}
        </button>
      </div>

      {messageOpen && (
        <div className="tenant-list-export__message-composer">
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={`Message to send to ${selected.size > 0 ? selected.size : tenants.length} tenant${(selected.size > 0 ? selected.size : tenants.length) === 1 ? '' : 's'}…`}
            rows={3}
            autoFocus
          />
          <div className="tenant-list-export__message-composer-actions">
            <button type="button" className="tenant-list-export__action-btn" onClick={handleSendMessage} disabled={sendingMessage}>
              {sendingMessage ? 'Sending…' : 'Send'}
            </button>
            <button type="button" className="tenant-list-export__action-btn tenant-list-export__action-btn--cancel" onClick={() => { setMessageOpen(false); setMessageText(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="tenant-list-export__error">{error}</p>}
      {notice && <p className="tenant-list-export__notice">{notice}</p>}

      {loading ? (
        <p className="tenant-list-export__empty">Loading…</p>
      ) : tenants.length === 0 ? (
        <p className="tenant-list-export__empty">
          {listType === 'current' && 'No current tenants in this apartment.'}
          {listType === 'joined' && `No one joined in ${monthLabel(year, month)}.`}
          {listType === 'left' && `No one left in ${monthLabel(year, month)}.`}
          {listType === 'left_all' && 'No one has left this apartment yet.'}
        </p>
      ) : (
        <div className="tenant-list-export__table">
          <div className="tenant-list-export__row tenant-list-export__row--head">
            <input type="checkbox" checked={selected.size === tenants.length} onChange={toggleSelectAll} />
            <span>Tenant</span>
            <span>Unit</span>
            <span>Phone</span>
            <span>{listType === 'joined' ? 'Joined' : listType === 'left' || listType === 'left_all' ? 'Left' : 'Status'}</span>
          </div>
          {tenants.map((t) => (
            <div className="tenant-list-export__row" key={t.id}>
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelected(t.id)} />
              {/* Tap the avatar to expand full contact details + photo -
                  same expandable card used elsewhere in the admin/
                  landlord portals, kept consistent here. */}
              <span className="tenant-list-export__name-cell">
                <TenantContactCard
                  tenant={{
                    full_name: t.fullName,
                    photo_url: t.photoUrl,
                    unit_name: t.unitName,
                    primary_phone: t.phone,
                    secondary_phone: t.secondaryPhone,
                    email: t.email,
                    emergency_contact_name: t.emergencyContactName,
                    emergency_contact_phone: t.emergencyContactPhone,
                  }}
                  size={28}
                />
                {t.fullName}
              </span>
              <span>{t.unitName}</span>
              <span>{t.phone}</span>
              <span>
                {listType === 'joined' && (t.moveInDate || '—')}
                {(listType === 'left' || listType === 'left_all') && (t.leftAt ? t.leftAt.slice(0, 10) : '—')}
                {listType === 'current' && (t.isActive ? 'Active' : 'Left')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
