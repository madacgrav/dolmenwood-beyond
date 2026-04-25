'use client';

import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { getKindredTraits, getAttackBonus, getSaveTargets } from '@dolmenwood/rules-engine';

export function Step6Traits({ basePath = '/characters/new/auto' }: { basePath?: string }) {
  const router = useRouter();
  const { kindred, characterClass } = useWizardStore();
  const kindredTraits = kindred ? getKindredTraits(kindred) : [];
  const attackBonus = characterClass ? getAttackBonus(characterClass, 1) : 0;
  const saves = characterClass ? getSaveTargets(characterClass, 1) : null;

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress step={6} totalSteps={13} title="Traits & Features"
        onBack={() => router.push(`${basePath}/5`)} />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        {/* Combat stats */}
        {saves && (
          <div style={{
            backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: '10px', padding: '1rem', marginBottom: '1rem',
          }}>
            <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: '600', color: 'var(--color-text)', marginBottom: '0.75rem' }}>
              Combat Stats (Level 1)
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <StatPill label="Attack" value={attackBonus >= 0 ? `+${attackBonus}` : String(attackBonus)} />
              <StatPill label="Doom" value={String(saves.doom)} />
              <StatPill label="Ray" value={String(saves.ray)} />
              <StatPill label="Hold" value={String(saves.hold)} />
              <StatPill label="Blast" value={String(saves.blast)} />
              <StatPill label="Spell" value={String(saves.spell)} />
            </div>
          </div>
        )}

        {/* Kindred traits */}
        {kindredTraits.length > 0 && (
          <>
            <div style={{
              fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem',
            }}>
              {kindred} Traits
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {kindredTraits.map(t => (
                <div key={t.name} style={{
                  backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: '8px', padding: '0.875rem',
                }}>
                  <div style={{ fontWeight: '600', color: 'var(--color-text)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{t.name}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.825rem', lineHeight: 1.45 }}>{t.description}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <button
          onClick={() => router.push(`${basePath}/7`)}
          style={{ width: '100%', padding: '0.875rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', minHeight: '44px' }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)', borderRadius: '6px', padding: '4px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--color-text)' }}>{value}</div>
    </div>
  );
}
