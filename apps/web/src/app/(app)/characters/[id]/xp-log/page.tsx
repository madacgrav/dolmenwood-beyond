'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchXPLog, type XPLogView } from '@/lib/api/xp-log';
import type { XPLogSource } from '@dolmenwood/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const SOURCE_LABELS: Record<XPLogSource, string> = {
  dm_award: 'DM Award',
  manual_edit: 'Manual Edit',
  level_up: 'Level Up',
};

const SOURCE_ICONS: Record<XPLogSource, string> = {
  dm_award: '🎁',
  manual_edit: '✏️',
  level_up: '⬆',
};

function deltaColor(delta: number) {
  if (delta > 0) return 'var(--color-gold)';
  if (delta < 0) return 'var(--color-danger)';
  return 'var(--color-text-muted)';
}

export default function XPLogPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? (rawId[0] ?? '') : (rawId ?? '');

  const [entries, setEntries] = useState<XPLogView['entries']>([]);
  const [characterName, setCharacterName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchXPLog(id);
        if (!data) throw new Error('Failed to load XP history');
        setCharacterName(data.characterName);
        setEntries(data.entries);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load XP history');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

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
            XP History
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
              <div key={i} style={{ height: '72px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--color-danger)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠</div>
            <p style={{ fontSize: '0.95rem' }}>{loadError}</p>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📈</div>
            <p style={{ fontSize: '0.95rem' }}>No XP changes recorded yet.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Awards, edits, and level-ups will appear here.</p>
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: idx === 0 ? 'var(--color-gold)' : 'var(--color-surface)',
                  border: idx === 0 ? 'none' : '1px solid var(--color-border)',
                  fontSize: '1.1rem',
                }}>
                  {SOURCE_ICONS[entry.source]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)' }}>
                    {SOURCE_LABELS[entry.source]}
                    {entry.source === 'level_up' && entry.toLevel != null && ` → Level ${entry.toLevel}`}
                    {idx === 0 && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--color-gold)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Latest</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                    {formatDate(entry.timestamp)} · by {entry.actorName}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: deltaColor(entry.delta) }}>
                    {entry.delta > 0 ? '+' : ''}{entry.delta.toLocaleString()} XP
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    {entry.newTotal.toLocaleString()} total
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
