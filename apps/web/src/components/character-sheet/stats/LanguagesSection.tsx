'use client';
import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Kindred } from '@dolmenwood/types';
import { getAbilityModifier, getKindredLanguages } from '@dolmenwood/rules-engine';
import { sectionHead } from './shared';

interface Props {
  kindred: Kindred;
  intScore: number;
  editMode: boolean;
  readOnly?: boolean;
  extraLanguages: string[];
  newLang: string;
  setNewLang: Dispatch<SetStateAction<string>>;
  langError: string;
  addLanguage: () => Promise<void>;
  removeLanguage: (idx: number) => Promise<void>;
}

export function LanguagesSection({
  kindred,
  intScore,
  editMode,
  readOnly,
  extraLanguages,
  newLang,
  setNewLang,
  langError,
  addLanguage,
  removeLanguage,
}: Props) {
  const nativeLanguages = useMemo(() => getKindredLanguages(kindred), [kindred]);
  const intMod = getAbilityModifier(intScore);
  const bonusLangSlots = Math.max(0, intMod);

  return (
    <section>
      <h3 style={sectionHead}>
        Languages
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {nativeLanguages.map(lang => (
          <div key={lang} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.5rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '40px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-gold)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Native</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{lang}</span>
          </div>
        ))}
        {extraLanguages.map((lang, idx) => (
          <div key={idx} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.5rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '40px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Learned</span>
            <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--color-text)' }}>{lang}</span>
            {editMode && !readOnly && (
              <button onClick={() => removeLanguage(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1rem', padding: '0.25rem', minHeight: '32px', minWidth: '32px', lineHeight: 1 }} aria-label={`Remove ${lang}`}>×</button>
            )}
          </div>
        ))}
        {bonusLangSlots > 0 && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            INT modifier grants {bonusLangSlots} bonus language slot{bonusLangSlots > 1 ? 's' : ''}.
            {extraLanguages.length < bonusLangSlots ? ` ${bonusLangSlots - extraLanguages.length} slot${bonusLangSlots - extraLanguages.length > 1 ? 's' : ''} remaining.` : ''}
          </p>
        )}
        {editMode && !readOnly && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input
              value={newLang}
              onChange={e => setNewLang(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addLanguage()}
              placeholder="Add language…"
              style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.875rem', minHeight: '44px', outline: 'none' }}
            />
            <button onClick={addLanguage} disabled={!newLang.trim()} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', minHeight: '44px', opacity: newLang.trim() ? 1 : 0.5 }}>Add</button>
          </div>
        )}
        {langError && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--color-danger)' }}>{langError}</p>
        )}
      </div>
    </section>
  );
}
