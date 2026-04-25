'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { getAbilityModifier, rollDie, getHitDie } from '@dolmenwood/rules-engine';
import type { DieType } from '@dolmenwood/rules-engine';

export function ManualStep7HP() {
  const router = useRouter();
  const { abilityScores, characterClass, setHpMax } = useWizardStore();
  const hitDie = characterClass ? getHitDie(characterClass) : 'd6';
  const dieSides = parseInt(hitDie.replace('d', ''), 10) as DieType;
  const conMod = getAbilityModifier(abilityScores.con);
  const [hp, setHp] = useState<number>(Math.max(1, Math.floor(dieSides / 2) + 1 + conMod));

  function rollHP() {
    const rolled = rollDie(dieSides);
    setHp(Math.max(1, rolled + conMod));
  }

  function handleContinue() {
    setHpMax(hp);
    router.push('/characters/new/manual/8');
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress
        step={7} totalSteps={13} title="Hit Points"
        onBack={() => router.push('/characters/new/manual/6')}
      />
      <div style={{ padding: '1rem', maxWidth: '480px', margin: '0 auto' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Enter or roll your starting hit points. Minimum&nbsp;1.
        </p>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
            {hitDie} + CON ({conMod >= 0 ? '+' : ''}{conMod})
          </div>
          <input
            type="number" min={1} max={dieSides + conMod + 6} value={hp}
            onChange={e => setHp(Math.max(1, parseInt(e.target.value, 10) || 1))}
            style={{
              fontSize: '4rem', fontWeight: '800', color: 'var(--color-primary)',
              width: '6rem', textAlign: 'center',
              backgroundColor: 'var(--color-surface)',
              border: '2px solid var(--color-border)',
              borderRadius: '10px', padding: '0.5rem', minHeight: '44px',
            }}
          />
        </div>

        <button
          onClick={rollHP}
          style={{
            display: 'block', margin: '0 auto 1.5rem',
            padding: '0.5rem 1.5rem',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px', cursor: 'pointer',
            color: 'var(--color-text)', fontSize: '0.875rem', minHeight: '44px',
          }}
        >
          🎲 Roll {hitDie}
        </button>

        <button
          onClick={handleContinue}
          style={{
            width: '100%', padding: '0.875rem',
            backgroundColor: 'var(--color-primary)', color: 'white',
            border: 'none', borderRadius: '8px',
            fontSize: '1rem', fontWeight: '600', cursor: 'pointer', minHeight: '44px',
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
