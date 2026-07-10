'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchCharacter as fetchCharacterData } from '@/lib/api/characters';
import { levelUpCharacter } from '@/lib/api/level-up';
import type { Character } from '@dolmenwood/types';
import {
  getXPThresholdForNextLevel,
  getLevelUpFeatures,
} from '@dolmenwood/rules-engine';
import { CheckStep } from './components/CheckStep';
import { HPRollStep } from './components/HPRollStep';
import { FeaturesStep } from './components/FeaturesStep';
import { ConfirmStep } from './components/ConfirmStep';
import { CelebrationOverlay } from './components/CelebrationOverlay';

type LevelUpStep = 'check' | 'hp-roll' | 'features' | 'confirm';

const STEPS: LevelUpStep[] = ['check', 'hp-roll', 'features', 'confirm'];
const STEP_LABELS: Record<LevelUpStep, string> = {
  'check': 'Overview',
  'hp-roll': 'Hit Points',
  'features': 'Features',
  'confirm': 'Confirm',
};

export default function LevelUpPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<LevelUpStep>('check');
  const [hpGain, setHpGain] = useState(0);
  const [hpRoll, setHpRoll] = useState(0);
  const [saving, setSaving] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const fetchCharacter = useCallback(async () => {
    // The API is owner-scoped, so a non-owner (or missing character) gets null.
    const mapped = await fetchCharacterData(id);
    if (!mapped) {
      router.push('/characters');
      return;
    }
    setCharacter(mapped);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchCharacter(); }, [fetchCharacter]);

  async function handleConfirm() {
    if (!character) return;
    setSaving(true);
    setConfirmError('');
    const newLevel = character.level + 1;
    const threshold = getXPThresholdForNextLevel(character.characterClass, character.level);

    try {
      const errorMessage = await levelUpCharacter({
        characterId: id,
        newLevel,
        hpGain,
        hpRoll,
        features,
        xpThreshold: threshold,
      });

      if (errorMessage) {
        setConfirmError(errorMessage);
        return;
      }

      setCelebrated(true);
      setTimeout(() => {
        router.push(`/characters/${id}`);
      }, 1800);
    } finally {
      setSaving(false);
    }
  }

  const stepIndex = STEPS.indexOf(step);
  const newLevel = character ? character.level + 1 : 0;
  const features = character ? getLevelUpFeatures(character.characterClass, character.level, newLevel) : [];

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading…
      </div>
    );
  }

  if (!character) return null;

  if (celebrated) {
    return <CelebrationOverlay newLevel={newLevel} characterName={character.name} />;
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0.875rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <button
          onClick={() => router.push(`/characters/${id}`)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', fontSize: '1.1rem',
            padding: '0.25rem 0.5rem', borderRadius: '6px',
            minHeight: '44px',
          }}
          aria-label="Back to character sheet"
        >
          ← Back
        </button>
        <h1 style={{
          margin: 0, flex: 1,
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1.1rem', fontWeight: '700',
          color: 'var(--color-gold)',
        }}>
          ⬆ Level Up — {character.name}
        </h1>
      </div>

      {/* Progress bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}>
        {STEPS.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1, padding: '0.5rem 0.25rem', textAlign: 'center',
              fontSize: '0.7rem', fontWeight: i <= stepIndex ? '700' : '400',
              color: i === stepIndex
                ? 'var(--color-gold)'
                : i < stepIndex
                  ? 'var(--color-primary)'
                  : 'var(--color-text-muted)',
              borderBottom: i === stepIndex ? '2px solid var(--color-gold)' : '2px solid transparent',
            }}
          >
            {i < stepIndex ? '✓ ' : ''}{STEP_LABELS[s]}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{ padding: '1rem', maxWidth: '540px', margin: '0 auto' }}>
        {step === 'check' && (
          <CheckStep
            character={character}
            onAdvance={() => setStep('hp-roll')}
          />
        )}
        {step === 'hp-roll' && (
          <HPRollStep
            character={character}
            onHpGain={setHpGain}
            onContinue={(gain, rawRoll) => {
              setHpGain(gain);
              setHpRoll(rawRoll);
              setStep('features');
            }}
          />
        )}
        {step === 'features' && (
          <FeaturesStep
            features={features}
            newLevel={newLevel}
            onContinue={() => setStep('confirm')}
          />
        )}
        {step === 'confirm' && (
          <>
            {confirmError && (
              <div style={{
                margin: '0 0 0.75rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, var(--color-bg))',
                borderRadius: '8px',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
                fontSize: '0.875rem',
              }}>
                ⚠️ {confirmError}
              </div>
            )}
            <ConfirmStep
              character={character}
              hpGain={hpGain}
              features={features}
              saving={saving}
              onConfirm={handleConfirm}
            />
          </>
        )}
      </div>
    </div>
  );
}
