import { describe, it, expect } from 'vitest';
import { deriveCharacterAC, type ACItem } from '../character-ac';

const base = { abilityScores: { dex: 10 }, kindred: 'Human', characterClass: 'Fighter', level: 1 };
const eq = (o: Omit<ACItem, 'location'>): ACItem => ({ location: 'equipped', ...o });

describe('deriveCharacterAC', () => {
  it('base 10 with no items', () => {
    expect(deriveCharacterAC(base, []).total).toBe(10);
  });
  it('Friar L1 unarmoured gets +2 class bonus → 12', () => {
    expect(deriveCharacterAC({ ...base, characterClass: 'Friar' }, []).total).toBe(12);
  });
  it('Friar in medium/heavy armour loses class bonus', () => {
    const items = [eq({ armorAcBonus: 4, armorBulk: 'heavy' })];
    const b = deriveCharacterAC({ ...base, characterClass: 'Friar' }, items);
    expect(b.classBonus).toBe(0);
    expect(b.total).toBe(14); // 10 + 4 armour
  });
  it('Breggle keeps +1 in light armour', () => {
    const items = [eq({ armorAcBonus: 2, armorBulk: 'light' })];
    const b = deriveCharacterAC({ ...base, kindred: 'Breggle' }, items);
    expect(b.kindredBonus).toBe(1);
    expect(b.total).toBe(13); // 10 + 2 + 1
  });
  it('Breggle loses +1 in plate', () => {
    const items = [eq({ armorAcBonus: 6, armorBulk: 'heavy' })];
    expect(deriveCharacterAC({ ...base, kindred: 'Breggle' }, items).kindredBonus).toBe(0);
  });
  it('shield splits from armour and stacks', () => {
    const items = [
      eq({ armorAcBonus: 2, armorBulk: 'light' }),
      eq({ armorAcBonus: 1, isShield: true }),
    ];
    const b = deriveCharacterAC(base, items);
    expect(b.armorBonus).toBe(2);
    expect(b.shieldBonus).toBe(1);
    expect(b.total).toBe(13);
  });
  it('null armorBulk falls open (Breggle keeps bonus)', () => {
    const items = [eq({ armorAcBonus: 2, armorBulk: null })];
    expect(deriveCharacterAC({ ...base, kindred: 'Breggle' }, items).kindredBonus).toBe(1);
  });
  it('stowed items ignored', () => {
    const items: ACItem[] = [{ location: 'stowed', armorAcBonus: 5 }];
    expect(deriveCharacterAC(base, items).armorBonus).toBe(0);
  });
});
