'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface LevelUpEntry {
  id: string;
  character_id: string;
  from_level: number;
  to_level: number;
  hp_roll: number;
  hp_roll_final: number;
  changes: { field: string; oldValue: unknown; newValue: unknown }[];
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatChange(c: { field: string; oldValue: unknown; newValue: unknown }) {
  const old = typeof c.oldValue === 'object' && c.oldValue !== null
    ? JSON.stringify(c.oldValue)
    : String(c.oldValue ?? '—');
  const next = typeof c.newValue === 'object' && c.newValue !== null
    ? JSON.stringify(c.newValue)
    : String(c.newValue ?? '—');
  const label = c.field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
  return { label, old, next };
}

export default function LevelUpLogPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const id = params.id as string;

  const [entries, setEntries] = useState<LevelUpEntry[]>([]);
  const [characterName, setCharacterName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: char }, { data: log }] = await Promise.all([
        supabase.from('characters').select('name').eq('id', id).single(),
        supabase.from('level_up_log')
          .select('*')
          .eq('character_id', id)
          .order('created_at', { ascending: false }),
      ]);
      setCharacterName((char as { name: string } | null)?.name ?? '');
      setEntries((log ?? []) as LevelUpEntry[]);
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', paddingBottom: '5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1rem 0.5rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.25rem', padding: '0.25rem', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Back"
        >
          ←
        </button>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-primary)', fontSize: '1.1rem' }}>
            Level Up History
          </h1>
          {characterName && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{characterName}</p>
          )}
        </div>
      </div>

      <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: '80px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📜</div>
            <p style={{ fontSize: '0.95rem' }}>No level-ups recorded yet.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>The log will appear here after the first level-up.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {entries.map((entry, idx) => (
              <div
                key={entry.id}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                {/* Level badge row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '44px', height: '44px', borderRadius: '50%',
                    backgroundColor: idx === 0 ? 'var(--color-gold)' : 'var(--color-primary)',
                    color: idx === 0 ? '#1a1500' : 'white',
                    fontFamily: 'var(--font-display), Georgia, serif',
                    fontWeight: '700', fontSize: '1.1rem', flexShrink: 0,
                  }}>
                    {entry.to_level}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)' }}>
                      Level {entry.from_level} → {entry.to_level}
                      {idx === 0 && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--color-gold)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Latest</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                      {formatDate(entry.created_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>HP</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                      +{entry.hp_roll_final}
                      {entry.hp_roll !== entry.hp_roll_final && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: '400' }}>
                          {' '}(rolled {entry.hp_roll})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Changes */}
                {entry.changes && entry.changes.length > 0 && (
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {entry.changes.map((c, ci) => {
                      const { label, old: oldVal, next: newVal } = formatChange(c);
                      return (
                        <div key={ci} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: '80px' }}>{label}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)', textDecoration: 'line-through' }}>{oldVal}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>→</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: '600' }}>{newVal}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
