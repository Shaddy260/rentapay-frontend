import { useEffect, useState } from 'react';

/**
 * PERFORMANCE FIX (direct request: "check anything causing low speed
 * and too much loading"): the dashboard's drilldown tables (all units,
 * overdue tenants, vacant units, etc.) rendered every row in the list
 * at once with no cap - fine for a landlord with a dozen units, but a
 * portfolio with a few hundred meant a few hundred DOM rows (several
 * with a nested TenantContactCard) mounting in one go every time a
 * drilldown was opened.
 *
 * This renders only the first `pageSize` items and reveals more in
 * batches on demand, resetting back to the first page whenever
 * `resetKey` changes (e.g. switching between drilldowns) so a person
 * always sees page 1 first rather than wherever they'd scrolled to on
 * a different list.
 */
export default function PagedList({ items, pageSize = 50, resetKey, children }) {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = items.length > visibleCount;

  return (
    <>
      {children(visibleItems)}
      {hasMore && (
        <tr>
          <td colSpan={12} style={{ textAlign: 'center', padding: '0.75rem' }}>
            <button type="button" className="ghost-link" onClick={() => setVisibleCount((c) => c + pageSize)}>
              Load more ({items.length - visibleCount} remaining)
            </button>
          </td>
        </tr>
      )}
    </>
  );
}
