import React from 'react';
import { PLATFORM_PAYBILL_NUMBER, PLATFORM_PAYBILL_ACCOUNT_NUMBER } from '../constants/platformPaybill.js';
import './PaymentDetailsCard.css';

// Direct request: "when displaying the manual payment table to both
// parties...when they tap pay manually...show a tab for the payment
// details, a nice visible one." One shared component instead of each
// page hand-rolling its own paragraph of instructions - which is
// exactly how SubscriptionManage.jsx ended up quietly showing the
// WRONG Paybill number while every other page had the right one.
export default function PaymentDetailsCard({ amount, note }) {
  return (
    <div className="payment-details-card">
      <div className="payment-details-card__header">💳 Pay via M-Pesa Paybill</div>
      <div className="payment-details-card__row">
        <span>Paybill Number</span>
        <strong>{PLATFORM_PAYBILL_NUMBER}</strong>
      </div>
      <div className="payment-details-card__row">
        <span>Account Number</span>
        <strong>{PLATFORM_PAYBILL_ACCOUNT_NUMBER}</strong>
      </div>
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
