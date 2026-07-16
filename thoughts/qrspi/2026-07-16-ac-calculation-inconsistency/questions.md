# Research Questions

## Context
Focus on the rules-engine package's Armor Class formula (`packages/rules-engine/src/ac.ts`) and every place in the web app that renders an AC value: the character-sheet tabs, the roster/party card, the creation wizard, and the PDF export. Pay attention to how each site sources its inputs (DEX modifier, equipped armor, kindred/class bonuses, shield) and where equipped-inventory armor is summed.

## Questions
1. What is the exact signature and formula of `calculateAC` in `packages/rules-engine/src/ac.ts`, and what does each input term (`dexScore`, `armorBonus`, `kindredACBonus`, `classACBonus`, `shieldBonus`) represent and default to?
2. At each site that calls `calculateAC` (Combat tab, Stats tab, roster `CharacterCard`, wizard `Step9AC`, PDF export), how is each input term sourced, and which terms are hardcoded versus derived?
3. How is "equipped armor bonus" computed across the codebase — trace `fetchEquippedArmorBonus` (`lib/api/inventory.ts`), the `armorByCharacter` map in `listCharactersWithArmor` (`lib/data/characters.ts`), and the inline reduce in the PDF exporter — and how do their inputs and results differ?
4. How does the `InventoryItem` model represent equipped items and `armorAcBonus`, where do those values originate (equipment catalog), and how is a shield represented relative to armor?
5. How is the kindred AC bonus resolved via `getKindredACBonus` and the `KindredData.acBonus` string, and are there class- or skill/ability-derived AC modifiers defined anywhere that no current call site feeds into `calculateAC`?
6. What data-loading pattern does each display site follow (async client fetch vs. server-tier batch fetch vs. stored value), and what character/inventory data is available at each site at render time?
7. How do the non-derived AC displays (`RetainerCard`, `MountCard` reading a stored `ac` field) fit in, and are there tests anywhere covering AC calculation or its display?
