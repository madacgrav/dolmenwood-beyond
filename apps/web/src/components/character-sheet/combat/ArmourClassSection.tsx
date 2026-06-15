'use client';
import { formatMod, sectionHead } from './shared';

interface Props {
  ac: number;
  dexScore: number;
  dexMod: number;
}

export function ArmourClassSection({ ac, dexScore, dexMod }: Props) {
  return (
    <section>
      <h3 style={sectionHead}>Armour Class</h3>
      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '1rem', color: 'var(--color-text)' }}>Total AC</span>
          <span style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-primary)', fontFamily: 'var(--font-display), Georgia, serif' }}>{ac}</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Base</span><span>10</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>DEX modifier ({dexScore})</span>
            <span style={{ color: dexMod > 0 ? 'var(--color-primary)' : dexMod < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
              {formatMod(dexMod)}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
            Equip armour in Inventory tab to increase AC
          </div>
        </div>
      </div>
    </section>
  );
}
