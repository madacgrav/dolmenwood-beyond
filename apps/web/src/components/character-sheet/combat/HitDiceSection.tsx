'use client';
import { sectionHead } from './shared';

interface Props {
  characterClass: string;
  level: number;
  hitDie: string;
}

export function HitDiceSection({ characterClass, level, hitDie }: Props) {
  return (
    <section>
      <h3 style={sectionHead}>Hit Dice</h3>
      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--color-text)' }}>{characterClass} — Level {level}</span>
        <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-gold)', fontFamily: 'var(--font-display), Georgia, serif' }}>
          {level}{hitDie}
        </span>
      </div>
    </section>
  );
}
