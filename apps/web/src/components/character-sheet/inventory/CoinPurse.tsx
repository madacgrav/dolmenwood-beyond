'use client';
import type { ReactNode } from 'react';
import type { Coins } from '@/lib/data/characters';
import { sectionHead } from './types';

interface Props {
  coins: Coins;
  isOwner: boolean;
  onCoinChange: (coin: 'gp' | 'sp' | 'cp', value: string) => void;
  /** Small control rendered on the heading row (e.g. the Spend & Bank toggle). */
  action?: ReactNode;
}

/** "Coins on Hand" section — three editable denomination boxes. */
export function CoinPurse({ coins, isOwner, onCoinChange, action }: Props) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <h3 style={sectionHead}>Coins on Hand</h3>
        {action}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {(['gp', 'sp', 'cp'] as const).map(coin => (
          <div key={coin} style={{ flex: 1, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.65rem', color: coin === 'gp' ? 'var(--color-gold)' : 'var(--color-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{coin}</span>
            <input
              type="number"
              min={0}
              value={coins[coin]}
              onChange={e => onCoinChange(coin, e.target.value)}
              disabled={!isOwner}
              style={{ width: '100%', textAlign: 'center', backgroundColor: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '1.1rem', fontWeight: '700', minHeight: '44px' }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
