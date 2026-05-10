'use client';
import { useState, useEffect, useMemo } from 'react';
import type { Character, AbilityScores } from '@dolmenwood/types';
import {
  getAbilityModifier, getPrimeAbilities, getSaveTargets,
  getAttackBonus, calculateAC, calculateSpeed,
  getMaxRetainers, getRetainerLoyaltyBase,
  getAllSkills, rollDie,
} from '@dolmenwood/rules-engine';
import type { SkillEntry } from '@dolmenwood/rules-engine';
import { createClient } from '@/lib/supabase/client';

type CharacterWithNotes = Character & { notes?: string };

interface DBRetainer {
  id: string;
  name: string;
  kindred: string;
  character_class: string;
  level: number;
  ac: number;
  hp_current: number;
  hp_max: number;
  attack_bonus: number;
  morale: number;
  loyalty: number;
  wage_type: 'daily' | 'share';
  wage_amount: number;
}

interface Props {
  character: CharacterWithNotes;
  editMode: boolean;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void;
  readOnly?: boolean;
}

const ABILITY_KEYS: { key: keyof AbilityScores; abbr: string; label: string }[] = [
  { key: 'str', abbr: 'STR', label: 'Strength' },
  { key: 'int', abbr: 'INT', label: 'Intellect' },
  { key: 'wis', abbr: 'WIS', label: 'Wisdom' },
  { key: 'dex', abbr: 'DEX', label: 'Dexterity' },
  { key: 'con', abbr: 'CON', label: 'Constitution' },
  { key: 'cha', abbr: 'CHA', label: 'Charisma' },
];

const SAVE_NAMES = [
  { key: 'doom', label: 'Death / Doom' },
  { key: 'ray', label: 'Wands / Rays' },
  { key: 'hold', label: 'Paralysis / Hold' },
  { key: 'blast', label: 'Breath / Blast' },
  { key: 'spell', label: 'Spells / Rods' },
] as const;

function formatMod(mod: number) { return mod >= 0 ? `+${mod}` : `${mod}`; }

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: '8px', padding: '0.5rem 0.875rem',
      display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px',
    }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: '1.1rem', fontWeight: '700', color }}>{value}</span>
    </div>
  );
}

