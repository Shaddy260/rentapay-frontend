# Reports, documents, and data export

Beyond day to day rent collection, RentaPay gives a landlord several ways to step
back and see the bigger picture across their whole portfolio, or pull their own
records out of the platform entirely.

## Annual report

A landlord can generate an annual report for a chosen year, compiling rent
collected, outstanding balances, and occupancy across every property into a single
summary. This is useful for a landlord's own bookkeeping, or for sharing a clear
picture of a year's performance with an accountant or business partner.

## Financial statistics and payment history

The Finances section of the landlord portal shows financial statistics across a
portfolio, a full payment history with every confirmed, rejected, and disputed
payment, and a dedicated view of any payment plan a tenant has requested, so
nothing about the money side of the business needs to be pieced together from
memory.

## Document storage

A landlord, manager, or caretaker can attach documents to a tenant or a property,
such as a signed lease, so that important paperwork lives alongside the tenancy it
belongs to rather than in a separate folder somewhere else entirely.

## Expense tracking

A landlord can record costs associated with running a property, kept separate from
tenant facing rent and deposit records, so that income and outgoings can both be
seen from the same place when it is time to review how a property is actually
performing.

## Data export

A landlord can request an export of their own account's underlying records in a
portable format at any time. Like every other feature in RentaPay, this export
only ever contains data that landlord's own account was already entitled to see;
it is simply a way to take that same data outside the app when needed.

## Larger reports run in the background

Some reports, such as an annual report, a tax summary, or a full year of receipts
bundled into a ZIP file, take longer to put together than a typical page load, since
they are compiled fresh from your actual payment and unit records rather than
prebuilt in advance. Requesting one of these queues it as a background job; once it
is ready, you are given a download link. That link is time limited, currently valid
for one hour from when it is generated, after which it stops working. If you did not
get to it in time, or you need the same report again later, simply request it again
from within the app; generating a fresh link takes moments and does not affect the
underlying records the report is built from in any way.

## If the background report system is temporarily unavailable

On the rare occasion the background job system used for the largest reports is
unavailable, RentaPay automatically falls back to generating certain smaller reports
immediately within the same request instead, so reporting keeps working in a reduced
form rather than failing outright. The public status page reports this subsystem
separately, under "Report & export downloads," so you can check whether a slow or
failed report request is a known, wider issue before trying again.

## What each export format is best for

A CSV export opens directly in a spreadsheet program and is the right choice when you
want to filter, sort, total, or otherwise work with your own numbers further. A PDF
report is the right choice when you want something that looks the same on every
device and is ready to print, save, or send to someone else, such as an accountant or
a tax authority, without them needing to reformat anything. A ZIP file of receipts
bundles many individual payment receipts together as separate files inside one
download, useful when you need the underlying paper trail for every payment in a
period rather than a single summarised total.
