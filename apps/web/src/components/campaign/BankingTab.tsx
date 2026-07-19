'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  dmBankOverview,
  recordBankTransaction,
  type LedgerRow,
  type DMBankEntry,
} from '@/lib/api/bank';
import { EmptyState } from '@/components/ui/EmptyState';

interface CharacterBank {
  character: DMBankEntry;
  balance: number;
  ledger: LedgerRow[];
  showTransfer: boolean;
  transferAmount: string;
  transferDesc: string;
  transferError: string;
  transferLoading: boolean;
  showHistory: boolean;
}

export function BankingTab() {
  const [entries, setEntries] = useState<CharacterBank[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const overview = await dmBankOverview();
    setEntries(overview.map(c => ({
      character: c,
      balance: c.balance,
      ledger: c.ledger,
      showTransfer: false,
      transferAmount: '',
      transferDesc: '',
      transferError: '',
      transferLoading: false,
      showHistory: false,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function update(id: string, patch: Partial<CharacterBank>) {
    setEntries(prev => prev.map(e => e.character.id === id ? { ...e, ...patch } : e));
  }

  async function handleTransfer(entry: CharacterBank) {
    const amount = parseInt(entry.transferAmount);
    if (!amount || amount <= 0) { update(entry.character.id, { transferError: 'Enter a positive amount.' }); return; }
    if (amount > entry.balance) { update(entry.character.id, { transferError: `Bank only holds ${entry.balance} gp for this character.` }); return; }

    update(entry.character.id, { transferLoading: true, transferError: '' });

    const txError = await recordBankTransaction({
      characterId: entry.character.id,
      amountGp: -amount,
      description: entry.transferDesc.trim() || 'Transfer to character',
    });

    if (txError) {
      update(entry.character.id, { transferError: txError, transferLoading: false });
    } else {
      await loadData();
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '80px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState emoji="🏦" headline="No Deposits Yet" message="No characters found. Players need to create characters first." />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {entries.map(entry => (
        <div
          key={entry.character.id}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          {/* Character header */}
          <div style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              backgroundColor: 'var(--color-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.25rem', flexShrink: 0,
            }}>
              ⚔️
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.95rem' }}>
                {entry.character.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {entry.character.kindred} {entry.character.character_class} · Lv {entry.character.level}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>In Bank</div>
              <div style={{
                fontSize: '1.1rem', fontWeight: '700',
                color: entry.balance > 0 ? 'var(--color-gold)' : 'var(--color-text-muted)',
              }}>
                {entry.balance} gp
              </div>
            </div>
          </div>

          {/* Actions bar */}
          <div style={{ borderTop: '1px solid var(--color-border)', padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', backgroundColor: 'var(--color-bg)' }}>
            <button
              onClick={() => update(entry.character.id, { showTransfer: !entry.showTransfer, transferAmount: '', transferDesc: '', transferError: '' })}
              disabled={entry.balance === 0}
              style={{
                flex: 1, padding: '0.5rem', borderRadius: '8px',
                border: '1px solid var(--color-border)',
                backgroundColor: entry.balance > 0 ? 'var(--color-primary)' : 'var(--color-surface)',
                color: entry.balance > 0 ? 'white' : 'var(--color-text-muted)',
                fontWeight: '600', fontSize: '0.8rem', cursor: entry.balance > 0 ? 'pointer' : 'not-allowed',
                opacity: entry.balance === 0 ? 0.5 : 1, minHeight: '40px',
              }}
            >
              {entry.showTransfer ? 'Cancel' : '⬇ Transfer to Character'}
            </button>
            {entry.ledger.length > 0 && (
              <button
                onClick={() => update(entry.character.id, { showHistory: !entry.showHistory })}
                style={{
                  padding: '0.5rem 0.75rem', borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-muted)', fontSize: '0.8rem', cursor: 'pointer', minHeight: '40px',
                }}
              >
                {entry.showHistory ? 'Hide' : `History (${entry.ledger.length})`}
              </button>
            )}
          </div>

          {/* Transfer form */}
          {entry.showTransfer && (
            <div style={{ padding: '0.875rem 1rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Amount (gp)</label>
                  <input
                    type="number" min={1} max={entry.balance}
                    value={entry.transferAmount}
                    onChange={e => update(entry.character.id, { transferAmount: e.target.value })}
                    placeholder={`Max ${entry.balance}`}
                    style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Note (optional)</label>
                  <input
                    type="text"
                    value={entry.transferDesc}
                    onChange={e => update(entry.character.id, { transferDesc: e.target.value })}
                    placeholder="e.g. Quest reward payout"
                    style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              {entry.transferError && (
                <div style={{ fontSize: '0.78rem', color: 'var(--color-danger)' }}>{entry.transferError}</div>
              )}
              <button
                onClick={() => handleTransfer(entry)}
                disabled={entry.transferLoading || !entry.transferAmount}
                style={{
                  padding: '0.5rem', borderRadius: '8px', border: 'none',
                  backgroundColor: 'var(--color-primary)', color: 'white',
                  fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer',
                  opacity: entry.transferLoading || !entry.transferAmount ? 0.55 : 1, minHeight: '40px',
                }}
              >
                {entry.transferLoading ? 'Transferring…' : `Transfer ${entry.transferAmount || '0'} gp → Character`}
              </button>
            </div>
          )}

          {/* Transaction history */}
          {entry.showHistory && entry.ledger.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border)' }}>
              {entry.ledger.map(row => (
                <div
                  key={row.id}
                  style={{
                    padding: '0.5rem 1rem',
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '0.8rem',
                  }}
                >
                  <span style={{ color: row.amount_gp > 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontWeight: '700', minWidth: '60px' }}>
                    {row.amount_gp > 0 ? '+' : ''}{row.amount_gp} gp
                  </span>
                  <span style={{ flex: 1, color: 'var(--color-text)' }}>{row.description}</span>
                  <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(row.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
