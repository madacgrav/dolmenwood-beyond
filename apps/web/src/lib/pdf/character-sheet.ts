import { PDFDocument, type PDFForm } from 'pdf-lib';
import {
  getAbilityModifier,
  getSaveTargets,
  getAttackBonus,
  calculateAC,
  getKindredACBonus,
  calculateSpeed,
  getAllSkills,
  getPrimeAbilities,
  getXPModifier,
  getKindredXPBonus,
  getXPThresholdForNextLevel,
} from '@dolmenwood/rules-engine';
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

  // HP
  set('Max Hit Points', c.hpMax);
  set('Hit Points', c.hpCurrent);

  // Save targets ('Magic Resistance' isn't modeled — blank)
  const saves = getSaveTargets(c.characterClass, c.level);
  if (saves) {
    set('Doom', saves.doom);
    set('Ray', saves.ray);
    set('Hold', saves.hold);
    set('Blast', saves.blast);
    set('Spell', saves.spell);
  }

  // AC — same inputs as CombatTab (shield folds into equipped armorAcBonus)
  const armorBonus = c.inventory
    .filter((e) => e.location === 'equipped')
    .reduce((s, e) => s + (e.armorAcBonus ?? 0), 0);
  set(
    'Armour Class',
    calculateAC({
      dexScore: a.dex,
      armorBonus,
      kindredACBonus: getKindredACBonus(c.kindred),
      classACBonus: 0,
      shieldBonus: 0,
    }),
  );

  // Attack
  set('Attack', fmt(getAttackBonus(c.characterClass, c.level)));

  // Movement — same weight rule as the Inventory tab's WeightBar (tiny items
  // are weightless; campaign coin-weight option not applied). Exploring/
  // Overland aren't modeled — blank.
  const itemWeight = c.inventory
    .filter((e) => e.location !== 'tiny')
    .reduce((s, e) => s + e.weightCoins * e.quantity, 0);
  set('Speed', calculateSpeed(itemWeight));

  // Skills — universal (Listen/Search/Survival) have same-named fields;
  // class skills go to the Extra Skill slots
  const skills = getAllSkills(c.characterClass, c.level, c.kindred);
  for (const s of skills.filter((s) => s.isUniversal)) set(s.name, `${s.target}+`);
  skills
    .filter((s) => !s.isUniversal)
    .slice(0, 6)
    .forEach((s, i) => set(`Extra Skill ${i + 1}`, `${s.name} ${s.target}+`));

  // Languages — stored extras only (base/kindred languages aren't modeled)
  const langs = c.extraLanguages ?? [];
  const half = Math.ceil(langs.length / 2);
  set('Languages 1', langs.slice(0, half).join(', '));
  set('Languages 2', langs.slice(half).join(', '));

  // Progression
  set('Level', c.level);
  set('XP', c.xp);
  set('XP For Next Level', getXPThresholdForNextLevel(c.characterClass, c.level));
  const primeScores = getPrimeAbilities(c.characterClass).map(
    (p) => a[p.toLowerCase() as keyof typeof a] ?? 0,
  );
  const xpMod = getXPModifier(primeScores) + getKindredXPBonus(c.kindred);
  set('XP Modifier', `${xpMod >= 0 ? '+' : ''}${xpMod}%`);

  return pdf.save();
}
