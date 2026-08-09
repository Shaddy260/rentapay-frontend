# RentaPay — Landlord Portal Build (this pass)

You asked for a lot in one message. This delivery covers the **landlord
portal** fully, reviewed line-by-line against blueprint sections 6, 7,
8, 9.4, 10, 11, plus your direct additions (Remind button, pricing
change, help system). Tenant portal and Super Admin panel are next,
as agreed.

## What's built and verified this pass

### OTP recovery (the bug you led with)
- `POST /api/auth/resend-otp` - new backend endpoint
- `VerifyAccount.jsx` - standalone page, reachable from a "Verify now"
  link that now appears on Login.jsx's "Account not verified" error
- A real user can no longer get permanently stuck

### Backend additions (blueprint coverage)
| Endpoint | Blueprint ref | What it does |
|---|---|---|
| `PATCH /api/units/:id/due-date` | 7.3 | Change due date, **notifies tenant** (was missing entirely) |
| `PATCH /api/units/:id/rent` | 7.3 | Fixed - now **actually notifies the tenant** (silently didn't before) |
| `GET /api/units/:id` | 7.2/7.3 | Full unit detail incl. tenant + payment history |
| `GET /api/tenants/:id` | 11.2 | Single tenant detail |
| `PATCH /api/tenants/:id` | 11.2 "Edit tenant details anytime" | New |
| `POST /api/tenants/:id/remind` | your "Remind" button request | New - on-demand single reminder |
| `POST /api/tenants/bulk-remind` | 11.2 "bulk SMS reminders" | New |
| `POST /api/tenants/:id/transfer` | 7.3/11.2 "Transfer tenant" | New |

### Frontend pages (new)
- **Dashboard.jsx** (rewritten) - full blueprint 11.1 metric set (added
  Notice Given, Vacant counts), Quick Actions row (Add unit / bulk
  remind / download report / help), unit cards now link to detail
  pages and visually flag overdue (red border)
- **UnitDetail.jsx** - status editor (occupied/vacant/maintenance),
  inline rent + due-date editors (both notify tenant), extra charges
  manager, tenant panel with Remind/Record Payment/Edit Balance/Waive
  Interest/Transfer/Revoke Notice actions, payment history table
- **AddUnit.jsx** - add a unit anytime (not just during setup),
  enforces real subscription unit limit
- **AddTenant.jsx** - full blueprint section 4 form, reachable from any
  vacant unit
- **SubscriptionManage.jsx** - renew via M-Pesa, change payment method
  (blueprint 11.2)
- **HelpButton.jsx** - shared component, used on the dashboard now,
  will be reused on the tenant portal next. Wired to your real contact
  details: mngmtrentapay@gmail.com / WhatsApp +254710888917

### Pricing change
KES 150 → 70/unit/month, updated in `backend/src/utils/pricing.js` and
the frontend preview in `RegisterFlow.jsx`. Discount percentages
(5%/10%/15%) unchanged, applied to the new base rate. Flagged in code
comments as a deliberate deviation from the blueprint's stated price,
so nobody mistakes it for an error later.

## Explicitly NOT done yet (told you exactly, not hiding it)

1. **Setup-wizard reorder** (pay-after-setup instead of pay-first) -
   you asked for this but it's a structural change to the registration
   flow itself; deferred so this pass could focus on the portal you
   asked to start with. Flag if you still want it before tenant portal.
2. **Download report** is a client-side CSV export of currently-loaded
   data, not a server-generated PDF. Real "payment reports" per
   blueprint 9.2/11.2 (historical, filterable, downloadable) would need
   a dedicated reports endpoint - reasonable next increment.
3. **Remove-charge endpoint** still doesn't exist (only add) - same gap
   flagged in the previous pass, unchanged.
4. Vacating notice **submission** (tenant-side) has no UI yet, since
   the tenant portal doesn't exist - revoke (landlord-side) works.

## Verification performed

- Full syntax + import-resolution sweep across backend and frontend -
  clean.
- All 6 new/changed page components rendered server-side with
  realistic mock API responses (units, tenants, payments, subscription
  status) to confirm the JSX actually executes, not just parses.
- Caught and fixed one real syntax bug during this process (a leftover
  duplicate code block from an in-place edit) before it ever reached
  you.
- Core logic (overdue detection, placeholder-slot math) verified
  against hand-computed expected values.

## Running it

Both backend and frontend changed - replace both, or see the specific
files listed in each controller/route/page above. `npm install` not
required for either (no new packages), just restart both dev servers.
