'use client';
import { formatMod, sectionHead } from './shared';
import { StatPill } from './StatPill';

interface Props {
  ac: number;
  attackBonus: number;
  speed: number;
  /** Exploration rate in feet per Turn. */
  exploring: number;
  /** Overland travel points per day. */
  overland: number;
}

export function CombatStatsSection({ ac, attackBonus, speed, exploring, overland }: Props) {
  return (
    <section>
      <h3 style={sectionHead}>
        Combat Stats
      </h3>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <StatPill label="AC" value={ac} color="var(--color-primary)" />
        <StatPill label="Attack" value={formatMod(attackBonus)} color="var(--color-primary)" />
        <StatPill label="Speed" value={`${speed}′`} color="var(--color-text)" />
        <StatPill label="Exploring" value={`${exploring}′`} color="var(--color-text)" />
        <StatPill label="Overland" value={`${overland} pts`} color="var(--color-text)" />
      </div>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
        Speed is feet/round (encumbrance-based) · Exploring is feet/turn · Overland is travel points/day.
      </p>
    </section>
  );
}
