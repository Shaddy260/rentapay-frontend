# How payments flow

## Today: tenant pays, landlord confirms

Right now, RentaPay does not confirm payments automatically. Here's how a
payment actually goes through:

1. **The tenant pays** rent to the till/account shown in their portal (for
   example, an M-Pesa till number) and receives a payment confirmation
   code from that transaction.
2. **The tenant submits that code** in RentaPay against their rent balance.
3. **The landlord (or their manager/caretaker) reviews and approves** the
   submitted code.
4. **Once approved**, the payment is recorded and everything updates
   automatically — the tenant's balance, the landlord's dashboard, and the
   receipt.

This approval step exists deliberately, for trust: it gives the landlord a
chance to verify a payment actually came through before it's marked as
paid in the system.

## Manual payments

Some tenants pay by cash or bank deposit instead. A property manager or
caretaker can record that payment directly on the tenant's behalf, and it
goes through the same review step before it's confirmed.

## Where this is headed

RentaPay is working toward direct payment integrations that would confirm
some payments automatically, without the code-submission-and-approval
step. When that's available, landlords will be able to choose whether to
use automatic confirmation or keep the current approve-each-payment
process — it won't be forced on anyone.

## Receipts

Once a payment is approved, it generates a receipt the tenant can view or
download, and the landlord can always see who submitted and who approved
each payment.
