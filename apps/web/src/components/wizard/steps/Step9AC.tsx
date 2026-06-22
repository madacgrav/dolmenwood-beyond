'use client';
import { primaryBtn } from '@/components/wizard/shared';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { getAbilityModifier, getKindredACBonus, calculateAC } from '@dolmenwood/rules-engine';

export function Step9AC({ basePath = '/characters/new/auto' }: { basePath?: string }) {
  const router = useRouter();
  const { abilityScores, kindred } = useWizardStore();
  const dexMod = getAbilityModifier(abilityScores.dex);
  const kindredBonus = kindred ? getKindredACBonus(kindred) : 0;
  // armour bonus wired in once inventory is tracked; defaults to 0 for now
  const armorBonus = 0;
  const ac = calculateAC({ dexScore: abilityScores.dex, armorBonus, kindredACBonus: kindredBonus, classACBonus: 0, shieldBonus: 0 });

  const rows: { label: string; value: number }[] = [
    { label: 'Base', value: 10 },
    { label: 'DEX modifier', value: dexMod },
    ...(armorBonus ? [{ label: 'Armour', value: armorBonus }] : []),
    ...(kindredBonus ? [{ label: `${kindred} bonus`, value: kindredBonus }] : []),
  ];

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress step={9} totalSteps={13} title="Armour Class"
        onBack={() => router.push(`${basePath}/8`)} />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '4rem', fontWeight: '800', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {ac}
          </div>
          <div style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Armour Class</div>
        </div>

        <div style={{
          backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem',
        }}>
          {rows.map((row, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0',
              borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{row.label}</span>
              <span style={{
                color: row.value > 0 ? 'var(--color-primary)' : row.value < 0 ? 'var(--color-danger)' : 'var(--color-text)',
                fontWeight: '600', fontVariantNumeric: 'tabular-nums',
              }}>
                {row.value > 0 ? '+' : ''}{row.value}
              </span>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0 0',
            borderTop: '2px solid var(--color-border)', marginTop: '0.375rem',
          }}>
            <span style={{ fontWeight: '700', color: 'var(--color-text)' }}>Total AC</span>
            <span style={{ fontWeight: '800', fontSize: '1.25rem', color: 'var(--color-primary)' }}>{ac}</span>
          </div>
        </div>

        <button onClick={() => router.push(`${basePath}/10`)} style={primaryBtn}>
          Continue →
        </button>
      </div>
    </div>
  );
}
