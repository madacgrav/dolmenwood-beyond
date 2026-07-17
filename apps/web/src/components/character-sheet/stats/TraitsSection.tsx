'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { CharacterWithNotes } from '@dolmenwood/types';
import { sectionHead } from './shared';

type SaveStatus = 'idle' | 'saving' | 'saved';

interface Props {
  traits?: string;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void;
  readOnly?: boolean;
}

export function TraitsSection({ traits, onUpdate, readOnly }: Props) {
  const [text, setText] = useState(traits ?? '');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setText(traits ?? ''); }, [traits]);

  const triggerSave = useCallback((value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('saving');
    timerRef.current = setTimeout(async () => {
      await onUpdate({ traits: value });
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    }, 1000);
  }, [onUpdate]);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h3 style={{ ...sectionHead, margin: 0 }}>Kindred &amp; Class Traits</h3>
        <span style={{ fontSize: '0.75rem', color: status === 'saved' ? 'var(--color-primary)' : status === 'saving' ? 'var(--color-gold)' : 'transparent', transition: 'color 0.3s' }}>
          {status === 'saved' ? 'Saved ✓' : status === 'saving' ? 'Saving…' : '·'}
        </span>
      </div>
      <textarea
        value={text}
        onChange={e => { if (!readOnly) { setText(e.target.value); triggerSave(e.target.value); } }}
        readOnly={readOnly}
        placeholder="Special abilities, class features, kindred traits…"
        style={{ width: '100%', minHeight: '140px', padding: '0.875rem', borderRadius: '10px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: 1.6, resize: readOnly ? 'none' : 'vertical', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
      />
    </section>
  );
}
