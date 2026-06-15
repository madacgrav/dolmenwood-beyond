'use client';
import type { Dispatch, SetStateAction } from 'react';
import type { DBMount } from '@/lib/data/mounts';
import type { NewMountState } from './types';
import { sectionHead } from './shared';
import { MountCard } from './MountCard';
import { AddMountForm } from './AddMountForm';

interface Props {
  readOnly: boolean;
  mounts: DBMount[];
  mountsLoading: boolean;
  showAddMount: boolean;
  setShowAddMount: Dispatch<SetStateAction<boolean>>;
  newMount: NewMountState;
  setNewMount: Dispatch<SetStateAction<NewMountState>>;
  mountSaving: boolean;
  adjustMountHP: (mount: DBMount, delta: number) => void;
  addMount: () => Promise<void>;
  deleteMount: (id: string) => Promise<void>;
}

export function MountsSection({
  readOnly,
  mounts,
  mountsLoading,
  showAddMount,
  setShowAddMount,
  newMount,
  setNewMount,
  mountSaving,
  adjustMountHP,
  addMount,
  deleteMount,
}: Props) {
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={sectionHead}>Mounts</h3>
        {!readOnly && (
          <button
            onClick={() => setShowAddMount(v => !v)}
            style={{
              padding: '0.25rem 0.75rem', borderRadius: '6px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'transparent', color: 'var(--color-primary)',
              fontSize: '0.8rem', cursor: 'pointer', minHeight: '44px',
            }}
          >
            {showAddMount ? 'Cancel' : '＋ Add Mount'}
          </button>
        )}
      </div>

      {mountsLoading ? (
        <div style={{ height: '48px', borderRadius: '8px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {mounts.map(mount => (
            <MountCard
              key={mount.id}
              mount={mount}
              readOnly={readOnly}
              adjustMountHP={adjustMountHP}
              deleteMount={deleteMount}
            />
          ))}

          {mounts.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
              No mounts.{!readOnly ? ' Use "Add Mount" to record a horse, mule, or other animal.' : ''}
            </p>
          )}
        </div>
      )}

      {/* Add Mount form */}
      {!readOnly && showAddMount && (
        <AddMountForm
          newMount={newMount}
          setNewMount={setNewMount}
          addMount={addMount}
          mountSaving={mountSaving}
          onCancel={() => setShowAddMount(false)}
        />
      )}
    </section>
  );
}
