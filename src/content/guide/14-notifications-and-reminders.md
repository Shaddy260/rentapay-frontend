# Notifications and reminders

RentaPay keeps everyone in the loop automatically, so a landlord is not left
manually messaging every tenant every month, and a tenant is never caught off
guard by a due date they did not know was coming.

## Email

Email carries account essentials: one time verification codes used to log in or
reset a password, receipts once a payment is confirmed, rent due and overdue
reminders, and, for a landlord who opts in, a periodic portfolio digest
summarising occupancy, rent collected, and any vacant unit that is still missing
photos. A landlord can turn the digest email on or off at any time from settings;
the essential account emails, such as a one time verification code, cannot be
turned off, since the feature they support could not otherwise work.

## Push notifications

Where a landlord, manager, caretaker, or tenant enables it, RentaPay can send a
live alert straight to a browser or device, even when the RentaPay tab is not
open. This is used for time sensitive events: a new payment submission waiting to
be reviewed, a maintenance request update, a new chat message, or a reminder that
a subscription is about to expire. Push notifications are entirely optional and
can be turned off at any time from device or browser settings.

## Bulk reminders

A landlord or manager can send a rent reminder to every overdue tenant at once,
rather than messaging each one individually, either as an in app notification or
as a WhatsApp message using the tenant's own registered phone number. This is
especially useful right around a due date, when several tenants may need the same
nudge on the same day.

## Reminders that run on their own schedule

Behind the scenes, RentaPay runs a set of scheduled jobs that keep the platform
current without anyone needing to trigger them by hand: rent due and overdue
reminders, monthly utility and rent billing, subscription expiry reminders, and
processing of vacating notices once their notice period has passed. None of these
require a landlord or tenant to do anything; they simply run on their own schedule
in the background.

## Which channels a notification can go out on

Depending on what the notification is about and how a given RentaPay deployment is
configured, a notification may be sent by email, as a message to the phone number on
file for your account, or as a push notification to your browser or device if you
have allowed those. A payment confirmation, for example, is typically sent by email
at minimum, with a phone-based message alongside it where that channel is available
for the deployment you're using.

## What happens if a notification fails to send

Sending a notification never blocks or reverses the action it is about. If a payment
is recorded successfully but the accompanying email or message fails to send, for
example because of a temporary problem with the delivery provider, the payment record
itself is completely unaffected, and the same information is always visible inside
the app directly. You should treat the app itself, not an external notification, as
the authoritative record of anything time sensitive.

## Turning push notifications on or off

Push notifications require you to explicitly allow them in your browser when
prompted; RentaPay cannot enable them without that permission, and you can revoke
that permission at any time through your browser or device's own notification
settings, at which point RentaPay simply stops being able to send them to that
device. Turning off push notifications does not affect email or phone-based
notifications, which are controlled separately.

## Reminder timing

Rent due reminders and similar scheduled notifications run on a recurring background
job rather than being sent the instant you open the app, so there can be a short gap
between when a reminder condition is met, such as a due date approaching, and when
the notification actually goes out. This is normal and does not indicate a problem;
the app's own balance and due date figures update immediately regardless of when the
reminder notification itself is sent.
