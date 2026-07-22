import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

export default function Privacy() {
  return (
    <div className="legal-page">
      <div className="legal-page__card">
        <Link to="/login" className="ghost-link">← Back to login</Link>
        <h1>Privacy Policy</h1>
        <p className="legal-page__updated">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <p>
          RentaPay is a Kenya-based rent management platform. This policy explains what
          information we collect, how it is used, and who can see it.
        </p>

        <h2>1. Information We Collect</h2>
        <ul>
          <li>Names, phone numbers, and email addresses for landlords, property managers, and tenants</li>
          <li>Property and unit details, including rent amounts and due dates</li>
          <li>Payment records, including M-Pesa transaction codes, amounts, and payment history</li>
          <li>Identification and emergency contact details tenants provide at their landlord's request</li>
          <li>Messages exchanged through the platform's chat and complaints features</li>
        </ul>

        <h2>2. How We Use It</h2>
        <p>
          Your information is used to operate the core service: tracking balances, confirming
          payments, sending reminders and receipts, and enabling communication between
          landlords, managers, and tenants. Phone numbers are used to send SMS notifications.
          We do not sell personal data to third parties.
        </p>

        <h2>3. Who Can See Your Information</h2>
        <p>
          A tenant's landlord and any property managers or caretakers the landlord has added can
          see that tenant's account and payment records. Tenants can see their own balance,
          payment history, and their landlord's payment details. RentaPay's team may access
          account data as needed to operate, troubleshoot, and support the platform.
        </p>

        <h2>4. Payment Data Retention</h2>
        <p>
          Confirmed or rejected payment submissions are retained for six months by default, or
          deleted sooner at the landlord's or manager's discretion. Completed payment history is
          retained for ongoing record-keeping.
        </p>

        <h2>5. Data Deletion</h2>
        <p>
          You may request deletion of your account data via the Help option in the app, through
          your landlord or property manager (for tenant accounts), or by contacting the RentaPay
          team directly. Some records may be retained where required for legitimate
          record-keeping.
        </p>

        <h2>6. Security</h2>
        <p>
          We apply reasonable technical and organizational measures to protect your data,
          including encrypted password storage and role-based access controls.
        </p>

        <h2>7. Contact</h2>
        <p>
          For privacy questions or requests, use the Help option in the app or contact the
          RentaPay team directly.
        </p>
      </div>
    </div>
  );
}
