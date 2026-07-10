'use client';
import type { Dispatch, SetStateAction } from 'react';
import type { DBRetainer } from '@/lib/api/retainers';
import type { NewRetainerState } from './types';
import { sectionHead } from './shared';
import { RetainerCard } from './RetainerCard';
import { AddRetainerForm } from './AddRetainerForm';

interface Props {
  readOnly?: boolean;
  maxRetainers: number;
  loyaltyBase: number;
  retainers: DBRetainer[];
  retainerLoading: boolean;
  showAddRetainer: boolean;
  setShowAddRetainer: Dispatch<SetStateAction<boolean>>;
  newRetainer: NewRetainerState;
  setNewRetainer: Dispatch<SetStateAction<NewRetainerState>>;
  expandedRetainer: string | null;
  setExpandedRetainer: Dispatch<SetStateAction<string | null>>;
  addRetainer: () => Promise<void>;
  updateRetainerHP: (id: string, delta: number) => Promise<void>;
  handlePromoteClick: (id: string) => void;
  dismissRetainer: (id: string) => Promise<void>;
}

export function RetainersSection({
  readOnly,
  maxRetainers,
  loyaltyBase,
  retainers,
  retainerLoading,
  showAddRetainer,
  setShowAddRetainer,
  newRetainer,
  setNewRetainer,
  expandedRetainer,
  setExpandedRetainer,
  addRetainer,
  updateRetainerHP,
  handlePromoteClick,
  dismissRetainer,
}: Props) {
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ ...sectionHead, margin: 0 }}>
          Retainers
        </h3>
        <span style={{ fontSize: '0.75rem', color: retainers.length >= maxRetainers ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
          {retainers.length} / {maxRetainers} (CHA)
        </span>
      </div>

      {retainerLoading ? (
        <div style={{ height: '48px', borderRadius: '8px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {retainers.map(r => {
            const expanded = expandedRetainer === r.id;
            return (
              <RetainerCard
                key={r.id}
                r={r}
                expanded={expanded}
                readOnly={readOnly}
                loyaltyBase={loyaltyBase}
                onToggle={() => setExpandedRetainer(expanded ? null : r.id)}
                updateRetainerHP={updateRetainerHP}
                handlePromoteClick={handlePromoteClick}
                dismissRetainer={dismissRetainer}
              />
            );
          })}

          {retainers.length === 0 && !showAddRetainer && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              No retainers. Max {maxRetainers} based on CHA.
            </p>
          )}
        </div>
      )}

      {/* Add retainer form */}
      {!readOnly && showAddRetainer && (
        <AddRetainerForm
          newRetainer={newRetainer}
          setNewRetainer={setNewRetainer}
          addRetainer={addRetainer}
          onCancel={() => setShowAddRetainer(false)}
        />
      )}

      {!readOnly && retainers.length < maxRetainers && !showAddRetainer && (
        <button
          onClick={() => setShowAddRetainer(true)}
          style={{ marginTop: '0.625rem', width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px dashed var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.85rem', minHeight: '44px' }}
        >
          + Hire retainer
        </button>
      )}
    </section>
  );
}
