import { describe, it, expect } from 'vitest';
import { getUniversalSkills, getClassSkills, getAllSkills } from '../skills';

describe('Skills', () => {
  it('universal skills include Listen, Search, Survival', () => {
    const skills = getUniversalSkills();
    const names = skills.map((s) => s.name);
    expect(names).toContain('Listen');
    expect(names).toContain('Search');
    expect(names).toContain('Survival');
  });

  it('universal skills all have isUniversal=true', () => {
    getUniversalSkills().forEach((s) => expect(s.isUniversal).toBe(true));
  });

  it('Thief level 1 has class skills', () => {
    const skills = getClassSkills('Thief', 1);
    expect(skills.length).toBeGreaterThan(0);
    const names = skills.map((s) => s.name);
    expect(names).toContain('Pick Lock');
    expect(names).toContain('Stealth');
  });

  it('Thief class skills have isUniversal=false', () => {
    getClassSkills('Thief', 1).forEach((s) => expect(s.isUniversal).toBe(false));
  });

  it('Fighter has no class-specific skills', () => {
    expect(getClassSkills('Fighter', 1)).toHaveLength(0);
  });

  it('getAllSkills returns both universal and class skills for Bard', () => {
    const all = getAllSkills('Bard', 1);
    const names = all.map((s) => s.name);
    expect(names).toContain('Listen');
    expect(names).toContain('Monster Lore');
  });

  it('skill targets improve at higher levels for Thief', () => {
    const level1 = getClassSkills('Thief', 1).find((s) => s.name === 'Stealth')!;
    const level15 = getClassSkills('Thief', 15).find((s) => s.name === 'Stealth')!;
    expect(level15.target).toBeLessThan(level1.target);
  });
});
