# Status page and how RentaPay reports problems honestly

## Why this page exists

Rather than leaving you guessing whether a problem is on RentaPay's side or your
own, we publish a public status page that anyone can check, without signing in, at
any time. It exists so that "is RentaPay down, or is it just me" always has a fast,
honest answer.

## The components it checks

The status page currently reports on the following parts of the platform
individually, each described in plain language:

- **API** - the core RentaPay server every screen in the app talks to.
- **Database** - where accounts, units, tenants, payments, and every other record live.
- **Sign in and accounts** - signing in, account lookups, and session handling.
- **Payments (M-Pesa)** - M-Pesa STK push for subscription billing and, where enabled, tenant rent collection.
- **Email delivery** - one time codes, password resets, receipts, and reminders.
- **SMS & WhatsApp alerts** - text-message-style notifications sent alongside email.
- **Push notifications** - live browser or device alerts when the tab isn't open.
- **File storage** - unit photos, payment proof screenshots, and uploaded documents.
- **Background jobs** - rent reminders, monthly billing, and vacating notice processing.
- **Report & export downloads** - annual reports, tax summaries, financial CSVs, receipt bundles.
- **Support chat** - the in-app chat to reach RentaPay support and, for landlords, tenant messaging.
- **Public listings** - the public vacant unit page anyone can browse without an account.
- **Maintenance requests** - reporting, tracking, and updating maintenance issues.
- **Disputes & complaints** - disputing a charge and the complaints inbox.
- **Community board** - shared posts and announcements within a property.
- **Utility submetering** - shared meter readings and the invoices generated from them.
- **Error tracking** - RentaPay's own behind-the-scenes monitoring, invisible to you day to day.

That's seventeen independently reported components in total - enough that when one
part of RentaPay has a problem, it shows up by name rather than the whole platform
reading as generically "broken."

## What "when one breaks" actually looks like

Each component shows either "Operational" or "Issue detected." When anything shows
"Issue detected," the top of the page also displays a short, specific summary
naming exactly which components are affected and which everyday feature each one
touches - for example, "Payments (M-Pesa) - affects making or confirming a
payment." You don't have to interpret a vague "degraded" badge; the page tells you
directly what's broken and what it means for you.

## How often it checks, and what the badges mean

The page checks automatically every thirty seconds while you have it open, and you
can also trigger a fresh check manually at any time. The overall badge at the top
summarises the detailed list below it:

- **All systems operational** - every component checked "Operational."
- **Partial outage** - the page could be reached, but one or more specific
  components reported an issue; the summary tells you which ones.
- **Can't reach RentaPay** - the status page itself couldn't get a response at
  all. If other websites are loading fine for you, the problem is very likely on
  our end; if nothing else is loading either, it's probably your own connection.

## What counts as "ok" versus a real problem

A component that is optional for a given deployment and simply hasn't been set up,
such as error tracking when no monitoring tool has been configured, is reported as
"Operational" rather than "Issue detected" - it isn't broken, it's just not in use.
Only a component that is expected to be working but genuinely isn't reachable is
ever shown as an issue. This distinction matters: it means a green status page is a
meaningful, honest signal, not one padded out by ignoring anything inconvenient.
