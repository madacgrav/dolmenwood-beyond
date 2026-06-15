'use client';
import type { Dispatch, SetStateAction } from 'react';
import { KINDREDS, CHARACTER_CLASSES } from './types';
import type { NewRetainerState } from './types';

interface Props {
  newRetainer: NewRetainerState;
  setNewRetainer: Dispatch<SetStateAction<NewRetainerState>>;
  addRetainer: () => Promise<void>;
  onCancel: () => void;
}

export function AddRetainerForm({ newRetainer, setNewRetainer, addRetainer, onCancel }: Props) {
  return (
    <div style={{ marginTop: '0.75rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-primary)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <h4 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.875rem', color: 'var(--color-text)' }}>New Retainer</h4>
      <input type="text" placeholder="Name" value={newRetainer.name} onChange={e => setNewRetainer(p => ({ ...p, name: e.target.value }))}
        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px' }} />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Kindred</label>
          <select value={newRetainer.kindred} onChange={e => setNewRetainer(p => ({ ...p, kindred: e.target.value }))}
            style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '40px' }}>
            {KINDREDS.map(k => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Class</label>
          <select value={newRetainer.character_class} onChange={e => setNewRetainer(p => ({ ...p, character_class: e.target.value }))}
            style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '40px' }}>
            {CHARACTER_CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem' }}>
        {[
          { label: 'Level', key: 'level', min: 1, max: 10 },
          { label: 'AC', key: 'ac', min: 10, max: 20 },
          { label: 'HP', key: 'hp_max', min: 1, max: 100 },
          { label: 'ATK', key: 'attack_bonus', min: -2, max: 10 },
        ].map(({ label, key, min, max }) => (
          <div key={key}>
            <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.15rem' }}>{label}</label>
            <input type="number" min={min} max={max}
              value={newRetainer[key as keyof typeof newRetainer] as number}
              onChange={e => {
                const v = parseInt(e.target.value) || min;
                const upd: Partial<typeof newRetainer> = { [key]: v };
                if (key === 'hp_max') upd.hp_current = v;
                setNewRetainer(p => ({ ...p, ...upd }));
              }}
              style={{ width: '100%', padding: '0.3rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', textAlign: 'center', minHeight: '40px', boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <select value={newRetainer.wage_type} onChange={e => setNewRetainer(p => ({ ...p, wage_type: e.target.value as 'daily' | 'share' }))}
          style={{ flex: 1, padding: '0.4rem 0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '40px' }}>
          <option value="daily">Daily wage</option>
          <option value="share">XP share</option>
        </select>
        <input type="number" min={0} value={newRetainer.wage_amount} onChange={e => setNewRetainer(p => ({ ...p, wage_amount: parseFloat(e.target.value) || 0 }))}
          placeholder="gp/day" style={{ width: '80px', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px', textAlign: 'center', boxSizing: 'border-box' }} />
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>gp</span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.875rem', minHeight: '44px' }}>
          Cancel
        </button>
        <button onClick={addRetainer}
          style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', minHeight: '44px' }}>
          Hire
        </button>
      </div>
    </div>
  );
}
