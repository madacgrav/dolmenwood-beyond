'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Character, AbilityScores } from '@dolmenwood/types';
import { AnimatedDie } from '@/components/wizard/AnimatedDie';
import {
  getAbilityModifier,
  getAttackBonus,
  getSaveTargets,
  getSpellSlots,
  getHitDie,
  isSpellcaster,
  getXPThresholdForNextLevel,
  getLevelUpChanges,
  rollDie,
  type DieType,
} from '@dolmenwood/rules-engine';
import type { LevelUpChange } from '@dolmenwood/rules-engine';

// ── types ────────────────────────────────────────────────────────────────────

type LevelUpStep = 'check' | 'hp-roll' | 'features' | 'confirm';

// ── helpers ───────────────────────────────────────────────────────────────────

function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

// ── step components ───────────────────────────────────────────────────────────

function CheckStep({
  character,
  onAdvance,
}: {
  character: Character;
  onAdvance: () => void;
}) {
  const newLevel = character.level + 1;
  const threshold = getXPThresholdForNextLevel(character.characterClass, character.level);
  const canAdvance = threshold > 0 && character.xp >= threshold;
  const oldAttack = getAttackBonus(character.characterClass, character.level);
  const newAttack = getAttackBonus(character.characterClass, newLevel);
  const oldSaves = getSaveTargets(character.characterClass, character.level);
  const newSaves = getSaveTargets(character.characterClass, newLevel);
  const hitDieStr = getHitDie(character.characterClass);
  const oldSlots = isSpellcaster(character.characterClass)
    ? getSpellSlots(character.characterClass, character.level)
    : null;
  const newSlots = isSpellcaster(character.characterClass)
    ? getSpellSlots(character.characterClass, newLevel)
    : null;

  const savesChanged =
    oldSaves &&
    newSaves &&
    (newSaves.doom !== oldSaves.doom ||
      newSaves.ray !== oldSaves.ray ||
      newSaves.hold !== oldSaves.hold ||
      newSaves.blast !== oldSaves.blast ||
      newSaves.spell !== oldSaves.spell);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Level badge */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '1.25rem', padding: '1.5rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '12px', border: '1px solid var(--color-border)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Current</div>
          <div style={{
            width: '4rem', height: '4rem', borderRadius: '50%',
            backgroundColor: 'var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.75rem', fontWeight: '700',
            fontFamily: 'var(--font-display), Georgia, serif',
            color: 'var(--color-text)',
          }}>{character.level}</div>
        </div>
        <div style={{ fontSize: '2rem', color: 'var(--color-gold)' }}>⬆</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-gold)', marginBottom: '0.25rem', fontWeight: '600' }}>New</div>
          <div style={{
            width: '4rem', height: '4rem', borderRadius: '50%',
            backgroundColor: 'var(--color-gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.75rem', fontWeight: '700',
            fontFamily: 'var(--font-display), Georgia, serif',
            color: 'white',
            boxShadow: '0 0 16px color-mix(in srgb, var(--color-gold) 50%, transparent)',
          }}>{newLevel}</div>
        </div>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>
        You have <strong style={{ color: 'var(--color-gold)' }}>{character.xp.toLocaleString()} XP</strong>
        {canAdvance
          ? ` — enough to reach level ${newLevel}!`
          : ` — need ${threshold.toLocaleString()} XP to reach level ${newLevel}.`}
      </p>

      {/* Stats comparison */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '10px', border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '0.5rem 0.875rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'grid', gridTemplateColumns: '1fr auto auto',
          gap: '0.5rem', alignItems: 'center',
          fontSize: '0.7rem', fontWeight: '700',
          color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span>Stat</span>
          <span style={{ textAlign: 'right', minWidth: '3rem' }}>Now</span>
          <span style={{ textAlign: 'right', color: 'var(--color-gold)', minWidth: '3rem' }}>Level {newLevel}</span>
        </div>

        {[
          {
            label: 'Attack Bonus',
            old: `+${oldAttack}`,
            next: `+${newAttack}`,
            changed: newAttack !== oldAttack,
          },
          {
            label: 'Hit Dice',
            old: `${character.level}${hitDieStr}`,
            next: `${newLevel}${hitDieStr}`,
            changed: true,
          },
          ...(savesChanged && oldSaves && newSaves
            ? [
                { label: 'Save: Doom', old: String(oldSaves.doom), next: String(newSaves.doom), changed: newSaves.doom !== oldSaves.doom },
                { label: 'Save: Ray', old: String(oldSaves.ray), next: String(newSaves.ray), changed: newSaves.ray !== oldSaves.ray },
                { label: 'Save: Hold', old: String(oldSaves.hold), next: String(newSaves.hold), changed: newSaves.hold !== oldSaves.hold },
                { label: 'Save: Blast', old: String(oldSaves.blast), next: String(newSaves.blast), changed: newSaves.blast !== oldSaves.blast },
                { label: 'Save: Spell', old: String(oldSaves.spell), next: String(newSaves.spell), changed: newSaves.spell !== oldSaves.spell },
              ]
            : []),
          ...(oldSlots && newSlots && !('glamours' in newSlots)
            ? ([1, 2, 3, 4, 5, 6] as const)
                .filter(rank => {
                  const o = (oldSlots as Record<string | number, number>)[rank] ?? 0;
                  const n = (newSlots as Record<string | number, number>)[rank] ?? 0;
                  return o > 0 || n > 0;
                })
                .map(rank => ({
                  label: `Rank ${rank} Spells`,
                  old: String((oldSlots as Record<string | number, number>)[rank] ?? 0),
                  next: String((newSlots as Record<string | number, number>)[rank] ?? 0),
                  changed: ((oldSlots as Record<string | number, number>)[rank] ?? 0) !== ((newSlots as Record<string | number, number>)[rank] ?? 0),
                }))
            : []),
        ].map((row, i) => (
          <div
            key={i}
            style={{
              padding: '0.625rem 0.875rem',
              display: 'grid', gridTemplateColumns: '1fr auto auto',
              gap: '0.5rem', alignItems: 'center',
              borderBottom: '1px solid var(--color-border)',
              fontSize: '0.875rem',
            }}
          >
            <span style={{ color: 'var(--color-text)' }}>{row.label}</span>
            <span style={{ textAlign: 'right', minWidth: '3rem', color: 'var(--color-text-muted)' }}>{row.old}</span>
            <span style={{
              textAlign: 'right', minWidth: '3rem',
              color: row.changed ? 'var(--color-gold)' : 'var(--color-text-muted)',
              fontWeight: row.changed ? '700' : '400',
            }}>
              {row.next}
              {row.changed && ' ✨'}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onAdvance}
        disabled={!canAdvance}
        style={{
          width: '100%', padding: '0.875rem',
          backgroundColor: canAdvance ? 'var(--color-gold)' : 'var(--color-border)',
          color: canAdvance ? 'white' : 'var(--color-text-muted)',
          border: 'none', borderRadius: '10px',
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1rem', fontWeight: '700',
          cursor: canAdvance ? 'pointer' : 'not-allowed',
          letterSpacing: '0.05em',
          minHeight: '44px',
        }}
      >
        Advance! ⬆
      </button>
    </div>
  );
}

function HPRollStep({
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

function FeaturesStep({
  features,
  newLevel,
  onContinue,
}: {
  features: LevelUpChange[];
  newLevel: number;
  onContinue: () => void;
}){
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{
        margin: 0, fontSize: '1rem', fontWeight: '700',
        fontFamily: 'var(--font-display), Georgia, serif',
        color: 'var(--color-text)', textAlign: 'center',
      }}>
        New at Level {newLevel}
      </h3>

      {features.length === 0 ? (
        <div style={{
          padding: '1.5rem', textAlign: 'center',
          backgroundColor: 'var(--color-surface)',
          borderRadius: '10px', border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)', fontSize: '0.9rem',
        }}>
          No new class features at this level.
        </div>
      ) : (
        features.map((f, i) => (
          <div
            key={i}
            style={{
              padding: '1rem',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              borderLeft: '3px solid var(--color-gold)',
            }}
          >
            <div style={{
              fontSize: '0.875rem', fontWeight: '700',
              fontFamily: 'var(--font-display), Georgia, serif',
              color: 'var(--color-text)', marginBottom: '0.25rem',
            }}>
              ✦ {f.name}
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {f.description}
            </div>
          </div>
        ))
      )}

      <button
        onClick={onContinue}
        style={{
          width: '100%', padding: '0.875rem',
          backgroundColor: 'var(--color-primary)',
          color: 'white', border: 'none', borderRadius: '10px',
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1rem', fontWeight: '700', cursor: 'pointer',
          minHeight: '44px',
        }}
      >
        Continue →
      </button>
    </div>
  );
}

