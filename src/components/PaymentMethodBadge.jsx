import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import './PaymentMethodBadge.css';

// Always-visible payment method indicator, shown in the landlord,
// manager, caretaker, and tenant portals (never admin - admin isn't
// attached to any one landlord's payment setup). Fetches fresh on
// mount so a landlord's change (which also fires an announcement -
// see auth.controller.js updatePaymentMethod) is reflected the next
// time anyone opens their portal, not just via the announcement text.
//
// `paymentMethod` can be passed directly (e.g. the tenant portal
// already has this data loaded as `paymentInstructions`) to skip the
// extra fetch - otherwise this fetches it itself for landlord/manager/
// caretaker portals.
//
// `shape`: 'square' (landlord/manager/caretaker header, unchanged
// position) or 'rectangle' (tenant portal, shown directly below the
// unit code - see TenantPortal.jsx). Both use the same gradient +
// glow treatment, just a different silhouette.
export default function PaymentMethodBadge({ token, paymentMethod: providedMethod, shape = 'square', propertyId }) {
  const [method, setMethod] = useState(providedMethod || null);

  useEffect(() => {
    if (providedMethod) {
      setMethod(providedMethod);
      return;
    }
    if (!token) return;
    // BUG FIX: this used to always call getPaymentMethod(token) with no
    // propertyId, so the badge showed the landlord's account-wide
    // default even while viewing an apartment with its own overridden
    // payment method - the "it shows the same to the other apartments"
    // bug also affected this badge, not just the Settings form.
    api.getPaymentMethod(token, propertyId).then((res) => setMethod(res.paymentMethod)).catch(() => {});
  }, [token, providedMethod, propertyId]);

  if (!method) return null;

  const label = method.method === 'paybill'
    ? `Paybill ${method.paybillNumber || '—'}${method.accountNumber ? ` · Acc ${method.accountNumber}` : ''}`
    : method.method === 'till'
      ? `Till ${method.tillNumber || '—'}`
      : `Send to ${method.stkPhoneNumber || '—'}`;

  return (
    <div className={`payment-method-badge payment-method-badge--${method.method} payment-method-badge--${shape}`}>
      <span className="payment-method-badge__icon">💳</span>
      <span className="payment-method-badge__label">{label}</span>
      {(method.isOverride || method.isApartmentSpecific) && <span className="payment-method-badge__override-tag">Apartment-specific</span>}
    </div>
  );
}
