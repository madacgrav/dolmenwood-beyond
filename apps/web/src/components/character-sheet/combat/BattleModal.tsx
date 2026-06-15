'use client';

interface Props {
  ammoName: string;
  battleStartQty: number;
  battleCurrentQty: number;
  battleResult: { recovered: number } | null;
  battleEnding: boolean;
  fireShotInBattle: () => Promise<void>;
  endBattle: () => Promise<void>;
  closeBattle: () => void;
}

export function BattleModal({
  ammoName,
  battleStartQty,
  battleCurrentQty,
  battleResult,
  battleEnding,
  fireShotInBattle,
  endBattle,
  closeBattle,
}: Props) {
  const shotsUsed = battleStartQty - battleCurrentQty;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      backgroundColor: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '16px',
        padding: '1.5rem',
        width: '100%', maxWidth: '360px',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1.2rem', fontWeight: '700', color: 'var(--color-text)', marginBottom: '0.25rem' }}>
            ⚔️ Battle Mode
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {ammoName} — Started with {battleStartQty}
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'var(--color-bg)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Remaining</div>
          <div style={{
            fontSize: '3rem', fontWeight: '700',
            fontFamily: 'var(--font-display), Georgia, serif',
            color: battleCurrentQty === 0 ? 'var(--color-danger)' : 'var(--color-primary)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}>
            {battleCurrentQty}
          </div>
          {shotsUsed > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              {shotsUsed} shot{shotsUsed !== 1 ? 's' : ''} fired
            </div>
          )}
        </div>

        {battleResult ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{
              padding: '0.875rem', borderRadius: '10px',
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))',
              border: '1px solid var(--color-primary)',
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Arrow Recovery</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-primary)', fontFamily: 'var(--font-display), Georgia, serif' }}>
                +{battleResult.recovered} recovered
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                ({shotsUsed} fired → ½ recovered)
              </div>
            </div>
            <button
              onClick={closeBattle}
              style={{
                padding: '0.75rem', borderRadius: '10px', border: 'none',
                backgroundColor: 'var(--color-primary)', color: 'white',
                fontWeight: '700', fontSize: '1rem', cursor: 'pointer', minHeight: '44px',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <button
              onClick={fireShotInBattle}
              disabled={battleCurrentQty <= 0}
              style={{
                padding: '1rem', borderRadius: '10px', border: 'none',
                backgroundColor: battleCurrentQty > 0 ? 'var(--color-primary)' : 'var(--color-border)',
                color: 'white', fontWeight: '700', fontSize: '1.1rem',
                cursor: battleCurrentQty > 0 ? 'pointer' : 'not-allowed',
                minHeight: '56px', opacity: battleCurrentQty > 0 ? 1 : 0.5,
              }}
            >
              🏹 Shot Fired
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={endBattle}
                disabled={battleEnding}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'color-mix(in srgb, var(--color-gold) 15%, var(--color-bg))',
                  color: 'var(--color-gold)', fontWeight: '700',
                  fontSize: '0.9rem', cursor: 'pointer', minHeight: '44px',
                  opacity: battleEnding ? 0.6 : 1,
                }}
              >
                {battleEnding ? '…' : '🏁 End Battle'}
              </button>
              <button
                onClick={closeBattle}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)',
                  fontSize: '0.9rem', cursor: 'pointer', minHeight: '44px',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
