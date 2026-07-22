// src/constants/platformPaybill.js
//
// RentaPay's OWN receiving Paybill/account for platform subscription
// payments (landlord AND scout) - mirrors backend
// src/constants/platformPaybill.js exactly. Kept as ONE shared
// constant, imported everywhere a "pay manually" screen needs to
// show these numbers, specifically because SubscriptionManage.jsx
// used to have this hardcoded separately and had drifted to the
// WRONG paybill number (400200 instead of the real 522522) - a
// landlord following those instructions would have sent money
// nowhere useful. Never hardcode these numbers inline again; import
// from here.

export const PLATFORM_PAYBILL_NUMBER = '522522';
export const PLATFORM_PAYBILL_ACCOUNT_NUMBER = '1341657388';
