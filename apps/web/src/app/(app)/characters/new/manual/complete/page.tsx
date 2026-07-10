'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { createCharacter } from '@/lib/api/characters';

export default function ManualCompletePage() {
  const router = useRouter();
  const wizard = useWizardStore();
  const { name, kindred, characterClass, abilityScores, hpMax, reset } = wizard;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    // Guard: if wizard state is empty, send back to start
    if (!characterClass && !kindred) {
      router.replace('/characters/new');
    }
  }, [characterClass, kindred, router]);

  const displayName = name || 'Unnamed Adventurer';

  async function handleFinish() {
    if (saving) return;
    setSaving(true);
    setSaveError('');

    const { id, error } = await createCharacter({
      name: displayName,
      sex: wizard.sex,
      age: wizard.age,
      height: wizard.height,
      weight: wizard.weight,
      kindred: kindred ?? 'Human',
      characterClass: characterClass ?? 'Fighter',
      alignment: wizard.alignment ?? 'neutral',
      background: wizard.background,
      abilityScores,
      hpMax,
      portraitUrl: wizard.portraitUrl,
    });

    setSaving(false);
    if (error) {
      setSaveError(error);
    } else if (id) {
      reset();
      router.push(`/characters/${id}`);
    }
  }

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

        {saveError && (
          <div style={{
            marginBottom: '0.75rem', padding: '0.75rem 1rem',
            backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, var(--color-bg))',
            border: '1px solid var(--color-danger)', borderRadius: '8px',
            color: 'var(--color-danger)', fontSize: '0.875rem',
          }}>
            ⚠️ Failed to save character: {saveError}
          </div>
        )}

        <button
          onClick={handleFinish}
          disabled={saving}
          style={{
            width: '100%',
            padding: '0.875rem',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1,
            minHeight: '44px',
            marginBottom: '0.75rem',
          }}
        >
          {saving ? 'Saving…' : 'Save Character →'}
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
