'use client';
import { formatMod, sectionHead } from './shared';
import { StatPill } from './StatPill';

interface Props {
  ac: number;
  attackBonus: number;
  speed: number;
}

export function CombatStatsSection({ ac, attackBonus, speed }: Props) {
  return (
    <section>
      <h3 style={sectionHead}>
        Combat Stats
      </h3>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <StatPill label="AC" value={ac} color="var(--color-primary)" />
        <StatPill label="Attack" value={formatMod(attackBonus)} color="var(--color-primary)" />
        <StatPill label="Speed" value={`${speed}′`} color="var(--color-text)" />
      </div>
    </section>
  );
}
