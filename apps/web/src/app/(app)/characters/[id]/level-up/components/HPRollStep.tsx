'use client';

import { useEffect, useState } from 'react';
import type { Character } from '@dolmenwood/types';
import { AnimatedDie } from '@/components/wizard/AnimatedDie';
import { useOptionalRules } from '@/hooks/use-optional-rules';
import {
  getAbilityModifier,
  getHitDie,
  rollDie,
  type DieType,
} from '@dolmenwood/rules-engine';

function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function HPRollStep({
  character,
  onContinue,
  onHpGain,
}: {
  character: Character;
  onContinue: (gain: number, rawRoll: number) => void;
  onHpGain: (gain: number) => void;
}){
  const hitDie = parseInt(getHitDie(character.characterClass).slice(1), 10);
  const conMod = getAbilityModifier(character.abilityScores.con);

  const [rules] = useOptionalRules();
  const [roll, setRoll] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let innerTimer: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      const rolled = rollDie(hitDie as DieType);
      setRoll(rolled);
      setRolling(true);

      // After animation (~800ms), mark done
      innerTimer = setTimeout(() => {
        setRolling(false);
        const gain = Math.max(1, rolled + conMod);
        onHpGain(gain);
        setDone(true);
      }, 800);
    }, 500);
    return () => { clearTimeout(timer); clearTimeout(innerTimer!); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = roll !== null ? Math.max(1, roll + conMod) : null;

  function reroll() {
    const rolled = rollDie(hitDie as DieType);
    setRoll(rolled);
    onHpGain(Math.max(1, rolled + conMod));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
      <h3 style={{
        margin: 0, fontSize: '1rem', fontWeight: '700',
        fontFamily: 'var(--font-display), Georgia, serif',
        color: 'var(--color-text)', textAlign: 'center',
      }}>
        Roll for Hit Points
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <AnimatedDie value={roll} sides={hitDie} rolling={rolling} size="lg" />
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          d{hitDie} hit die
        </p>
      </div>

      {done && total !== null && roll !== null && (
        <div style={{
          textAlign: 'center',
          animation: 'celebrationBounce 0.5s ease-out forwards',
        }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '0.375rem' }}>
            d{hitDie} rolled {roll} {conMod !== 0 && `+ CON ${formatMod(conMod)}`} = {total} HP gained
          </div>
          <div style={{
            fontSize: '2.5rem', fontWeight: '900',
            fontFamily: 'var(--font-display), Georgia, serif',
            color: 'var(--color-primary)',
          }}>
            +{total} HP
          </div>
        </div>
      )}

      {!done && (
        <div style={{ fontSize: '1rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          Rolling…
        </div>
      )}

      {done && rules.hpRerollLowRolls && roll !== null && roll <= 2 && (
        <button
          onClick={reroll}
          style={{
            width: '100%', padding: '0.875rem',
            backgroundColor: 'var(--color-surface)', color: 'var(--color-gold)',
            border: '1px solid var(--color-gold)', borderRadius: '10px',
            fontFamily: 'var(--font-display), Georgia, serif',
            fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer', minHeight: '44px',
          }}
        >
          Bad luck — re-roll
        </button>
      )}

      <button
        disabled={!done}
        onClick={() => total !== null && roll !== null && onContinue(total, roll)}
        style={{
          width: '100%', padding: '0.875rem',
          backgroundColor: done ? 'var(--color-primary)' : 'var(--color-border)',
          color: done ? 'white' : 'var(--color-text-muted)',
          border: 'none', borderRadius: '10px',
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1rem', fontWeight: '700',
          cursor: done ? 'pointer' : 'not-allowed',
          transition: 'background-color 0.3s',
          minHeight: '44px',
        }}
      >
        Continue →
      </button>
    </div>
  );
}
