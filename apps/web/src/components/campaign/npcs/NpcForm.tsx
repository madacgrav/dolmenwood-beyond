'use client';

import { NPC_STATUSES, type NpcInput } from '@/lib/api/npcs';

interface Props {
  mode: 'create' | 'edit';
  value: NpcInput;
  error: string;
  loading: boolean;
  onChange: (patch: Partial<NpcInput>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.625rem', borderRadius: '6px',
  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text)', fontSize: '0.875rem', minHeight: '40px',
  boxSizing: 'border-box', width: '100%',
};

export function NpcForm({ mode, value, error, loading, onChange, onSubmit, onCancel }: Props) {
  const canSubmit = !!value.name.trim() && !loading;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      padding: '0.875rem', borderRadius: '10px',
      border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
    }}>
      <input
        type="text"
        placeholder="Name"
        value={value.name}
        onChange={e => onChange({ name: e.target.value })}
        style={inputStyle}
      />
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        <input
          type="text"
          placeholder="Ally, rival, patron…"
          value={value.relationship}
          onChange={e => onChange({ relationship: e.target.value })}
          style={{ ...inputStyle, flex: 1 }}
        />
        <select
          value={value.status}
          onChange={e => onChange({ status: e.target.value as NpcInput['status'] })}
          style={{ ...inputStyle, width: '110px', fontSize: '0.8rem' }}
        >
          {NPC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <textarea
        placeholder="Notes about this person (optional)"
        value={value.note}
        onChange={e => onChange({ note: e.target.value })}
        rows={3}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
      />
      {error && (
        <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', margin: 0 }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '0.5rem', borderRadius: '6px',
            border: '1px solid var(--color-border)', backgroundColor: 'transparent',
            color: 'var(--color-text-muted)', fontSize: '0.85rem', cursor: 'pointer', minHeight: '40px',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          style={{
            flex: 1, padding: '0.5rem', borderRadius: '6px', border: 'none',
            backgroundColor: canSubmit ? 'var(--color-primary)' : 'var(--color-border)',
            color: 'white', fontSize: '0.85rem', fontWeight: '600',
            cursor: canSubmit ? 'pointer' : 'not-allowed', minHeight: '40px',
          }}
        >
          {loading ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Add NPC'}
        </button>
      </div>
    </div>
  );
}
