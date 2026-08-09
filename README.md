# RentaPay Frontend

## This pass: the wizard finally writes to the database

You correctly identified that nothing you typed into Property,
Payment Method, Units, or Extra Charges was ever being saved -
that gap existed since the very first delivery and finally got closed
this pass. Verified end-to-end through real, unmodified backend
controller code (not just "compiles"):

```
1. register            PASS
2. simulate payment    PASS
3. verify OTP          PASS
4. auto-login          PASS  <- new
5. save property       PASS  <- new
6. save payment method PASS  <- new
7. create unit A1      PASS  <- new (real RPA-A1-001 code generated)
8. create unit A2      PASS  <- new
9. add extra charge    PASS  <- new
10. complete wizard    PASS

Final units in DB: 2 - A1 (KES 8000), A2 (KES 12000)
```

### What changed

**The missing piece underneath everything**: a fresh registration had
no JWT until the *separate* Login page was used. Every wizard step
after OTP verification had nothing to authenticate with, so even
"wiring up" those steps would have silently done nothing. Fixed by
calling `api.login()` automatically right after OTP succeeds, using
the password still held in component state at that moment.

**Backend additions** (`auth.controller.js` / `auth.routes.js`):
- `PATCH /api/auth/landlord/property` - persists estate name, location,
  county, description. Didn't exist before; the property step had
  nowhere to send data even if it tried.
- `PATCH /api/auth/landlord/payment-method` - persists STK/Paybill/Till
  choice and the relevant account numbers.

**Frontend wiring** (`RegisterFlow.jsx`):
- `handlePropertySubmit`, `handlePaymentMethodSubmit` now call the
  endpoints above.
- `handleUnitsSubmit` now calls `api.createUnit()` for each unit that
  doesn't already have a real database id (so going Back and Forward
  in the wizard doesn't create duplicates) and captures the real
  `unit.id` and auto-generated `unit_payment_code` from the response.
- `handleAddCharge` now calls `api.addExtraCharge()` against the
  unit's real id.

### Known remaining gap: removing a charge

`handleRemoveCharge` only updates local display - there's no backend
endpoint to delete a single extra charge yet (only to add one). If a
charge was already saved and then "removed" in the UI, it still exists
in the database until that endpoint is built. Flagged in the code
comment at the point it matters, not hidden.

## Everything else from previous passes is unchanged

Login → dashboard routing, the unit-limit enforcement on the units
step, the extra-charges input UI itself - all from the prior pass,
untouched here.

## Running it

Same as always. Both backend and frontend changed this pass - replace
both folders, or at minimum these files:
- `backend/src/controllers/auth.controller.js`
- `backend/src/routes/auth.routes.js`
- `frontend/src/api/client.js`
- `frontend/src/pages/RegisterFlow.jsx`

## Verification note

The full chain above was run through the actual `auth.controller.js`,
`unit.controller.js`, and `dev.controller.js` functions - unmodified,
the same files that will run on your machine - against an in-memory
fake Supabase supporting insert/select/update/eq/joins. This is
stronger evidence than a syntax check: it proves the data actually
flows from registration through to real `units` rows with the correct
foreign keys, not just that the code parses. You'll still want to walk
through it once in your browser against your real Supabase project,
since that's the only way to catch anything specific to your actual
data (existing stale rows, RLS settings, etc).

## Latest pass: subscription days fix (data, not code) + empty unit slots

**"92 days instead of 365"** - traced to a manual database edit: your
test row had `subscription_period_months = 12` but
`subscription_expires_at` set only 3 months past `subscription_started_at`.
The day-count math in `getSubscriptionStatus`/`getLandlordDashboard` is
correct - it just reflects whatever's actually in `subscription_expires_at`.
Fix is a one-time data correction, not a code change:

```sql
update landlords
set subscription_expires_at = subscription_started_at + interval '12 months'
where id = '<your landlord id>';
```

**Empty placeholder slots for unused unit quota** - this is a
deliberate addition beyond the original blueprint (confirmed: the
blueprint's unit_limit is a billing ceiling, not a display feature -
there's no "empty slot" concept in the source plan). Built anyway as
requested:
- Backend: `dashboard.controller.js` now also selects and returns
  `unitLimit`.
- Frontend: the units grid renders `unitLimit - totalUnits` dashed
  "Unused slot" placeholder cards after the real unit cards.
- Also added while in this file: vacant units now show an "Add Tenant"
  button per blueprint 7.2's sample dashboard cards - currently
  disabled with a tooltip, since the actual add-tenant page doesn't
  exist yet. Left disabled rather than wired to a route that doesn't
  exist, which would otherwise silently bounce through the catch-all
  back to /login.

Verified: the placeholder-count math (`Math.max(0, limit - real)`,
including the edge case where real units somehow exceed the limit)
and the resulting rendered HTML were both tested directly - 5 limit,
2 real units in, 2 real cards + 3 placeholder cards out, confirmed
correct.
