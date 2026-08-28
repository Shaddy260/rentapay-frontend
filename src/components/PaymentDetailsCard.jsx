import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import './PaymentDetailsCard.css';

// Direct request: "when displaying the manual payment table to both
// parties...when they tap pay manually...show a tab for the payment
// details, a nice visible one." One shared component instead of each
// page hand-rolling its own paragraph of instructions - which is
// exactly how SubscriptionManage.jsx ended up quietly showing the
// WRONG Paybill number while every other page had the right one.
//
// UPDATE (direct request: "strictly admin only...a way for him to
// change the payment method that the landlords pay their amounts
// during subscription"): the Paybill/account/till shown here used to
// be a hardcoded constant (src/constants/platformPaybill.js) - now
// fetched live from the admin-editable setting (see
// AdminPlatformPaymentSettings.jsx), so it always reflects whatever
// destination the admin currently has configured, with no redeploy
// needed to change it.
export default function PaymentDetailsCard({ amount, note }) {
  const token = localStorage.getItem('rentapay_token');
  const [details, setDetails] = useState(null);

  useEffect(() => {
    api.getPlatformPaymentDetails(token).then(setDetails).catch(() => {});
  }, [token]);

  return (
    <div className="payment-details-card">
      <div className="payment-details-card__header">💳 Pay via M-Pesa {details?.method === 'till' ? 'Till' : 'Paybill'}</div>
      {details?.method === 'till' ? (
        <div className="payment-details-card__row">
          <span>Till Number</span>
          <strong>{details?.tillNumber || '…'}</strong>
        </div>
      ) : (
        <>
          <div className="payment-details-card__row">
            <span>Paybill Number</span>
            <strong>{details?.paybillNumber || '…'}</strong>
          </div>
          <div className="payment-details-card__row">
            <span>Account Number</span>
            <strong>{details?.accountNumber || '…'}</strong>
          </div>
        </>
      )}
      {amount != null && (
        <div className="payment-details-card__row">
          <span>Amount</span>
          <strong>KES {Number(amount).toLocaleString()}</strong>
        </div>
      )}
      {note && <p className="payment-details-card__note">{note}</p>}
    </div>
  );
}
