import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import AccountMenu from '../components/AccountMenu.jsx';
import HelpButton from '../components/HelpButton.jsx';
import ChatWidget from '../components/ChatWidget.jsx';
import Countdown from '../components/Countdown.jsx';
import PortalSidebar from '../components/PortalSidebar.jsx';
import UnitInfoCard from '../components/UnitInfoCard.jsx';
import StatisticsPanel from '../components/StatisticsPanel.jsx';
import { downloadCsv } from '../utils/downloadCsv.js';
import { initPushSubscription } from '../utils/push.js';
import Faq from '../components/Faq.jsx';
import ComplaintsPanel from '../components/ComplaintsPanel.jsx';
import AnnouncementBell from '../components/AnnouncementBell.jsx';
import PaymentMethodBadge from '../components/PaymentMethodBadge.jsx';
import '../components/Countdown.css';
import { api, ApiError } from '../api/client.js';
import './TenantPortal.css';

/**
 * Blueprint section 12: Tenant Portal. Covers every row in the
 * blueprint's feature table: rent breakdown, outstanding balance, due
 * date countdown, pay via STK/Paybill, payment history, receipt
 * download, vacating notice (submit + cancel), profile view, help.
 */
// Shared pending/rejected/normal payment-action block, used in both
// the normal balance card and the "paid ahead" card so the two never
// drift into different behavior. `myConfirmation` is the tenant's own
// most recent submission (or null) from GET /payments/my-latest-confirmation.
function PaymentStatusAction({ myConfirmation, payLabel, onPay, onCheck }) {
  if (myConfirmation?.status === 'pending') {
    return (
      <div className="stk-pending paybill-pending">
        <p>⏳ Submitted, waiting for approval.</p>
        <div className="paybill-pending__details">
          <div><span>Transaction code</span><span>{myConfirmation.transaction_code}</span></div>
          <div><span>Amount</span><span>KES {Number(myConfirmation.amount_paid).toLocaleString()}</span></div>
          <div><span>Paid by</span><span>{myConfirmation.mpesa_payer_name}</span></div>
          <div><span>Submitted</span><span>{new Date(myConfirmation.submitted_at).toLocaleString('en-GB')}</span></div>
        </div>
        <button onClick={onCheck}>Check for confirmation</button>
      </div>
    );
  }

  if (myConfirmation?.status === 'rejected') {
    // "A tenant should receive a banner telling them the payment was
    // rejected, with a way to resubmit right there in the same
    // banner." Red/urgent styling, distinct from the neutral pending
    // banner above.
    return (
      <div className="paybill-rejected-banner">
        <p>❌ Your last payment submission was not approved.</p>
        {myConfirmation.rejection_reason && <p className="paybill-rejected-banner__reason">Reason: {myConfirmation.rejection_reason}</p>}
        <Button variant="mpesa" onClick={onPay}>Resubmit payment</Button>
      </div>
    );
  }

  return (
    <div className="pay-actions">
      <Button variant="mpesa" onClick={onPay}>{payLabel}</Button>
    </div>
  );
}

