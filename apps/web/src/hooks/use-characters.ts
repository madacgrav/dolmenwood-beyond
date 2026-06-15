'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { listCharacters, deleteCharacter as deleteCharacterQuery } from '@/lib/data/characters';
import type { Character } from '@dolmenwood/types';

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchCharacters() {
      const { characters: mapped, error } = await listCharacters(supabase);
      if (error) {
        setError(error);
      } else {
        setCharacters(mapped);
      }
      setLoading(false);
    }

    fetchCharacters();

    // Realtime subscription for live HP updates during play
    const channel = supabase
      .channel('characters')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'characters',
      }, () => fetchCharacters())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function deleteCharacter(id: string) {
    const error = await deleteCharacterQuery(createClient(), id);
    if (!error) {
      setCharacters(prev => prev.filter(c => c.id !== id));
    }
    return error;
  }

  return { characters, loading, error, deleteCharacter };
}
