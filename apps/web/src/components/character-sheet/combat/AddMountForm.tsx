'use client';
import type { Dispatch, SetStateAction } from 'react';
import { MOUNT_TYPES, type MountType, type NewMountState } from './types';

interface Props {
  newMount: NewMountState;
  setNewMount: Dispatch<SetStateAction<NewMountState>>;
  addMount: () => Promise<void>;
  mountSaving: boolean;
  onCancel: () => void;
}

export function AddMountForm({ newMount, setNewMount, addMount, mountSaving, onCancel }: Props) {
  return (
    <div style={{
      marginTop: '0.75rem',
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-primary)',
      borderRadius: '10px',
      padding: '1rem',
      display: 'flex', flexDirection: 'column', gap: '0.625rem',
    }}>
      <h4 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.875rem', color: 'var(--color-text)' }}>
        New Mount
      </h4>

      <div>
        <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Name</label>
        <input
          type="text"
          placeholder="e.g. Shadowmere"
          value={newMount.name}
          onChange={e => setNewMount(p => ({ ...p, name: e.target.value }))}
          style={{
            width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Type</label>
          <select
            value={newMount.mount_type}
            onChange={e => setNewMount(p => ({ ...p, mount_type: e.target.value as MountType }))}
            style={{
              width: '100%', padding: '0.4rem 0.5rem', borderRadius: '8px',
              border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '40px',
            }}
          >
            {MOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Speed (ft/round)</label>
          <input
            type="number"
            min={10} max={120} step={10}
            value={newMount.speed}
            onChange={e => setNewMount(p => ({ ...p, speed: parseInt(e.target.value) || 40 }))}
            style={{
              width: '100%', padding: '0.4rem 0.5rem', borderRadius: '8px',
              border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text)', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={newMount.has_full_stats}
          onChange={e => setNewMount(p => ({ ...p, has_full_stats: e.target.checked }))}
        />
        Full stat block (warhorse / combat mount)
      </label>

      {newMount.has_full_stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem' }}>
          {[
            { label: 'AC', key: 'ac' as const, min: 5, max: 20 },
            { label: 'HP Max', key: 'hp_max' as const, min: 1, max: 100 },
            { label: 'ATK Bonus', key: 'attack_bonus' as const, min: -2, max: 10 },
            { label: 'Morale', key: 'morale' as const, min: 2, max: 12 },
          ].map(({ label, key, min, max }) => (
            <div key={key}>
              <label style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.15rem' }}>{label}</label>
              <input
                type="number" min={min} max={max}
                value={newMount[key]}
                onChange={e => setNewMount(p => ({ ...p, [key]: parseInt(e.target.value) || min }))}
                style={{
                  width: '100%', padding: '0.3rem', borderRadius: '6px',
                  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)', fontSize: '0.9rem', textAlign: 'center',
                  minHeight: '40px', boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={addMount}
          disabled={mountSaving || !newMount.name.trim()}
          style={{
            flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none',
            backgroundColor: mountSaving || !newMount.name.trim() ? 'var(--color-border)' : 'var(--color-primary)',
            color: 'white', fontWeight: '600', fontSize: '0.875rem',
            cursor: mountSaving || !newMount.name.trim() ? 'not-allowed' : 'pointer',
            minHeight: '44px',
          }}
        >
          {mountSaving ? 'Saving…' : 'Add Mount'}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '0.625rem 1rem', borderRadius: '8px',
            border: '1px solid var(--color-border)', backgroundColor: 'transparent',
            color: 'var(--color-text-muted)', fontSize: '0.875rem', cursor: 'pointer', minHeight: '44px',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
