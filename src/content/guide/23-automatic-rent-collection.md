# Automatic rent collection

By default, every RentaPay rent payment uses manual confirmation: a tenant pays,
submits proof, and a landlord, manager, or caretaker reviews and confirms it (see
"How payments flow"). Automatic rent collection is an optional upgrade to that -
never a requirement - that a landlord can turn on for their own account.

## What changes when it's on

A landlord who owns a real Safaricom Business Paybill or Till can connect it to
RentaPay from Settings. Once it's verified and active:

- A tenant tapping "Pay Rent" gets a real M-Pesa STK prompt sent straight to their
  phone, the same way an STK push already works for RentaPay's own subscription
  payments.
- The moment Safaricom confirms the payment, the tenant's balance updates itself
  and the landlord or manager is notified - with **no manual review step**.
- If a push ever fails to arrive or go through for any reason, the tenant
  automatically sees the manual payment instructions instead, so a payment is
  never blocked.

The manual flow is never removed. A landlord can switch back to it at any time,
and doing so doesn't affect any payment history already on record.

## What RentaPay does - and doesn't - do

RentaPay never touches, holds, or custodies rent money at any point, in either
mode. Automatic collection doesn't change that: it only triggers the M-Pesa
prompt using the landlord's own Safaricom Daraja credentials, directly against
the landlord's own Paybill or Till. The money moves directly from tenant to
landlord through Safaricom, exactly as it always has - RentaPay is only
initiating the request, never sitting in the middle of it.

## Who can turn it on

Automatic collection is opt-in per landlord, and only available to a landlord who
has (or can get) a genuine **Business** Paybill or Till registered through
Safaricom. It is not available for:

- **Pochi la Biashara**, which shares a personal M-Pesa number and has no API
  access of its own.
- **A bank's own paybill** (for example a bank's paybill with an account
  number) - that number belongs to the bank, not the landlord, so Safaricom
  can't issue API access for it.

A landlord without a Business Paybill yet can apply for one directly through
Safaricom (via m-pesaforbusiness.co.ke) - RentaPay recommends a Paybill
specifically over a Till, since a Paybill's account-number field is what lets
tenants be told apart cleanly through one number, the same way RentaPay's own
Paybill already does.

## Setting it up

From Settings, a landlord answers one eligibility question, then either gets
pointed to how to apply for a Paybill (if they don't have one yet) or moves
straight into entering their Paybill/Till number and Daraja app credentials.
Verification is fully automatic - RentaPay sends a small real test push to the
landlord's own phone to confirm everything works, with no manual review from
RentaPay staff at any point. Progress is saved automatically, so a landlord who
needs to wait a few days on Safaricom for their Paybill can leave and pick up
again exactly where they left off.

## Who can access this section

Only the landlord account itself can view or manage this section - not a
manager, and not a caretaker, even one with otherwise broad access on the
account. This matches how the landlord's manual payment method is locked down
elsewhere in Settings, since both are the account's own banking/API details.

Because opening this section exposes and controls real Daraja credentials -
and a mistaken click here could disable rent collection or scramble the
credentials tenants are being charged against - it's also locked behind the
landlord's own login password every time it's opened, even within an already
signed-in session. This is the same password used to log in, re-entered here
rather than a separate PIN, and it must be re-entered again the next time the
section is opened (unlocking it once doesn't stay unlocked across visits or
reloads).

Managers and caretakers can still see whether automatic collection is
currently working, through the read-only status banner shown on their
dashboard - they just can't open, edit, or disable the credentials themselves.
