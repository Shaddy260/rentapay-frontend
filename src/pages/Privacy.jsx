import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

export default function Privacy() {
  return (
    <div className="legal-page">
      <div className="legal-page__card">
        <Link to="/login" className="ghost-link">Back to login</Link>
        <h1>Privacy Policy</h1>
        <p className="legal-page__updated">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <p>
          RentaPay is a rent management platform built for the Kenyan rental market, used by
          landlords, property managers, caretakers, general managers, tenants, Brand Ambassadors,
          and prospective tenants browsing publicly listed vacant units. This Privacy Policy
          explains, in plain and complete detail, what personal information RentaPay collects, why
          it is collected, how it is used, who it is shared with and under what circumstances, how
          long it is kept, and the choices and rights you have over it. It should be read alongside
          our <Link to="/terms">Terms of Service</Link>, which explains how the platform's features
          themselves work.
        </p>
        <p>
          We process personal data in a way that is intended to be consistent with Kenya's Data
          Protection Act, 2019, and with the guidance issued by the Office of the Data Protection
          Commissioner. Where this policy uses a term defined by that Act, such as data controller,
          data processor, or data subject, it uses that term in the same sense the Act does. If you
          have a question this policy does not answer, Section 15 explains how to reach us.
        </p>

        <h2>1. Who This Policy Covers</h2>
        <p>
          This policy applies to anyone who creates an account on RentaPay, or is added to one, in
          any role, including a landlord, a property manager, a caretaker, a general manager, and
          a tenant. It also applies to a Brand Ambassador who has agreed to introduce landlords to
          RentaPay under a separate arrangement, and to a prospective landlord whose name, phone
          number, and general location a Brand Ambassador has submitted to RentaPay ahead of that
          landlord registering an account of their own. It applies to a prospective tenant who
          simply browses RentaPay's public vacant unit listing pages without ever creating an
          account, and to anyone who reaches out to a landlord, manager, or caretaker through the
          WhatsApp link on a public listing page. Wherever this policy uses the word you, it means
          whichever of these categories applies to your own situation.
        </p>

        <h2>2. Information We Collect</h2>
        <h3>2.1 Information you, your landlord, or your manager provide directly</h3>
        <ul>
          <li>Full name, phone number, and email address, collected for landlords, property
            managers, caretakers, general managers, and tenants alike;</li>
          <li>National identification number and emergency contact details, collected from a
            tenant only where the landlord onboarding that tenant chooses to request them;</li>
          <li>Property and unit details, including physical addresses, rent amounts, due dates,
            unit photographs, and lease start and move in dates;</li>
          <li>Security deposit records, including the amount a tenant paid at move in, the date it
            was paid, and, once a tenancy ends, whether it was refunded in full, partially
            refunded together with a stated reason for any amount withheld, or forfeited;</li>
          <li>Utility submetering records, including meter readings, calculated usage, and the
            resulting water or electricity bills issued to a unit;</li>
          <li>Payment records, including M Pesa transaction codes, amounts, timestamps, and
            payment method, whether submitted by a tenant as proof of a rent payment or generated
            automatically when a landlord pays a subscription by M Pesa STK push;</li>
          <li>Where a landlord enables the optional late payment penalty feature, the formula
            settings that landlord configures (rate, whether it applies per day or per week, and
            any cap), and, where a landlord or property manager waives or adjusts a penalty for a
            specific tenant, the free text reason entered for that decision, timestamped and
            attributed to whoever entered it;</li>
          <li>Where a landlord enables the optional automatic rent collection feature, that
            landlord's own Safaricom Daraja API credentials for their Business Paybill or Till
            (shortcode, consumer key, consumer secret, and passkey), which are encrypted before
            storage and used solely to initiate M Pesa payment requests against that landlord's own
            Paybill or Till. These credentials are never shared with, or usable by, any other
            landlord on the platform, and are never displayed back in full within the app;</li>
          <li>Content you submit through the platform's features, such as maintenance request
            descriptions, complaints, dispute descriptions, community board posts and replies,
            support chat messages, and ratings, including any optional written comment attached to
            a rating;</li>
          <li>Account credentials. Your password is stored only as a one way cryptographic hash,
            meaning RentaPay itself cannot see or recover your actual password, and where a general
            manager sets an Operations PIN, that PIN is stored the same way;</li>
          <li>For a Brand Ambassador, the identity and payout details needed to pay a qualified
            introduction commission, and, for a prospective landlord a Brand Ambassador has
            introduced, that prospective landlord's name, phone number, and general location.</li>
        </ul>
        <h3>2.2 Information generated automatically by your use of the platform</h3>
        <ul>
          <li>Login timestamps, session activity, and basic device and browser information, used
            for security purposes such as detecting an unusual or suspicious login attempt and
            enforcing a temporary lockout after repeated failed attempts;</li>
          <li>Records of notifications sent to you by email and, where you have enabled it, by
            browser or device push, so we can confirm delivery and avoid sending the same
            notification twice;</li>
          <li>A tenant's aggregate rating history, computed from every rating submitted by a
            landlord, property manager, or caretaker who has managed that tenant, keyed to the
            tenant's own email address so that it can be portable across landlords entirely at the
            tenant's own choice;</li>
          <li>An activity log of actions taken by a general manager, so the landlord who created
            that general manager account can review, and where appropriate revert, sensitive
            actions taken under it;</li>
          <li>Basic diagnostic and error information generated when something goes wrong
            technically, used to fix the underlying problem.</li>
        </ul>
        <h3>2.3 Information from third parties</h3>
        <p>
          When a landlord pays their RentaPay subscription by M Pesa STK push, Safaricom provides
          transaction confirmation data back to RentaPay, including the amount, the phone number
          used, and the M Pesa receipt number, so the payment can be recorded automatically without
          either side needing to do anything further. A tenant's rent payment works differently.
          A tenant pays their landlord directly by M Pesa, whether through Paybill, Till, or Send
          Money, and then manually enters the transaction code, amount, payer name, payer phone
          number, and the time shown on the M Pesa confirmation message within RentaPay. This
          information comes from the tenant themselves, not automatically from Safaricom, and is
          reviewed and either confirmed or rejected by the landlord, manager, or caretaker before
          it is treated as a confirmed payment. Separately, where a landlord pays a subscription
          manually rather than by STK push, that landlord submits similar proof of payment, which
          an administrator at RentaPay then reviews. A Brand Ambassador may also submit a
          prospective landlord's name, phone number, and general location to RentaPay ahead of that
          landlord registering their own account, and that information is handled under this same
          Privacy Policy from the moment it reaches us, regardless of whether the landlord or the
          Brand Ambassador provided it first.
        </p>

        <h2>3. How We Use Your Information</h2>
        <p>Your information is used to operate the core service. In particular, we use it to:</p>
        <ul>
          <li>Create and secure your account, verify your identity when you log in, and confirm a
            general manager's Operations PIN before a sensitive action is completed;</li>
          <li>Track rent balances, security deposits, and utility bills, confirm payments, and
            generate receipts and payment history for both landlord and tenant to rely on;</li>
          <li>Send account notifications, payment reminders, receipts, one time verification
            codes, password reset codes, and, for landlords who choose to receive it, the optional
            portfolio digest email summarising occupancy, rent collection, and vacant units that
            are missing photographs;</li>
          <li>Enable communication between landlords, managers, caretakers, and tenants, including
            maintenance requests, complaints, disputes, the community board, and in app chat with
            RentaPay's own support team;</li>
          <li>Compute and display a tenant's reputation score, and, only at that tenant's own
            choice, generate a shareable link to that tenant's aggregate score for use when
            contacting a prospective new landlord;</li>
          <li>Display a unit's photographs and basic details on RentaPay's public vacant unit
            listing page once a landlord marks that unit as publicly listed, and connect an
            interested prospective tenant to the appropriate landlord, manager, or caretaker
            through a WhatsApp link that resolves to the right phone number without displaying
            that number directly on the public page;</li>
          <li>Track a Brand Ambassador's introductions, assess whether an introduced landlord has
            met qualification criteria for a payout, and calculate and record that payout;</li>
          <li>Detect and prevent fraud, abuse, and violations of our Terms of Service, including
            duplicate account creation and suspicious login activity;</li>
          <li>Maintain and improve the platform itself, including diagnosing and fixing technical
            problems.</li>
        </ul>
        <p>
          Your email address is used primarily to send account notifications, receipts, reminders,
          one time verification codes, password reset codes, and, for landlords who opt in, digest
          emails. Your phone number is used primarily for account identification and, where
          relevant, for M Pesa payment processing and for connecting a prospective tenant to a
          landlord through the public listing page's WhatsApp link. <strong>We do not sell your
          personal data to any third party</strong>, and we do not use your data to serve third
          party advertising of any kind, to you or to anyone else.
        </p>

        <h2>4. Who Can See Your Information</h2>
        <p>
          RentaPay is built around a small number of clearly scoped visibility rules, rather than
          broad, unrestricted access to everyone's data:
        </p>
        <ul>
          <li>A tenant's landlord, and any property manager, caretaker, or general manager that
            landlord has given access to that tenant's property, can see that tenant's account
            details, payment records, deposit status, and utility bills;</li>
          <li>Where a landlord has enabled the late payment penalty feature, that landlord and any
            property manager they've given access to see the formula and any override reasons
            entered for their own tenants only; a tenant sees the formula and any override reason
            as it applies to their own tenancy; none of this is shared beyond the landlord/manager
            of that specific property and the tenant it concerns;</li>
          <li>A tenant can see their own balance, payment history, deposit status, utility bills,
            and their landlord's, manager's, or caretaker's payment details, so they know where to
            pay, but cannot see any other tenant's records, even within the same property;</li>
          <li>A tenant's individual written rating comments are visible only to that tenant, on
            their own account, and never to any landlord, including within a reputation summary
            that tenant chooses to share, which shows only the aggregate score and category
            breakdown, never the written text underneath it;</li>
          <li>Content posted to a property's community board is visible to other tenants and
            landlord side users of that same community, not to the wider public;</li>
          <li>A unit's photographs and basic listing details are visible to the public only if,
            and for as long as, a landlord marks that unit as publicly listed as vacant; a landlord
            can remove a unit from public listing at any time, immediately stopping it from
            appearing on future page loads;</li>
          <li>A Brand Ambassador can see only the landlords they themselves have introduced, along
            with each one's qualification and payout status, never any other Brand Ambassador's
            introductions or any landlord's own operational data beyond what is needed to confirm
            qualification;</li>
          <li>A landlord who creates a general manager account can see that general manager's
            activity log, so sensitive actions remain reviewable even though they were taken by
            someone other than the landlord;</li>
          <li>RentaPay's own team may access account data as needed to operate the platform,
            troubleshoot a technical problem, investigate a report of abuse, or provide support,
            and that access is limited to what is genuinely needed for the specific task at hand,
            not standing, unrestricted access to every account.</li>
        </ul>
        <p>
          We may also disclose information where required by law, for example in response to a
          valid order from a Kenyan court, or a lawful request from a Kenyan regulatory or law
          enforcement authority with jurisdiction to make one.
        </p>

        <h2>5. Third Party Service Providers</h2>
        <p>
          RentaPay relies on a small number of specialist third party providers to operate the
          platform, each used only for the specific function described here, and each given only
          the access needed to perform that function.
        </p>
        <h3>5.1 Safaricom and the Daraja API</h3>
        <p>
          Safaricom's Daraja API is used to initiate an M Pesa STK push for a landlord's
          subscription payment. Where a landlord separately chooses to enable the optional
          automatic rent collection feature, RentaPay also uses Safaricom's Daraja API to initiate
          M Pesa payment requests for rent, but does so using that landlord's own Daraja
          credentials against that landlord's own Business Paybill or Till, not RentaPay's own
          shortcode. In either case, Safaricom receives only the phone number and amount needed to
          process that specific transaction and returns transaction confirmation data back to
          RentaPay. RentaPay does not share any other personal information with Safaricom beyond
          what a standard M Pesa transaction itself requires, and a landlord's Daraja credentials
          are never shared with Safaricom on any other landlord's behalf.
        </p>
        <h3>5.2 Cloud Database and File Storage</h3>
        <p>
          RentaPay's database, which holds account records, payment history, ratings, messages,
          and every other record described in this policy, and RentaPay's file storage, which holds
          unit photographs, payment proof screenshots, and uploaded documents, are both provided by
          a specialist cloud infrastructure provider operating under a service agreement with
          RentaPay. RentaPay's own backend controls who can read or write which record, rather than
          relying on the infrastructure provider itself to enforce those rules, so the boundaries
          described in Section 4 above are enforced by RentaPay's own code, every time.
        </p>
        <h3>5.3 Email Delivery</h3>
        <p>
          Every email RentaPay sends, including one time verification codes, password reset codes,
          receipts, reminders, and digest emails, is sent through a specialist third party email
          delivery provider. That provider receives the recipient's email address and the content
          of the specific email being sent, and nothing more.
        </p>
        <h3>5.4 Push Notifications</h3>
        <p>
          Where you enable browser or device push notifications, RentaPay uses the standard Web
          Push protocol, secured with a private key that never leaves RentaPay's own server, to
          deliver a notification directly to your browser or device even when the RentaPay tab is
          not open. Enabling push notifications is entirely optional, and you can turn it off at
          any time from your device or browser settings.
        </p>
        <h3>5.5 Error Monitoring</h3>
        <p>
          RentaPay may use a third party error monitoring service to capture technical error
          details when something breaks unexpectedly, so our team can find and fix the underlying
          problem quickly. This is limited to technical diagnostic information, such as which part
          of the platform failed and why, and is used purely to keep the platform reliable.
        </p>
        <p>
          We choose these providers carefully and require that each of them protect your
          information appropriately. None of these providers are permitted to use your data for
          their own independent purposes, such as advertising, beyond performing the specific
          function RentaPay uses them for.
        </p>

        <h2>6. Data Retention</h2>
        <ul>
          <li>Active account data, including your profile, your units, and your ongoing payment
            history, is retained for as long as the relevant account remains active, so that both
            landlord and tenant have continuity of records throughout a tenancy and afterward;</li>
          <li>Payment confirmation submissions, meaning the proof of payment images and M Pesa
            message details a tenant or landlord submits for review, are retained for six months
            by default once they have been confirmed or rejected, after which they are
            automatically removed, or deleted sooner at the landlord's or manager's own discretion.
            The underlying completed payment record itself, meaning the amount, the date, and the
            status, is retained for ongoing record keeping even after the supporting proof image
            has been removed;</li>
          <li>One time codes used for account verification and password resets expire shortly
            after they are issued and are not retained beyond that short validity window;</li>
          <li>An activity log of a general manager's actions is retained for as long as that
            general manager account exists, so a landlord retains the ability to review and, where
            appropriate, revert an action taken under it;</li>
          <li>Where an account is deleted, as described in Section 7 below, we retain the minimum
            data necessary to comply with legal, tax, or accounting obligations, and to prevent
            fraud, for example retaining a record that a given phone number was previously
            associated with a now closed account, without retaining that account's full profile.</li>
        </ul>

        <h2>7. Your Rights and Choices</h2>
        <p>Under the Data Protection Act, 2019, and consistent with how RentaPay itself works, you can:</p>
        <ul>
          <li><strong>Access</strong> the personal data RentaPay holds about you, most of which is
            already visible directly within your own account, including your profile, payment
            history, and ratings;</li>
          <li><strong>Correct</strong> most of your own details directly within the app. A small
            number of fields, specifically your full name, your national identification number,
            your move in date, and your email address, are controlled by your landlord or manager
            if you are a tenant, or are fixed after registration for every role in the case of
            email, because they anchor your login identity and, for a tenant, your portable rating
            history. Contact your landlord or manager, or RentaPay support directly, to request a
            correction to one of these fields;</li>
          <li><strong>Request deletion</strong> of your account and its associated data, using the
            Help option within the app, through your landlord or property manager if you are a
            tenant, or by contacting the RentaPay team directly. As explained in Section 6, some
            records may be retained where required for legitimate record keeping, fraud
            prevention, or legal compliance;</li>
          <li><strong>Object to or restrict</strong> certain processing, such as opting out of the
            optional landlord portfolio digest email at any time from your settings;</li>
          <li><strong>Withdraw consent</strong> for optional features, such as choosing not to
            generate or share a tenant reputation link, or a landlord choosing not to mark a unit
            as publicly listed, or choosing not to enable push notifications.</li>
        </ul>
        <p>
          We will respond to a legitimate request within a reasonable time and in line with our
          obligations under Kenyan data protection law. Where we are unable to fulfil part of a
          request, for example because a record must be retained for legal compliance, we will
          explain why.
        </p>

        <h2>8. Security</h2>
        <p>
          We apply technical and organisational measures intended to protect your data, including
          encrypted password and Operations PIN storage using a one way cryptographic hash rather
          than plain text, role based access controls so that an account only ever sees what its
          own role permits, rate limiting and temporary lockouts after repeated failed login
          attempts, and encrypted transport using HTTPS for every request sent to and from the
          platform. No system can ever be guaranteed to be completely secure, and we encourage you
          to use a strong, unique password, to keep your own login credentials confidential, and to
          notify us promptly if you believe your account has been accessed without your
          authorisation.
        </p>

        <h2>9. International Data Transfers</h2>
        <p>
          Some of RentaPay's infrastructure providers, described in Section 5, may process or
          store data outside Kenya as part of delivering the service, for example as part of cloud
          hosting or email delivery infrastructure operated internationally. Where this occurs, we
          take reasonable steps to ensure the provider concerned offers an adequate level of data
          protection, consistent with the requirements of the Data Protection Act, 2019.
        </p>

        <h2>10. Children's Privacy</h2>
        <p>
          RentaPay is not directed at, and does not knowingly collect personal data from, anyone
          under the age of eighteen. A tenant account belongs to the adult tenant it is created for,
          not to any minor living in the same household. If you believe a minor has provided us
          with personal data, please contact us using the details in Section 15 so we can address
          it.
        </p>

        <h2>11. Automated Decisions</h2>
        <p>
          Where RentaPay's own systems automatically flag something for a human being to review,
          for example flagging a meter reading that looks unusually high compared to that meter's
          history, or flagging a rating for possible abuse, that flag is only ever a prompt for a
          person to look more closely. RentaPay does not make a final decision that produces a
          legal or similarly significant effect on you, such as terminating your account, using
          fully automated processing alone, without a human being involved.
        </p>
        <p>
          The one exception is confirming a rent or subscription payment made through the
          automatic M Pesa flow (Section 4.1b/4.2 of our Terms of Service): once Safaricom reports
          that a payment succeeded, RentaPay updates the relevant balance automatically, with no
          person reviewing that specific payment first. We treat this differently from an
          automated decision in the above sense, because RentaPay is not evaluating you or
          exercising judgment about you — it is recording a factual outcome reported directly by
          Safaricom, the same transaction that would have occurred with or without RentaPay. You
          can still dispute any payment recorded this way through the in app dispute tool, which is
          reviewed by a human being, and a landlord can always switch back to manual confirmation
          for future payments.
        </p>

        <h2>12. Cookies and Similar Technologies</h2>
        <p>
          RentaPay uses a small number of strictly necessary cookies or similar local storage
          mechanisms to keep you logged in between visits and to remember basic preferences, such
          as whether you have already seen the introductory walkthrough. RentaPay does not use
          cookies for third party advertising or cross site tracking.
        </p>

        <h2>13. Marketing Communications</h2>
        <p>
          RentaPay does not send unsolicited marketing communications to tenants. A landlord who
          has opted into the optional portfolio digest email will continue receiving it until they
          opt out from their settings. Where RentaPay does send information about a new feature or
          a change relevant to your account, that message is considered part of operating the
          service, not third party marketing, and follows the same email delivery process described
          in Section 5.3.
        </p>

        <h2>14. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time as the platform evolves, for example
          to reflect a new feature that processes data differently, or a change in applicable law.
          Where a change is material, we will make reasonable efforts to notify account holders
          within the app or by email ahead of that change taking effect. The date at the top of
          this page reflects the most recent revision, and we encourage you to review this policy
          periodically.
        </p>

        <h2>15. Definitions</h2>
        <p>
          Data controller means the entity that decides why and how personal data is processed,
          which for the purposes of this policy is RentaPay in relation to the platform as a whole,
          and a landlord in relation to the tenant data that landlord manages within their own
          account. Data processor means an entity that processes personal data on behalf of a
          controller, which describes RentaPay's own infrastructure providers listed in Section 5.
          Personal data means any information relating to an identified or identifiable natural
          person. Processing means anything done with personal data, including collecting, storing,
          using, sharing, and deleting it. Data subject means the individual the personal data is
          about, meaning you. These definitions follow the meanings given to them in the Data
          Protection Act, 2019, and are included here purely to make the rest of this policy easier
          to follow.
        </p>

        <h2>16. Legal Basis for Processing Your Data</h2>
        <p>
          Kenyan data protection law requires that personal data only be processed where a valid
          legal basis exists. Here is how that applies to the main categories of data described in
          Section 2 of this policy. Your name, phone number, email address, and account credentials
          are processed on the basis that they are necessary to perform the contract formed by
          these Terms, meaning RentaPay simply could not provide you an account without them. Your
          national identification number and emergency contact details, where a landlord requests
          them from a tenant, are processed on the basis of the contract between that landlord and
          tenant, and RentaPay processes them on the landlord's instruction as the party operating
          the platform the landlord has chosen to use. Payment records are processed both to
          perform the contract, since tracking a payment is a core feature you are using RentaPay
          for, and to comply with RentaPay's own legal obligations around financial record keeping.
          Security related information, such as login timestamps and device information used to
          detect suspicious activity, is processed on the basis of RentaPay's legitimate interest in
          keeping the platform secure for everyone, an interest we consider does not override your
          own rights given how narrowly this data is used. Optional features, such as the landlord
          portfolio digest email, push notifications, and a tenant's shareable reputation link, are
          processed on the basis of your consent, which you can withdraw at any time as described in
          Section 7.
        </p>

        <h2>17. National Identification Numbers and Other Sensitive Details</h2>
        <p>
          A national identification number is treated with particular care. It is collected only
          where a landlord specifically chooses to request it from a tenant as part of onboarding
          that tenant, is visible only to that tenant's own landlord and to the managers and
          caretakers that landlord has given access to that tenant's property, and is never
          displayed on any public page, including the public vacant unit listing pages described in
          Section 12 of our <Link to="/terms">Terms of Service</Link>. RentaPay does not use a
          national identification number for any purpose beyond identity verification requested by
          the landlord who collected it, and does not share it with any third party service
          provider described in Section 5 of this policy.
        </p>
        <p>
          RentaPay does not knowingly collect other especially sensitive categories of information
          about you, such as biometric data, precise real time location data from your device, health
          information, or payment card numbers. Where a Brand Ambassador submits a prospective
          landlord's general location, this means a broad area, such as a neighbourhood or town, not
          a precise coordinate captured from a device, and is used solely to help RentaPay
          understand where an introduced landlord's property is likely to be, for the purposes
          described in Section 22 below.
        </p>

        <h2>18. Backups and Disaster Recovery</h2>
        <p>
          Our infrastructure provider maintains routine backups of the database described in
          Section 5.2, so that RentaPay can recover from a technical failure without losing
          everyone's records. A backup may, for a limited period, contain a copy of data that has
          since been deleted from the live system, for example because you requested deletion of
          your account shortly before a backup was taken. Backups are retained only for a limited,
          rolling period needed for disaster recovery purposes, are not used for any everyday
          operational purpose, and age out automatically as newer backups replace them.
        </p>

        <h2>19. Server and Application Logs</h2>
        <p>
          Like most web applications, RentaPay's servers keep short lived technical logs of requests
          made to the platform, used to diagnose problems, monitor performance, and detect abuse.
          These logs typically include things such as which endpoint was called, how long it took to
          respond, and whether it succeeded or failed, and are retained only for a limited period
          before being automatically rotated out, except where a specific log entry is needed for
          longer as part of investigating a genuine security incident.
        </p>

        <h2>20. Community Board and Support Chat Data in Detail</h2>
        <p>
          A post or reply you make on a property's community board is stored together with your
          name and account role, and remains visible to other members of that same community for as
          long as it is not removed, either by you or by RentaPay under Section 7 of our Terms of
          Service. A conversation you have with RentaPay's own support team through in app chat is
          stored so that support staff can review the history of your query, so a different support
          staff member can pick up an ongoing conversation without you needing to repeat yourself,
          and so a conversation can be reviewed later for quality and training purposes. Where a
          landlord or manager uses chat to message a tenant directly, that conversation is visible
          to the landlord, manager, or caretaker on that side and to the tenant on the other side,
          and to RentaPay's own team only where needed to investigate a reported problem.
        </p>

        <h2>21. Reports, Audit Logs, Documents, and Exported Data</h2>
        <p>
          The reporting and export tools described in Section 26 of our
          <Link to="/terms"> Terms of Service</Link>, including a landlord's annual report, data
          export, document storage, expense tracking, and general manager audit log, all operate
          strictly within the same visibility boundaries described in Section 4 of this policy. A
          document a landlord uploads, an expense a landlord records, and an audit log entry
          generated by a general manager's action, are all visible only to that landlord and to the
          managers, caretakers, and general managers that landlord has given the relevant access to,
          never to another landlord's account, and never to the public.
        </p>

        <h2>22. Brand Ambassador Data in Detail</h2>
        <p>
          Where a Brand Ambassador submits a prospective landlord's name, phone number, and general
          location to RentaPay ahead of that landlord registering their own account, that
          information is stored so RentaPay can attribute the eventual registration back to the
          correct Brand Ambassador for qualification and payout purposes. Once the prospective
          landlord registers their own account, their information from that point onward is
          governed like any other landlord's data under this policy, and the earlier submission from
          the Brand Ambassador is retained only as needed to support that attribution. A Brand
          Ambassador's own payout details, submitted so RentaPay can pay a qualified commission, are
          visible only to RentaPay's own finance and support team and to the Brand Ambassador
          themselves.
        </p>

        <h2>23. Data Breach Notification</h2>
        <p>
          If RentaPay becomes aware of a breach of security that is likely to result in a risk to
          your rights and freedoms, such as unauthorised access to your personal data, we will
          assess the breach promptly, take reasonable steps to contain it, and, where required by
          the Data Protection Act, 2019, notify the Office of the Data Protection Commissioner and
          affected account holders within the timeframe that law requires, describing what happened,
          what data was involved, and what steps we are taking in response.
        </p>

        <h2>24. Your Right to Complain to a Regulator</h2>
        <p>
          While we hope you will raise a concern with us first, using the contact details in Section
          15, you also have the right to lodge a complaint directly with the Office of the Data
          Protection Commissioner in Kenya if you believe your personal data has been processed in a
          way that breaches the Data Protection Act, 2019. Raising a concern with us first often
          resolves the issue faster, since we can look into your specific account directly, but this
          right exists independently of whether you choose to contact us first.
        </p>

        <h2>25. Do Not Track and Similar Browser Signals</h2>
        <p>
          Some browsers offer a do not track signal or a similar setting. Because there is no
          common industry standard for how a website should respond to that signal, RentaPay does
          not currently change its behaviour based on it. As stated in Section 12, RentaPay does not
          use cookies for third party advertising or cross site tracking in any case, regardless of
          your browser's settings.
        </p>

        <h2>26. This Policy in Plain Language</h2>
        <p>
          Everything above is written to be precise and complete, but here is the short version.
          RentaPay collects the information needed to run your account, track rent, deposits, and
          utility bills, and let you communicate with the other people involved in your tenancy. We
          use a small number of trusted specialist companies to send email, host our database and
          files, process M Pesa payments, and deliver push notifications, and none of them are
          allowed to use your data for their own purposes. We never sell your data, and we never use
          it for advertising. You can see most of your own data directly in the app, correct what
          you are allowed to correct yourself, and ask us or your landlord to correct or delete the
          rest. A landlord can only see the tenants on their own properties, never anyone else's. A
          tenant's private rating comments are never shown to a landlord. If something goes wrong on
          our end that puts your data at risk, we will tell you and the regulator, as the law
          requires. If you are ever unsure about any of this, contact us and ask, rather than
          guessing.
        </p>

        <h2>27. Frequently Asked Questions</h2>
        <p>
          Does RentaPay share my phone number with advertisers. No. Your phone number is used only
          for account identification, M Pesa processing where relevant, and connecting a
          prospective tenant to a landlord through a public listing's WhatsApp link, never for
          advertising.
        </p>
        <p>
          Can I see everything RentaPay knows about me. Most of it is already visible directly in
          your account. For anything that is not, you can request it using the contact details in
          Section 15.
        </p>
        <p>
          What happens to my data if my landlord's account is closed. Your own tenant account and
          its data are handled as described in Section 6 and Section 19 of our
          <Link to="/terms"> Terms of Service</Link>, and your portable reputation record, if you
          have one, is not deleted simply because a particular landlord's account is closed.
        </p>
        <p>
          Who can I talk to if I am not sure whether something is a privacy issue or a general
          support issue. Either way, start with the Help option in the app. Our support team will
          route your question appropriately, including to a dedicated privacy contact where needed.
        </p>

        <h2>28. Additional Notes on Retention and Sub Processors</h2>
        <p>
          For clarity beyond the retention schedule in Section 6, temporary technical data such as
          server logs, described in Section 19, and backups, described in Section 18, follow their
          own shorter retention windows regardless of how long your account itself remains active,
          since they exist for operational and disaster recovery purposes rather than as part of
          your account's own record. The specific third party providers named in Section 5 may
          themselves rely on their own further sub processors, such as a data centre operator, to
          deliver the specific function RentaPay uses them for. RentaPay requires that any such sub
          processor be bound by data protection obligations at least as strong as those RentaPay
          itself commits to in this policy.
        </p>
        <p>
          Where you were introduced to RentaPay as a prospective landlord by a Brand Ambassador, as
          described in Section 22, and you never go on to register your own account, RentaPay
          retains only the limited information the Brand Ambassador submitted, for a reasonable
          period needed to support that Brand Ambassador's own qualification and payout process, and
          does not treat you as having a RentaPay account or any of the rights and obligations that
          come with one until you actually register.
        </p>

        <h2>29. Illustrative Data Flow: From Public Listing to Registered Tenant</h2>
        <p>
          To help make Sections 2 through 5 concrete, here is a short example of how information
          about one prospective tenant moves through RentaPay. A prospective tenant browses
          RentaPay's public vacant unit listing pages without creating any account at all. At this
          stage, RentaPay has not collected that prospective tenant's name, phone number, or any
          other personal detail, since browsing a public listing requires no account. The
          prospective tenant taps the WhatsApp link on a unit they are interested in, which opens a
          WhatsApp conversation directly with the appropriate landlord, manager, or caretaker.
          RentaPay's own server resolves which phone number that link should open on the fly,
          without ever displaying that number on the page itself, but the WhatsApp conversation
          itself then takes place entirely within WhatsApp, a separate service operated by Meta, not
          within RentaPay, and is not visible to RentaPay at all. If the prospective tenant goes on
          to move into the unit, the landlord or manager then creates a tenant account for them, or
          invites them to complete self onboarding, at which point the full set of tenant data
          described in Section 2 begins to be collected under this policy, tied to that new account.
        </p>

        <h2>30. WhatsApp and Other External Links</h2>
        <p>
          Where RentaPay links out to an external service, most notably the WhatsApp link on a
          public listing page described in Section 29 above, anything that happens after you leave
          RentaPay and land on that external service is governed by that service's own privacy
          policy and terms, not by this one. We choose reputable, widely used services to link to,
          but we do not control how they themselves handle your data once you are using them
          directly.
        </p>

        <h2>31. How We Handle Requests From Authorities</h2>
        <p>
          Where a Kenyan court, regulator, or law enforcement authority makes a request for
          information that we are legally required to comply with, we will disclose only the
          specific information covered by that request, verify that the request itself is valid and
          properly issued before responding wherever we are able to do so, and, where we are legally
          permitted to, make reasonable efforts to notify the affected account holder that a request
          was made.
        </p>

        <p>
          Each time this Privacy Policy is materially updated, the date at the top of this page
          changes to reflect that revision, and, as described in Section 14, we make reasonable
          efforts to notify account holders of a material change ahead of it taking effect. If you
          would like to understand what changed between two versions of this policy, contact us
          using the details in Section 15 and we will explain the substance of the change to you
          directly.
        </p>

        <h2>32. Version History of This Policy</h2>
        <p>
          Each time this Privacy Policy is materially updated, the date at the top of this page
          changes to reflect that revision, and, as described in Section 14, we make reasonable
          efforts to notify account holders of a material change ahead of it taking effect. If you
          would like to understand what changed between two versions of this policy, contact us
          using the details in Section 15 and we will explain the substance of the change to you
          directly.
        </p>

        <h2>34. Account Sessions and How Sign In Is Kept Secure</h2>
        <p>
          When you sign in, RentaPay issues your device a signed session token that identifies
          your account and role. By default that token remains valid for seven days from the
          moment you sign in, after which you will be asked to sign in again; a platform operator
          can configure a shorter or longer session length for a given deployment, but seven days
          is the default every account starts from. Signing out, or changing your password,
          invalidates that token immediately rather than waiting for it to expire on its own. The
          token itself is never visible to you as readable text within the app and is not
          something we ask you to share with anyone, including someone claiming to be RentaPay
          support; a genuine member of our team will never ask you for it, for your password, or
          for a one time code sent to your phone or email, and any message asking for these things
          should be treated as fraudulent regardless of who it claims to be from.
        </p>
        <p>
          Repeated failed sign in attempts against the same account are rate limited, meaning that
          after a number of incorrect attempts in a short window, further attempts are
          automatically slowed down or temporarily blocked. This is a security measure aimed at
          making automated password guessing impractical; it is not intended to lock a genuine
          user out for an extended period, and normal access resumes once the short window has
          passed. The same broader rate limiting also applies, at a more generous threshold, to
          the platform's other endpoints as a whole, so that a single account, device, or script
          cannot overwhelm RentaPay's servers in a way that would degrade the service for everyone
          else using it at the same time.
        </p>

        <h2>35. How Reports, PDFs, and Exported Files Are Generated and Delivered</h2>
        <p>
          Certain features, such as an annual report, a tax summary, a financial report in
          spreadsheet friendly CSV format, or a ZIP file of payment receipts, are generated as a
          background job rather than instantly, because assembling them can take longer than a
          typical web request should. When you request one of these, the request is queued, a
          background worker process assembles the file from the same underlying records described
          in Section 2, and the finished file is placed into a private storage location that is
          not publicly browsable. You are then given a link to download it. That link is a signed
          URL, meaning it encodes a limited amount of time, currently one hour from when it is
          issued, during which the specific file it points to can be downloaded; after that window
          the link stops working and, if you still need the file, a fresh one must be generated by
          requesting the report again. If the background queue used for this feature is not
          available on a given deployment, RentaPay automatically falls back to generating certain
          smaller reports immediately within the original request instead, so the feature keeps
          working, just without the queued, larger scale version of it.
        </p>

        <h2>36. Error Monitoring</h2>
        <p>
          Where a deployment of RentaPay has error monitoring configured, unhandled errors that
          occur while the server is processing a request, for example an unexpected failure while
          calculating a rent balance or contacting a payment provider, are reported to that error
          monitoring tool so our team can find and fix the underlying bug. An error report of this
          kind typically includes technical details about the failure itself, such as which part
          of the code raised it and the request path involved, and may incidentally include
          limited account identifiers connected to the request that failed, but it is not used as
          a general record of what you do on RentaPay and is not linked back to build a profile of
          your activity. Where a deployment has not configured error monitoring, errors are
          instead only written to that server's own operational logs, described further in
          Section 19, and are not sent to any external error tracking tool at all.
        </p>

        <h2>37. Subscription Billing Records</h2>
        <p>
          A landlord's subscription fee is calculated from the number of units on their account
          and the billing period they choose, with longer prepaid periods (three, six, or twelve
          months at a time) qualifying for a discounted effective monthly rate compared to paying
          month to month. The specific base rate per unit and the discount percentage attached to
          each period length are configured centrally and can change over time; whichever rate was
          in effect at the moment a given subscription payment was calculated is the rate recorded
          against that payment, so a landlord's historical billing records always reflect the
          actual price they were charged at the time, even if the standard rate has since changed.
          We retain the history of subscription payments, the unit count and period length each
          one was calculated from, and the M Pesa transaction details confirming payment, for the
          same reasons and retention approach described in Section 6.
        </p>

        <h2>38. WhatsApp, SMS, and Other Outbound Messages in Detail</h2>
        <p>
          Beyond email, RentaPay sends certain notifications, such as a payment confirmation or a
          rent due reminder, as a message to the phone number on file for your account. The exact
          delivery channel used for these messages depends on how a given deployment is
          configured and can change over time as the underlying provider changes; regardless of
          which channel carries the message, sending it never blocks or reverses the action that
          triggered it; if a payment is recorded successfully but the accompanying notification
          fails to send for any reason, such as your phone being unreachable at that moment, the
          payment record itself is entirely unaffected, and you can always see the same
          information inside the app directly rather than relying on the outbound message alone.
          If a deployment has an outbound messaging channel temporarily switched off entirely, for
          example while a technical or account issue with that channel's provider is being
          resolved, notifications sent that way simply do not go out during that period, and this
          is reflected honestly on our status page described in Section 40 rather than reported as
          working when it is not.
        </p>

        <h2>39. Rate Limiting and Automated Traffic</h2>
        <p>
          To keep RentaPay responsive for everyone, requests to our servers are rate limited: each
          IP address is allowed a set number of requests within a rolling time window across the
          platform generally, with a stricter, separate limit applied specifically to sign in
          attempts as described in Section 34. If you or an automated tool you use exceeds these
          limits, further requests are temporarily rejected with a message asking you to try again
          shortly, rather than being permanently blocked. We do not use rate limiting data to
          build a profile of your browsing habits elsewhere on the internet; it exists solely to
          protect the availability of the service for all users at once.
        </p>

        <h2>40. Public Status Page</h2>
        <p>
          RentaPay publishes a public status page, accessible without signing in, that reports in
          real time whether core parts of the platform, such as sign in, payments, email delivery,
          file storage, and several other subsystems, are operating normally. Checking that page
          does not require an account and is not itself logged against any account of yours. The
          status page exists so that if something is not working, you can quickly tell whether the
          problem is on RentaPay's end or specific to your own device or connection, without
          needing to contact support first.
        </p>

        <h2>41. Data We Do Not Collect</h2>
        <p>
          It is as important to say plainly what RentaPay does not collect as it is to describe
          what it does. We do not collect your M Pesa PIN, mobile money account password, bank
          card number, card verification value, or online banking credentials of any kind; where a
          payment is confirmed automatically, it is confirmed through Safaricom's Daraja platform
          without RentaPay ever seeing or storing those credentials, and where a payment is
          confirmed manually by uploading a screenshot, we store only the image you choose to
          upload and the transaction reference visible on it, not any credential used to make that
          payment. We do not collect your government login details, biometric data such as a
          fingerprint or facial scan, precise real time location tracking of your device as you
          move around, the contents of your private messages on other platforms, or your browsing
          activity on websites outside RentaPay. We do not buy personal data about you from data
          brokers, and we do not sell the personal data we do hold to anyone, in the sense that
          word is used under Kenya's Data Protection Act, 2019.
        </p>

        <h2>42. How Uploaded Files and Images Are Stored</h2>
        <p>
          Photographs and documents you upload, such as a unit photo, a payment proof screenshot,
          a maintenance issue photo, or a supporting document attached to a dispute, are stored in
          cloud file storage operated by our infrastructure provider on RentaPay's behalf, in a
          storage location that is not browsable or listable by the general public. Some uploaded
          images, such as a unit photo attached to a public vacant unit listing, are intentionally
          made viewable through a direct link so that the listing can display them to a
          prospective tenant browsing without an account; other uploads, such as a payment proof
          screenshot or a tenant's personal document, are kept private and are only accessible to
          the account holders who have a legitimate reason to see them, as described in Section 4.
          Removing a unit's photo, or a document you uploaded, from within the app removes it from
          the location it was displayed; a copy may persist for a limited time afterward in
          backups, consistent with Section 18.
        </p>

        <h2>43. A Note on Roommates, Co-Tenants, and Household Members</h2>
        <p>
          Where a unit is shared by more than one named tenant, or where a tenant's household
          includes people who are not themselves registered as a RentaPay user, such as a spouse,
          child, or roommate who was never added as their own account, information about the unit,
          balance, and payment history is visible to the named tenant account holder or holders on
          that unit, not to every person physically living there. If your landlord has recorded
          household or emergency contact details about someone who is not a RentaPay user
          themselves, for example a next of kin's name and phone number, that information is
          treated the same way as the rest of a tenant's record described in this policy, and a
          request from that person to know what is held about them, or to have it corrected or
          removed, can be made through the tenant account holder or directly to us using the
          contact details below.
        </p>

        <h2>44. Contact</h2>
        <p>
          For privacy questions, an access or deletion request, or to exercise any of the rights
          described in Section 7 above, use the Help option within the app or contact the RentaPay
          team directly. Our support email address is displayed within the Help section of the app
          and in the footer of our emails.
        </p>
      </div>
    </div>
  );
}
