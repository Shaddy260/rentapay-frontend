import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

export default function Terms() {
  return (
    <div className="legal-page">
      <div className="legal-page__card">
        <Link to="/login" className="ghost-link">Back to login</Link>
        <h1>Terms of Service</h1>
        <p className="legal-page__updated">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <p>
          Welcome to RentaPay. These Terms of Service, which we refer to simply as the Terms,
          govern your access to and use of RentaPay, a rent management platform built for the
          Kenyan rental market. RentaPay helps landlords, property managers, caretakers, general
          managers, tenants, and prospective tenants track rent, record and confirm payments,
          manage maintenance requests, communicate with each other, and keep a shared, orderly
          history of a tenancy from move in to move out. This document is intentionally long and
          detailed, because we would rather explain exactly how the platform works than leave you
          guessing. Please take the time to read it in full.
        </p>
        <p>
          By creating an account, accepting an invitation to join an account, accessing the
          RentaPay website or app, or otherwise using the service in any way, you agree to be
          bound by these Terms and by our <Link to="/privacy">Privacy Policy</Link>, which is
          incorporated into these Terms by reference and should be read together with them. If
          you are creating or using an account on behalf of a company, partnership, or other
          organisation, you confirm that you have the authority to bind that organisation to
          these Terms, and the words you and your then refer to that organisation as well as to
          you personally. If you do not agree with any part of these Terms, you must not create
          an account or otherwise use RentaPay.
        </p>
        <p>
          These Terms are written to cover, among other things, what RentaPay is and what it is
          not, how the different account roles work and what each one can and cannot do, how rent
          payments and landlord subscription payments are handled, how security deposits and
          utility submetering are recorded, what conduct is and is not allowed on the platform,
          how tenant ratings and reputation scores work, how disputes, complaints, and maintenance
          requests are handled, how the community board, chat, and support features work, how the
          Brand Ambassador program works, how intellectual property in the platform is owned and
          licensed, how service availability and changes are handled, how liability is limited,
          how accounts can be suspended or terminated, which law governs the relationship between
          you and RentaPay, and how you can contact us. Numbered section headings are provided
          purely to make the document easier to navigate and do not limit the meaning of any
          clause.
        </p>

        <h2>1. What RentaPay Is, and What RentaPay Is Not</h2>
        <p>
          RentaPay is a record keeping, notification, reminder, and communication tool built
          around residential and small commercial rentals in Kenya. Its purpose is to make it
          easier for everyone involved in a tenancy, landlords, property managers, caretakers,
          general managers, and tenants, to track balances, confirm payments, share documents,
          request and follow up on maintenance, record security deposits, submit and review meter
          readings for shared or individual water and electricity billing, and generally stay in
          touch with a clear, shared, timestamped record of what has happened. RentaPay exists to
          support the legal relationship that already exists between a landlord and a tenant, not
          to replace, alter, or interpret it.
        </p>
        <p>To be completely explicit, RentaPay is not any of the following, and you should not
          treat it as any of the following when deciding how to use the platform or when relying
          on anything it displays:</p>
        <ul>
          <li>RentaPay is not a bank, a deposit taking institution, a lender, a microfinance
            provider, or an issuer of electronic money of any kind;</li>
          <li>RentaPay is not an escrow agent, trustee, or custodian of rental deposits or rent
            payments, and at no point in the payment flows described in these Terms does RentaPay
            take possession, custody, or control of a tenant's rent money or a security deposit;</li>
          <li>RentaPay is not a party to any lease, tenancy agreement, or rental arrangement
            entered into between a landlord and a tenant, whether that agreement is written,
            oral, or implied by conduct;</li>
          <li>RentaPay is not a letting agency, estate agency, or property broker, unless a
            specific landlord, manager, or other individual using the platform happens to be
            separately and independently licensed as one under their own name, in which case that
            licensing has nothing to do with RentaPay itself;</li>
          <li>RentaPay is not a guarantor of any payment, of a unit's habitability or condition,
            of a tenant's conduct, or of a landlord's, manager's, or caretaker's conduct;</li>
          <li>RentaPay is not a court, tribunal, arbitrator, mediator, or any other body with
            authority to make a binding decision about a dispute between a landlord and a tenant.</li>
        </ul>
        <p>
          Rent amounts, security deposit amounts, notice periods, permitted uses of a unit, and
          every other substantive term of a tenancy remain matters agreed directly between the
          landlord and the tenant, under whatever tenancy agreement they have entered into and
          under applicable Kenyan law, including any relevant landlord and tenant legislation and
          any county level regulation that may apply to a particular property. RentaPay simply
          gives both sides a shared place to record, track, and confirm what has already been
          agreed elsewhere. When these Terms describe a feature of RentaPay, such as recording a
          security deposit as held, refunded, partially refunded, or forfeited, that description
          is about how RentaPay stores and displays information, not about what the underlying
          tenancy law says should happen to that deposit.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          To create a RentaPay account in any role, you must be at least eighteen years old and
          capable of entering into a legally binding contract under the laws of Kenya. RentaPay
          is not directed at, and does not knowingly allow registration by, anyone under the age
          of eighteen. If we become aware that an account belongs to someone under eighteen, we
          may suspend or close that account. A tenant account is normally created by a landlord
          or property manager on behalf of an adult tenant as part of onboarding a new tenancy,
          or, where a landlord has enabled self onboarding for a property, completed directly by
          the tenant themselves once invited, but in either case the person the account belongs to
          must meet this same age and capacity requirement.
        </p>
        <p>
          By registering for an account, or by accepting an invitation to one, you confirm that
          every piece of information you provide, including your full name, phone number, email
          address, national identification number where requested, emergency contact details
          where requested, and, for landlords, every property and unit detail you enter, is
          accurate, current, and not misleading, and you agree to keep that information up to date
          as it changes. Providing false identity information, or impersonating another real
          person when creating or using an account, is a serious breach of these Terms.
        </p>

        <h2>3. Account Roles and What Each One Can Do</h2>
        <p>
          RentaPay accounts are organised into distinct roles, each with different permissions and
          different visibility into the platform's data. Understanding these roles matters,
          because a large part of how RentaPay protects everyone's information depends on these
          boundaries being respected.
        </p>
        <h3>3.1 Landlord</h3>
        <p>
          The landlord account is the account that owns a property listing on RentaPay. A
          landlord's account has full visibility into that landlord's own properties, units,
          tenants, financial records, and reports, manages the landlord's own subscription
          billing, and controls which property managers, caretakers, and general managers can
          access which properties. A landlord can create, edit, and archive units, set rent
          amounts and due dates, review and confirm or reject payment submissions, record and
          settle security deposits, configure utility submetering, mark a unit as publicly listed
          when it is vacant, add and remove tenants, generate reports including an annual report
          and a data export, and manage every other landlord side feature described elsewhere in
          these Terms.
        </p>
        <h3>3.2 Property Manager</h3>
        <p>
          A property manager account is added by a landlord to help run one or more of that
          landlord's properties. A property manager's permissions are set by the landlord who
          added them and can be scoped to a subset of the landlord's properties rather than the
          whole portfolio. Depending on what the landlord allows, a property manager may be able
          to confirm payments, manage tenants, handle maintenance requests, respond to disputes,
          and use most of the same day to day tools a landlord uses for the properties they have
          been given access to.
        </p>
        <h3>3.3 General Manager</h3>
        <p>
          A general manager account is a more senior, trusted management role that a landlord may
          choose to create, intended for someone who effectively runs the operational side of a
          landlord's business across some or all of the landlord's properties. A general manager
          protects sensitive actions behind their own personal four digit Operations PIN, set
          during onboarding and changeable at any time from settings, which is separate from their
          login password and is required again before certain higher risk actions can be
          completed. A landlord retains the ability to review a general manager's actions through
          an activity log, and certain general manager actions can be reviewed and, where
          appropriate, reverted by the landlord.
        </p>
        <h3>3.4 Caretaker</h3>
        <p>
          A caretaker account is a more limited manager role, typically used for on site staff.
          A caretaker is usually able to confirm payments, submit meter readings, handle
          maintenance requests, and manage day to day tenant contact, but without access to more
          sensitive financial controls, such as changing rent amounts, editing subscription
          billing, or seeing portfolio wide financial reports, unless the landlord has specifically
          extended additional permissions to that caretaker.
        </p>
        <h3>3.5 Tenant</h3>
        <p>
          A tenant account is associated with one specific rented unit at a time. A tenant can view
          their own balance and payment history, submit proof of a rent payment they have made
          directly to their landlord, raise maintenance requests and complaints, dispute a payment
          record they believe is wrong, view their own security deposit status once it has been
          recorded by the landlord or manager, view any utility bill issued against their unit,
          post to and read the community board where enabled, chat with support, and rate their
          landlord, manager, or the property once a tenancy has reached the relevant point. A
          tenant cannot see another tenant's balance, payment history, or personal details, even
          within the same property.
        </p>
        <h3>3.6 Brand Ambassador</h3>
        <p>
          A Brand Ambassador is an independent representative who has agreed to a separate
          arrangement with RentaPay to introduce new landlords to the platform in exchange for a
          payout once an introduced landlord meets qualification criteria set by RentaPay, such as
          remaining an active, paying subscriber for a defined period. A Brand Ambassador is not
          an employee or agent of RentaPay with authority to bind RentaPay to anything, and a Brand
          Ambassador account has its own separate dashboard showing only the landlords that Brand
          Ambassador has introduced, along with each one's qualification and payout status. A
          Brand Ambassador's own conduct when contacting a prospective landlord remains that Brand
          Ambassador's responsibility.
        </p>
        <h3>3.7 Account Security and Shared Identifiers</h3>
        <p>
          A phone number or an email address may only be associated with one active account of a
          given role at a time. RentaPay uses these identifiers, together with other technical
          signals, to reduce duplicate accounts and to make it harder for someone to impersonate
          another person. You are responsible for keeping your own login credentials confidential
          and for all activity that takes place under your account, whether or not you personally
          performed that activity, unless it resulted from RentaPay's own fault. If you believe
          your account has been accessed without your authorisation, you must notify us promptly
          using the contact details in Section 22 so we can help secure it.
        </p>
        <p>
          Landlords are responsible for the accuracy of the property, unit, and rent information
          they enter, and for the conduct of any property manager, caretaker, or general manager
          account they create or to whom they grant access to their properties. Removing a
          manager's, caretaker's, or general manager's access is the landlord's own responsibility
          and can be done at any time from the landlord's dashboard. RentaPay is not responsible
          for a landlord's delay in removing access from someone whose role or employment has
          ended.
        </p>

        <h2>4. Payments and Subscriptions</h2>
        <p>
          Money moves through RentaPay in two fundamentally different flows, and it is important
          that you understand the difference between them before relying on anything RentaPay
          displays about a payment.
        </p>
        <h3>4.1 Rent Payments, From Tenant to Landlord</h3>
        <p>
          A tenant pays rent using M Pesa, whether through a Paybill number, a Buy Goods Till
          number, or a direct Send Money transfer, sent directly to the landlord's own M Pesa
          Paybill, Till number, or personal phone number. This payment never passes through a
          RentaPay controlled account, and it is never initiated through an M Pesa STK push
          triggered by RentaPay on the tenant's side. Once the tenant has made the payment outside
          the app, the tenant then submits proof of that payment within RentaPay, consisting of
          the M Pesa transaction code, the amount paid, the payer name and phone number shown on
          the M Pesa confirmation message, and the time shown on that message. A landlord,
          property manager, or caretaker with access to that tenant's unit then reviews this
          submission and either confirms it as received or rejects it.
        </p>
        <p>
          RentaPay does not hold, take custody of, guarantee, insure, or exercise any control over
          rent funds at any point in this process. RentaPay records what has been reported by a
          tenant and reviewed by a landlord, manager, or caretaker. A payment marked confirmed
          within RentaPay reflects that landlord's, manager's, or caretaker's own decision that
          they personally received the funds. It is not a guarantee made by RentaPay, and RentaPay
          is not liable if a landlord, manager, or caretaker confirms a payment they did not
          actually receive, or fails to confirm a payment they did receive, whether that happens
          by honest mistake or in bad faith. Reviewing and confirming a submitted payment is a
          manual step performed by a human being on the landlord's side and is not instantaneous.
          It may take anywhere from a few minutes to a few hours, and in some cases longer,
          depending on how quickly the landlord, manager, or caretaker responds. A payment
          confirmation, once made, can still be challenged through the in app dispute process
          described in Section 8 of these Terms, but resolving what actually happened with the
          underlying rent obligation remains a matter between the landlord and the tenant.
        </p>
        <h3>4.1a Optional Late Payment Penalty</h3>
        <p>
          A landlord may choose to enable a late payment penalty on their account, applied to
          overdue rent (and, if they choose, overdue utility or other charges tracked in the app).
          This feature is off by default and is never enabled without the landlord's own action.
          The rate, whether it applies per day or per week, and whether a maximum cap applies are
          all set by that individual landlord, not by RentaPay, and different landlords on the
          platform may use different terms. RentaPay is not a party to the penalty amount itself:
          it is a term of the tenancy set by the landlord, calculated automatically by the app
          according to the formula that landlord has configured, and RentaPay does not collect,
          hold, or benefit from any penalty amount charged. A tenant can see the exact formula and
          amount currently applied to their tenancy within their own portal at any time, and a
          landlord or property manager may waive or adjust a penalty for a specific tenant and
          billing period, which is always shown to that tenant rather than applied silently.
        </p>
        <h3>4.2 Landlord Subscription Fees, From Landlord to RentaPay</h3>
        <p>
          Access to RentaPay's landlord, property manager, general manager, and caretaker features
          requires an active subscription tied to the landlord's account. Subscription fees are
          billed to the landlord and are ordinarily paid using an M Pesa STK push initiated by
          RentaPay itself, sent to RentaPay's own Paybill number, so the landlord enters their
          M Pesa PIN once prompted and the payment is confirmed automatically once Safaricom
          reports it back to RentaPay. As an alternative, a landlord may instead pay a subscription
          manually, by sending payment to RentaPay's Paybill or Till number outside the app and
          then submitting proof within RentaPay in a similar way to how a tenant submits proof of
          a rent payment, in which case that submission starts in a pending state and requires an
          administrator at RentaPay to review and confirm it before access is unlocked.
        </p>
        <p>
          Subscription pricing, billing cycles, and any free trial or introductory terms that may
          be offered from time to time are as displayed within the app at the time of purchase or
          renewal, and may change from time to time. Where a pricing change would affect an
          existing subscriber, we will make reasonable efforts to provide notice within the app
          ahead of that change taking effect. If a subscription lapses because it was not renewed,
          access to certain landlord, property manager, caretaker, and general manager features,
          such as onboarding a new tenant or receiving the optional portfolio digest email, may be
          reduced or suspended until payment is made and confirmed. Existing tenant records,
          payment history, and other data already recorded are preserved rather than deleted
          simply because a subscription has lapsed, so a landlord who renews later does not lose
          their history.
        </p>
        <p>
          Subscription fees are generally not refundable once a billing period has begun, except
          where a refund is required by applicable law, or where RentaPay determines, in its own
          reasonable discretion, that a refund is warranted, for example where a technical error
          on RentaPay's side resulted in duplicate billing for the same period.
        </p>
        <h3>4.3 Loyalty Discounts</h3>
        <p>
          From time to time, RentaPay may grant a landlord a loyalty discount on their
          subscription, for example in recognition of a long standing, continuously active
          subscription. A granted loyalty discount, where offered, is generally subject to an
          expiry date, and an unused loyalty discount that is not applied before that date may
          lapse automatically. Any specific terms attached to a particular loyalty discount, such
          as its size, its duration, and how it is applied, are as displayed within the app at the
          time it is granted.
        </p>

        <h2>5. Security Deposits</h2>
        <p>
          Where a landlord chooses to record it, RentaPay lets a landlord or manager note that a
          tenant paid a security deposit at the start of a tenancy, together with the amount and
          the date it was paid. This deposit record is deliberately kept completely separate from
          a tenant's ordinary rent balance. A security deposit recorded in RentaPay is never added
          to a tenant's rent balance, is never available to be drawn down against unpaid rent
          automatically by the platform, and is never treated by RentaPay as its own money to hold
          or disburse. A tenant can see their own recorded deposit amount and status, but RentaPay
          itself never takes possession of that money.
        </p>
        <p>
          When a tenancy ends, a landlord or manager can record what happened to the deposit,
          marking it as fully refunded, partially refunded with a stated reason for any amount
          withheld, or forfeited entirely. This is a record keeping feature only. RentaPay does
          not decide, adjudicate, or verify whether a deduction from a deposit was fair, lawful,
          or supported by evidence of damage, and does not itself hold, transfer, or guarantee the
          return of any deposit amount. What is and is not a lawful deduction from a security
          deposit remains governed entirely by the tenancy agreement between landlord and tenant
          and by applicable Kenyan law.
        </p>

        <h2>6. Utility Submetering</h2>
        <p>
          Where a property has water or electricity meters that a landlord wants to bill tenants
          for individually, RentaPay provides tools for a landlord, manager, or caretaker to set up
          individual or shared meters, submit monthly meter readings, and have RentaPay calculate
          usage and cost based on a rate the landlord sets. For a shared meter covering several
          units, RentaPay splits the total usage cost across the units that had an active tenant
          during that billing period, based on occupied days, and a landlord or manager can review
          and, where a genuine reason exists, override an individual unit's occupied days or final
          billed amount before finalising the bill and sending it to the affected tenant or
          tenants. Once finalised, a utility bill becomes its own invoice, separate from a
          tenant's rent balance, so a tenant can view and, where the landlord has enabled tenant
          side payment for utilities, pay a water or electricity bill independently of paying
          rent.
        </p>
        <p>
          As with rent payments, RentaPay does not verify the accuracy of a submitted meter
          reading beyond basic checks such as flagging a reading that looks unusually high or low
          compared to that meter's history, and it is the landlord's, manager's, or caretaker's
          responsibility to record readings accurately and to resolve any dispute a tenant raises
          about a utility bill.
        </p>

        <h2>7. Acceptable Use</h2>
        <p>You agree that, in connection with your use of RentaPay, you will not do any of the following:</p>
        <ul>
          <li>Submit false, fraudulent, or misleading payment information, including confirming
            a payment as received when you have not genuinely verified that it was received;</li>
          <li>Impersonate another person, or create or maintain an account using another person's
            identity, phone number, or other contact details without that person's genuine
            consent;</li>
          <li>Attempt to circumvent, disable, or interfere with any security feature, request
            limit, or access control built into the platform;</li>
          <li>Use the platform to harass, threaten, discriminate against, or unlawfully evict a
            tenant, or to unlawfully withhold a tenant's security deposit;</li>
          <li>Use the community board, complaints tool, dispute tool, chat, or any other messaging
            feature to post unlawful, defamatory, hateful, or sexually explicit content, or
            content that infringes another person's rights;</li>
          <li>Scrape, copy, reverse engineer, or use any automated tool to extract data from
            RentaPay beyond the ordinary, manual use of your own account;</li>
          <li>Attempt to gain access to another account, another property, or another landlord's
            data that you have not been given permission to access;</li>
          <li>Use RentaPay for any purpose that violates applicable Kenyan law, including consumer
            protection law, data protection law, and landlord and tenant law.</li>
        </ul>
        <p>
          We reserve the right to investigate suspected violations of these Terms, and to suspend
          or terminate an account that violates them, with or without prior notice depending on
          the severity and urgency of the situation. Where we can reasonably do so without
          compromising an investigation, we will explain to the affected account holder why action
          was taken.
        </p>

        <h2>8. Tenant Ratings and Portable Reputation</h2>
        <p>
          RentaPay allows a landlord, property manager, or caretaker to rate a tenant on aspects
          such as payment reliability and care of the unit, and separately allows a tenant to rate
          their landlord, manager, or the property itself. A tenant's aggregate rating, built up
          from every landlord who has rated that tenant, broken down by category and by the role
          of the person who rated them, is tied to the tenant's own registered email address. This
          means that, entirely at the tenant's own option, that aggregate rating can follow the
          tenant to a new landlord who also uses RentaPay, or can be shared by the tenant
          themselves, using a link the tenant generates and chooses to send, when inquiring about
          a new vacant unit either on or off the platform.
        </p>
        <p>
          Ratings are the opinions of the account holder who submits them, not verified facts, and
          RentaPay does not independently confirm their accuracy before they are recorded. Any
          individual written comment attached to a rating is visible only to the tenant being
          rated, on that tenant's own account, and, where relevant, to RentaPay's own support and
          moderation team. Written comments are never shown to other landlords, even within a
          reputation summary a tenant chooses to share, which surfaces only the aggregate score and
          the category breakdown, never the underlying written text. A rating a tenant believes is
          inaccurate, retaliatory, or abusive can be flagged for review using the in app flagging
          feature, and RentaPay may, at its own reasonable discretion, remove or adjust a rating
          found to violate these Terms.
        </p>
        <p>
          RentaPay is not responsible for a decision a landlord makes on the basis of a tenant's
          rating history, and is not responsible for any effect a rating has on a tenant's ability
          to secure a new unit, whether on RentaPay or elsewhere.
        </p>

        <h2>9. Disputes, Complaints, and Maintenance Requests</h2>
        <p>
          RentaPay provides tools within the app for a tenant to dispute a payment record they
          believe is wrong, to raise a general complaint, or to submit a maintenance request, and
          for a landlord, manager, or caretaker to respond to any of these. These tools exist to
          make communication easier and to keep a shared, timestamped record of what was raised
          and how it was resolved. RentaPay does not itself adjudicate a dispute, does not mediate
          a complaint, and does not guarantee that a maintenance issue will be addressed within any
          particular timeframe. More serious disputes, for example over the return of a security
          deposit, an alleged unlawful eviction, or a habitability issue, are civil matters between
          landlord and tenant, and may ultimately need to be pursued through Kenya's courts, rent
          tribunals, or other dispute resolution bodies that exist outside RentaPay entirely.
        </p>

        <h2>10. Community Board</h2>
        <p>
          Where a landlord has enabled it, RentaPay's community board allows tenants and
          landlord side users associated with a particular property, or in some cases a wider
          area, to post and reply to one another, for example to share notices, ask questions, or
          arrange informal exchanges. Content posted to a community board is visible to other
          users of that same community and remains the sole responsibility of the person who
          posted it, not of RentaPay. RentaPay may remove content that violates Section 7 of these
          Terms once it becomes aware of it, but does not review or screen posts before they
          appear.
        </p>

        <h2>11. Chat and Support</h2>
        <p>
          RentaPay provides an in app chat and support system that a user can use to reach
          RentaPay's own support team, and that a landlord or manager can use to communicate with
          a tenant directly where that feature is enabled. Where you contact RentaPay's own
          support through this feature, you may be asked to rate the support you received once
          your query is resolved, and we may occasionally send a reminder asking for that rating if
          it has not yet been given. Support conversations may be reviewed by RentaPay staff for
          quality, training, and dispute resolution purposes.
        </p>

        <h2>12. Public Vacant Unit Listings</h2>
        <p>
          Where a landlord marks a unit as publicly listed, that unit's photos and basic details,
          such as location, rent, deposit requirements, and listing status, become visible on
          RentaPay's public vacant unit listing pages, which anyone can browse without creating an
          account. A prospective tenant who is interested in a publicly listed unit can be
          connected to the landlord, manager, or caretaker responsible for that unit through a
          WhatsApp link that resolves, on RentaPay's own server, to whichever of those roles is
          appropriate to contact first, without the underlying phone number ever being displayed
          directly on the page itself. A landlord can remove a unit from public listing at any
          time, and doing so removes it from these pages going forward.
        </p>
        <p>
          RentaPay does not verify the accuracy of listing details a landlord chooses to publish,
          and is not responsible for a landlord's failure to keep a public listing up to date, for
          example failing to mark a unit as no longer vacant once it has actually been let.
          RentaPay is also not a party to, and does not facilitate or guarantee, any tenancy
          agreement that results from a contact made through a public listing.
        </p>

        <h2>13. Brand Ambassador Program</h2>
        <p>
          A person who becomes a Brand Ambassador does so under a separate arrangement with
          RentaPay governing how landlords are introduced, how qualification is assessed, and how
          any payout is calculated and released. A Brand Ambassador's use of the RentaPay platform
          itself, including their own dashboard, is nonetheless governed by these Terms. A Brand
          Ambassador must not make any promise to a prospective landlord on RentaPay's behalf that
          RentaPay has not itself authorised, and remains responsible for the accuracy of any
          information they submit about a prospective landlord, such as that landlord's name,
          phone number, and general location, ahead of that landlord registering their own
          account. Qualification for a payout, including any required minimum period during which
          an introduced landlord must remain an active, paying subscriber, is assessed by RentaPay
          against criteria that may be updated from time to time and that are made available to
          Brand Ambassadors within their own dashboard.
        </p>

        <h2>14. Intellectual Property</h2>
        <p>
          The RentaPay name, logo, app, website, and the underlying software that powers them are
          the property of RentaPay and its licensors. You are granted a limited, personal,
          nonexclusive, nontransferable licence to use the platform for its intended purpose for as
          long as your account remains active and you comply with these Terms. Nothing in these
          Terms transfers any ownership of RentaPay's own intellectual property to you.
        </p>
        <p>
          You retain ownership of content you submit through the platform, such as unit photos,
          ratings, written comments, maintenance request descriptions, and messages. By submitting
          that content, you grant RentaPay a licence to store, display, and process it as needed
          to operate the service, for example showing a unit's photos on the public vacant unit
          listing page once a landlord marks that unit as publicly listed, or including a
          landlord's own portfolio statistics in that landlord's optional digest email. This
          licence lasts only as long as is needed to provide the relevant feature, and does not
          give RentaPay any right to use your content for advertising or for any purpose unrelated
          to operating the platform.
        </p>

        <h2>15. Service Availability and Changes</h2>
        <p>
          We aim to keep RentaPay available and reliable, but we do not guarantee that it will be
          available at all times or that it will operate without error. Features may be added,
          changed, or removed over time as the platform continues to develop, and scheduled or
          emergency maintenance may cause temporary unavailability of part or all of the service.
          Where a change is likely to significantly affect how you use RentaPay, we will make
          reasonable efforts to communicate it in advance, for example within the app or by email.
          A public status page, describing the operational state of RentaPay's key subsystems, is
          available at any time without needing to log in, so you can check whether a problem you
          are experiencing is likely on RentaPay's side.
        </p>

        <h2>16. Third Party Services RentaPay Relies On</h2>
        <p>
          RentaPay's own operation depends on a small number of external service providers, and it
          is worth understanding, in plain terms, what each one does and where responsibility sits
          if one of them has a problem. Safaricom's M Pesa platform, accessed through Safaricom's
          Daraja API, is used for landlord subscription payments initiated through the app, and,
          where a landlord enables it, may also be involved in tenant rent collection. A problem on
          Safaricom's own systems, such as an outage of M Pesa itself, is outside RentaPay's
          control, even though it may temporarily prevent a payment from completing inside
          RentaPay. Email delivery, including one time codes, password reset messages, receipts,
          and reminders, is handled through a third party email delivery provider. Database
          storage and file storage for records such as unit photos, payment proof screenshots, and
          documents are provided by a third party cloud infrastructure provider. None of these
          third parties are given more access to your information than is strictly needed for them
          to perform the specific function RentaPay uses them for, and each is described in more
          detail in our <Link to="/privacy">Privacy Policy</Link>.
        </p>

        <h2>17. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by Kenyan law, RentaPay and its officers, employees, and
          agents will not be liable for indirect, incidental, special, or consequential damages
          arising from your use of the platform, including but not limited to loss of rental
          income, a dispute over a security deposit, reliance on a tenant's or landlord's rating,
          or a delay in confirming a payment. RentaPay's total liability for any claim arising from
          these Terms, however that claim is framed, is limited to the total subscription fees you
          personally paid to RentaPay in the three months immediately preceding the event giving
          rise to the claim, except where such a limitation is not permitted by applicable law.
          Nothing in these Terms limits liability for fraud, for wilful misconduct, or for any
          other liability that cannot lawfully be limited or excluded under Kenyan law.
        </p>

        <h2>18. Indemnity</h2>
        <p>
          You agree to indemnify and hold RentaPay, and its officers, employees, and agents,
          harmless from any claim, loss, liability, or expense, including reasonable legal costs,
          arising out of your breach of these Terms, your violation of applicable law, or your
          infringement of any third party's rights, except to the extent that claim, loss,
          liability, or expense was caused by RentaPay's own breach of these Terms or its own
          negligence.
        </p>

        <h2>19. Account Suspension and Termination</h2>
        <p>
          You may stop using RentaPay, or request deletion of your account, at any time. See
          Section 6 of our <Link to="/privacy">Privacy Policy</Link> for exactly how a deletion
          request works and what happens to your data afterward. We may suspend or terminate an
          account that violates these Terms, that poses a security risk to RentaPay or to other
          users, or where required to do so by law, and we will make reasonable efforts to notify
          the affected account holder unless doing so would be inappropriate in the circumstances,
          for example where we reasonably suspect fraud and an advance warning would allow that
          fraud to continue.
        </p>
        <p>
          Where a landlord's account is terminated, that landlord's tenants will, wherever
          reasonably possible, be given notice so they can preserve their own payment history
          before it becomes inaccessible to them, and a tenant's own portable reputation record,
          being tied to the tenant's own email address rather than to any one landlord's account,
          is not deleted simply because a particular landlord's account is terminated.
        </p>

        <h2>20. Relationship Between These Terms and Individual Tenancy Agreements</h2>
        <p>
          Nothing in these Terms overrides, replaces, or takes priority over the actual tenancy
          agreement between a landlord and a tenant. Where something displayed within RentaPay, for
          example a due date, a rent amount, or a deposit status, appears to conflict with the
          underlying tenancy agreement, the tenancy agreement itself governs the legal relationship
          between landlord and tenant, and either party should raise the discrepancy with the other
          directly, and correct the record within RentaPay once it has been resolved between them.
        </p>

        <h2>21. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time as the platform evolves, for example to
          reflect a new feature, a change in applicable law, or feedback from our users. Where a
          change is material, we will make reasonable efforts to notify account holders within the
          app or by email ahead of that change taking effect. The date at the top of this page
          shows when these Terms were last revised. Continued use of RentaPay after a change takes
          effect constitutes your acceptance of the updated Terms. If you do not agree with an
          update, your only remedy is to stop using RentaPay and, if you wish, request deletion of
          your account as described in our Privacy Policy.
        </p>

        <h2>22. Governing Law and Disputes With RentaPay</h2>
        <p>
          These Terms, and any dispute or claim arising out of or in connection with them or with
          your use of RentaPay, are governed by the laws of the Republic of Kenya. Before
          commencing any formal legal proceeding against RentaPay, you agree to first attempt to
          resolve the matter informally by contacting us using the details in Section 24, giving
          us a reasonable opportunity to address the issue. Where a dispute cannot be resolved
          informally, it will be subject to the exclusive jurisdiction of the courts of Kenya.
        </p>

        <h2>23. General Provisions</h2>
        <p>
          If any provision of these Terms is found by a court of competent jurisdiction to be
          unlawful, void, or unenforceable, that provision will be considered severable from these
          Terms and will not affect the validity and enforceability of the remaining provisions.
          Our failure to enforce any right or provision of these Terms will not be considered a
          waiver of that right or provision. These Terms, together with our Privacy Policy,
          constitute the entire agreement between you and RentaPay regarding your use of the
          platform, and supersede any prior agreement or understanding between you and RentaPay on
          that subject, except that they do not supersede any separate written agreement you may
          have entered into with RentaPay covering a specific arrangement, such as the Brand
          Ambassador program described in Section 13, which continues to be governed first by that
          separate agreement and, on any point it does not cover, by these Terms.
        </p>

        <h2>24. Definitions</h2>
        <p>
          To make these Terms easier to apply to a real situation, here is what several recurring
          words mean when used in this document. Account means a registered RentaPay profile in
          any role. Confirmed payment means a payment submission that a landlord, manager, or
          caretaker has manually reviewed and accepted as received. Digest email means the optional
          periodic email summarising a landlord's portfolio, sent only to landlords who have opted
          in. Listing status means the current public visibility state of a unit, such as vacant
          and publicly listed, vacant and not listed, or occupied. Operations PIN means the four
          digit code a general manager sets, separate from their login password, required again
          before certain sensitive actions. Portable reputation means a tenant's aggregate rating
          record, tied to that tenant's email address rather than to any one landlord, which the
          tenant can choose to share with a new landlord. Submission means proof of payment,
          whether of rent or of a subscription, entered into RentaPay for review. These definitions
          are provided for clarity only and do not create rights or obligations beyond what the
          rest of these Terms already state.
        </p>

        <h2>25. An Illustrative Walkthrough of a Rent Payment</h2>
        <p>
          Because the payment flow described in Section 4 is central to how RentaPay works, here
          is a concrete, step by step example of how it plays out in practice, purely to help you
          picture it. A tenant's rent of a given amount falls due on the date recorded for their
          unit. The tenant opens their M Pesa menu on their own phone and sends that amount to their
          landlord's own Paybill number, Till number, or personal phone number, exactly as they
          normally would outside of RentaPay. Safaricom processes that transfer as an ordinary M
          Pesa transaction between the tenant and the landlord, with RentaPay having no part in it
          at all. Once the tenant receives their own M Pesa confirmation message, they open
          RentaPay, go to their unit's payment screen, and enter the transaction code, the amount,
          the payer name, the payer phone number, and the time shown on that message. This creates
          a submission with a pending status. The landlord, or whichever manager or caretaker has
          access to that unit, receives a notification about the new submission, reviews it against
          their own M Pesa statement, and either confirms it, which updates the tenant's balance,
          or rejects it, for example because the amount does not match or the transaction code
          cannot be found, which prompts the tenant to correct and resubmit. At every step of this
          walkthrough, the actual money moved directly between tenant and landlord through
          Safaricom's own systems, and RentaPay only ever recorded what the two of them reported and
          confirmed to each other.
        </p>

        <h2>26. Reporting, Records, and Export Tools</h2>
        <p>
          RentaPay includes several tools that let a landlord or manager see and export their own
          data in a structured way, rather than only viewing it one screen at a time. An annual
          report tool compiles a landlord's own portfolio activity over a chosen year, including
          rent collected, outstanding balances, and occupancy, into a single summary. A data export
          tool lets a landlord request their own account's underlying records in a portable format.
          A document storage feature lets a landlord, manager, or caretaker attach and retrieve
          documents relevant to a property or a tenancy, such as a signed lease. An expense tracking
          feature lets a landlord record costs associated with running a property, kept separate
          from tenant facing rent and deposit records. An audit log records significant actions
          taken on sensitive parts of the platform, such as changes made by a general manager, so
          they remain reviewable afterward. Every one of these tools operates within the same role
          based visibility rules described in Section 3, meaning a landlord's export, report, or
          audit log only ever contains data that landlord was already entitled to see.
        </p>

        <h2>27. Manual Subscription Payment Review in Detail</h2>
        <p>
          Where a landlord chooses to pay a subscription manually, by sending payment to RentaPay's
          Paybill or Till number outside the app rather than through an in app STK push, that
          landlord then submits proof within RentaPay, consisting of similar details to a rent
          payment submission. This creates a pending record that is not treated as paid until an
          administrator at RentaPay has reviewed it against RentaPay's own records and confirmed it.
          This manual review step exists because, unlike an STK push, a manual payment does not
          automatically report back to RentaPay from Safaricom in a way that is tied to that
          specific landlord's account, so a human check is needed before access is unlocked. A
          landlord who needs faster confirmation is encouraged to use the in app STK push option
          instead, where available, since it is confirmed automatically once Safaricom reports it.
        </p>

        <h2>28. General Manager Operations PIN and Reversible Actions in Detail</h2>
        <p>
          A general manager sets their own Operations PIN the first time they access certain
          sensitive tools, and can change it at any time afterward from their own settings, subject
          to knowing their current PIN. This PIN is separate from the password used to log in, and
          is asked for again immediately before a sensitive action is completed, such as an action
          with significant financial or tenant facing consequences, adding a second, deliberate
          step before that action takes effect. Because a general manager acts with a wide scope of
          trust across a landlord's properties, certain actions taken under a general manager
          account remain visible to the landlord through an activity log, and, for a defined set of
          actions, can be reviewed and reverted by the landlord within a limited window after the
          action was taken. This exists to give a landlord a genuine safety net, not to suggest that
          a general manager's actions are routinely second guessed.
        </p>

        <h2>29. Force Majeure</h2>
        <p>
          RentaPay will not be liable for any failure or delay in performing its obligations under
          these Terms where that failure or delay results from a cause beyond our reasonable
          control, including but not limited to a natural disaster, a nationwide network or power
          outage, an outage of a third party service RentaPay relies on such as Safaricom's M Pesa
          platform, a change in law, civil unrest, or an act of government.
        </p>

        <h2>30. Assignment</h2>
        <p>
          You may not transfer or assign your rights or obligations under these Terms to anyone
          else without our prior written consent. RentaPay may assign these Terms, in whole or in
          part, in connection with a merger, acquisition, reorganisation, or sale of substantially
          all of its assets, provided the receiving party agrees to honour these Terms toward
          existing account holders.
        </p>

        <h2>31. Notices</h2>
        <p>
          Any notice RentaPay is required to give you under these Terms will be given by posting it
          within the app, by sending it to the email address associated with your account, or both.
          You are responsible for keeping your email address current so that a notice reaches you.
        </p>

        <h2>32. Relationship of the Parties</h2>
        <p>
          Nothing in these Terms creates a partnership, joint venture, agency, or employment
          relationship between you and RentaPay, except to the extent a separate written agreement,
          such as an employment contract or the Brand Ambassador arrangement described in Section
          13, expressly says otherwise.
        </p>

        <h2>33. Language and Currency</h2>
        <p>
          These Terms are written and provided in English. Where RentaPay provides a translation of
          any part of the app or of these Terms into another language, the English version
          controls in the event of any conflict. Unless stated otherwise, all amounts displayed
          within RentaPay are in Kenya Shillings.
        </p>

        <h2>34. Frequently Asked Questions</h2>
        <p>
          This section answers, in plain language, some of the questions we hear most often. It
          does not replace any other section of these Terms, and where anything here appears to
          conflict with an earlier section, the earlier, more detailed section controls.
        </p>
        <p>
          Does RentaPay ever hold my rent money. No. Rent is paid directly from tenant to landlord
          by M Pesa, and RentaPay only records what both sides report and confirm.
        </p>
        <p>
          What happens if my landlord does not confirm my payment. Confirmation is a manual step
          performed by a human being, so it can take a few minutes or a few hours. If it is taking
          longer than that, contact your landlord, manager, or caretaker directly, and if the issue
          cannot be resolved between you, use the in app dispute tool described in Section 9.
        </p>
        <p>
          Can my landlord see my rating comments about them. A landlord can see the aggregate score
          a tenant has given them, but a tenant's own written comment about a landlord is treated
          the same way as any written comment a landlord leaves about a tenant, meaning it is not
          shown to the other party directly, only reflected in the aggregate score.
        </p>
        <p>
          Does deleting my account delete my rating history. Your own account is deleted, but a
          tenant's aggregate reputation score, being tied to an email address rather than to a
          single account, may be retained in aggregate form as described in our Privacy Policy,
          unless you specifically request its removal as well.
        </p>
        <p>
          Who do I contact if something looks wrong. Use the Help option in the app first, and if
          your issue involves a suspected security problem, mention that clearly so it can be
          prioritised appropriately.
        </p>

        <h2>35. Appendix: Summary of Notification Channels</h2>
        <p>
          For quick reference, here is how RentaPay reaches you. Email is used for one time
          verification codes, password reset codes, receipts, reminders, and, for landlords who opt
          in, the portfolio digest. Push notifications, where you have enabled them, deliver a live
          alert to your browser or device even when RentaPay is not open, for events such as a new
          payment submission awaiting review, a maintenance request update, or a chat message. In
          app notifications appear within RentaPay itself the next time you open it, and remain
          visible in your notifications list until you dismiss them. You can adjust which of these
          channels you receive optional notifications through from your own settings, though certain
          essential notifications, such as a one time verification code needed to log in, cannot be
          turned off, since the feature they support could not otherwise function.
        </p>

        <h2>36. Appendix: Summary of Account Roles</h2>
        <p>
          For quick reference, here is a short recap of the roles described fully in Section 3. A
          landlord owns a property listing and has full visibility and control over it. A property
          manager is added by a landlord to help run one or more properties, with permissions the
          landlord sets. A general manager is a senior, trusted management role protected by its
          own Operations PIN, with actions that remain reviewable by the landlord. A caretaker is a
          more limited, typically on site role focused on payments, meter readings, and maintenance.
          A tenant is tied to one specific unit and can see only their own records. A Brand
          Ambassador introduces new landlords under a separate arrangement and sees only their own
          introductions. This summary does not replace Section 3, which remains the authoritative
          description of each role's permissions.
        </p>

        <h2>37. Beta Features and Feedback</h2>
        <p>
          From time to time, RentaPay may make a new feature available to some accounts before
          others, for example to gather feedback before a wider release. Such a feature may be
          clearly marked as new, experimental, or in testing within the app, may change or be
          removed without the same advance notice given for a fully released feature, and, unless
          stated otherwise, is provided as is. Feedback you choose to give us about a feature,
          whether new or established, may be used to improve RentaPay, and by submitting feedback
          you agree that we may use it for that purpose without owing you compensation for it.
        </p>

        <h2>38. Subscription Pricing, Discounts, and Billing Periods</h2>
        <p>
          A landlord's subscription fee is calculated from a base rate charged per unit per month,
          multiplied by the number of units on that landlord's account. RentaPay offers a
          discounted effective monthly rate to landlords who prepay for a longer billing period
          rather than paying month to month; at the time of writing, prepaying for three, six, or
          twelve months at a time each carries its own discount percentage off the standard
          monthly rate, with the longer the prepaid period, the larger the discount. The exact base
          rate and discount percentages are configured centrally by RentaPay, are displayed to you
          before you confirm a subscription payment, and may be changed for future billing periods;
          a change to the standard rate does not retroactively alter what you were charged for a
          period you already paid for. Whichever rate was in force at the moment a given
          subscription payment was calculated is the rate that applies to that payment.
        </p>
        <p>
          A landlord whose subscription lapses moves into a short grace period during which
          existing data remains visible but certain features may be limited, followed by a locked
          state if the subscription is not renewed, as described further in Section 12. Renewing a
          subscription at any point, including after it has lapsed, restores full access; RentaPay
          does not delete a landlord's property, unit, tenant, or payment records merely because a
          subscription has lapsed.
        </p>

        <h2>39. Rate Limiting and Fair Use of the Platform</h2>
        <p>
          To keep RentaPay responsive for everyone using it at the same time, requests to our
          servers are automatically rate limited. Sign in attempts are limited more strictly than
          other requests, as a security measure to slow down automated password guessing; the
          platform's other endpoints, taken together, are also limited at a more generous
          threshold to prevent any single account, device, or script from degrading performance
          for other users. If you or a tool acting on your behalf exceeds these limits, further
          requests are temporarily rejected with a message asking you to try again shortly. You
          agree not to attempt to circumvent, disable, or work around these limits, and not to use
          RentaPay in a manner intended to overwhelm, disrupt, or gain an unfair share of its
          server capacity.
        </p>

        <h2>40. Session Length and Staying Signed In</h2>
        <p>
          When you sign in, RentaPay issues your device a signed session that, by default, remains
          valid for seven days before you are asked to sign in again; signing out, or changing your
          password, ends that session immediately rather than waiting for it to expire. You are
          responsible for keeping your device and account credentials secure while a session is
          active, including signing out of a shared or borrowed device once you are done using it.
          RentaPay staff will never ask you to share a session token, password, or one time code
          with them, and you should treat any message asking for these things as fraudulent
          regardless of who it claims to be from.
        </p>

        <h2>41. Report and Export Downloads</h2>
        <p>
          Certain documents, such as an annual report, a tax summary, a financial report in
          spreadsheet format, or a bundle of payment receipts, may be generated as a background
          job rather than produced instantly, and made available to you as a time limited download
          link, currently valid for one hour from when it is generated. If that window passes
          before you download the file, you can generate a fresh copy at any time by requesting
          the report again from within the app; the underlying records the report is built from
          are not affected by the download link expiring. Where the background job system used for
          larger reports is temporarily unavailable, RentaPay falls back to generating certain
          smaller reports immediately instead, so the feature continues to work in a reduced form
          rather than failing outright.
        </p>

        <h2>42. Outbound Notification Channels May Vary or Be Limited</h2>
        <p>
          RentaPay sends certain notifications, such as a payment confirmation or a rent due
          reminder, to the phone number or email address on file for your account, using whichever
          delivery channel a given deployment has configured at the time. You acknowledge that a
          given delivery channel may, from time to time, be limited, delayed, or temporarily
          unavailable, including for reasons outside RentaPay's control such as a third party
          provider's own outage, and that the underlying record of a payment, request, or other
          action within RentaPay is always the authoritative one, regardless of whether an
          accompanying notification was successfully delivered. You should not rely solely on
          receiving an external notification and should check the app itself for the current
          status of anything time sensitive.
        </p>

        <h2>43. Error Monitoring and Diagnostics</h2>
        <p>
          Where a deployment of RentaPay has error monitoring tooling configured, technical
          details about an unexpected server error, such as which part of the platform's code
          failed and the request path involved, may be recorded to help our team find and fix the
          underlying issue, as described further in our <Link to="/privacy">Privacy Policy</Link>.
          This diagnostic information is used to maintain and improve the platform's reliability
          and is not used to make decisions about your account.
        </p>

        <h2>44. Status Page and How to Tell a Fault From a Local Issue</h2>
        <p>
          RentaPay maintains a public status page, reachable without signing in, that reports in
          real time whether core subsystems, including sign in, payments, email and message
          delivery, file storage, background jobs, maintenance requests, disputes and complaints,
          the community board, utility submetering, and several others, are each operating
          normally. If something in the app is not working as expected, checking the status page
          first is the fastest way to tell whether the issue is a known, wider problem on
          RentaPay's side or something specific to your own device, browser, or connection, before
          contacting support.
        </p>

        <h2>45. Contact</h2>
        <p>
          For questions about these Terms, to report suspected abuse or a security concern, or to
          request deletion of your account or your data, use the Help option within the app, or
          contact the RentaPay team directly. Our support email address is displayed within the
          Help section of the app and in the footer of our emails, and our public status page,
          which is always available without needing to log in, is the fastest way to check whether
          a problem you are experiencing is a known, wider issue.
        </p>
      </div>
    </div>
  );
}
