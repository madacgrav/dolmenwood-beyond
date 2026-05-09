'use client';
import { useState, useEffect, useMemo } from 'react';
import type { Character } from '@dolmenwood/types';
import { getAttackBonus, getSaveTargets, calculateAC, getHitDie, getAbilityModifier, rollDie } from '@dolmenwood/rules-engine';
import { createClient } from '@/lib/supabase/client';

interface Props {
  character: Character;
  characterId: string;
}

interface EquippedWeapon {
  id: string;
  item_name: string;
  weapon_damage_dice: string | null;
}

type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100;

const CONDITIONS = ['Poisoned', 'Paralysed', 'Unconscious'] as const;
type Condition = typeof CONDITIONS[number];

const SAVE_NAMES = [
  { key: 'doom', label: 'Death / Doom' },
  { key: 'ray', label: 'Wands / Rays' },
  { key: 'hold', label: 'Paralysis / Hold' },
  { key: 'blast', label: 'Breath / Blast' },
  { key: 'spell', label: 'Spells / Rods' },
] as const;

type SaveKey = typeof SAVE_NAMES[number]['key'];

interface RollResult { roll: number; passed: boolean; target: number; }
interface AttackResult { attackRoll: number; attackTotal: number; damageRoll: number; damageDice: string; }

function formatMod(mod: number) { return mod >= 0 ? `+${mod}` : `${mod}`; }

function rollDamage(notation: string): number {
  const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return 0;
  const count = parseInt(match[1] ?? '1', 10);
  const sides = parseInt(match[2] ?? '6', 10);
  const bonus = parseInt(match[3] ?? '0', 10);
  let total = bonus;
  for (let i = 0; i < count; i++) total += rollDie(sides as DieType);
  return Math.max(1, total);
}

const sectionHead: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontFamily: 'var(--font-display), Georgia, serif',
  fontSize: '0.9rem',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

export function CombatTab({ character, characterId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [conditions, setConditions] = useState<Set<Condition>>(new Set());
  const [saveRolls, setSaveRolls] = useState<Partial<Record<SaveKey, RollResult>>>({});
  const [attackResults, setAttackResults] = useState<Partial<Record<string, AttackResult>>>({});
  const [genericAttack, setGenericAttack] = useState<AttackResult | null>(null);
  const [weapons, setWeapons] = useState<EquippedWeapon[]>([]);

  const attackBonus = getAttackBonus(character.characterClass, character.level);
  const saves = getSaveTargets(character.characterClass, character.level);
  const strMod = getAbilityModifier(character.abilityScores.str);
  const dexMod = getAbilityModifier(character.abilityScores.dex);

  const equippedArmorBonus = 0; // updated when armor items are read
  const ac = calculateAC({
    dexScore: character.abilityScores.dex,
    armorBonus: equippedArmorBonus,
    kindredACBonus: 0,
    classACBonus: 0,
    shieldBonus: 0,
  });
  const hitDie = getHitDie(character.characterClass);

  useEffect(() => {
    supabase
      .from('character_inventory')
      .select('id, item_name, weapon_damage_dice')
      .eq('character_id', characterId)
      .eq('item_type', 'weapon')
      .eq('location', 'equipped')
      .then(({ data }) => setWeapons((data ?? []) as EquippedWeapon[]));
  }, [characterId, supabase]);

  function toggleCondition(c: Condition) {
    setConditions(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  function rollSave(key: SaveKey) {
    if (!saves) return;
    const target = (saves as Record<string, number>)[key] ?? 15;
    const roll = rollDie(20 as DieType);
    setSaveRolls(prev => ({ ...prev, [key]: { roll, passed: roll >= target, target } }));
  }

  function rollWeaponAttack(weapon: EquippedWeapon, isMelee: boolean) {
    const mod = isMelee ? strMod : dexMod;
    const attackRoll = rollDie(20 as DieType);
    const attackTotal = attackRoll + attackBonus + mod;
    const damageDice = weapon.weapon_damage_dice ?? '1d6';
    const damageRoll = rollDamage(damageDice + (isMelee && strMod !== 0 ? (strMod >= 0 ? `+${strMod}` : `${strMod}`) : ''));
    setAttackResults(prev => ({ ...prev, [weapon.id]: { attackRoll, attackTotal, damageRoll, damageDice } }));
  }

  function rollGenericAttack(isMelee: boolean) {
    const mod = isMelee ? strMod : dexMod;
    const attackRoll = rollDie(20 as DieType);
    const attackTotal = attackRoll + attackBonus + mod;
    setGenericAttack({ attackRoll, attackTotal, damageRoll: 0, damageDice: '' });
  }

  const ResultBadge = ({ pass, roll, target }: { pass: boolean; roll: number; target: number }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      fontSize: '0.8rem', fontWeight: '700',
      color: pass ? 'var(--color-primary)' : 'var(--color-danger)',
      backgroundColor: pass ? 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))' : 'color-mix(in srgb, var(--color-danger) 12%, var(--color-bg))',
      borderRadius: '6px', padding: '0.2rem 0.5rem',
    }}>
      🎲 {roll} {pass ? '✓' : '✗'} <span style={{ fontWeight: '400', fontSize: '0.72rem' }}>vs {target}+</span>
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Conditions */}
      <section>
        <h3 style={sectionHead}>Conditions</h3>
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
              <span>DEX modifier ({character.abilityScores.dex})</span>
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

      {/* Attack — Equipped Weapons */}
      <section>
        <h3 style={sectionHead}>Attack Rolls</h3>
        {weapons.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {weapons.map(w => {
              const result = attackResults[w.id];
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
                  {result && (
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
                      fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', minHeight: '36px',
                    }}
                  >
                    🎲 Roll d20
                  </button>
                  {genericAttack && (
                    <div style={{ marginTop: '0.375rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                      → {genericAttack.attackTotal}
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

      {/* Hit Dice */}
      <section>
        <h3 style={sectionHead}>Hit Dice</h3>
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
          <h3 style={sectionHead}>Saving Throws <span style={{ fontSize: '0.72rem', fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>— tap to roll</span></h3>
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
            {SAVE_NAMES.map(({ key, label }, i) => {
              const target = (saves as Record<string, number>)[key] ?? 15;
              const result = saveRolls[key];
              return (
                <button
                  key={key}
                  onClick={() => rollSave(key)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    width: '100%', padding: '0.625rem 0.875rem',
                    borderBottom: i < SAVE_NAMES.length - 1 ? '1px solid var(--color-border)' : 'none',
                    backgroundColor: 'transparent', border: 'none',
                    borderBottomColor: i < SAVE_NAMES.length - 1 ? 'var(--color-border)' : 'transparent',
                    borderBottomWidth: i < SAVE_NAMES.length - 1 ? '1px' : '0',
                    borderBottomStyle: 'solid',
                    cursor: 'pointer', textAlign: 'left', minHeight: '48px',
                    transition: 'background-color 0.15s',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {result ? (
                      <ResultBadge pass={result.passed} roll={result.roll} target={target} />
                    ) : (
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {target}+
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {Object.keys(saveRolls).length > 0 && (
            <button
              onClick={() => setSaveRolls({})}
              style={{ marginTop: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: '0.25rem' }}
            >
              ↺ Clear rolls
            </button>
          )}
        </section>
      )}
    </div>
  );
}
