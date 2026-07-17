'use client';

import { type QuestInput } from '@/lib/api/quests';

interface Props {
  mode: 'create' | 'edit';
  value: QuestInput;
  error: string;
  loading: boolean;
  onChange: (patch: Partial<QuestInput>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.625rem', borderRadius: '6px',
  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text)', fontSize: '0.875rem', minHeight: '40px',
  boxSizing: 'border-box', width: '100%',
};

export function QuestForm({ mode, value, error, loading, onChange, onSubmit, onCancel }: Props) {
  const canSubmit = !!value.title.trim() && !loading;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      padding: '0.875rem', borderRadius: '10px',
      border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
    }}>
      <input
        type="text"
        placeholder="Quest title"
        value={value.title}
        onChange={e => onChange({ title: e.target.value })}
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Quest-giver (optional)"
        value={value.giver}
        onChange={e => onChange({ giver: e.target.value })}
        style={inputStyle}
      />
      <textarea
        placeholder="Notes about this quest (optional)"
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
          {loading ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Add Quest'}
        </button>
      </div>
    </div>
  );
}
