'use client';
import { primaryBtn, secondaryBtn } from '@/components/wizard/shared';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { useOptionalRules } from '@/hooks/use-optional-rules';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { rollDie, getAbilityModifier, getHitDie } from '@dolmenwood/rules-engine';
import type { DieType } from '@dolmenwood/rules-engine';
import { AnimatedDie } from '@/components/wizard/AnimatedDie';

export function Step7HP() {
  const router = useRouter();
  const { characterClass, abilityScores, hpMax, setHpMax } = useWizardStore();
  const [rules] = useOptionalRules();
  const hitDie = characterClass ? getHitDie(characterClass) : 'd6';
  const dieSides = parseInt(hitDie.replace('d', ''), 10) as DieType;
  const conMod = getAbilityModifier(abilityScores.con);
  const [rolled, setRolled] = useState<number | null>(hpMax > 1 ? hpMax - conMod : null);
  const [rolling, setRolling] = useState(false);

  async function handleRoll() {
    setRolling(true);
    await new Promise(r => setTimeout(r, 800));
    const roll = rollDie(dieSides);
    const final = Math.max(1, roll + conMod);
    setRolled(roll);
    setHpMax(final);
    setRolling(false);
  }

  const finalHP = rolled !== null ? Math.max(1, rolled + conMod) : null;
  const isBadRoll = rolled !== null && rolled <= 2;

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress step={7} totalSteps={13} title="Roll Hit Points"
        onBack={() => router.push('/characters/new/auto/6')} />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Roll your {hitDie} and add your CON modifier ({conMod >= 0 ? '+' : ''}{conMod}).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <AnimatedDie value={rolled} sides={dieSides} rolling={rolling} size="lg" />

          {finalHP !== null && !rolling && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {rolled} {conMod >= 0 ? '+' : ''}{conMod} CON =
              </div>
              <div style={{ fontSize: '3rem', fontWeight: '800', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {finalHP}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Max HP</div>
            </div>
          )}
        </div>

        {isBadRoll && rules.hpRerollLowRolls && !rolling && (
          <div style={{
            padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem',
            backgroundColor: 'color-mix(in srgb, var(--color-gold) 15%, transparent)',
            border: '1px solid var(--color-gold)', color: 'var(--color-gold)', fontSize: '0.875rem',
          }}>
            Bad luck! Would you like to re-roll?
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {rolled === null ? (
            <button onClick={handleRoll} style={primaryBtn}>Roll {hitDie}!</button>
          ) : (
            <>
              <button onClick={() => router.push('/characters/new/auto/8')} style={primaryBtn}>
                Accept {finalHP} HP →
              </button>
              {isBadRoll && rules.hpRerollLowRolls && <button onClick={handleRoll} style={secondaryBtn}>Re-roll</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
