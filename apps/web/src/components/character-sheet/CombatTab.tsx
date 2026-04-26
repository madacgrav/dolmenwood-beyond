'use client';
import { useState } from 'react';
import type { Character } from '@dolmenwood/types';
import { getAttackBonus, getSaveTargets, calculateAC, getHitDie } from '@dolmenwood/rules-engine';

interface Props { character: Character; }

const CONDITIONS = ['Poisoned', 'Paralysed', 'Unconscious'] as const;
type Condition = typeof CONDITIONS[number];

const SAVE_NAMES = [
  { key: 'doom', label: 'Death / Doom' },
  { key: 'ray', label: 'Wands / Rays' },
  { key: 'hold', label: 'Paralysis / Hold' },
  { key: 'blast', label: 'Breath / Blast' },
  { key: 'spell', label: 'Spells / Rods' },
] as const;

function formatMod(mod: number) { return mod >= 0 ? `+${mod}` : `${mod}`; }

export function CombatTab({ character }: Props) {
  const [conditions, setConditions] = useState<Set<Condition>>(new Set());
  const attackBonus = getAttackBonus(character.characterClass, character.level);
  const saves = getSaveTargets(character.characterClass, character.level);
  const ac = calculateAC({ dexScore: character.abilityScores.dex, armorBonus: 0, kindredACBonus: 0, classACBonus: 0, shieldBonus: 0 });
  const hitDie = getHitDie(character.characterClass);

  function toggleCondition(c: Condition) {
    setConditions(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Conditions */}
      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Conditions
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {CONDITIONS.map(c => {
            const active = conditions.has(c);
            return (
              <button
                key={c}
                onClick={() => toggleCondition(c)}
                style={{
                  padding: '0.375rem 0.875rem', borderRadius: '20px',
                  border: `2px solid ${active ? 'var(--color-danger)' : 'var(--color-border)'}`,
                  backgroundColor: active ? 'color-mix(in srgb, var(--color-danger) 15%, var(--color-bg))' : 'var(--color-surface)',
                  color: active ? 'var(--color-danger)' : 'var(--color-text-muted)',
                  fontWeight: active ? '700' : '400', fontSize: '0.85rem', cursor: 'pointer', minHeight: '44px',
                }}
              >
                {active ? '⚠️ ' : ''}{c}
              </button>
            );
          })}
        </div>
      </section>

      {/* AC Breakdown */}
      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Armour Class
        </h3>
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
              <span>DEX modifier ({character.abilityScores.dex})</span>
              <span style={{ color: ac - 10 > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                {formatMod(ac - 10)}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
              Equip armour in Inventory tab to increase AC
            </div>
          </div>
        </div>
      </section>

      {/* Attack Bonus */}
      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Attack Bonus
        </h3>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ flex: 1, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.875rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>MELEE</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-primary)' }}>{formatMod(attackBonus)}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>+ STR mod</div>
          </div>
          <div style={{ flex: 1, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.875rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>RANGED</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-primary)' }}>{formatMod(attackBonus)}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>+ DEX mod</div>
          </div>
        </div>
      </section>

      {/* Hit Dice */}
      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Hit Dice
        </h3>
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text)' }}>{character.characterClass} — Level {character.level}</span>
          <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-gold)', fontFamily: 'var(--font-display), Georgia, serif' }}>
            {character.level}{hitDie}
          </span>
        </div>
      </section>

      {/* Saving Throws */}
      {saves && (
        <section>
          <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Saving Throws
          </h3>
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
            {SAVE_NAMES.map(({ key, label }, i) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', borderBottom: i < SAVE_NAMES.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{label}</span>
                <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {(saves as Record<string, number>)[key]}+
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
