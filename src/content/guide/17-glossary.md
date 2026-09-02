# Glossary

**Account role.** The permission level an account has: landlord, property manager,
general manager, caretaker, tenant, or Brand Ambassador. Every screen and every
piece of data in RentaPay checks this role before showing anything.

**Aggregate rating.** A tenant's overall reputation score, built from every
individual rating a landlord, manager, or caretaker has given them, tied to the
tenant's own email address rather than to any one landlord's account.

**Confirmed payment.** A payment submission that has been accepted as genuinely
received - either manually, by a landlord, manager, or caretaker reviewing it, or
automatically, the moment Safaricom reports it back for a landlord who has
connected their own Paybill/Till.

**Daraja API.** Safaricom's own interface for initiating and receiving M Pesa
transactions. RentaPay uses it for a landlord's automatic subscription payments,
and, where a landlord connects their own Daraja app credentials, for that
landlord's own optional automatic rent collection too.

**Digest email.** The optional periodic email a landlord can opt into, summarising
their portfolio: occupancy, rent collected, and vacant units missing photos.

**Installment.** One scheduled part of a payment plan a tenant has proposed, made
up of an amount and a due date.

**Loyalty discount.** A discount on a subscription that RentaPay may grant to a
long standing, continuously active landlord account, subject to its own expiry
date.

**Notice given.** The status a unit moves into once a tenant has submitted a
vacating notice, shown clearly on the landlord's dashboard ahead of the actual move
out date.

**Occupied days.** The number of days a unit had an active tenant during a billing
period, used to fairly split the cost of a shared utility meter across several
units.

**Operations PIN.** A general manager's own four digit code, separate from their
login password, required again before certain sensitive actions can be completed.

**Payment plan.** An arrangement a tenant proposes to split a payment into several
smaller installments, subject to the landlord's approval.

**Portable reputation.** A tenant's aggregate rating, tied to their own email
address, that can follow them to a new landlord on RentaPay, or be shared through a
link the tenant generates themselves.

**Publicly listed.** The state of a vacant unit once a landlord has marked it to
appear on RentaPay's public vacant unit listing pages, visible to anyone browsing
without an account.

**Security deposit.** An amount a tenant pays at the start of a tenancy, tracked
completely separately from their rent balance, and settled as refunded, partially
refunded, or forfeited once the tenancy ends.

**Submission.** Proof of a payment, whether rent, a subscription, or a utility
bill, entered into RentaPay and awaiting review.

**Subscription.** A landlord's own ongoing payment to RentaPay for access to the
platform, priced per unit per month, separate entirely from any tenant's rent.

**Vacating notice.** A tenant's own notification, submitted from their portal, of
their intended move out date.

**WhatsApp connect link.** The link shown on a public listing page that opens a
WhatsApp conversation with the right landlord, manager, or caretaker for that
unit, without ever displaying the underlying phone number on the page itself.

**Written comment.** An optional note a landlord or tenant can attach to a rating,
visible only to the tenant it is about, never to another landlord.

## A few additional terms

**Grace period** - the short window after a subscription's due date, before it
locks, during which existing data stays visible but some features may be limited.

**Signed URL** - a time-limited download link generated for a report or export,
currently valid for one hour, after which it stops working and a fresh one must be
requested.

**Session** - the signed token your device holds after signing in, valid for seven
days by default, that proves who you are without asking for your password again on
every screen.

**Status page** - RentaPay's public page, reachable without signing in, reporting
in real time whether each part of the platform is working normally.

**Background job** - work RentaPay does behind the scenes on a schedule or a queue
rather than instantly within a single page load, such as sending rent reminders or
assembling a large report.
