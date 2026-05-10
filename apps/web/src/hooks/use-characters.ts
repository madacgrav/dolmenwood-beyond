'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Character } from '@dolmenwood/types';

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchCharacters() {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        // Map snake_case DB columns to camelCase Character type
        const mapped: Character[] = (data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          ownerId: row.owner_id as string,
          name: row.name as string,
          sex: row.sex as string | undefined,
          age: row.age as string | undefined,
          height: row.height as string | undefined,
          weight: row.weight as string | undefined,
          kindred: row.kindred as Character['kindred'],
          characterClass: row.character_class as Character['characterClass'],
          alignment: row.alignment as Character['alignment'],
          moonSign: row.moon_sign as string | undefined,
          background: row.background as string | undefined,
          level: row.level as number,
          xp: row.xp as number,
          abilityScores: row.ability_scores as Character['abilityScores'],
          hpCurrent: row.hp_current as number,
          hpMax: row.hp_max as number,
          portraitUrl: row.portrait_url as string | undefined,
          isActive: row.is_active as boolean,
          extraLanguages: (row.extra_languages as string[] | undefined) ?? [],
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        }));
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
    const supabase = createClient();
    const { error } = await supabase.from('characters').delete().eq('id', id);
    if (!error) {
      setCharacters(prev => prev.filter(c => c.id !== id));
    }
    return error;
  }

  return { characters, loading, error, deleteCharacter };
}
