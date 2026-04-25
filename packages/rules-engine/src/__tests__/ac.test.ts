import { describe, it, expect } from 'vitest';
import { calculateAC } from '../ac';

describe('AC Calculation', () => {
  it('base AC with no bonuses is 10', () => {
    expect(calculateAC({ dexScore: 10, armorBonus: 0, kindredACBonus: 0, classACBonus: 0, shieldBonus: 0 })).toBe(10);
  });
  it('DEX 16 adds +2', () => {
    expect(calculateAC({ dexScore: 16, armorBonus: 0, kindredACBonus: 0, classACBonus: 0, shieldBonus: 0 })).toBe(12);
  });
  it('leather armour (+2) + DEX 14 (+1) = AC 13', () => {
    expect(calculateAC({ dexScore: 14, armorBonus: 2, kindredACBonus: 0, classACBonus: 0, shieldBonus: 0 })).toBe(13);
  });
  it('shield adds bonus', () => {
    expect(calculateAC({ dexScore: 10, armorBonus: 0, kindredACBonus: 0, classACBonus: 0, shieldBonus: 1 })).toBe(11);
  });
  it('all bonuses stack', () => {
    expect(calculateAC({ dexScore: 16, armorBonus: 4, kindredACBonus: 1, classACBonus: 1, shieldBonus: 1 })).toBe(19);
  });
});
