'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { updateCharacter } from '@/lib/data/characters';

/**
 * Learned (extra) languages, persisted on the `characters` row.
 * Updates are optimistic: local state changes first, then rolls back
 * with an error message if the Supabase write fails.
 */
export function useLanguages(
  supabase: SupabaseClient,
  characterId: string,
  rawExtraLanguages: string[] | undefined,
) {
  const [extraLanguages, setExtraLanguages] = useState<string[]>(
    Array.isArray(rawExtraLanguages) ? rawExtraLanguages.filter(l => typeof l === 'string') : []
  );
  const [newLang, setNewLang] = useState('');
  const [langError, setLangError] = useState('');

  async function addLanguage() {
    const lang = newLang.trim();
    if (!lang) return;
    const updated = [...extraLanguages, lang];
    setExtraLanguages(updated);
    setNewLang('');
    setLangError('');
    const error = await updateCharacter(supabase, characterId, { extraLanguages: updated });
    if (error) {
      setExtraLanguages(extraLanguages);
      setLangError('Failed to save language');
    }
  }

  async function removeLanguage(idx: number) {
    const updated = extraLanguages.filter((_, i) => i !== idx);
    setExtraLanguages(updated);
    setLangError('');
    const error = await updateCharacter(supabase, characterId, { extraLanguages: updated });
    if (error) {
      setExtraLanguages(extraLanguages);
      setLangError('Failed to remove language');
    }
  }

  return {
    extraLanguages,
    newLang, setNewLang,
    langError,
    addLanguage, removeLanguage,
  };
}
