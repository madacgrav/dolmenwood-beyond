'use client';
import { useState } from 'react';
import type { Coins } from '@/lib/api/characters';
import { spendCoins } from '@/lib/api/characters';

interface Props {
  characterId: string;
  coins: Coins;
  /** Called after a successful spend with the character's new coin counts. */
  onSpent: (coins: Coins) => void;
}

/** Owner-only "Spend" flow: amount + denomination, server-enforced deduction
 *  with change-making across the purse. */
export function SpendForm({ characterId, coins, onSpent }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [denom, setDenom] = useState<'gp' | 'sp' | 'cp'>('gp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSpend() {
    const n = parseInt(amount);
    if (!n || n <= 0) { setError('Enter a positive amount.'); return; }
    setLoading(true);
    setError('');
    const { coins: next, error: spendError } = await spendCoins(characterId, n, denom);
    if (spendError || !next) {
      setError(spendError ?? 'Spend failed.');
    } else {
      onSpent(next);
      setOpen(false);
      setAmount('');
    }
    setLoading(false);
  }

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.875rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🪙</span>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Spend from purse
          </div>
        </div>
        <button
          onClick={() => { setOpen(o => !o); setError(''); setAmount(''); }}
          style={{
            padding: '0.4rem 0.875rem',
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px', cursor: 'pointer',
            fontSize: '0.8rem', fontWeight: '600',
            color: 'var(--color-primary)', minHeight: '44px',
          }}
        >
          {open ? 'Cancel' : '💸 Spend'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.875rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Amount</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Coin</label>
              <select
                value={denom}
                onChange={e => setDenom(e.target.value as 'gp' | 'sp' | 'cp')}
                style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px', boxSizing: 'border-box' }}
              >
                <option value="gp">gp</option>
                <option value="sp">sp</option>
                <option value="cp">cp</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            You have {coins.gp} gp, {coins.sp} sp, {coins.cp} cp. Change is made automatically.
          </div>
          {error && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-danger)' }}>{error}</div>
          )}
          <button
            onClick={handleSpend}
            disabled={loading || !amount}
            style={{
              padding: '0.5rem', borderRadius: '8px', border: 'none',
              backgroundColor: 'var(--color-primary)', color: 'white',
              fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer',
              opacity: loading || !amount ? 0.55 : 1, minHeight: '40px',
            }}
          >
            {loading ? 'Spending…' : `Spend ${amount || '0'} ${denom}`}
          </button>
        </div>
      )}
    </div>
  );
}