export default function TenantPortal() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('rentapay_token');

  const [breakdown, setBreakdown] = useState(null);
  const [prepayment, setPrepayment] = useState(null);
  const [paymentInstructions, setPaymentInstructions] = useState(null);
  const [profile, setProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showPaybillModal, setShowPaybillModal] = useState(false);
  // FIX ("tenant still shows 'awaiting confirmation' even after the
  // landlord rejected it"): this used to be inferred client-side from
  // sessionStorage + watching for a matching row in payment history,
  // which only ever changes on CONFIRM - a REJECT was invisible. Now
  // sourced directly from GET /payments/my-latest-confirmation on
  // every load(), so pending/confirmed/rejected are all reflected
  // accurately and a rejection shows its own banner immediately.
  const [myConfirmation, setMyConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);

  // Sidebar nav (Dashboard / Statistics / Financials / Complaints),
  // styled after the reference university-portal layout the user
  // shared. Payment history and Your details, which used to live
  // behind a small 2-item dropdown, are now full tabs.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | contact | financials | statistics | complaints
  const [chatOpen, setChatOpen] = useState(false);

  function load() {
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    Promise.all([api.getBalance(token), api.getProfile(token), api.getPaymentHistory(token), api.getMyLatestPaybillConfirmation(token)])
      .then(([balanceRes, profileRes, historyRes, confirmationRes]) => {
        setBreakdown(balanceRes.breakdown);
        setPrepayment(balanceRes.prepayment);
        setPaymentInstructions(balanceRes.paymentInstructions || null);
        setProfile(profileRes.profile);
        setPayments(historyRes.payments || []);
        // Drives the pending/rejected banners below - a 'confirmed'
        // record (or none at all) means there's nothing to show and
        // the normal "Pay Rent" button appears instead.
        setMyConfirmation(confirmationRes.confirmation || null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          sessionStorage.removeItem('rentapay_token');
          sessionStorage.removeItem('rentapay_role');
          if (err.accountRevoked) {
            sessionStorage.setItem('rentapay_logout_message', err.message);
          }
          navigate('/login');
          return;
        }
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Live push" - see Dashboard.jsx's identical effect for the
  // landlord/manager side. Same safe no-op behavior here.
  useEffect(() => {
    initPushSubscription(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return <div className="tenant-portal tenant-portal--loading"><p>Loading your portal…</p></div>;
  }

  if (error && !breakdown) {
    return (
      <div className="tenant-portal tenant-portal--loading">
        <p>{error}</p>
        <Button variant="ghost" onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }

  const unit = profile?.units;
  const dueDate = breakdown?.dueDate ? new Date(breakdown.dueDate) : null;

  return (
    <div className="tenant-portal">
      <PortalSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey={activeTab}
        items={[
          { key: 'dashboard', label: 'Dashboard', icon: '🏠', onClick: () => setActiveTab('dashboard') },
          { key: 'contact', label: 'Contact & Notice', icon: '📇', onClick: () => setActiveTab('contact') },
          { key: 'messages', label: 'Messages', icon: '💬', onClick: () => setChatOpen(true) },
          { key: 'statistics', label: 'Statistics', icon: '📊', onClick: () => setActiveTab('statistics') },
          { key: 'financials', label: 'Financials', icon: '🏦', onClick: () => setActiveTab('financials') },
          { key: 'complaints', label: 'Complaints', icon: '⚠️', onClick: () => setActiveTab('complaints') },
          { key: 'faq', label: 'FAQs', icon: '❓', onClick: () => setActiveTab('faq') },
        ]}
      />

      <header className="tenant-portal-header portal-topbar">
        <div className="portal-topbar__left">
          <button type="button" className="portal-topbar__hamburger" aria-label="Menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="portal-topbar__brand-block">
            <div className="portal-topbar__brand"><span>🏠</span> RentaPay</div>
            <div className="portal-topbar__role-label">Tenant</div>
          </div>
        </div>
        <div className="portal-topbar__right">
          {profile && (
            <>
              {/* Bell right next to the avatar/name, both pinned to the
                  extreme top-right. Photo update/removal now lives
                  inside the account menu dropdown, so there's a single
                  avatar control here instead of two overlapping ones. */}
              <AnnouncementBell token={token} role="tenant" />
              <AccountMenu
                name={profile.full_name}
                photoUrl={profile.photo_url}
                role="tenant"
                phone={profile.primary_phone}
                token={token}
                onPhotoChange={(newUrl) => setProfile((p) => ({ ...p, photo_url: newUrl }))}
              />
              <HelpButton
                role="tenant"
                token={token}
                landlordContact={
                  profile.landlords
                    ? {
                        name: profile.landlords.full_name,
                        phone: profile.landlords.phone,
                        managerName: unit?.properties?.contact_manager?.full_name || unit?.properties?.caretaker_name,
                        managerPhone: unit?.properties?.contact_manager?.phone || unit?.properties?.caretaker_phone,
                      }
                    : null
                }
              />
              {/* Sidebar's "Messages" item opens this with no launcher
                  button of its own - full thread list (support + landlord). */}
              <ChatWidget
                token={token}
                role="tenant"
                hideLauncher
                controlledOpen={chatOpen}
                onOpenChange={setChatOpen}
              />

            </>
          )}
        </div>
      </header>

      <main className="tenant-portal-main">
        {notice && <div className="tenant-portal-banner tenant-portal-banner--ok">{notice}</div>}
        {error && <div className="tenant-portal-banner tenant-portal-banner--error">{error}</div>}

        <section className="tenant-welcome">
          <h1>Hi, {profile?.full_name?.split(' ')[0]}</h1>
          <p className="tenant-welcome__unit">Unit {unit?.unit_name} · {unit?.unit_payment_code}</p>
          <PaymentMethodBadge paymentMethod={paymentInstructions} shape="rectangle" />
        </section>

        {activeTab === 'dashboard' && (
          <>
            {prepayment?.isAhead ? (
              <section className="balance-card balance-card--ahead">
                <span className="balance-card__label">You've paid ahead</span>
                <span className="balance-card__amount">KES {prepayment.creditAmount?.toLocaleString()}</span>
                <span className="balance-card__due">
                  You've covered the next {prepayment.monthsCovered} month{prepayment.monthsCovered === 1 ? '' : 's'}. Your next payment is KES{' '}
                  {prepayment.nextPaymentAmount?.toLocaleString()}, due on{' '}
                  {new Date(prepayment.nextPaymentDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                </span>

                {/* Even paid ahead, a tenant may want to submit an early
                    payment (e.g. paying next month's rent now) - this
                    used to have no payment UI at all once ahead. */}
                <PaymentStatusAction
                  myConfirmation={myConfirmation}
                  payLabel="Make a payment"
                  onPay={() => setShowPaybillModal(true)}
                  onCheck={() => load()}
                />
              </section>
            ) : (
              <section className="balance-card">
                <span className="balance-card__label">Rent balance</span>
                <span className="balance-card__amount">KES {Number(breakdown.totalDue).toLocaleString()}</span>
                <span className="balance-card__due">
                  {dueDate && (breakdown.balance > 0 || new Date() <= dueDate) ? (
                    <>Due in <Countdown target={dueDate} expiredLabel="Overdue" /></>
                  ) : (
                    'No balance due'
                  )}
                </span>

                {/* Manual Paybill/Till payment only - STK push removed
                    from the tenant rent-payment flow per product
                    decision. (The landlord's OWN subscription payment
                    to the platform still uses STK via
                    daraja.service.js - that's untouched and unrelated.) */}
                <PaymentStatusAction
                  myConfirmation={myConfirmation}
                  payLabel="Pay Rent"
                  onPay={() => setShowPaybillModal(true)}
                  onCheck={() => load()}
                />

                <button className="balance-card__breakdown-link" onClick={() => setActiveTab('financials')}>
                  View full breakdown &amp; payment history →
                </button>
              </section>
            )}

            <UnitInfoCard unit={unit} profile={profile} dueDate={dueDate} />
          </>
        )}

        {activeTab === 'contact' && (
          <>
            {/* Landlord / caretaker / property manager contact. Whoever is
                set as "the contact" for this property (property.
                primary_contact_manager_id, edited from the landlord's
                Settings) is shown here first with the landlord's own
                number always shown too; the caretaker is a separate,
                no-login contact and always shown when set.
                Moved into its own menu tab (was previously stuck in the
                dashboard body) per direct request. */}
            {profile?.landlords && (
              <section className="tenant-section">
                <h2>Contact</h2>
                <div className="contact-card">
                  <div className="contact-card__row">
                    <span className="contact-card__label">Landlord</span>
                    <span className="contact-card__name">{profile.landlords.full_name}</span>
                    <a className="contact-card__phone" href={`tel:${profile.landlords.phone}`}>{profile.landlords.phone}</a>
                  </div>
                  {unit?.properties?.contact_manager && (
                    <div className="contact-card__row">
                      <span className="contact-card__label">Property manager</span>
                      <span className="contact-card__name">{unit.properties.contact_manager.full_name}</span>
                      {unit.properties.contact_manager.phone && (
                        <a className="contact-card__phone" href={`tel:${unit.properties.contact_manager.phone}`}>{unit.properties.contact_manager.phone}</a>
                      )}
                    </div>
                  )}
                  {unit?.properties?.caretaker_name && (
                    <div className="contact-card__row">
                      <span className="contact-card__label">Caretaker</span>
                      <span className="contact-card__name">{unit.properties.caretaker_name}</span>
                      {unit.properties.caretaker_phone && (
                        <a className="contact-card__phone" href={`tel:${unit.properties.caretaker_phone}`}>{unit.properties.caretaker_phone}</a>
                      )}
                    </div>
                  )}
                </div>

                {/* "Text your landlord" - a live chat straight into the
                    landlord's own dashboard, in addition to (not instead
                    of) the tel: links above. */}
                <div className="contact-card__chat">
                  <ChatWidget
                    token={token}
                    role="tenant"
                    label="Text your landlord"
                    directThread={{ threadType: 'landlord_tenant', name: profile.landlords.full_name || 'Your Landlord' }}
                  />
                </div>
              </section>
            )}

            {/* Vacating notice - blueprint 12 rows 8-9, blueprint section 8 */}
            <section className="tenant-section">
              <h2>Vacating notice</h2>
              {profile?.notice_given ? (
                <div className="notice-status">
                  <p>You've given notice to vacate on <strong>{profile.notice_date}</strong>.</p>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api.cancelVacatingNotice(token);
                        setNotice('Vacating notice cancelled.');
                        load();
                      } catch (err) {
                        setError(err.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    This was a mistake — Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" onClick={() => setShowNoticeModal(true)}>Give Vacating Notice</Button>
              )}
            </section>
          </>
        )}

        {activeTab === 'financials' && (
          <>
            <section className="tenant-section">
              <h2>Financial breakdown</h2>
              {prepayment?.isAhead ? (
                <p className="tenant-portal-hint">
                  You've covered the next {prepayment.monthsCovered} month{prepayment.monthsCovered === 1 ? '' : 's'} (KES{' '}
                  {prepayment.creditAmount?.toLocaleString()} credit). Your next payment is KES {prepayment.nextPaymentAmount?.toLocaleString()}, due on{' '}
                  {new Date(prepayment.nextPaymentDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                </p>
              ) : (
                <div className="rent-breakdown">
                  <div className="rent-breakdown__row"><span>Monthly rent</span><span>KES {Number(breakdown.rentAmount).toLocaleString()}</span></div>
                  {breakdown.extraCharges?.map((c, i) => (
                    <div className="rent-breakdown__row" key={i}><span>{c.name}</span><span>KES {Number(c.amount).toLocaleString()}</span></div>
                  ))}
                  {breakdown.carriedArrears > 0 && (
                    <div className="rent-breakdown__row"><span>Carried arrears</span><span>KES {Number(breakdown.carriedArrears).toLocaleString()}</span></div>
                  )}
                  <div className="rent-breakdown__row rent-breakdown__row--total"><span>Total due</span><span>KES {Number(breakdown.totalDue).toLocaleString()}</span></div>
                </div>
              )}

              <p className="tenant-portal-hint">
                {paymentInstructions?.method === 'paybill'
                  ? <>Pay via M-Pesa STK push straight from the Dashboard tab, or use Paybill <strong>{paymentInstructions.paybillNumber}</strong>, Account Number <strong>{paymentInstructions.accountNumber}</strong>.</>
                  : paymentInstructions?.method === 'till'
                  ? <>Pay via M-Pesa STK push straight from the Dashboard tab, or Buy Goods Till Number <strong>{paymentInstructions.tillNumber}</strong>.</>
                  : <>Pay via the M-Pesa STK push prompt sent straight to your phone from the Dashboard tab.</>}
              </p>
            </section>

            <section className="tenant-section">
              <div className="tenant-section__header-row">
                <h2>Payment history</h2>
                {payments.length > 0 && (
                  <button
                    className="ghost-link"
                    onClick={() =>
                      downloadCsv(
                        'rentapay-payment-history',
                        ['Date', 'Amount (KES)', 'Method', 'Status'],
                        payments.map((p) => [
                          p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '—',
                          p.amount,
                          p.payment_method.replace('_', ' '),
                          p.status,
                        ])
                      )
                    }
                  >
                    Download
                  </button>
                )}
              </div>
              {payments.length === 0 ? (
                <p className="tenant-portal-hint">No payments yet.</p>
              ) : (
                <div className="payments-table-wrap">
                  <table className="payments-table">
                    <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '—'}</td>
                          <td>KES {Number(p.amount).toLocaleString()}</td>
                          <td>{p.payment_method.replace('_', ' ')}</td>
                          <td><span className={`payment-status payment-status--${p.status}`}>{p.status}</span></td>
                          <td>
                            {p.status === 'completed' && (
                              <button className="receipt-link" onClick={() => window.print()}>Receipt</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="tenant-section">
              <h2>Your details</h2>
              <div className="profile-grid">
                <div><span className="profile-grid__label">Name</span><span>{profile?.full_name}</span></div>
                <div><span className="profile-grid__label">Phone</span><span>{profile?.primary_phone}</span></div>
                <div><span className="profile-grid__label">Email</span><span>{profile?.email || '—'}</span></div>
                <div><span className="profile-grid__label">ID Number</span><span>{profile?.id_number}</span></div>
                <div><span className="profile-grid__label">Move-in date</span><span>{profile?.move_in_date}</span></div>
                <div><span className="profile-grid__label">Emergency contact</span><span>{profile?.emergency_contact_name} ({profile?.emergency_contact_phone})</span></div>
              </div>
              <p className="tenant-portal-hint">To update any of these details, contact your landlord.</p>
            </section>
          </>
        )}

        {activeTab === 'statistics' && <StatisticsPanel payments={payments} />}

        {activeTab === 'complaints' && (
          <ComplaintsPanel token={token} name={profile?.full_name} defaultPhone={profile?.primary_phone} />
        )}

        {activeTab === 'faq' && <Faq audience="tenant" />}
      </main>

      {showNoticeModal && (
        <VacatingNoticeModal
          token={token}
          onClose={() => setShowNoticeModal(false)}
          onDone={() => { setShowNoticeModal(false); setNotice('Vacating notice submitted.'); load(); }}
        />
      )}
      {showPaybillModal && (
        <PaybillModal
          paymentInstructions={paymentInstructions}
          amountDue={prepayment?.isAhead ? prepayment.nextPaymentAmount : breakdown?.totalDue}
          token={token}
          onClose={() => setShowPaybillModal(false)}
          onDone={() => { setShowPaybillModal(false); load(); }}
        />
      )}
    </div>
  );
}

function VacatingNoticeModal({ token, onClose, onDone }) {
  const [step, setStep] = useState(1); // 2-step confirmation per blueprint 8
  const [vacatingDate, setVacatingDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await api.submitVacatingNotice({ vacatingDate, reason }, token);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>Give vacating notice</h3>
          <button className="modal-card__close" onClick={onClose}>×</button>
        </div>

        {step === 1 ? (
          <form
            className="modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!vacatingDate) return;
              setStep(2);
            }}
          >
            <label className="form-field__label">Intended vacating date</label>
            <input type="date" required value={vacatingDate} onChange={(e) => setVacatingDate(e.target.value)} />
            <label className="form-field__label">Reason (optional)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            <Button type="submit" variant="primary">Continue</Button>
          </form>
        ) : (
          <div className="modal-form">
            {error && <p className="modal-error">{error}</p>}
            <p>You're about to give notice to vacate on <strong>{vacatingDate}</strong>. Your landlord will be notified immediately.</p>
            <Button variant="ghost" onClick={() => setStep(1)}>This was a mistake — Cancel</Button>
            <Button variant="primary" loading={busy} onClick={confirm}>Confirm notice</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PaybillModal({ paymentInstructions, amountDue, token, onClose, onDone }) {
  const [transactionCode, setTransactionCode] = useState('');
  const [amountPaid, setAmountPaid] = useState(amountDue != null ? String(amountDue) : '');
  const [mpesaPayerName, setMpesaPayerName] = useState('');
  const [mpesaPayerPhone, setMpesaPayerPhone] = useState('');
  const [mpesaSmsTimestamp, setMpesaSmsTimestamp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!mpesaSmsTimestamp) {
        setError('M-Pesa SMS time is required — enter the time shown on your payment confirmation SMS.');
        setBusy(false);
        return;
      }
      if (!mpesaPayerPhone.trim()) {
        setError('The phone number you sent the money from is required.');
        setBusy(false);
        return;
      }
      const payload = {
        transactionCode: transactionCode.trim(),
        amountPaid: Number(amountPaid),
        mpesaPayerName: mpesaPayerName.trim(),
        mpesaPayerPhone: mpesaPayerPhone.trim(),
        mpesaSmsTimestamp: new Date(mpesaSmsTimestamp).toISOString(),
      };
      const res = await api.submitPaybillTransaction(payload, token);
      if (res.isDuplicate) {
        setError(res.message);
        setBusy(false);
        return;
      }
      onDone({
        transactionCode: payload.transactionCode.toUpperCase(),
        amountPaid: payload.amountPaid,
        mpesaPayerName: payload.mpesaPayerName,
        mpesaPayerPhone: payload.mpesaPayerPhone,
        submittedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>Pay Rent</h3>
          <button className="modal-card__close" onClick={onClose}>×</button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          {error && <p className="modal-error">{error}</p>}
          {paymentInstructions?.method === 'paybill' ? (
            <p>Use Paybill <strong>{paymentInstructions.paybillNumber}</strong>, Account Number <strong>{paymentInstructions.accountNumber}</strong>. Once you've paid, fill in the details below exactly as shown on your M-Pesa confirmation SMS.</p>
          ) : paymentInstructions?.method === 'till' ? (
            <p>Use Buy Goods Till Number <strong>{paymentInstructions.tillNumber}</strong>. Once you've paid, fill in the details below exactly as shown on your M-Pesa confirmation SMS.</p>
          ) : paymentInstructions?.method === 'stk' && paymentInstructions.stkPhoneNumber ? (
            <p>Send payment via M-Pesa (Send Money) to <strong>{paymentInstructions.stkPhoneNumber}</strong>. Once you've paid, fill in the details below exactly as shown on your M-Pesa confirmation SMS.</p>
          ) : (
            <p>Fill in the details below exactly as shown on your M-Pesa confirmation SMS.</p>
          )}

          <label className="form-field__label">Transaction code</label>
          <input required value={transactionCode} onChange={(e) => setTransactionCode(e.target.value)} placeholder="e.g. QGH7XYZ123" />

          <label className="form-field__label">Amount paid (KES)</label>
          <input required type="number" min="0" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />

          <label className="form-field__label">M-Pesa payer name</label>
          <input required value={mpesaPayerName} onChange={(e) => setMpesaPayerName(e.target.value)} placeholder="Name shown on the M-Pesa SMS" />

          <label className="form-field__label">Phone number you sent the money from</label>
          <input required type="tel" value={mpesaPayerPhone} onChange={(e) => setMpesaPayerPhone(e.target.value)} placeholder="e.g. 0712345678" />

          <label className="form-field__label">M-Pesa SMS time</label>
          <input required type="datetime-local" value={mpesaSmsTimestamp} onChange={(e) => setMpesaSmsTimestamp(e.target.value)} />

          <Button type="submit" variant="primary" loading={busy}>Submit</Button>
        </form>
      </div>
    </div>
  );
}
