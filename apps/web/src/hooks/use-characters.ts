'use client';

import { useEffect, useState } from 'react';
import { listCharacters, deleteCharacter as deleteCharacterQuery } from '@/lib/api/characters';
import type { Character } from '@dolmenwood/types';

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [armorByCharacter, setArmorByCharacter] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCharacters() {
      const { characters: mapped, armorByCharacter: armor, error } = await listCharacters();
      if (error) {
        setError(error);
      } else {
        setCharacters(mapped);
        setArmorByCharacter(armor);
      }
      setLoading(false);
    }

    fetchCharacters();
    // TODO(phase8): live HP updates return via Cosmos change feed → SignalR
    // (replaced the Supabase realtime subscription that lived here).
  }, []);

  async function deleteCharacter(id: string) {
    const error = await deleteCharacterQuery(id);
    if (!error) {
      setCharacters(prev => prev.filter(c => c.id !== id));
    }
    return error;
  }

  return { characters, armorByCharacter, loading, error, deleteCharacter };
}
