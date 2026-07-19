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
  /** Switches the sheet to the Combat tab for the full breakdown. */
  onGoToCombat?: () => void;
}

/** Combat at a glance — the full AC breakdown and saves live in the Combat tab. */
export function CombatStatsSection({ ac, attackBonus, speed, exploring, overland, onGoToCombat }: Props) {
  return (
    <section>
      <h3 style={sectionHead}>
        Combat at a Glance
      </h3>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <StatPill label="AC" value={ac} color="var(--color-primary)" />
        <StatPill label="Attack" value={formatMod(attackBonus)} color="var(--color-primary)" />
        <StatPill label="Speed" value={`${speed}′`} color="var(--color-text)" />
        {onGoToCombat && (
          <button
            onClick={onGoToCombat}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 600,
              padding: '0.25rem 0.5rem', minHeight: '44px',
            }}
          >
            Details →
          </button>
        )}
      </div>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
        Exploring {exploring}′/turn · Overland {overland} pts/day · Full AC breakdown &amp; saves in Combat.
      </p>
    </section>
  );
}
