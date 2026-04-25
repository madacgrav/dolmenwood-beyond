'use client';

import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { isClassAllowedForKindred, getHitDie, getPrimeAbilities, ALL_CLASSES } from '@dolmenwood/rules-engine';
import type { CharacterClass } from '@dolmenwood/types';

const CLASS_DESCRIPTIONS: Record<CharacterClass, string> = {
  Cleric: 'Divine warrior serving a forest deity, wielding holy power.',
  Enchanter: 'Fairy-touched weaver of glamours and illusions.',
  Fighter: 'Veteran warrior, master of arms and combat.',
  Friar: 'Wandering holy person with healing prayers and nature lore.',
  Hunter: 'Skilled woodsman tracking prey through the deep forest.',
  Knight: 'Armoured noble warrior with a loyal warhorse.',
  Magician: 'Scholar of arcane arts casting powerful spells.',
  Thief: 'Cunning rogue skilled in stealth and larceny.',
  Bard: 'Wandering entertainer with enchanting music and charm.',
};

export function Step3Class({ basePath = '/characters/new/auto' }: { basePath?: string }) {
  const router = useRouter();
  const { abilityScores, kindred, characterClass: selected, setCharacterClass } = useWizardStore();

  const sorted = (Object.entries(abilityScores) as [string, number][]).sort(([, a], [, b]) => b - a);
  const top2 = new Set(sorted.slice(0, 2).map(([k]) => k.toUpperCase()));

  const available = ALL_CLASSES.filter(cls =>
    !kindred || isClassAllowedForKindred(kindred, cls)
  );

  function suitsBadge(cls: string): boolean {
    const primes = getPrimeAbilities(cls);
    return primes.some(p => top2.has(p));
  }

  function handleSelect(cls: CharacterClass) {
    setCharacterClass(cls);
    router.push(`${basePath}/4`);
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress
        step={3} totalSteps={13} title="Choose Class"
        onBack={() => router.push(`${basePath}/2`)}
      />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        {kindred && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Classes available to {kindred}. Restricted classes are hidden.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {available.map((cls) => {
            const hitDie = getHitDie(cls);
            const primes = getPrimeAbilities(cls);
            const suits = suitsBadge(cls);
            const isSelected = selected === cls;

            return (
              <button
                key={cls}
                onClick={() => handleSelect(cls as CharacterClass)}
                style={{
                  display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
                  padding: '1rem', borderRadius: '10px', textAlign: 'left',
                  backgroundColor: isSelected
                    ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-surface))'
                    : 'var(--color-surface)',
                  border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  cursor: 'pointer', width: '100%', minHeight: '44px',
                }}
              >
                <div style={{
                  backgroundColor: 'var(--color-bg)', borderRadius: '8px',
                  padding: '0.375rem 0.625rem', flexShrink: 0,
                  fontFamily: 'var(--font-display), Georgia, serif',
                  fontSize: '0.875rem', fontWeight: '700', color: 'var(--color-primary)',
                  minWidth: '44px', textAlign: 'center',
                }}>
                  {hitDie}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{
                      fontFamily: 'var(--font-display), Georgia, serif',
                      fontWeight: '600', color: 'var(--color-text)',
                    }}>{cls}</span>
                    {suits && (
                      <span style={{
                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px',
                        backgroundColor: 'color-mix(in srgb, var(--color-gold) 20%, transparent)',
                        color: 'var(--color-gold)', fontWeight: '600',
                      }}>
                        ✦ Suits your rolls
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>
                    {CLASS_DESCRIPTIONS[cls as CharacterClass]}
                  </p>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {primes.map(p => (
                      <span key={p} style={{
                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px',
                        backgroundColor: top2.has(p)
                          ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)'
                          : 'var(--color-bg)',
                        border: `1px solid ${top2.has(p) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        color: top2.has(p) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        fontWeight: top2.has(p) ? '600' : '400',
                      }}>
                        Prime: {p}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
