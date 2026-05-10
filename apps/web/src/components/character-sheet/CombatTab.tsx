'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Character } from '@dolmenwood/types';
import { getAttackBonus, getSaveTargets, calculateAC, getHitDie, getAbilityModifier, rollDie, rollDamage, calcAmmoRecovery, type DieType } from '@dolmenwood/rules-engine';
import { createClient } from '@/lib/supabase/client';

interface Props {
  character: Character;
  characterId: string;
  readOnly?: boolean;
}

interface EquippedWeapon {
  id: string;
  item_name: string;
  weapon_damage_dice: string | null;
}

interface AmmoItem {
  id: string;
  item_name: string;
  quantity: number;
}

interface DBMount {
  id: string;
  owner_id: string;
  owner_type: string;
  character_id: string | null;
  campaign_id: string | null;
  name: string;
  mount_type: string;
  speed: number;
  has_full_stats: boolean;
  ac: number | null;
  hp_current: number | null;
  hp_max: number | null;
  attack_bonus: number | null;
  morale: number | null;
  created_at: string;
}

const MOUNT_TYPES = ['Horse', 'Mule', 'Dog', 'Pony', 'Other'] as const;
type MountType = typeof MOUNT_TYPES[number];

const RANGED_WEAPON_PATTERNS = /bow|crossbow|sling|dart|javelin|thrown/i;

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

const sectionHead: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontFamily: 'var(--font-display), Georgia, serif',
  fontSize: '0.9rem',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