function ConfirmStep({
  character,
  hpGain,
  features,
  saving,
  onConfirm,
}: {
  character: Character;
  hpGain: number;
  features: LevelUpChange[];
  saving: boolean;
  onConfirm: () => void;
}){
  const newLevel = character.level + 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h3 style={{
        margin: 0, fontSize: '1rem', fontWeight: '700',
        fontFamily: 'var(--font-display), Georgia, serif',
        color: 'var(--color-text)', textAlign: 'center',
      }}>
        Ready to Level Up!
      </h3>

      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '10px', border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        {[
          { label: 'Level', value: `${character.level} → ${newLevel}` },
          { label: 'Max HP', value: `${character.hpMax} → ${character.hpMax + hpGain} (+${hpGain})` },
          { label: 'Current HP', value: `${character.hpCurrent} → ${character.hpCurrent + hpGain} (+${hpGain})` },
          ...(features.length > 0
            ? [{ label: 'New Features', value: features.map(f => f.name).join(', ') }]
            : []),
        ].map((row, i, arr) => (
          <div
            key={i}
            style={{
              padding: '0.75rem 0.875rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>{row.label}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)', textAlign: 'right' }}>{row.value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onConfirm}
        disabled={saving}
        style={{
          width: '100%', padding: '0.875rem',
          backgroundColor: saving ? 'var(--color-border)' : 'var(--color-gold)',
          color: saving ? 'var(--color-text-muted)' : 'white',
          border: 'none', borderRadius: '10px',
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1rem', fontWeight: '700',
          cursor: saving ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
          minHeight: '44px',
        }}
      >
        {saving ? 'Saving…' : '🏆 Complete Level Up'}
      </button>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

const STEPS: LevelUpStep[] = ['check', 'hp-roll', 'features', 'confirm'];
const STEP_LABELS: Record<LevelUpStep, string> = {
  'check': 'Overview',
  'hp-roll': 'Hit Points',
  'features': 'Features',
  'confirm': 'Confirm',
};

export default function LevelUpPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<LevelUpStep>('check');
  const [hpGain, setHpGain] = useState(0);
  const [hpRoll, setHpRoll] = useState(0);
  const [saving, setSaving] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const fetchCharacter = useCallback(async () => {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      router.push('/characters');
      return;
    }

    // Ownership guard: only the character owner may access the level-up wizard.
    const { data: { user } } = await supabase.auth.getUser();
    const row = data as Record<string, unknown>;
    if (!user || row.owner_id !== user.id) {
      router.push(`/characters/${id}`);
      return;
    }

    const mapped: Character = {
      id: row.id as string,
      ownerId: row.owner_id as string,
      name: row.name as string,
      sex: row.sex as string | undefined,
      age: row.age as string | undefined,
      height: row.height as string | undefined,
      weight: row.weight as string | undefined,
      kindred: row.kindred as Character['kindred'],
      characterClass: row.character_class as Character['characterClass'],
      alignment: row.alignment as Character['alignment'],
      moonSign: row.moon_sign as string | undefined,
      background: row.background as string | undefined,
      level: row.level as number,
      xp: row.xp as number,
      abilityScores: row.ability_scores as AbilityScores,
      hpCurrent: row.hp_current as number,
      hpMax: row.hp_max as number,
      portraitUrl: row.portrait_url as string | undefined,
      isActive: row.is_active as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
    setCharacter(mapped);
    setLoading(false);
  }, [id, supabase, router]);

  useEffect(() => { fetchCharacter(); }, [fetchCharacter]);

  async function handleConfirm() {
    if (!character) return;
    setSaving(true);
    setConfirmError('');
    const newLevel = character.level + 1;
    const threshold = getXPThresholdForNextLevel(character.characterClass, character.level);

    try {
      const { error } = await supabase.rpc('level_up', {
        p_character_id:  id,
        p_new_level:     newLevel,
        p_hp_gain:       hpGain,
        p_hp_roll:       hpRoll,
        p_changes:       features.map(f => ({ field: f.name, oldValue: '', newValue: f.description })),
        p_xp_threshold:  threshold,
      });

      if (error) {
        setConfirmError(error.message);
        return;
      }

      setCelebrated(true);
      setTimeout(() => {
        router.push(`/characters/${id}`);
      }, 1800);
    } finally {
      setSaving(false);
    }
  }

  const stepIndex = STEPS.indexOf(step);
  const newLevel = character ? character.level + 1 : 0;
  const features = character ? getLevelUpChanges(character.characterClass, character.level, newLevel) : [];

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading…
      </div>
    );
  }

  if (!character) return null;

  if (celebrated) {
    return (
      <div style={{
        minHeight: '100dvh', backgroundColor: 'var(--color-bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '1rem', padding: '2rem',
      }}>
        <div style={{
          fontSize: '5rem',
          animation: 'celebrationBounce 0.6s ease-out forwards',
        }}>
          🏆
        </div>
        <h2 style={{
          margin: 0, textAlign: 'center',
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1.5rem', fontWeight: '700',
          color: 'var(--color-gold)',
        }}>
          Level {newLevel} Achieved!
        </h2>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', textAlign: 'center' }}>
          {character.name} has advanced. Returning to character sheet…
        </p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0.875rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <button
          onClick={() => router.push(`/characters/${id}`)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', fontSize: '1.1rem',
            padding: '0.25rem 0.5rem', borderRadius: '6px',
            minHeight: '44px',
          }}
          aria-label="Back to character sheet"
        >
          ← Back
        </button>
        <h1 style={{
          margin: 0, flex: 1,
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1.1rem', fontWeight: '700',
          color: 'var(--color-gold)',
        }}>
          ⬆ Level Up — {character.name}
        </h1>
      </div>

      {/* Progress bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}>
        {STEPS.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1, padding: '0.5rem 0.25rem', textAlign: 'center',
              fontSize: '0.7rem', fontWeight: i <= stepIndex ? '700' : '400',
              color: i === stepIndex
                ? 'var(--color-gold)'
                : i < stepIndex
                  ? 'var(--color-primary)'
                  : 'var(--color-text-muted)',
              borderBottom: i === stepIndex ? '2px solid var(--color-gold)' : '2px solid transparent',
            }}
          >
            {i < stepIndex ? '✓ ' : ''}{STEP_LABELS[s]}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{ padding: '1rem', maxWidth: '540px', margin: '0 auto' }}>
        {step === 'check' && (
          <CheckStep
            character={character}
            onAdvance={() => setStep('hp-roll')}
          />
        )}
        {step === 'hp-roll' && (
          <HPRollStep
            character={character}
            onHpGain={setHpGain}
            onContinue={(gain, rawRoll) => {
              setHpGain(gain);
              setHpRoll(rawRoll);
              setStep('features');
            }}
          />
        )}
        {step === 'features' && (
          <FeaturesStep
            features={features}
            newLevel={newLevel}
            onContinue={() => setStep('confirm')}
          />
        )}
        {step === 'confirm' && (
          <>
            {confirmError && (
              <div style={{
                margin: '0 0 0.75rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, var(--color-bg))',
                borderRadius: '8px',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
                fontSize: '0.875rem',
              }}>
                ⚠️ {confirmError}
              </div>
            )}
            <ConfirmStep
              character={character}
              hpGain={hpGain}
              features={features}
              saving={saving}
              onConfirm={handleConfirm}
            />
          </>
        )}
      </div>
    </div>
  );
}
