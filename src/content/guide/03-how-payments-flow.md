# How payments flow

There are two separate kinds of payment inside RentaPay, and they work
differently on purpose. Understanding the difference matters.

## Rent, from tenant to landlord

Rent works one of two ways, depending on whether the landlord has switched on
automatic collection. Manual confirmation is the default, and remains available
to every landlord regardless; automatic collection is an optional, opt-in mode a
landlord can turn on or off at any time.

### Manual confirmation (the default)

1. **The tenant pays** rent using M Pesa, whether through the landlord's Paybill,
   Till number, or personal phone number shown in their portal, exactly as they
   would pay it outside the app. Safaricom processes this as an ordinary transfer
   directly between tenant and landlord.
2. **The tenant submits proof** in RentaPay: the M Pesa transaction code, the
   amount, the payer name and phone number, and the time shown on the M Pesa
   confirmation message.
3. **The landlord, manager, or caretaker reviews** the submission against their own
   M Pesa records and either confirms it as received or rejects it, for example if
   the amount does not match.
4. **Once confirmed**, everything updates automatically: the tenant's balance, the
   landlord's dashboard, and a receipt the tenant can view or download.

This review step exists deliberately, for trust: since RentaPay never holds or
moves the tenant's money itself, only the person who actually received the funds
can confirm they arrived.

### Automatic collection (opt-in)

A landlord who owns their own Safaricom Business Paybill or Till can connect it to
RentaPay under Settings. Once connected and verified, a tenant tapping "Pay Rent"
gets a real M-Pesa STK prompt sent straight to their phone; the moment Safaricom
confirms it, the balance updates itself and the landlord or manager is notified
automatically - with no manual review step in this path. RentaPay still never
touches, holds, or custodies the money at any point: the push is triggered using
the landlord's own credentials, straight into the landlord's own Paybill/Till.
A landlord can switch back to manual confirmation at any time; doing so doesn't
affect any payment history already on record. See the Pricing/Settings section
for how a landlord sets this up.

## Manual and cash payments

Some tenants pay by cash or bank deposit instead of M Pesa. A property manager or
caretaker can record that payment directly on the tenant's behalf, and it goes
through the same review step before it is confirmed.

## Subscriptions, from landlord to RentaPay

A landlord's own subscription payment to RentaPay works differently, and can be
fully automatic. See the Pricing section for the two ways a landlord can pay a
subscription: an automatic M Pesa STK push that confirms itself the moment
Safaricom reports it, or a manual payment reviewed by a RentaPay administrator.

## Utility bills

Where a landlord has set up utility submetering, a finalised water or electricity
bill becomes its own invoice, separate from rent. Depending on how the landlord has
configured it, a tenant may pay a utility bill the same way they pay rent, with
proof submitted and reviewed the same way.

## Receipts

Once a rent payment is confirmed, it generates a receipt the tenant can view or
download at any time, and the landlord can always see exactly who submitted a
payment and who reviewed and confirmed it.

## Two ways a payment can be confirmed

A rent or subscription payment reaches RentaPay in one of two ways. The first is an
automatic confirmation through Safaricom's Daraja platform, where an M-Pesa STK
push prompt appears directly on the payer's phone, they enter their PIN, and the
payment is confirmed back to RentaPay automatically with no manual step on either
side. The second is a manual confirmation, where a tenant pays by another means
(for example, sending directly to a landlord's own M-Pesa till or paybill outside
the app) and then uploads a screenshot of the M-Pesa confirmation message as proof;
a landlord, manager, or caretaker then reviews that proof and marks the payment as
confirmed.

## Why the transaction code matters

Every M-Pesa payment carries its own unique transaction code. RentaPay records that
code alongside every payment, whether confirmed automatically or manually, because
it's the one piece of information that ties a RentaPay record back to Safaricom's
own record of the same transaction. If a payment is ever questioned or disputed,
that code is the starting point for checking what actually happened.

## What happens if a payment fails partway through

If an STK push prompt is sent but the payer cancels it, enters the wrong PIN, or
the request times out, no payment is recorded - the balance is unaffected and the
payer can simply try again. RentaPay never records a payment as confirmed based on
the prompt being sent; only an actual confirmation, automatic or manual, moves a
balance.
