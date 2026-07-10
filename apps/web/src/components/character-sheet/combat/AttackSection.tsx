'use client';
import { rollDie, rollDamage, type DieType } from '@dolmenwood/rules-engine';
import type { EquippedWeapon } from '@/lib/api/inventory';
import { AnimatedDie } from '@/components/wizard/AnimatedDie';
import { useDiceRoll } from '@/hooks/use-dice-roll';
import { formatMod, sectionHead } from './shared';

interface AttackResult { attackRoll: number; attackTotal: number; damageRoll: number; damageDice: string; }

interface Props {
  weapons: EquippedWeapon[];
  attackBonus: number;
  strMod: number;
  dexMod: number;
}

export function AttackSection({ weapons, attackBonus, strMod, dexMod }: Props) {
  const { results, rollingKeys, faceValues, roll } = useDiceRoll<AttackResult>();

  function rollWeaponAttack(weapon: EquippedWeapon, isMelee: boolean) {
    roll(weapon.id, () => {
      const mod = isMelee ? strMod : dexMod;
      const attackRoll = rollDie(20 as DieType);
      const attackTotal = attackRoll + attackBonus + mod;
      const damageDice = weapon.weapon_damage_dice ?? '1d6';
      const damageRoll = rollDamage(damageDice + (isMelee && strMod !== 0 ? (strMod >= 0 ? `+${strMod}` : `${strMod}`) : ''));
      return { face: attackRoll, result: { attackRoll, attackTotal, damageRoll, damageDice } };
    });
  }

  function rollGenericAttack(isMelee: boolean) {
    const key = isMelee ? 'generic-melee' : 'generic-ranged';
    roll(key, () => {
      const mod = isMelee ? strMod : dexMod;
      const attackRoll = rollDie(20 as DieType);
      const attackTotal = attackRoll + attackBonus + mod;
      return { face: attackRoll, result: { attackRoll, attackTotal, damageRoll: 0, damageDice: '' } };
    });
  }

  return (
    <section>
      <h3 style={sectionHead}>Attack Rolls</h3>
      {weapons.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {weapons.map(w => {
            const result = results[w.id];
            const isMissile = !!(w.weapon_damage_dice && w.item_name.toLowerCase().match(/bow|crossbow|sling|throwing/));
            const mod = isMissile ? dexMod : strMod;
            const modLabel = isMissile ? 'DEX' : 'STR';
            return (
              <div key={w.id} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)' }}>{w.item_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      d20 {formatMod(attackBonus + mod)} to hit · {w.weapon_damage_dice ?? '1d6'} {isMissile ? '' : `${strMod >= 0 ? '+' : ''}${strMod} `}dmg · {modLabel}
                    </div>
                  </div>
                  <button
                    onClick={() => rollWeaponAttack(w, !isMissile)}
                    style={{
                      padding: '0.375rem 0.875rem', borderRadius: '8px', border: 'none',
                      backgroundColor: 'var(--color-primary)', color: 'white',
                      fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', minHeight: '44px',
                    }}
                  >
                    🎲 Roll
                  </button>
                </div>
                {rollingKeys[w.id] ? (
                  <div style={{ marginTop: '0.625rem' }}>
                    <AnimatedDie value={faceValues[w.id] ?? null} sides={20} rolling size="sm" />
                  </div>
                ) : result && (
                  <div style={{ marginTop: '0.625rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.85rem', fontWeight: '700', padding: '0.25rem 0.625rem',
                      borderRadius: '6px', backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, var(--color-bg))',
                      color: 'var(--color-primary)',
                    }}>
                      Hit: {result.attackTotal} <span style={{ fontWeight: '400', fontSize: '0.72rem' }}>(rolled {result.attackRoll})</span>
                    </span>
                    <span style={{
                      fontSize: '0.85rem', fontWeight: '700', padding: '0.25rem 0.625rem',
                      borderRadius: '6px', backgroundColor: 'color-mix(in srgb, var(--color-gold) 15%, var(--color-bg))',
                      color: 'var(--color-gold)',
                    }}>
                      Dmg: {result.damageRoll}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {(['melee', 'ranged'] as const).map(type => {
            const isMelee = type === 'melee';
            const mod = isMelee ? strMod : dexMod;
            const key = isMelee ? 'generic-melee' : 'generic-ranged';
            return (
              <div key={type} style={{ flex: 1, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.875rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>{type}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-primary)', marginBottom: '0.375rem' }}>
                  {formatMod(attackBonus + mod)}
                </div>
                <button
                  onClick={() => rollGenericAttack(isMelee)}
                  style={{
                    width: '100%', padding: '0.375rem', borderRadius: '6px', border: 'none',
                    backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)',
                    fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', minHeight: '44px',
                  }}
                >
                  🎲 Roll d20
                </button>
                {rollingKeys[key] ? (
                  <div style={{ marginTop: '0.375rem', display: 'flex', justifyContent: 'center' }}>
                    <AnimatedDie value={faceValues[key] ?? null} sides={20} rolling size="sm" />
                  </div>
                ) : results[key] && (
                  <div style={{ marginTop: '0.375rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                    → {results[key]!.attackTotal}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {weapons.length === 0 && (
        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0.5rem 0 0', fontStyle: 'italic' }}>
          Equip weapons in Inventory tab to see weapon-specific rolls.
        </p>
      )}
    </section>
  );
}
