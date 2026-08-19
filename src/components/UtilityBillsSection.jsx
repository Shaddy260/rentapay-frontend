import React, { useState, useEffect, useCallback } from 'react';
import Button from './Button.jsx';
import { api } from '../api/client.js';
import { PaybillModal } from '../pages/TenantPortal.jsx';
import './UtilityBillsSection.css';

const UTILITY_LABELS = { water: 'Water', electricity: 'Electricity' };
const UTILITY_ICONS = { water: '💧', electricity: '⚡' };

// Shows each utility type the landlord has actually set up for this
// tenant as its own card (water and electricity side by side on
// desktop, stacked on mobile) - a type with no bills on file simply
// doesn't render, per direct request ("if not added should not be
// visible"). Each card pays independently of rent and of the other
// utility. The grand total at the bottom is rent + every utility
// combined, for display only - it never merges the underlying
// balances.
export default function UtilityBillsSection({ token, paymentInstructions, rentOwed, onPaid }) {
  const [byType, setByType] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingInvoice, setPayingInvoice] = useState(null); // { id, utilityType, amountOwed }

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .getUtilityInvoices(token)
      .then((res) => setByType(res.byType || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading || byType.length === 0) return null; // nothing to show if the landlord hasn't set up any utility billing

  const utilitiesTotal = byType.reduce((sum, t) => sum + Number(t.totalOwed || 0), 0);
  const grandTotal = Math.round((Number(rentOwed || 0) + utilitiesTotal) * 100) / 100;

  return (
    <section className="utility-bills-section">
      {error && <p className="modal-error">{error}</p>}
      <div className="utility-bills-section__grid">
        {byType.map((group) => {
          const openInvoice = group.invoices.find((inv) => inv.status !== 'paid');
          const label = UTILITY_LABELS[group.utilityType] || group.utilityType;
          return (
            <div className="utility-bill-card" key={group.utilityType}>
              <div className="utility-bill-card__header">
                <span className="utility-bill-card__icon">{UTILITY_ICONS[group.utilityType] || '🔌'}</span>
                <span className="utility-bill-card__label">{label}</span>
              </div>
              <div className="utility-bill-card__amount">
                KES {Number(group.totalOwed).toLocaleString()}
              </div>
              <div className="utility-bill-card__sub">
                {group.totalOwed > 0 ? 'Owed' : 'Fully paid'}
                {openInvoice?.month_key ? ` · ${openInvoice.month_key}` : ''}
              </div>
              {group.totalOwed > 0 && openInvoice && (
                <Button
                  variant="mpesa"
                  onClick={() =>
                    setPayingInvoice({
                      id: openInvoice.id,
                      utilityType: group.utilityType,
                      amountOwed: Number(group.totalOwed),
                    })
                  }
                >
                  Pay {label}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="utility-bills-section__total">
        <span>Total owed</span>
        <span className="utility-bills-section__total-amount">
          Rent {Number(rentOwed || 0).toLocaleString()} + {byType.map((t) => `${UTILITY_LABELS[t.utilityType] || t.utilityType} ${Number(t.totalOwed).toLocaleString()}`).join(' + ')} = KES {grandTotal.toLocaleString()}
        </span>
      </div>

      {payingInvoice && (
        <PaybillModal
          title={`Pay ${UTILITY_LABELS[payingInvoice.utilityType] || payingInvoice.utilityType}`}
          paymentInstructions={paymentInstructions}
          amountDue={payingInvoice.amountOwed}
          token={token}
          targetInvoiceId={payingInvoice.id}
          onClose={() => setPayingInvoice(null)}
          onDone={() => {
            setPayingInvoice(null);
            load();
            if (onPaid) onPaid();
          }}
        />
      )}
    </section>
  );
}
