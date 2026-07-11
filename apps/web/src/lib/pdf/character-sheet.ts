import { PDFDocument, type PDFForm } from 'pdf-lib';
import { getAbilityModifier } from '@dolmenwood/rules-engine';
import type { FullCharacter } from '@/lib/data/mappers/character';

/**
 * Fills the official Dolmenwood fillable character sheet (109 AcroForm text
 * fields) from a FullCharacter. Fields the app has no data for (Affiliation,
 * Magic Resistance, Exploring, Overland, Pellucidium Pieces) stay blank.
 */

function trySet(form: PDFForm, name: string, value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return;
  try {
    form.getTextField(name).setText(String(value));
  } catch {
    // field absent in this revision of the sheet — skip
  }
}

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export async function fillCharacterSheet(
  blank: ArrayBuffer | Uint8Array,
  c: FullCharacter,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(blank);
  const form = pdf.getForm();
  const set = (name: string, value: string | number | undefined | null) => trySet(form, name, value);

  // Identity
  set('Name', c.name);
  set('Kindred & Class', `${c.kindred} ${c.characterClass}`);
  set('Background', c.background);
  set('Alignment', c.alignment);
  set('Moon Sign', c.moonSign);

  // Abilities
  const a = c.abilityScores;
  const mod = (n: number) => fmt(getAbilityModifier(n));
  set('Strength', a.str);
  set('Strength Modifier', mod(a.str));
  set('Intelligence', a.int);
  set('Intelligence Modifier', mod(a.int));
  set('Wisdom', a.wis);
  set('Wisdom Modifier', mod(a.wis));
  set('Dexterity', a.dex);
  set('Dexterity Modifier', mod(a.dex));
  set('Constitution', a.con);
  set('Constitution Modifier', mod(a.con));
  set('Charisma', a.cha);
  set('Charisma Modifier', mod(a.cha));

  return pdf.save();
}
