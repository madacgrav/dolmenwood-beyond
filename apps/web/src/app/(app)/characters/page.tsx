'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCharacters } from '@/hooks/use-characters';
import { CharacterCard } from '@/components/characters/CharacterCard';
import { usePageHeader } from '@/components/layout/PageHeaderContext';

type SortOption = 'recently_viewed' | 'name' | 'level' | 'class';

export default function CharactersPage() {
  const { characters, acByCharacter, loading, error, deleteCharacter } = useCharacters();
  const [sort, setSort] = useState<SortOption>('recently_viewed');

  const sorted = [...characters].sort((a, b) => {
    switch (sort) {
      case 'name': return a.name.localeCompare(b.name);
      case 'level': return b.level - a.level;
      case 'class': return a.characterClass.localeCompare(b.characterClass);
      default: return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  const sortAction = useMemo(() => (
    characters.length > 1 ? (
      <select
        value={sort}
        onChange={e => setSort(e.target.value as SortOption)}
        aria-label="Sort characters"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          color: 'var(--color-text)',
          fontSize: '0.8rem',
          padding: '0.375rem 0.625rem',
          cursor: 'pointer',
          minHeight: '36px',
        }}
      >
        <option value="recently_viewed">Recent</option>
        <option value="name">Name</option>
        <option value="level">Level</option>
        <option value="class">Class</option>
      </select>
    ) : null
  ), [characters.length, sort]);

  usePageHeader(useMemo(() => ({ title: 'Characters', action: sortAction }), [sortAction]));

  return (
    <div style={{
      padding: '1rem',
      maxWidth: '600px',
      margin: '0 auto',
      minHeight: '100dvh',
    }}>
      {/* Loading state */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: '90px', borderRadius: '12px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          padding: '1rem', borderRadius: '8px',
          backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
          border: '1px solid var(--color-danger)',
          color: 'var(--color-danger)', fontSize: '0.9rem',
        }}>
          Failed to load characters: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && characters.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '4rem 1rem', textAlign: 'center',
          gap: '1rem',
        }}>
          <div style={{ fontSize: '4rem' }}>⚔️</div>
          <h2 style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            color: 'var(--color-text)', margin: 0, fontSize: '1.25rem',
          }}>
            No Adventurers Yet
          </h2>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, maxWidth: '280px', lineHeight: 1.5 }}>
            Create your first character to begin your journey in Dolmenwood.
          </p>
          <Link href="/characters/new" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--color-primary)', color: 'white',
            borderRadius: '8px', textDecoration: 'none',
            fontWeight: '600', fontSize: '0.95rem', minHeight: '44px',
          }}>
            Create your first adventurer
          </Link>
        </div>
      )}

      {/* Character list */}
      {!loading && sorted.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sorted.map(character => (
            <CharacterCard
              key={character.id}
              character={character}
              ac={acByCharacter[character.id] ?? 10}
              onDelete={deleteCharacter}
            />
          ))}
        </div>
      )}

      {/* Floating Action Button */}
      {!loading && (
        <Link href="/characters/new" style={{
          position: 'fixed', bottom: '80px', right: '1.25rem',
          width: '56px', height: '56px', borderRadius: '50%',
          backgroundColor: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textDecoration: 'none', fontSize: '1.75rem', color: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          zIndex: 40,
        }}>
          +
        </Link>
      )}
    </div>
  );
}