export function StatsTab({ character, editMode, onUpdate, readOnly }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const primes = getPrimeAbilities(character.characterClass);
  const saves = getSaveTargets(character.characterClass, character.level);
  const attackBonus = getAttackBonus(character.characterClass, character.level);
  const ac = calculateAC({ dexScore: character.abilityScores.dex, armorBonus: 0, kindredACBonus: 0, classACBonus: 0, shieldBonus: 0 });
  const speed = calculateSpeed(0);
  const maxRetainers = getMaxRetainers(character.abilityScores.cha);
  const loyaltyBase = getRetainerLoyaltyBase(character.abilityScores.cha);

  const [editScores, setEditScores] = useState<AbilityScores>({ ...character.abilityScores });
  const [retainers, setRetainers] = useState<DBRetainer[]>([]);
  const [retainerLoading, setRetainerLoading] = useState(true);
  const [showAddRetainer, setShowAddRetainer] = useState(false);
  const [newRetainer, setNewRetainer] = useState<{
    name: string; kindred: string; character_class: string; level: number;
    ac: number; hp_current: number; hp_max: number; attack_bonus: number;
    morale: number; loyalty: number; wage_type: 'daily' | 'share'; wage_amount: number;
  }>({
    name: '', kindred: 'Human', character_class: 'Fighter', level: 1,
    ac: 10, hp_current: 4, hp_max: 4, attack_bonus: 0,
    morale: 7, loyalty: loyaltyBase, wage_type: 'daily', wage_amount: 1,
  });
  const [expandedRetainer, setExpandedRetainer] = useState<string | null>(null);
  const [promotingRetainer, setPromotingRetainer] = useState<string | null>(null);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promoteSuccess, setPromoteSuccess] = useState<{ name: string; charId: string } | null>(null);

  // Skills
  const skills = useMemo(
    () => getAllSkills(character.characterClass, character.level, character.kindred),
    [character.characterClass, character.level, character.kindred]
  );
  const [skillRolls, setSkillRolls] = useState<Record<string, { roll: number; pass: boolean } | undefined>>({});

  function rollSkill(skill: SkillEntry) {
    const roll = rollDie(6);
    // Dolmenwood skills: roll d6, succeed if result >= target number
    setSkillRolls(prev => ({ ...prev, [skill.name]: { roll, pass: roll >= skill.target } }));
  }

  useEffect(() => {
    supabase.from('retainers')
      .select('*')
      .eq('owner_character_id', character.id)
      .eq('is_promoted_to_pc', false)
      .order('created_at')
      .then(({ data }) => {
        setRetainers((data ?? []) as DBRetainer[]);
        setRetainerLoading(false);
      });
  }, [character.id, supabase]);

  async function addRetainer() {
    if (!newRetainer.name.trim()) return;
    const { data, error } = await supabase.from('retainers').insert({
      ...newRetainer,
      name: newRetainer.name.trim(),
      owner_character_id: character.id,
    }).select().single();
    if (!error && data) {
      setRetainers(prev => [...prev, data as DBRetainer]);
      setNewRetainer({
        name: '', kindred: 'Human', character_class: 'Fighter', level: 1,
        ac: 10, hp_current: 4, hp_max: 4, attack_bonus: 0,
        morale: 7, loyalty: loyaltyBase, wage_type: 'daily', wage_amount: 1,
      });
      setShowAddRetainer(false);
    }
  }

  async function promoteRetainer(r: DBRetainer) {
    setPromoteLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: newChar, error: insertErr } = await supabase.from('characters').insert({
        owner_id: user.id,
        name: r.name,
        kindred: r.kindred,
        character_class: r.character_class,
        level: r.level,
        xp: 0,
        alignment: 'neutral',
        ability_scores: { str: 10, int: 10, wis: 10, dex: 10, con: 10, cha: 10 },
        hp_current: r.hp_current,
        hp_max: r.hp_max,
        is_active: true,
      }).select().single();
      if (insertErr || !newChar) { setPromoteLoading(false); return; }
      await supabase.from('retainers').update({ is_promoted_to_pc: true }).eq('id', r.id);
      setRetainers(prev => prev.filter(x => x.id !== r.id));
      setPromotingRetainer(null);
      setPromoteSuccess({ name: r.name, charId: (newChar as Record<string, string>).id! });
      setTimeout(() => setPromoteSuccess(null), 6000);
    } finally {
      setPromoteLoading(false);
    }
  }

  function handlePromoteClick(id: string) {
    setExpandedRetainer(id);
    setPromotingRetainer(id);
  }

  async function updateRetainerHP(id: string, delta: number) {
    const r = retainers.find(x => x.id === id);
    if (!r) return;
    const hp = Math.max(0, Math.min(r.hp_max, r.hp_current + delta));
    setRetainers(prev => prev.map(x => x.id === id ? { ...x, hp_current: hp } : x));
    await supabase.from('retainers').update({ hp_current: hp }).eq('id', id);
  }

  async function dismissRetainer(id: string) {
    if (!confirm('Dismiss this retainer?')) return;
    setRetainers(prev => prev.filter(x => x.id !== id));
    await supabase.from('retainers').delete().eq('id', id);
  }

  function handleScoreChange(key: keyof AbilityScores, value: string) {
    const num = Math.max(3, Math.min(18, parseInt(value, 10) || 3));
    setEditScores(prev => ({ ...prev, [key]: num }));
  }

  function saveScores() {
    onUpdate({ abilityScores: editScores });
  }

  const scores = (editMode && !readOnly) ? editScores : character.abilityScores;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Ability Scores */}
      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Ability Scores
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {ABILITY_KEYS.map(({ key, abbr, label }) => {
            const isPrime = primes.includes(abbr);
            const score = scores[key];
            const mod = getAbilityModifier(score);
            const modColor = mod > 0 ? 'var(--color-primary)' : mod < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)';

            return (
              <div
                key={key}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: `2px solid ${isPrime ? 'var(--color-gold)' : 'var(--color-border)'}`,
                  borderRadius: '10px',
                  padding: '0.625rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                  position: 'relative',
                }}
              >
                {isPrime && (
                  <span style={{ position: 'absolute', top: 4, right: 6, fontSize: '0.6rem', color: 'var(--color-gold)', fontWeight: '700' }}>★</span>
                )}
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: '700', letterSpacing: '0.06em' }}>{abbr}</span>
                {(editMode && !readOnly) ? (
                  <input
                    type="number"
                    min={3} max={18}
                    value={editScores[key]}
                    onChange={e => handleScoreChange(key, e.target.value)}
                    onBlur={saveScores}
                    style={{
                      width: '44px', height: '36px', textAlign: 'center', fontSize: '1.25rem', fontWeight: '700',
                      border: '1px solid var(--color-border)', borderRadius: '6px',
                      backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '1.75rem', fontWeight: '700', lineHeight: 1, color: 'var(--color-text)' }}>{score}</span>
                )}
                <span style={{
                  fontSize: '0.75rem', fontWeight: '700', color: modColor,
                  backgroundColor: `color-mix(in srgb, ${modColor} 12%, var(--color-bg))`,
                  borderRadius: '4px', padding: '1px 6px',
                }}>
                  {formatMod(mod)}
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>{label}</span>
              </div>
            );
          })}
        </div>
        {primes.length > 0 && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: 'var(--color-gold)' }}>
            ★ Prime {primes.length > 1 ? 'abilities' : 'ability'}: {primes.join(', ')}
          </p>
        )}
      </section>

      {/* Derived Stats row */}
      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Combat Stats
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <StatPill label="AC" value={ac} color="var(--color-primary)" />
          <StatPill label="Attack" value={formatMod(attackBonus)} color="var(--color-primary)" />
          <StatPill label="Speed" value={`${speed}′`} color="var(--color-text)" />
        </div>
      </section>

      {/* Skills */}
      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Skills
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {skills.map(skill => (
            <div key={skill.name} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem', minHeight: '44px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>{skill.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {7 - skill.target}-in-6 (need {skill.target}+) {skill.isUniversal ? '· Universal' : '· Class'}
                </div>
              </div>
              {skillRolls[skill.name] && (
                <span style={{
                  padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700',
                  backgroundColor: skillRolls[skill.name]!.pass ? '#1a4a1a' : '#4a1a1a',
                  color: skillRolls[skill.name]!.pass ? '#4ade80' : '#f87171',
                }}>
                  {skillRolls[skill.name]!.roll} {skillRolls[skill.name]!.pass ? '✓' : '✗'}
                </span>
              )}
              <button
                onClick={() => rollSkill(skill)}
                style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--color-gold)', fontSize: '1.1rem', padding: '0.25rem 0.5rem', minHeight: '44px', minWidth: '44px' }}
                aria-label={`Roll ${skill.name}`}
              >
                🎲
              </button>
            </div>
          ))}
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
              <div
                key={key}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.625rem 0.875rem',
                  borderBottom: i < SAVE_NAMES.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{label}</span>
                <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {(saves as Record<string, number>)[key]}+
                </span>
              </div>
            ))}
          </div>
          <p style={{ margin: '0.375rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            Roll d20 equal to or above target number to succeed.
          </p>
        </section>
      )}

      {/* Retainers */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Retainers
          </h3>
          <span style={{ fontSize: '0.75rem', color: retainers.length >= maxRetainers ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
            {retainers.length} / {maxRetainers} (CHA)
          </span>
        </div>

        {retainerLoading ? (
          <div style={{ height: '48px', borderRadius: '8px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {retainers.map(r => {
              const expanded = expandedRetainer === r.id;
              const hpPct = r.hp_max > 0 ? Math.max(0, r.hp_current / r.hp_max) : 0;
              const hpColor = hpPct > 0.66 ? 'var(--color-primary)' : hpPct > 0.33 ? 'var(--color-gold)' : 'var(--color-danger)';
              return (
                <div key={r.id} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedRetainer(expanded ? null : r.id)}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: '52px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)' }}>{r.name}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
                          {r.kindred} {r.character_class} L{r.level}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: hpColor, fontWeight: '700' }}>
                          ❤️ {r.hp_current}/{r.hp_max}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{expanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-border)', marginTop: '0.375rem', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${hpPct * 100}%`, backgroundColor: hpColor, borderRadius: '2px' }} />
                    </div>
                  </button>

                  {expanded && (
                    <div style={{ borderTop: '1px solid var(--color-border)', padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Stat row */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                          { label: 'AC', value: r.ac },
                          { label: 'ATK', value: r.attack_bonus >= 0 ? `+${r.attack_bonus}` : r.attack_bonus },
                          { label: 'Morale', value: r.morale },
                          { label: 'Loyalty', value: r.loyalty },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.3rem 0.6rem', textAlign: 'center', minWidth: '52px' }}>
                            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-primary)' }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      {/* HP controls */}
                      {!readOnly && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>HP:</span>
                        {[-1, 1].map(d => (
                          <button key={d} onClick={() => updateRetainerHP(r.id, d)}
                            style={{ padding: '0.25rem 0.625rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: d < 0 ? 'color-mix(in srgb, var(--color-danger) 15%, var(--color-bg))' : 'color-mix(in srgb, var(--color-primary) 15%, var(--color-bg))', color: d < 0 ? 'var(--color-danger)' : 'var(--color-primary)', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', minHeight: '36px', minWidth: '44px' }}>
                            {d > 0 ? '+1' : '−1'}
                          </button>
                        ))}
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: hpColor }}>{r.hp_current} / {r.hp_max}</span>
                      </div>
                      )}
                      {/* Wage */}
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Wage: {r.wage_amount} gp/{r.wage_type === 'daily' ? 'day' : 'XP share'}
                        {' · '}Base Loyalty: {loyaltyBase}
                      </div>
                      {!readOnly && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button onClick={() => handlePromoteClick(r.id)}
                          style={{ padding: '0.375rem 0.875rem', borderRadius: '6px', border: '1px solid var(--color-gold)', backgroundColor: 'color-mix(in srgb, var(--color-gold) 10%, var(--color-bg))', color: 'var(--color-gold)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', minHeight: '36px' }}>
                          ⭐ Promote to Character
                        </button>
                        <button onClick={() => dismissRetainer(r.id)}
                          style={{ padding: '0.375rem 0.875rem', borderRadius: '6px', border: '1px solid var(--color-danger)', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, var(--color-bg))', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', minHeight: '36px' }}>
                          Dismiss retainer
                        </button>
                      </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {retainers.length === 0 && !showAddRetainer && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No retainers. Max {maxRetainers} based on CHA.
              </p>
            )}
          </div>
        )}

        {/* Add retainer form */}
        {!readOnly && showAddRetainer && (
          <div style={{ marginTop: '0.75rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-primary)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <h4 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.875rem', color: 'var(--color-text)' }}>New Retainer</h4>
            <input type="text" placeholder="Name" value={newRetainer.name} onChange={e => setNewRetainer(p => ({ ...p, name: e.target.value }))}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Kindred</label>
                <select value={newRetainer.kindred} onChange={e => setNewRetainer(p => ({ ...p, kindred: e.target.value }))}
                  style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '40px' }}>
                  {['Human', 'Breggle', 'Elf', 'Grimalkin', 'Mossling', 'Woodgrue'].map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Class</label>
                <select value={newRetainer.character_class} onChange={e => setNewRetainer(p => ({ ...p, character_class: e.target.value }))}
                  style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '40px' }}>
                  {['Fighter', 'Thief', 'Cleric', 'Magician', 'Bard', 'Enchanter', 'Friar', 'Hunter', 'Knight'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem' }}>
              {[
                { label: 'Level', key: 'level', min: 1, max: 10 },
                { label: 'AC', key: 'ac', min: 10, max: 20 },
                { label: 'HP', key: 'hp_max', min: 1, max: 100 },
                { label: 'ATK', key: 'attack_bonus', min: -2, max: 10 },
              ].map(({ label, key, min, max }) => (
                <div key={key}>
                  <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.15rem' }}>{label}</label>
                  <input type="number" min={min} max={max}
                    value={newRetainer[key as keyof typeof newRetainer] as number}
                    onChange={e => {
                      const v = parseInt(e.target.value) || min;
                      const upd: Partial<typeof newRetainer> = { [key]: v };
                      if (key === 'hp_max') upd.hp_current = v;
                      setNewRetainer(p => ({ ...p, ...upd }));
                    }}
                    style={{ width: '100%', padding: '0.3rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', textAlign: 'center', minHeight: '40px', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select value={newRetainer.wage_type} onChange={e => setNewRetainer(p => ({ ...p, wage_type: e.target.value as 'daily' | 'share' }))}
                style={{ flex: 1, padding: '0.4rem 0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '40px' }}>
                <option value="daily">Daily wage</option>
                <option value="share">XP share</option>
              </select>
              <input type="number" min={0} value={newRetainer.wage_amount} onChange={e => setNewRetainer(p => ({ ...p, wage_amount: parseFloat(e.target.value) || 0 }))}
                placeholder="gp/day" style={{ width: '80px', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px', textAlign: 'center', boxSizing: 'border-box' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>gp</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setShowAddRetainer(false)}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.875rem', minHeight: '44px' }}>
                Cancel
              </button>
              <button onClick={addRetainer}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', minHeight: '44px' }}>
                Hire
              </button>
            </div>
          </div>
        )}

        {!readOnly && retainers.length < maxRetainers && !showAddRetainer && (
          <button
            onClick={() => setShowAddRetainer(true)}
            style={{ marginTop: '0.625rem', width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px dashed var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.85rem', minHeight: '44px' }}
          >
            + Hire retainer
          </button>
        )}
      </section>

      {/* Promote confirmation modal */}
      {promotingRetainer && (() => {
        const r = retainers.find(x => x.id === promotingRetainer);
        if (!r) return null;
        return (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '1.5rem', maxWidth: '360px', width: '100%' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-gold)', fontSize: '1.1rem' }}>⭐ Promote to Character</h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
                Promote <strong>{r.name}</strong> to a full player character? A new character sheet will be created with their current stats.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setPromotingRetainer(null)} disabled={promoteLoading}
                  style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.9rem', minHeight: '44px' }}>
                  Cancel
                </button>
                <button onClick={() => promoteRetainer(r)} disabled={promoteLoading}
                  style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-gold)', color: '#1a1a00', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '700', minHeight: '44px', opacity: promoteLoading ? 0.7 : 1 }}>
                  {promoteLoading ? 'Promoting…' : 'Promote!'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Promote success toast */}
      {promoteSuccess && (
        <div style={{ position: 'fixed', bottom: '5.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 200, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-gold)', borderRadius: '10px', padding: '0.75rem 1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: 'calc(100vw - 2rem)' }}>
          <span style={{ fontSize: '1.25rem' }}>⭐</span>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-gold)' }}>{promoteSuccess.name} promoted!</div>
            <a href={`/characters/${promoteSuccess.charId}`} style={{ fontSize: '0.8rem', color: 'var(--color-primary)', textDecoration: 'underline' }}>Open character sheet →</a>
          </div>
          <button onClick={() => setPromoteSuccess(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.25rem', padding: 0, lineHeight: 1, minHeight: '24px', minWidth: '24px' }}>×</button>
        </div>
      )}
    </div>
  );
}
