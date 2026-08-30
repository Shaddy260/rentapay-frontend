# Troubleshooting common issues

**A tenant's payment submission was rejected.** Check the transaction code, amount,
and payer details against your own M Pesa statement. A common cause is a code that
was typed with one wrong character, or an amount that does not match because the
tenant included their own transaction charge in the figure. Ask the tenant to
resubmit with the corrected details once you have identified the mismatch.

**A payment is taking a long time to confirm.** If your landlord has connected
their own Paybill/Till for automatic collection, a genuine payment confirms itself
within moments of Safaricom reporting it, so a long delay likely means the M-Pesa
prompt was missed, cancelled, or never sent — try paying again from the app. Where
automatic collection isn't enabled, confirmation is a manual review step performed
by whoever manages the unit. If it has been longer than a few hours, reach out to
your landlord, manager, or caretaker directly. If it still cannot be resolved
between you, use the in app dispute tool to create a shared, timestamped record of
the issue.

**A meter reading looks wrong.** RentaPay flags a reading that looks unusually high
or low compared to that meter's own history before it is used to calculate a bill,
so double check the reading against the physical meter before finalising. If a
genuine explanation exists, such as a tenant who moved in partway through the
month, you can override the calculated occupied days or amount for that specific
unit before finalising.

**A general manager cannot complete an action.** Certain sensitive actions require
the general manager's own Operations PIN, entered again at the moment of that
action, separate from their login password. If they have forgotten it, they can
reset it from their own settings the same way they would reset a forgotten login
password.

**A caretaker cannot see something a landlord can.** This is expected, not a bug.
A caretaker account has a deliberately narrower set of permissions than a property
manager or landlord, described in the Landlord Portal section of this guide. If a
caretaker genuinely needs broader access, the landlord can grant it, or add that
person as a property manager instead.

**RentaPay itself seems to be down.** Check the public status page, available at
any time without needing to log in, which shows the live state of every major part
of the platform, including payments, email delivery, and file storage
individually, so you can quickly tell whether the issue is on RentaPay's side or
your own connection.

**Still stuck?** Reach RentaPay support through in app chat, the call number,
WhatsApp, or email shown on your own portal's Help section, whichever is easiest
for you.

**A subscription payment did not go through.** If you used the automatic M Pesa
STK push option and did not see the prompt on your phone, check that you have
enough M Pesa balance and a stable network connection, then try again from the
subscription screen. If you paid manually to RentaPay's own Paybill or Till
number instead, remember that a manual payment needs a RentaPay administrator to
review and confirm it before access unlocks, which can take a little longer than
the automatic option.

**A tenant says they cannot see their unit anymore.** This usually means the
tenant's account was deactivated, either because a landlord or manager removed
them, or because a vacating notice they submitted reached its move out date. Their
payment history and portable reputation record are preserved either way, so
nothing about their past tenancy is lost even though the unit itself is no longer
showing.

## Scrolling feels stuck or a screen won't respond

If a page seems to resist scrolling, or a swipe feels laggy, first try refreshing —
this class of issue is almost always a temporary rendering hiccup rather than a
data problem, and a refresh clears it. If it persists across a refresh and across
different screens, check the status page; if every component shows Operational,
report it through Help with the specific screen and device involved, since RentaPay
is built so that scrolling should never be blocked on any screen.

## Something at the bottom of the screen looks cut off

On a phone, RentaPay reserves space at the bottom of every scrollable screen so the
fixed navigation bar never covers the last item in a list or the last button in a
row. If you ever see a button, list item, or piece of text tucked partly or fully
underneath that bar, that's a genuine bug worth reporting with a screenshot — it
should not happen on any screen, at any font size.

## A number looks wrong

If a balance, total, or report figure looks wrong, check first whether it matches
what you'd expect given the individual payments and charges listed beneath it —
RentaPay always shows the components a total is built from alongside the total
itself, specifically so a wrong-looking number can be checked against its parts
rather than taken on faith. If the parts don't add up to the total shown, that's
worth reporting directly, with the specific unit or tenant named.

## The app seems to be loading an old version

Because every account always runs the current version of RentaPay, seeing outdated
behaviour usually means your browser has cached an old copy of the page. A hard
refresh (reloading while bypassing the cache, the exact method depends on your
browser) resolves this in almost all cases.

## I can't sign in

Double-check your phone number or email and password are entered exactly as set.
If you've forgotten your password, use the reset option on the sign-in screen
rather than repeatedly guessing — repeated failed attempts are rate limited as a
security measure and will temporarily slow further attempts either way. If you were
given first-time credentials by your landlord or manager and haven't set your own
password yet, make sure you're using exactly what they gave you for that first
sign-in.

## A payment I made isn't showing up

First check whether it was meant to confirm automatically (via the in-app M-Pesa
prompt) or whether it needs manual confirmation (payment made outside the app, with
a screenshot uploaded as proof). A manually-confirmed payment only appears once your
landlord, manager, or caretaker has reviewed and confirmed it — if it's been a
while, following up directly through Messages is the fastest way to resolve it.

## An email or message I expected never arrived

Check your spam or junk folder for email first. If it's genuinely not arriving,
check the status page — if email or SMS/WhatsApp delivery shows an issue, that
explains it, and no action is needed on your side; it'll be resolved and the
underlying record (payment, request, etc.) was never affected in the first place.
