'use client';
import type { ACBreakdown } from '@dolmenwood/types';
import { formatMod, sectionHead } from './shared';

interface Props {
  breakdown: ACBreakdown | null;
  dexScore: number;
}

function Row({ label, value, signed = true }: { label: string; value: number; signed?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span style={{
        color: signed && value > 0 ? 'var(--color-primary)'
          : signed && value < 0 ? 'var(--color-danger)'
          : 'var(--color-text-muted)',
      }}>
        {signed ? formatMod(value) : value}
      </span>
    </div>
  );
}

export function ArmourClassSection({ breakdown, dexScore }: Props) {
  const ac = breakdown?.total ?? 10;
  return (
    <section>
      <h3 style={sectionHead}>Armour Class</h3>
      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '1rem', color: 'var(--color-text)' }}>Total AC</span>
          <span style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-primary)', fontFamily: 'var(--font-display), Georgia, serif' }}>{ac}</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <Row label="Base" value={breakdown?.base ?? 10} signed={false} />
          <Row label={`DEX modifier (${dexScore})`} value={breakdown?.dexModifier ?? 0} />
          {breakdown && breakdown.armorBonus !== 0 && <Row label="Armour" value={breakdown.armorBonus} />}
          {breakdown && breakdown.shieldBonus !== 0 && <Row label="Shield" value={breakdown.shieldBonus} />}
          {breakdown && breakdown.kindredBonus !== 0 && <Row label="Kindred" value={breakdown.kindredBonus} />}
          {breakdown && breakdown.classBonus !== 0 && <Row label="Class" value={breakdown.classBonus} />}
          {(!breakdown || (breakdown.armorBonus === 0 && breakdown.shieldBonus === 0)) && (
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
              Equip armour in Inventory tab to increase AC
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
