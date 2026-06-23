'use client';
import { useMemo } from 'react';
import type { Kindred, CharacterClass } from '@dolmenwood/types';
import { getAllSkills, rollDie } from '@dolmenwood/rules-engine';
import type { SkillEntry } from '@dolmenwood/rules-engine';
import { AnimatedDie } from '@/components/wizard/AnimatedDie';
import { useDiceRoll } from '@/hooks/use-dice-roll';
import { sectionHead } from './shared';

interface Props {
  characterClass: CharacterClass;
  level: number;
  kindred: Kindred;
}

export function SkillsSection({ characterClass, level, kindred }: Props) {
  const skills = useMemo(
    () => getAllSkills(characterClass, level, kindred),
    [characterClass, level, kindred]
  );
  const { results, rollingKeys, faceValues, roll } = useDiceRoll<{ roll: number; pass: boolean }>();

  function rollSkill(skill: SkillEntry) {
    roll(skill.name, () => {
      const r = rollDie(6);
      // Dolmenwood skills: roll d6, succeed if result >= target number
      return { face: r, result: { roll: r, pass: r >= skill.target } };
    });
  }

  return (
    <section>
      <h3 style={sectionHead}>
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
            {rollingKeys[skill.name] ? (
              <AnimatedDie value={faceValues[skill.name] ?? null} sides={6} rolling size="sm" />
            ) : results[skill.name] ? (
              <span style={{
                padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700',
                backgroundColor: results[skill.name]!.pass
                  ? 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))'
                  : 'color-mix(in srgb, var(--color-danger) 12%, var(--color-bg))',
                color: results[skill.name]!.pass ? 'var(--color-primary)' : 'var(--color-danger)',
              }}>
                {results[skill.name]!.roll} {results[skill.name]!.pass ? '✓' : '✗'}
              </span>
            ) : null}
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
  );
}
