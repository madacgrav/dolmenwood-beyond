'use client';
import type { Coins } from '@/lib/data/characters';
import { RESTOCK_ITEMS, totalSpOnHand } from './restock-data';
import type { RestockController } from './use-restock';

interface Props {
  coins: Coins;
  controller: RestockController;
}

/** Bottom-sheet modal for buying consumables from the restock catalog. */
export function RestockSheet({ coins, controller }: Props) {
  const {
    setShowRestock,
    restockQtys, setRestockQtys,
    restockLoading, restockSuccess, restockError,
    restockTotalSp, handleRestock,
  } = controller;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.55)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={e => { if (e.target === e.currentTarget) setShowRestock(false); }}
    >
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
        border: '1px solid var(--color-border)',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Sheet header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.25rem 0.75rem',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-text)' }}>
              🛒 Restock Supplies
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
              You have: {coins.gp} GP, {coins.sp} SP{coins.cp > 0 ? `, ${coins.cp} CP` : ''}
              {' '}≈ {totalSpOnHand(coins).toFixed(1)} SP total
            </div>
          </div>
          <button
            onClick={() => setShowRestock(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontSize: '1.4rem',
              padding: '0.25rem', minHeight: '44px', minWidth: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Close restock"
          >✕</button>
        </div>

        {/* Item rows */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem 1.25rem' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto auto',
            gap: '0.5rem', alignItems: 'center',
            paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)',
            marginBottom: '0.5rem',
            fontSize: '0.65rem', color: 'var(--color-text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <span>Item</span>
            <span style={{ textAlign: 'right' }}>Price</span>
            <span style={{ textAlign: 'center', minWidth: '90px' }}>Qty</span>
            <span style={{ textAlign: 'right', minWidth: '48px' }}>Total</span>
          </div>

          {RESTOCK_ITEMS.map(entry => {
            const qty = restockQtys[entry.name] ?? 0;
            const subtotal = qty * entry.priceSp;
            const fmtSp = (sp: number) =>
              sp >= 1
                ? `${sp.toFixed(sp % 1 === 0 ? 0 : 1)} sp`
                : `${Math.round(sp * 10)} cp`;
            return (
              <div key={entry.name} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                gap: '0.5rem', alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)',
              }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)' }}>{entry.name}</div>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {fmtSp(entry.priceSp)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', minWidth: '90px', justifyContent: 'center' }}>
                  <button
                    onClick={() => setRestockQtys(q => ({ ...q, [entry.name]: Math.max(0, (q[entry.name] ?? 0) - 1) }))}
                    disabled={qty <= 0}
                    style={{
                      width: '32px', height: '44px', borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
                      fontSize: '1rem', cursor: 'pointer',
                      opacity: qty <= 0 ? 0.35 : 1,
                    }}
                    aria-label={`Decrease ${entry.name}`}
                  >−</button>
                  <span style={{
                    minWidth: '2ch', textAlign: 'center',
                    fontSize: '1rem', fontWeight: '700',
                    color: qty > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>{qty}</span>
                  <button
                    onClick={() => setRestockQtys(q => ({ ...q, [entry.name]: (q[entry.name] ?? 0) + 1 }))}
                    style={{
                      width: '32px', height: '44px', borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
                      fontSize: '1rem', cursor: 'pointer',
                    }}
                    aria-label={`Increase ${entry.name}`}
                  >+</button>
                  {entry.pack != null && (
                    <button
                      onClick={() => setRestockQtys(q => ({ ...q, [entry.name]: (q[entry.name] ?? 0) + entry.pack! }))}
                      style={{
                        height: '44px', padding: '0 0.5rem', borderRadius: '6px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)',
                        fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                      aria-label={`Add ${entry.pack} ${entry.name}`}
                    >+{entry.pack}</button>
                  )}
                </div>
                <span style={{
                  fontSize: '0.82rem', fontWeight: qty > 0 ? '700' : '400',
                  color: qty > 0 ? 'var(--color-gold)' : 'var(--color-text-muted)',
                  textAlign: 'right', minWidth: '48px', whiteSpace: 'nowrap',
                }}>
                  {subtotal > 0 ? fmtSp(subtotal) : '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.875rem 1.25rem 1.25rem',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column', gap: '0.625rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Total</span>
            <span style={{
              fontSize: '1.1rem', fontWeight: '700',
              fontFamily: 'var(--font-display), Georgia, serif',
              color: restockTotalSp() > totalSpOnHand(coins) ? 'var(--color-danger)' : 'var(--color-gold)',
            }}>
              {restockTotalSp() >= 1
                ? `${restockTotalSp().toFixed(restockTotalSp() % 1 === 0 ? 0 : 2)} sp`
                : restockTotalSp() > 0
                  ? `${Math.round(restockTotalSp() * 10)} cp`
                  : '0 sp'}
            </span>
          </div>

          {restockError === 'insufficient' && (
            <div style={{
              padding: '0.625rem', borderRadius: '8px',
              backgroundColor: 'color-mix(in srgb, var(--color-danger) 12%, var(--color-bg))',
              border: '1px solid var(--color-danger)',
              fontSize: '0.82rem', color: 'var(--color-danger)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem',
            }}>
              <span>⚠️ Not enough coin ({totalSpOnHand(coins).toFixed(1)} sp available)</span>
              <button
                onClick={() => handleRestock(true)}
                style={{
                  padding: '0.25rem 0.625rem', borderRadius: '6px',
                  border: '1px solid var(--color-danger)',
                  backgroundColor: 'transparent', color: 'var(--color-danger)',
                  fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: '44px',
                }}
              >
                Proceed anyway
              </button>
            </div>
          )}

          {restockError === 'error' && (
            <div style={{ fontSize: '0.82rem', color: 'var(--color-danger)' }}>
              Something went wrong. Please try again.
            </div>
          )}

          {restockSuccess ? (
            <div style={{
              padding: '0.875rem', borderRadius: '10px', textAlign: 'center',
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, var(--color-bg))',
              color: 'var(--color-primary)', fontWeight: '700', fontSize: '1rem',
            }}>
              ✓ Restocked!
            </div>
          ) : (
            <button
              onClick={() => handleRestock(false)}
              disabled={restockLoading || restockTotalSp() === 0}
              style={{
                padding: '0.875rem', borderRadius: '10px', border: 'none',
                backgroundColor: 'var(--color-primary)', color: 'white',
                fontWeight: '700', fontSize: '1rem', cursor: 'pointer',
                minHeight: '44px',
                opacity: restockLoading || restockTotalSp() === 0 ? 0.5 : 1,
              }}
            >
              {restockLoading
                ? 'Restocking…'
                : `Restock (${
                    restockTotalSp() >= 1
                      ? `${restockTotalSp().toFixed(restockTotalSp() % 1 === 0 ? 0 : 2)} sp`
                      : `${Math.round(restockTotalSp() * 10)} cp`
                  })`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