export function CombatTab({ character, characterId, readOnly = false }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [conditions, setConditions] = useState<Set<Condition>>(new Set());
  const [saveRolls, setSaveRolls] = useState<Partial<Record<SaveKey, RollResult>>>({});
  const [attackResults, setAttackResults] = useState<Partial<Record<string, AttackResult>>>({});
  const [genericAttack, setGenericAttack] = useState<AttackResult | null>(null);
  const [weapons, setWeapons] = useState<EquippedWeapon[]>([]);

  // ── Mounts state ────────────────────────────────────────────────────────────
  const [mounts, setMounts] = useState<DBMount[]>([]);
  const [mountsLoading, setMountsLoading] = useState(true);
  const [showAddMount, setShowAddMount] = useState(false);
  const [newMount, setNewMount] = useState({
    name: '',
    mount_type: 'Horse' as MountType,
    speed: 40,
    has_full_stats: character.characterClass === 'Knight',
    ac: 14,
    hp_max: 12,
    attack_bonus: 2,
    morale: 7,
  });
  const [mountSaving, setMountSaving] = useState(false);
  const hpTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Ammo tracking
  const [ammoItems, setAmmoItems] = useState<AmmoItem[]>([]);
  const [hasRangedWeapon, setHasRangedWeapon] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [battleAmmoId, setBattleAmmoId] = useState<string | null>(null);
  const [battleStartQty, setBattleStartQty] = useState(0);
  const [battleCurrentQty, setBattleCurrentQty] = useState(0);
  const [battleResult, setBattleResult] = useState<{ recovered: number } | null>(null);
  const [battleEnding, setBattleEnding] = useState(false);

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

  const fetchAmmo = useCallback(async () => {
    const { data } = await supabase
      .from('character_inventory')
      .select('id, item_name, quantity')
      .eq('character_id', characterId)
      .or('item_type.eq.ammo,item_name.ilike.%Arrow%,item_name.ilike.%Quarrel%,item_name.ilike.%Stone%,item_name.ilike.%Bolt%');
    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      item_name: r.item_name as string,
      quantity: r.quantity as number,
    }));
    setAmmoItems(mapped);
  }, [characterId, supabase]);

  useEffect(() => {
    supabase
      .from('character_inventory')
      .select('id, item_name, weapon_damage_dice')
      .eq('character_id', characterId)
      .eq('item_type', 'weapon')
      .eq('location', 'equipped')
      .then(({ data }) => {
        const ws = (data ?? []) as EquippedWeapon[];
        setWeapons(ws);
        setHasRangedWeapon(ws.some(w => RANGED_WEAPON_PATTERNS.test(w.item_name)));
      });
    fetchAmmo();
  }, [characterId, supabase, fetchAmmo]);

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

  async function adjustAmmo(item: AmmoItem, delta: number) {
    const next = Math.max(0, item.quantity + delta);
    setAmmoItems(prev => prev.map(a => a.id === item.id ? { ...a, quantity: next } : a));
    await supabase.from('character_inventory').update({ quantity: next }).eq('id', item.id);
  }

  function openBattle(item: AmmoItem) {
    setBattleAmmoId(item.id);
    setBattleStartQty(item.quantity);
    setBattleCurrentQty(item.quantity);
    setBattleResult(null);
    setBattleEnding(false);
    setBattleOpen(true);
  }

  async function fireShotInBattle() {
    if (battleCurrentQty <= 0) return;
    const next = battleCurrentQty - 1;
    setBattleCurrentQty(next);
    if (battleAmmoId) {
      await supabase.from('character_inventory').update({ quantity: next }).eq('id', battleAmmoId);
      setAmmoItems(prev => prev.map(a => a.id === battleAmmoId ? { ...a, quantity: next } : a));
    }
  }

  async function endBattle() {
    setBattleEnding(true);
    const shotsUsed = battleStartQty - battleCurrentQty;
    const recovered = calcAmmoRecovery(shotsUsed);
    if (recovered > 0 && battleAmmoId) {
      const finalQty = battleCurrentQty + recovered;
      await supabase.from('character_inventory').update({ quantity: finalQty }).eq('id', battleAmmoId);
      setAmmoItems(prev => prev.map(a => a.id === battleAmmoId ? { ...a, quantity: finalQty } : a));
      setBattleCurrentQty(finalQty);
    }
    setBattleResult({ recovered });
    setBattleEnding(false);
  }

  function closeBattle() {
    setBattleOpen(false);
    setBattleAmmoId(null);
    setBattleResult(null);
  }

  // ── Mount management ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('mounts')
      .select('*')
      .eq('character_id', characterId)
      .eq('owner_type', 'character')
      .order('created_at')
      .then(({ data }) => {
        setMounts((data ?? []) as DBMount[]);
        setMountsLoading(false);
      });
  }, [characterId, supabase]);

  function adjustMountHP(mount: DBMount, delta: number) {
    const current = mount.hp_current ?? 0;
    const max = mount.hp_max ?? 0;
    const next = Math.max(0, Math.min(max, current + delta));
    setMounts(prev => prev.map(m => m.id === mount.id ? { ...m, hp_current: next } : m));
    if (hpTimers.current[mount.id]) clearTimeout(hpTimers.current[mount.id]);
    hpTimers.current[mount.id] = setTimeout(async () => {
      await supabase.from('mounts').update({ hp_current: next }).eq('id', mount.id);
    }, 500);
  }

  async function addMount() {
    if (!newMount.name.trim()) return;
    setMountSaving(true);
    const payload: Record<string, unknown> = {
      owner_id: characterId,  // character UUID - matches RLS expectation
      owner_type: 'character',
      character_id: characterId,
      name: newMount.name.trim(),
      mount_type: newMount.mount_type,
      speed: newMount.speed,
      has_full_stats: newMount.has_full_stats,
    };
    if (newMount.has_full_stats) {
      payload.ac = newMount.ac;
      payload.hp_current = newMount.hp_max;
      payload.hp_max = newMount.hp_max;
      payload.attack_bonus = newMount.attack_bonus;
      payload.morale = newMount.morale;
    }
    const { data, error } = await supabase.from('mounts').insert(payload).select().single();
    if (!error && data) {
      setMounts(prev => [...prev, data as DBMount]);
      setShowAddMount(false);
      setNewMount({
        name: '',
        mount_type: 'Horse',
        speed: 40,
        has_full_stats: character.characterClass === 'Knight',
        ac: 14,
        hp_max: 12,
        attack_bonus: 2,
        morale: 7,
      });
    }
    setMountSaving(false);
  }

  async function deleteMount(id: string) {
    if (!confirm('Remove this mount?')) return;
    setMounts(prev => prev.filter(m => m.id !== id));
    await supabase.from('mounts').delete().eq('id', id);
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
                      fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', minHeight: '44px',
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

      {/* Ammo Counter */}
      {(hasRangedWeapon || ammoItems.length > 0) && (
        <section>
          <h3 style={sectionHead}>Ammunition</h3>
          {ammoItems.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
              No ammo in inventory. Add arrows, quarrels, or bolts in the Inventory tab.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ammoItems.map(ammo => (
                <div key={ammo.id} style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '10px',
                  padding: '0.75rem 0.875rem',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)' }}>
                    🏹 {ammo.item_name}
                  </span>
                  <button
                    onClick={() => adjustAmmo(ammo, -1)}
                    disabled={ammo.quantity <= 0}
                    style={{
                      width: '36px', height: '44px', borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
                      fontSize: '1.1rem', cursor: 'pointer',
                      opacity: ammo.quantity <= 0 ? 0.4 : 1,
                    }}
                    aria-label={`Remove one ${ammo.item_name}`}
                  >−</button>
                  <span style={{
                    minWidth: '3ch', textAlign: 'center',
                    fontSize: '1.1rem', fontWeight: '700',
                    color: ammo.quantity === 0 ? 'var(--color-danger)' : 'var(--color-text)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {ammo.quantity}
                  </span>
                  <button
                    onClick={() => adjustAmmo(ammo, 1)}
                    style={{
                      width: '36px', height: '44px', borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
                      fontSize: '1.1rem', cursor: 'pointer',
                    }}
                    aria-label={`Add one ${ammo.item_name}`}
                  >+</button>
                  {ammo.quantity > 0 && (
                    <button
                      onClick={() => openBattle(ammo)}
                      style={{
                        padding: '0 0.875rem', height: '44px', borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'var(--color-primary)', color: 'white',
                        fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ⚔️ Battle
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Battle Modal */}
      {battleOpen && (() => {
        const battleAmmo = ammoItems.find(a => a.id === battleAmmoId);
        const ammoName = battleAmmo?.item_name ?? 'Ammo';
        const shotsUsed = battleStartQty - battleCurrentQty;
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}>
            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: '1.5rem',
              width: '100%', maxWidth: '360px',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1.2rem', fontWeight: '700', color: 'var(--color-text)', marginBottom: '0.25rem' }}>
                  ⚔️ Battle Mode
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {ammoName} — Started with {battleStartQty}
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'var(--color-bg)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Remaining</div>
                <div style={{
                  fontSize: '3rem', fontWeight: '700',
                  fontFamily: 'var(--font-display), Georgia, serif',
                  color: battleCurrentQty === 0 ? 'var(--color-danger)' : 'var(--color-primary)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.1,
                }}>
                  {battleCurrentQty}
                </div>
                {shotsUsed > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    {shotsUsed} shot{shotsUsed !== 1 ? 's' : ''} fired
                  </div>
                )}
              </div>

              {battleResult ? (
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{
                    padding: '0.875rem', borderRadius: '10px',
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))',
                    border: '1px solid var(--color-primary)',
                  }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Arrow Recovery</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-primary)', fontFamily: 'var(--font-display), Georgia, serif' }}>
                      +{battleResult.recovered} recovered
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                      ({shotsUsed} fired → ½ recovered)
                    </div>
                  </div>
                  <button
                    onClick={closeBattle}
                    style={{
                      padding: '0.75rem', borderRadius: '10px', border: 'none',
                      backgroundColor: 'var(--color-primary)', color: 'white',
                      fontWeight: '700', fontSize: '1rem', cursor: 'pointer', minHeight: '44px',
                    }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <button
                    onClick={fireShotInBattle}
                    disabled={battleCurrentQty <= 0}
                    style={{
                      padding: '1rem', borderRadius: '10px', border: 'none',
                      backgroundColor: battleCurrentQty > 0 ? 'var(--color-primary)' : 'var(--color-border)',
                      color: 'white', fontWeight: '700', fontSize: '1.1rem',
                      cursor: battleCurrentQty > 0 ? 'pointer' : 'not-allowed',
                      minHeight: '56px', opacity: battleCurrentQty > 0 ? 1 : 0.5,
                    }}
                  >
                    🏹 Shot Fired
                  </button>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={endBattle}
                      disabled={battleEnding}
                      style={{
                        flex: 1, padding: '0.75rem', borderRadius: '10px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'color-mix(in srgb, var(--color-gold) 15%, var(--color-bg))',
                        color: 'var(--color-gold)', fontWeight: '700',
                        fontSize: '0.9rem', cursor: 'pointer', minHeight: '44px',
                        opacity: battleEnding ? 0.6 : 1,
                      }}
                    >
                      {battleEnding ? '…' : '🏁 End Battle'}
                    </button>
                    <button
                      onClick={closeBattle}
                      style={{
                        flex: 1, padding: '0.75rem', borderRadius: '10px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)',
                        fontSize: '0.9rem', cursor: 'pointer', minHeight: '44px',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
          {Object.keys(saveRolls).length > 0 && !readOnly && (
            <button
              onClick={() => setSaveRolls({})}
              style={{ marginTop: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: '0.25rem' }}
            >
              ↺ Clear rolls
            </button>
          )}
        </section>
      )}

      {/* Mounts */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={sectionHead}>Mounts</h3>
          {!readOnly && (
            <button
              onClick={() => setShowAddMount(v => !v)}
              style={{
                padding: '0.25rem 0.75rem', borderRadius: '6px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'transparent', color: 'var(--color-primary)',
                fontSize: '0.8rem', cursor: 'pointer', minHeight: '44px',
              }}
            >
              {showAddMount ? 'Cancel' : '＋ Add Mount'}
            </button>
          )}
        </div>

        {mountsLoading ? (
          <div style={{ height: '48px', borderRadius: '8px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {mounts.map(mount => {
              const hpPct = (mount.hp_max ?? 0) > 0 ? Math.max(0, (mount.hp_current ?? 0) / mount.hp_max!) : 0;
              const hpColor = hpPct > 0.66 ? 'var(--color-primary)' : hpPct > 0.33 ? 'var(--color-gold)' : 'var(--color-danger)';
              return (
                <div
                  key={mount.id}
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {/* Mount card header */}
                  <div style={{ padding: '0.75rem 0.875rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)' }}>
                          {mount.name}
                        </span>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: '600',
                          backgroundColor: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '4px', padding: '0.1rem 0.375rem',
                          color: 'var(--color-text-muted)',
                        }}>
                          {mount.mount_type}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          {mount.speed} ft/round
                        </span>
                      </div>

                      {mount.has_full_stats && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                            {[
                              { label: 'AC', value: mount.ac ?? '—' },
                              { label: 'ATK', value: mount.attack_bonus != null ? `+${mount.attack_bonus}` : '—' },
                              { label: 'Morale', value: mount.morale ?? '—' },
                            ].map(({ label, value }) => (
                              <div key={label} style={{
                                backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)',
                                borderRadius: '6px', padding: '0.2rem 0.5rem', textAlign: 'center', minWidth: '46px',
                              }}>
                                <div style={{ fontSize: '0.58rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--color-primary)' }}>{value}</div>
                              </div>
                            ))}
                          </div>

                          {/* HP bar */}
                          {(mount.hp_max ?? 0) > 0 && (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                                <span style={{ color: hpColor, fontWeight: '600' }}>
                                  ❤️ {mount.hp_current ?? 0} / {mount.hp_max}
                                </span>
                              </div>
                              <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--color-border)', overflow: 'hidden', marginBottom: '0.375rem' }}>
                                <div style={{ height: '100%', width: `${hpPct * 100}%`, backgroundColor: hpColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                              </div>
                              {!readOnly && (
                                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                                  {[-5, -1, 1, 5].map(d => (
                                    <button
                                      key={d}
                                      onClick={() => adjustMountHP(mount, d)}
                                      style={{
                                        padding: '0.2rem 0.5rem', borderRadius: '6px',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: d < 0
                                          ? 'color-mix(in srgb, var(--color-danger) 12%, var(--color-bg))'
                                          : 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))',
                                        color: d < 0 ? 'var(--color-danger)' : 'var(--color-primary)',
                                        fontSize: '0.75rem', fontWeight: '700',
                                        cursor: 'pointer', minHeight: '44px',
                                      }}
                                    >
                                      {d > 0 ? `+${d}` : d}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {!mount.has_full_stats && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          Tack &amp; inventory tracked in Inventory tab
                        </div>
                      )}
                    </div>

                    {!readOnly && (
                      <button
                        onClick={() => deleteMount(mount.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--color-danger)', fontSize: '1rem',
                          padding: '0.25rem', borderRadius: '4px',
                          minHeight: '44px', minWidth: '44px',
                          flexShrink: 0,
                        }}
                        aria-label={`Remove ${mount.name}`}
                        title="Remove mount"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {mounts.length === 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
                No mounts.{!readOnly ? ' Use "Add Mount" to record a horse, mule, or other animal.' : ''}
              </p>
            )}
          </div>
        )}

        {/* Add Mount form */}
        {!readOnly && showAddMount && (
          <div style={{
            marginTop: '0.75rem',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-primary)',
            borderRadius: '10px',
            padding: '1rem',
            display: 'flex', flexDirection: 'column', gap: '0.625rem',
          }}>
            <h4 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.875rem', color: 'var(--color-text)' }}>
              New Mount
            </h4>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Name</label>
              <input
                type="text"
                placeholder="e.g. Shadowmere"
                value={newMount.name}
                onChange={e => setNewMount(p => ({ ...p, name: e.target.value }))}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
                  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Type</label>
                <select
                  value={newMount.mount_type}
                  onChange={e => setNewMount(p => ({ ...p, mount_type: e.target.value as MountType }))}
                  style={{
                    width: '100%', padding: '0.4rem 0.5rem', borderRadius: '8px',
                    border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '40px',
                  }}
                >
                  {MOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Speed (ft/round)</label>
                <input
                  type="number"
                  min={10} max={120} step={10}
                  value={newMount.speed}
                  onChange={e => setNewMount(p => ({ ...p, speed: parseInt(e.target.value) || 40 }))}
                  style={{
                    width: '100%', padding: '0.4rem 0.5rem', borderRadius: '8px',
                    border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={newMount.has_full_stats}
                onChange={e => setNewMount(p => ({ ...p, has_full_stats: e.target.checked }))}
              />
              Full stat block (warhorse / combat mount)
            </label>

            {newMount.has_full_stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem' }}>
                {[
                  { label: 'AC', key: 'ac' as const, min: 5, max: 20 },
                  { label: 'HP Max', key: 'hp_max' as const, min: 1, max: 100 },
                  { label: 'ATK Bonus', key: 'attack_bonus' as const, min: -2, max: 10 },
                  { label: 'Morale', key: 'morale' as const, min: 2, max: 12 },
                ].map(({ label, key, min, max }) => (
                  <div key={key}>
                    <label style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.15rem' }}>{label}</label>
                    <input
                      type="number" min={min} max={max}
                      value={newMount[key]}
                      onChange={e => setNewMount(p => ({ ...p, [key]: parseInt(e.target.value) || min }))}
                      style={{
                        width: '100%', padding: '0.3rem', borderRadius: '6px',
                        border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)', fontSize: '0.9rem', textAlign: 'center',
                        minHeight: '40px', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={addMount}
                disabled={mountSaving || !newMount.name.trim()}
                style={{
                  flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none',
                  backgroundColor: mountSaving || !newMount.name.trim() ? 'var(--color-border)' : 'var(--color-primary)',
                  color: 'white', fontWeight: '600', fontSize: '0.875rem',
                  cursor: mountSaving || !newMount.name.trim() ? 'not-allowed' : 'pointer',
                  minHeight: '44px',
                }}
              >
                {mountSaving ? 'Saving…' : 'Add Mount'}
              </button>
              <button
                onClick={() => setShowAddMount(false)}
                style={{
                  padding: '0.625rem 1rem', borderRadius: '8px',
                  border: '1px solid var(--color-border)', backgroundColor: 'transparent',
                  color: 'var(--color-text-muted)', fontSize: '0.875rem', cursor: 'pointer', minHeight: '44px',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
