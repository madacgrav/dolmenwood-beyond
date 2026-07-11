import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { docToFullCharacter, newCharacterToDoc } from '@/lib/data/mappers/character';
import { fillCharacterSheet } from '@/lib/pdf/character-sheet';
import type { CharacterDoc } from '@/lib/cosmos/types';

function makeDoc(overrides: Partial<CharacterDoc> = {}): CharacterDoc {
  const doc = newCharacterToDoc('owner-1', {
    name: 'Brion Blackthorn',
    kindred: 'Breggle',
    characterClass: 'Knight',
    alignment: 'lawful',
    background: "Sorcerer's Assistant",
    level: 1,
    xp: 1665,
    abilityScores: { str: 15, int: 11, wis: 11, dex: 9, con: 16, cha: 13 },
    hpMax: 9,
  });
  return { ...doc, ...overrides };
}

describe('docToFullCharacter', () => {
  it('defaults missing embedded arrays to []', () => {
    const doc = makeDoc();
    // simulate a pre-phase-3b/4 document with the optional arrays absent
    delete doc.inventory;
    delete doc.spellSlots;
    delete doc.spellPreparations;
    delete doc.spellbook;
    const full = docToFullCharacter(doc);
    expect(full.inventory).toEqual([]);
    expect(full.spellSlots).toEqual([]);
    expect(full.spellPreparations).toEqual([]);
    expect(full.spellbook).toEqual([]);
    expect(full.coinsGp).toBe(0);
  });
});

// The blank official sheet is © Necrotic Gnome and gitignored — the round-trip
// test runs only where a local copy exists (dev machines), and skips in CI.
const BLANK_PATH = path.resolve(__dirname, '../../../public/dolmenwood-sheet.pdf');

describe.skipIf(!existsSync(BLANK_PATH))('fillCharacterSheet', () => {
  it('fills identity, abilities, and derived combat fields', async () => {
    const blank = readFileSync(BLANK_PATH);
    const doc = makeDoc({
      inventory: [
        {
          id: 'i1', itemName: 'Chainmail', itemType: 'armor', quantity: 1,
          weightCoins: 400, notes: null, location: 'equipped',
          weaponDamageDice: null, armorAcBonus: 4, catalogItemId: null,
        },
        {
          id: 'i2', itemName: 'Longsword', itemType: 'weapon', quantity: 1,
          weightCoins: 60, notes: null, location: 'equipped',
          weaponDamageDice: '1d8', armorAcBonus: null, catalogItemId: null,
        },
      ],
    });
    const bytes = await fillCharacterSheet(new Uint8Array(blank), docToFullCharacter(doc));

    const filled = await PDFDocument.load(bytes);
    const form = filled.getForm();
    const val = (name: string) => form.getTextField(name).getText();

    expect(val('Name')).toBe('Brion Blackthorn');
    expect(val('Kindred & Class')).toBe('Breggle Knight');
    expect(val('Strength')).toBe('15');
    expect(val('Strength Modifier')).toBe('+1');
    expect(val('Max Hit Points')).toBe('9');
    // Knight L1 saves and attack from the rules engine
    expect(val('Doom')).toBeTruthy();
    expect(val('Attack')).toMatch(/^\+\d+$/);
    // AC: base 10 + dex mod(9)=0 + armor 4 + breggle kindred bonus
    expect(Number(val('Armour Class'))).toBeGreaterThanOrEqual(14);
    // Speed: 460 coins equipped → 30
    expect(val('Speed')).toBe('30');
  });
});
