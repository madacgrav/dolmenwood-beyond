'use client';

import { PACK_ANIMAL_TYPES } from '@/lib/data/campaigns';
import type { PackAnimal, PackAnimalType } from '@/lib/data/campaigns';
import type { NewPackAnimalForm } from './types';

interface Props {
  animals: PackAnimal[];
  showAdd: boolean;
  newAnimal: NewPackAnimalForm;
  onToggleAdd: () => void;
  onPatchAnimal: (patch: Partial<NewPackAnimalForm>) => void;
  onAdd: () => void;
  onDelete: (animalId: string) => void;
}

export function PackAnimalsSection({ animals, showAdd, newAnimal, onToggleAdd, onPatchAnimal, onAdd, onDelete }: Props) {
  return (
    <div style={{ borderTop: '1px solid var(--color-border)' }}>
      <button
        onClick={onToggleAdd}
        style={{
          width: '100%', padding: '0.625rem 1rem',
          backgroundColor: 'var(--color-bg)', border: 'none',
          color: 'var(--color-text-muted)', fontSize: '0.8rem',
          cursor: 'pointer', textAlign: 'left', minHeight: '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span>🐴 Pack Animals ({animals.length})</span>
        <span>＋</span>
      </button>

      {/* Existing pack animals */}
      {animals.length > 0 && (
        <div style={{ padding: '0 1rem 0.625rem' }}>
          {animals.map(animal => (
            <div key={animal.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.375rem 0.5rem', fontSize: '0.8rem',
              backgroundColor: 'var(--color-bg)', borderRadius: '6px',
              border: '1px solid var(--color-border)', marginBottom: '0.3rem',
            }}>
              <span style={{ color: 'var(--color-text)', fontWeight: '600' }}>{animal.name}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>·</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{animal.mount_type}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>·</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{animal.speed} ft</span>
              <button
                onClick={() => onDelete(animal.id)}
                style={{
                  marginLeft: 'auto', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--color-danger)',
                  fontSize: '0.85rem', padding: '0.125rem', minHeight: '28px', minWidth: '28px',
                }}
                aria-label={`Remove ${animal.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add pack animal form */}
      {showAdd && (
        <div style={{ padding: '0 1rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Animal name"
            value={newAnimal.name}
            onChange={e => onPatchAnimal({ name: e.target.value })}
            style={{
              padding: '0.4rem 0.625rem', borderRadius: '6px',
              border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)', fontSize: '0.875rem', minHeight: '40px',
            }}
          />
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <select
              value={newAnimal.mount_type}
              onChange={e => onPatchAnimal({ mount_type: e.target.value as PackAnimalType })}
              style={{
                flex: 1, padding: '0.4rem 0.5rem', borderRadius: '6px',
                border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)', fontSize: '0.8rem', minHeight: '40px',
              }}
            >
              {PACK_ANIMAL_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <input
              type="number" min={10} max={60} step={10}
              value={newAnimal.speed}
              onChange={e => onPatchAnimal({ speed: parseInt(e.target.value) || 30 })}
              style={{
                width: '70px', padding: '0.4rem 0.5rem', borderRadius: '6px',
                border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)', fontSize: '0.8rem', minHeight: '40px', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={onAdd}
              disabled={!newAnimal.name.trim()}
              style={{
                padding: '0.4rem 0.875rem', borderRadius: '6px', border: 'none',
                backgroundColor: !newAnimal.name.trim() ? 'var(--color-border)' : 'var(--color-primary)',
                color: 'white', fontSize: '0.8rem', fontWeight: '600',
                cursor: !newAnimal.name.trim() ? 'not-allowed' : 'pointer',
                minHeight: '40px',
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
