'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordBankTransaction } from '@/lib/data/bank';

interface Props {
  supabase: SupabaseClient;
  characterId: string;
  bankBalance: number;
  coinsGp: number;
  isOwner: boolean;
  /** Called after a successful deposit with the character's new gp-on-hand. */
  onDeposited: (newGp: number) => Promise<void>;
}

/** Bank balance card with the owner-only deposit form. */
export function BankPanel({ supabase, characterId, bankBalance, coinsGp, isOwner, onDeposited }: Props) {
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDesc, setDepositDesc] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState('');

  async function handleDeposit() {
    const amount = parseInt(depositAmount);
    if (!amount || amount <= 0) { setDepositError('Enter a positive amount.'); return; }
    if (amount > coinsGp) { setDepositError(`You only have ${coinsGp} gp on hand.`); return; }
    setDepositLoading(true);
    setDepositError('');

    const newGp = coinsGp - amount;
    const txError = await recordBankTransaction(supabase, {
      characterId,
      amountGp: amount,
      description: depositDesc.trim() || 'Deposit',
    });

    if (txError) {
      setDepositError(txError);
    } else {
      await onDeposited(newGp);
      setShowDeposit(false);
      setDepositAmount('');
      setDepositDesc('');
    }
    setDepositLoading(false);
  }

  return (
    <section>
      <div style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        padding: '0.875rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🏦</span>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>In the Bank</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: bankBalance > 0 ? 'var(--color-gold)' : 'var(--color-text-muted)' }}>
                {bankBalance} gp
              </div>
            </div>
          </div>
          {isOwner && (
            <button
              onClick={() => { setShowDeposit(d => !d); setDepositError(''); setDepositAmount(''); setDepositDesc(''); }}
              style={{
                padding: '0.4rem 0.875rem',
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px', cursor: 'pointer',
                fontSize: '0.8rem', fontWeight: '600',
                color: 'var(--color-primary)', minHeight: '44px',
              }}
            >
              {showDeposit ? 'Cancel' : '⬆ Deposit'}
            </button>
          )}
        </div>

        {showDeposit && (
          <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Amount (gp)</label>
                <input
                  type="number" min={1} max={coinsGp}
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="0"
                  style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Note (optional)</label>
                <input
                  type="text"
                  value={depositDesc}
                  onChange={e => setDepositDesc(e.target.value)}
                  placeholder="e.g. Storing quest reward"
                  style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            {depositError && (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-danger)' }}>{depositError}</div>
            )}
            <button
              onClick={handleDeposit}
              disabled={depositLoading || !depositAmount}
              style={{
                padding: '0.5rem', borderRadius: '8px', border: 'none',
                backgroundColor: 'var(--color-primary)', color: 'white',
                fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer',
                opacity: depositLoading || !depositAmount ? 0.55 : 1, minHeight: '40px',
              }}
            >
              {depositLoading ? 'Depositing…' : `Deposit ${depositAmount || '0'} gp →`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
