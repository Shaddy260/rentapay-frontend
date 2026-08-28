import { useEffect, useState } from 'react';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import { api } from '../api/client.js';
import Button from './Button.jsx';
import './SubscriptionLockGate.css';
import InfoTip from './InfoTip.jsx';
import HelpButton from './HelpButton.jsx';

// FIX (direct request: "everything else including notifications
// worked perfectly...they shouldn't be able to access anything at
// all"): the old behaviour was a dismissible-in-spirit banner sitting
// ON TOP of a fully working dashboard - every page, every action, was
// still reachable underneath it once the subscription lapsed. This
// wraps every landlord/manager/caretaker-only route (Dashboard,
// Settings, Messages, AddUnit, UnitDetail, AddTenant - NOT /subscription
// itself, which must stay reachable to actually renew) and, once the
// account's subscription is 'expired', replaces the entire page with
// a full-screen, non-dismissible lock screen instead of rendering the
// page's children at all. Nothing behind the lock screen mounts, so
// there is no way to reach any other part of the app - the only way
// out is renewing.
//
// This is deliberately account-wide (reads the landlord's own row,
// no propertyId) rather than per-property: a lapsed subscription now
// locks the whole account out of the dashboard, not just one
// apartment's screens - matching how the STK/manual-payment renewal
// flow itself already works (there is one subscription per landlord
// account, not per property, for landlords who never bought a
// property its own independent clock).
//
// Tenants are completely unaffected by this component (it's never
// used on tenant routes) and background jobs (billing, reminders,
// tenant-facing notifications) keep running exactly as before - this
// only blocks the landlord/manager/caretaker's own dashboard access.
export default function SubscriptionLockGate({ children }) {
  const navigate = useNavigate();
  const token = localStorage.getItem('rentapay_token');
  const role = localStorage.getItem('rentapay_role');
  const [checked, setChecked] = useState(false);
  const [expired, setExpired] = useState(false);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    // Only landlords and managers/caretakers have a subscription to
    // lapse - tenants and admins pass straight through.
    if (role !== 'landlord' && role !== 'manager') {
      setChecked(true);
      return;
    }
    let cancelled = false;
    api
      .getSubscriptionStatus(token)
      .then((res) => {
        if (cancelled) return;
        setIsManager(role === 'manager');
        setExpired(res.subscription_status === 'expired');
      })
      .catch(() => {
        // Fail open on a network/lookup error - we don't want a
        // transient API hiccup to lock a paying landlord out of their
        // own dashboard. The next successful check will still catch
        // a genuinely lapsed subscription.
      })
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [token, role]);

  if (!checked) return null;

  if (!expired) return children;

  return (
    <div className="subscription-lock-gate">
      <div className="subscription-lock-gate__card">
        <h1>Your RentaPay subscription has ended</h1>
        <p>
          {isManager
            ? "The landlord's RentaPay subscription has ended. All access is locked, including yours, until it's renewed - contact them to renew it."
            : "All access to RentaPay is locked until you renew - your dashboard, units, messages, and everything else are unavailable until then."}
        </p>
        <InfoTip text={<>
          Everything is saved and waiting exactly as you left it, and your tenants' portals keep working normally in the meantime - this only blocks your own dashboard access.
        </>} />
        <div className="subscription-lock-gate__help">
          <p>Having trouble renewing? We're here to help - reach us any of these ways:</p>
          <HelpButton
            role={isManager ? 'manager' : 'landlord'}
            token={token}
            label="Get help"
            renderAs="ghost-link subscription-lock-gate__help-link"
          />
        </div>
        <div className="subscription-lock-gate__actions">
          {!isManager && (
            <Button variant="primary" onClick={() => navigate('/subscription')}>Renew now</Button>
          )}
          <button
            type="button"
            className="ghost-link"
            onClick={() => {
              localStorage.removeItem('rentapay_token');
              localStorage.removeItem('rentapay_role');
              localStorage.removeItem('rentapay_role_level');
              navigate('/login');
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
