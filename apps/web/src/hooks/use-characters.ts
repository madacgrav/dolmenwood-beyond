'use client';

import { useEffect, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
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

    // Live HP updates during play: Cosmos change feed → Azure Function →
    // SignalR (replaces the old Supabase realtime subscription). Absence of
    // the service (e.g. local dev without the env) degrades to no-live-updates.
    let stopped = false;
    let connection: ReturnType<HubConnectionBuilder['build']> | null = null;
    (async () => {
      try {
        const res = await fetch('/api/signalr/negotiate', { method: 'POST' });
        if (!res.ok) return;
        const { url, accessToken } = await res.json();
        if (stopped) return;
        connection = new HubConnectionBuilder()
          .withUrl(url, { accessTokenFactory: () => accessToken })
          .withAutomaticReconnect()
          .build();
        connection.on('characterChanged', () => fetchCharacters());
        await connection.start();
      } catch {
        // Live updates are best-effort — the roster still works without them.
      }
    })();

    return () => {
      stopped = true;
      connection?.stop().catch(() => undefined);
    };
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
