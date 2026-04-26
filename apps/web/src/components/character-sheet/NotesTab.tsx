'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { Character } from '@dolmenwood/types';

type CharacterWithNotes = Character & { notes?: string };
type SaveStatus = 'idle' | 'saving' | 'saved';

interface Props {
  character: CharacterWithNotes;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void;
}

export function NotesTab({ character, onUpdate }: Props) {
  const [text, setText] = useState(character.notes ?? '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setText(character.notes ?? ''); }, [character.notes]);

  const triggerSave = useCallback((value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveStatus('saving');
    timerRef.current = setTimeout(async () => {
      await onUpdate({ notes: value });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
  }, [onUpdate]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    triggerSave(e.target.value);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Notes
        </h3>
        <span style={{
          fontSize: '0.75rem',
          color: saveStatus === 'saved' ? 'var(--color-primary)' : saveStatus === 'saving' ? 'var(--color-gold)' : 'transparent',
          transition: 'color 0.3s',
        }}>
          {saveStatus === 'saved' ? 'Saved ✓' : saveStatus === 'saving' ? 'Saving…' : '·'}
        </span>
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Adventure notes, quest reminders, NPC names…"
        style={{
          width: '100%',
          minHeight: '300px',
          padding: '0.875rem',
          borderRadius: '10px',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          fontSize: '0.9rem',
          lineHeight: 1.6,
          resize: 'vertical',
          fontFamily: 'var(--font-body)',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
