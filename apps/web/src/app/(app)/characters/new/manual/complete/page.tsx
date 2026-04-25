'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';

export default function ManualCompletePage() {
  const router = useRouter();
  const { name, kindred, characterClass, abilityScores, hpMax, reset } = useWizardStore();

  useEffect(() => {
    // Guard: if wizard state is empty, send back to start
    if (!characterClass && !kindred) {
      router.replace('/characters/new');
    }
  }, [characterClass, kindred, router]);

  function handleFinish() {
    // TODO: save character to Supabase
    reset();
    router.push('/characters');
  }

  const displayName = name || 'Unnamed Adventurer';

  return (
    <div style={{
      backgroundColor: 'var(--color-bg)',
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚔️</div>

        <h1 style={{
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1.75rem',
          color: 'var(--color-text)',
          margin: '0 0 0.5rem',
        }}>
          {displayName}
        </h1>

        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: '0.925rem',
          margin: '0 0 1.75rem',
        }}>
          {kindred} {characterClass} · {hpMax} HP
        </p>

        {/* Score summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.625rem',
          marginBottom: '2rem',
        }}>
          {(Object.entries(abilityScores) as [string, number][]).map(([key, val]) => (
            <div key={key} style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '0.625rem',
            }}>
              <div style={{
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-muted)',
                marginBottom: '0.2rem',
              }}>
                {key.toUpperCase()}
              </div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: 'var(--color-text)',
              }}>
                {val}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleFinish}
          style={{
            width: '100%',
            padding: '0.875rem',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            minHeight: '44px',
            marginBottom: '0.75rem',
          }}
        >
          Save Character →
        </button>

        <button
          onClick={() => router.push('/characters/new/manual/13')}
          style={{
            width: '100%',
            padding: '0.875rem',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            fontSize: '0.95rem',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          ← Back to Details
        </button>
      </div>
    </div>
  );
}
