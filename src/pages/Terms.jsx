import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

export default function Terms() {
  return (
    <div className="legal-page">
      <div className="legal-page__card">
        <Link to="/login" className="ghost-link">← Back to login</Link>
        <h1>Terms of Service</h1>
        <p className="legal-page__updated">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <p>
          RentaPay is a Kenya-based rent management platform that helps landlords, property
          managers, and tenants track rent, payments, and communication in one place. By
          creating an account or using RentaPay, you agree to these terms.
        </p>

        <h2>1. What RentaPay Is</h2>
        <p>
          RentaPay is a record-keeping and communication tool for residential rentals. It is not
          a bank, lender, escrow service, or party to any tenancy agreement between a landlord
          and tenant. Rent obligations, deposits, and lease terms remain matters between the
          landlord and tenant; RentaPay simply helps track and confirm them.
        </p>

        <h2>2. Accounts and Roles</h2>
        <p>
          RentaPay accounts fall into three roles — landlord, property manager/caretaker, and
          tenant — each with different permissions. A phone number may only be associated with
          one active account at a time. Account holders are responsible for the accuracy of the
          information they provide and for keeping their login credentials secure.
        </p>

        <h2>3. Payments</h2>
        <p>
          Rent may be paid via M-Pesa STK push (where enabled) or by sending payment directly to
          a landlord's own Paybill, Till, or phone number and submitting proof for confirmation.
          RentaPay does not hold, custody, or guarantee any funds — it records what landlords and
          tenants report and confirm to each other. Landlord subscription fees paid to RentaPay
          itself are processed via M-Pesa STK push to RentaPay's own Paybill.
        </p>

        <h2>4. Acceptable Use</h2>
        <p>
          You agree not to submit false payment or identity information, impersonate another
          person, interfere with the platform's normal operation, or use RentaPay for any
          unlawful purpose. Landlords and managers should only confirm payments they have
          genuinely verified as received.
        </p>

        <h2>5. Data and Privacy</h2>
        <p>
          Our use of your information is described in the <Link to="/privacy">Privacy Policy</Link>,
          which forms part of these terms.
        </p>

        <h2>6. Changes to These Terms</h2>
        <p>
          We may update these terms as the platform evolves. Continued use of RentaPay after a
          change constitutes acceptance of the updated terms.
        </p>

        <h2>7. Contact</h2>
        <p>
          For questions about these terms, or to request account or data deletion, use the Help
          option within the app or contact the RentaPay team directly.
        </p>
      </div>
    </div>
  );
}
