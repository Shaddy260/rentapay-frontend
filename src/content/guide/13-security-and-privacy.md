# Security and privacy

RentaPay is built to keep each landlord's portfolio and each tenant's information
visible only to the people who genuinely need to see it.

## Role based access

Every account has a role, landlord, property manager, general manager, caretaker,
tenant, or Brand Ambassador, and every screen and every piece of data in RentaPay
checks that role before showing anything. A property manager only ever sees the
properties a landlord has explicitly given them access to; a tenant only ever sees
their own balance and history, never another tenant's, even within the same
building.

## Passwords and PINs

Your password, and a general manager's Operations PIN, are never stored as plain
text. Each is passed through a one way cryptographic hash before it is saved, which
means RentaPay itself cannot see or recover your actual password even if it wanted
to. When you log in, what you type is hashed the same way and compared to the
stored hash, rather than the original ever being stored anywhere.

## A landlord's own Daraja credentials

If a landlord connects their own Safaricom Business Paybill or Till for automatic
rent collection, the Consumer Secret and passkey they enter are encrypted before
being stored, not kept in plain text. That section of Settings is also visible
only to the landlord account itself, never a property manager or caretaker, and
is locked behind the landlord's own login password every time it is opened, even
within a session that is already signed in, so it cannot be viewed, edited, or
turned off by mistake or by someone else using an unlocked device.

## Guarding against brute force attempts

Repeated failed login attempts against an account trigger a temporary lockout, and
requests to sensitive endpoints, such as the login and password reset flows, are
rate limited, meaning only a limited number of attempts are allowed within a short
window. This makes it far harder for someone to simply guess their way into an
account.

## Encrypted transport

Every request sent to and from RentaPay, whether you are logging in, submitting a
payment, or just loading your dashboard, travels over an encrypted HTTPS
connection, so it cannot be read in transit by anyone else on the same network.

## What RentaPay relies on behind the scenes

RentaPay's own database and file storage, for records such as unit photos, payment
proof screenshots, and documents, are provided by a specialist cloud infrastructure
provider, accessed only through RentaPay's own backend, which enforces every one of
the access rules described above itself, rather than leaving that enforcement to
the infrastructure provider. Email, including one time verification codes and
password reset codes, is sent through a specialist third party email delivery
provider. Landlord subscription payments made by STK push go through Safaricom's
own Daraja API. None of these providers are given more access to your information
than the specific job RentaPay uses them for requires, and RentaPay does not sell
your data to anyone or use it for advertising. See the Privacy Policy for the full,
detailed picture of exactly what is collected, why, and for how long.

## A public status page, always available

If you are ever unsure whether a problem you are seeing is on RentaPay's side, a
public status page shows the live operational state of every major part of the
platform, including the API, the database, sign in, payments, email delivery, push
notifications, file storage, background jobs, support chat, and the public listings
page, and is available without needing to log in at all.

## Session handling

Once you log in, RentaPay issues a session that keeps you signed in without asking
for your password on every single screen. That session is tied to your specific
device and browser, and logging out, or simply not using RentaPay for an extended
period, ends it. If you ever suspect someone else has accessed your account, change
your password immediately and contact support so we can help review recent
activity on it.

## Keeping your own account safe

A few habits go a long way: use a password that is not reused from another
service, never share your login details or, if you are a general manager, your
Operations PIN, with anyone else, and log out of RentaPay on a shared or public
device once you are done using it. If you manage staff accounts, remove access
promptly once someone's role changes or their time working with you ends, since
RentaPay itself has no way of knowing that has happened until you tell it.

## What RentaPay never asks you for

RentaPay staff will never ask you, by phone, email, chat, or any other channel, for
your password, your M-Pesa PIN, a one-time code sent to your phone, or your session
token. Any message asking for these things, regardless of how convincing it looks
or who it claims to be from, should be treated as fraudulent and reported.

## Rate limiting as a security measure

Sign-in attempts are rate limited more strictly than other requests, meaning that
after a number of incorrect attempts in a short window, further attempts are
automatically slowed. This is aimed at making automated password guessing
impractical, not at locking out a genuine user for long - normal access resumes
once the short window passes.

## Error monitoring

Where a deployment has error monitoring configured, unexpected server errors are
reported to that tool so bugs can be found and fixed quickly. This is about the
platform's own reliability, not about tracking what you personally do - it is not
used to build a profile of your activity.
