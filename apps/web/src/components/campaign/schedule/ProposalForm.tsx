'use client';

import { DateTimePicker } from '@/components/campaign/schedule/DateTimePicker';

export type ProposalFormField = 'title' | 'scheduledAt' | 'notes';

interface Props {
  title: string;
  scheduledAt: string;   // datetime-local string
  notes: string;
  error: string;
  loading: boolean;
  mode: 'create' | 'edit';
  onChange: (field: ProposalFormField, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const inputStyle = {
  width: '100%', padding: '0.5rem 0.625rem', borderRadius: '6px',
  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text)', fontSize: '0.95rem', minHeight: '44px',
  boxSizing: 'border-box' as const,
};

const labelStyle = {
  fontSize: '0.75rem', color: 'var(--color-text-muted)',
  display: 'block', marginBottom: '0.25rem',
};

export function ProposalForm({ title, scheduledAt, notes, error, loading, mode, onChange, onSubmit, onCancel }: Props) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '10px',
      padding: '1rem',
    }}>
      <h3 style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-text)', margin: '0 0 0.875rem', fontSize: '1rem' }}>
        {mode === 'create' ? 'Propose a Date' : 'Edit Proposal'}
      </h3>

      <label style={labelStyle}>Title</label>
      <input
        type="text"
        value={title}
        onChange={e => onChange('title', e.target.value)}
        placeholder="e.g. Next session — pick a night"
        autoFocus
        style={{ ...inputStyle, marginBottom: '0.75rem' }}
      />

      <label style={labelStyle}>Date &amp; Time</label>
      <DateTimePicker value={scheduledAt} onChange={value => onChange('scheduledAt', value)} />

      <label style={labelStyle}>Notes (optional)</label>
      <textarea
        value={notes}
        onChange={e => onChange('notes', e.target.value)}
        placeholder="Any context for this proposed date."
        rows={3}
        style={{ ...inputStyle, minHeight: '64px', resize: 'vertical', marginBottom: '0.75rem' }}
      />

      {error && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-danger)', marginBottom: '0.625rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onSubmit}
          disabled={loading}
          style={{
            flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none',
            backgroundColor: 'var(--color-primary)', color: 'white',
            fontWeight: '600', fontSize: '0.875rem', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, minHeight: '44px',
          }}
        >
          {loading ? 'Saving…' : mode === 'create' ? 'Propose' : 'Save'}
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
