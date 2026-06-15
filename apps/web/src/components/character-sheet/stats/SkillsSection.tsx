'use client';
import { useState, useMemo } from 'react';
import type { Kindred, CharacterClass } from '@dolmenwood/types';
import { getAllSkills, rollDie } from '@dolmenwood/rules-engine';
import type { SkillEntry } from '@dolmenwood/rules-engine';
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
  const [skillRolls, setSkillRolls] = useState<Record<string, { roll: number; pass: boolean } | undefined>>({});

  function rollSkill(skill: SkillEntry) {
    const roll = rollDie(6);
    // Dolmenwood skills: roll d6, succeed if result >= target number
    setSkillRolls(prev => ({ ...prev, [skill.name]: { roll, pass: roll >= skill.target } }));
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
  );
}
