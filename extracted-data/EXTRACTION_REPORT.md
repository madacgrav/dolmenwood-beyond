# Dolmenwood Player's Book — Extraction Report

**PDF:** `Dolmenwood_Player_s_Book.pdf`  
**Total Pages:** 201  
**Raw Text Length:** ~626,000 characters  
**Extraction Date:** 2025  
**Extraction Method:** pdfjs-dist (Node.js), structured manually from raw text  

---

## Summary

| File | Status | Notes |
|------|--------|-------|
| `ability-modifiers.json` | ✅ Complete | Fully extracted from PDF page 24 |
| `class-advancement.json` | ✅ Complete | All 9 classes, levels 1–15 |
| `kindreds.json` | ✅ Complete | All 6 kindreds with traits, skills, restrictions |
| `spell-slots.json` | ✅ Complete | Cleric, Friar, Magician. Enchanter glamours noted. Bard noted as no slots. |
| `skills.json` | ✅ Complete | Universal + Bard, Hunter, Magician, Thief class skills |
| `equipment.json` | ✅ Complete | All weapons, armour, ammunition, adventuring gear |
| `name-tables.json` | ✅ Complete | All 6 kindreds |
| `background-tables.json` | ✅ Complete | All 6 kindreds |

---

## A. Ability Score Modifiers

**Source:** PDF page 24 (printed page 22)  
**Status:** ✅ Complete  

Extracted the ability modifiers table and prime ability XP modifiers table.

| Score | Modifier |
|-------|----------|
| 3 | –3 |
| 4–5 | –2 |
| 6–8 | –1 |
| 9–12 | None (0) |
| 13–15 | +1 |
| 16–17 | +2 |
| 18 | +3 |

---

## B. Class Advancement Tables

**Status:** ✅ Complete — All 9 classes, Levels 1–15  

| Class | PDF Pages | Hit Die | Prime Abilities | Special Column |
|-------|-----------|---------|-----------------|----------------|
| Bard | 60–61 | d6 | CHA, DEX | — |
| Cleric | 62–63 | d6 | WIS | — |
| Enchanter | 64–65 | d6 | CHA, INT | Glamours (count) |
| Fighter | 66–67 | d8 | STR | Combat Talents |
| Friar | 68–69 | d4 | INT, WIS | AC Bonus |
| Hunter | 70–71 | d8 | CON, DEX | — |
| Knight | 72–73 | d8 | CHA, STR | — |
| Magician | 74–75 | d4 | INT | — |
| Thief | 76–77 | d4 | DEX | — |

All tables include: XP threshold, HP die per level, Attack Bonus, Save Targets (Doom/Ray/Hold/Blast/Spell).

Post-Level-10 HP: Fighter, Hunter, Knight gain +2 HP/level; all others +1 HP/level.

---

## C. Kindred Data

**Status:** ✅ Complete — All 6 playable kindreds  

| Kindred | Type | PDF Pages | Size |
|---------|------|-----------|------|
| Breggle | Mortal | 34–37 | Medium |
| Elf | Fairy | 38–41 | Medium |
| Grimalkin | Fairy | 42–45 | Small |
| Human | Mortal | 46–49 | Medium |
| Mossling | Mortal | 50–53 | Small |
| Woodgrue | Demi-fey | 54–57 | Small |

**Included for each kindred:**
- Kindred type, age, lifespan, height, weight
- Native languages
- Full trait list with descriptions
- AC bonuses
- Natural attacks (where applicable)
- Class restrictions (common/rare/forbidden)
- Skill modifiers

**Notable traits:**
- Breggles: Fur (+1 AC), Horns (natural attack, scales by level), Gaze (charm, Level 4+)
- Elves: +2 Magic Resistance, immortal, Listen 5, Search 5, vulnerable to cold iron
- Grimalkins: Shape-shifting (Chester/Wilder), +2 vs Large, Listen 5, immortal, vulnerable to cold iron
- Humans: Decisiveness (win initiative ties), Leadership (+1 retainer loyalty), Spirited (+10% XP)
- Mosslings: Knacks (quasi-magic), Resilience (+4 vs poison/fungus, +2 all saves), Symbiotic Flesh (random trait per level)
- Woodgrues: Moon Sight (darkvision 60'), Mad Revelry (1/day), Compulsive Jubilation, +2 vs Large

---

## D. Spell Slot Tables

**Status:** ✅ Complete for spellcasting classes  

| Class | PDF Pages | Type | Ranks |
|-------|-----------|------|-------|
| Cleric | 62–63 | Holy | 5 |
| Friar | 68–69 | Holy | 5 |
| Magician | 74–75 | Arcane | 6 |
| Enchanter | 64–65 | Glamours | N/A |

**Bard:** No spell slots. Bards use Enchantment and Counter Charm special abilities, not spells.  
**Enchanter:** Uses Glamours (fairy magic, see p94), not traditional spell slots. Number of glamours known per level is in `class-advancement.json` under the `glamours` column.

---

## E. Skill Targets

**Status:** ✅ Complete  
**Source:** Multiple pages  

**Universal Skills** (all characters, default target 6):
- **Listen** (Elf: 5, Grimalkin: 5)
- **Search** (Elf: 5)
- **Survival** (Mossling when foraging: 5)

**Class-Based Skills:**

| Class | PDF Page | Skills |
|-------|----------|--------|
| Bard | 60 | Decipher Document, Legerdemain, Listen, Monster Lore |
| Hunter | 71 | Alertness, Stalking, Survival, Tracking |
| Magician | 75 | Detect Magic |
| Thief | 77 | Climb Wall, Decipher Document, Disarm Mechanism, Legerdemain, Listen, Pick Lock, Search, Stealth |

Thief and Hunter also have an optional **Customising Skills** rule (expertise points for custom skill advancement).

---

## F. Equipment Catalog

**Status:** ✅ Complete  
**Source:** PDF pages 118–120 (printed pages 116–118)  

| Category | Items |
|----------|-------|
| Weapons | 20 items (all with damage, weight, size, qualities) |
| Armour | 8 items (AC values 10–17 + shield +1) |
| Ammunition | 3 types |
| Containers | 12 items |
| Light sources | 6 items |
| Camping/Travel | 7 items |
| Holy items | 4 items |
| Tools | 29 items |
| Clothing | 6 items |

**Coinage:** gp / sp / cp / pp (pellucidium = fairy silver, 5gp each)  
**Weights:** in "coins" (a game unit, approx 10g each)  
**Note:** Items in italics in the original are only available in towns/cities (noted in equipment.json where applicable)

---

## G. Name Tables

**Status:** ✅ Complete — All 6 kindreds  
**Source:** PDF pages 34–56 (various pages per kindred)  

| Kindred | Format | Tables |
|---------|--------|--------|
| Breggle | d20 | Male / Female / Unisex / Surname |
| Elf | d20 | Rustic name / Courtly name (no surname) |
| Grimalkin | d20 | First Name / Surname |
| Human | d20 | Male / Female / Unisex / Surname |
| Mossling | d20 | Male / Female / Unisex / Surname |
| Woodgrue | d20 | Male / Female / Unisex / Surname |

**Note:** Elf names are full hyphenated names (e.g. "Bucket-and-Broth" or "Dream-of-Remembrance"), not first+last.

---

## H. Background Tables

**Status:** ✅ Complete — All 6 kindreds  

| Kindred | Die | Entries |
|---------|-----|---------|
| Breggle | d20 | 20 |
| Elf | d20 | 20 |
| Grimalkin | d20 | 20 |
| Human | d100 | 60 unique backgrounds (with ranges) |
| Mossling | d20 | 20 |
| Woodgrue | d20 | 20 |

---

## Data Not Extracted / Gaps

| Item | Status | Notes |
|------|--------|-------|
| Trinket tables (d100, per kindred) | ⚠️ Not extracted | Large d100 tables for Breggle, Elf, Grimalkin, Human, Mossling, Woodgrue. Found in raw-text.txt but not structured to JSON. |
| Kindred-Class advancement tables | ⚠️ Not extracted | Breggle/Elf/Grimalkin/Mossling/Woodgrue Kindred-Class tables (Appendices, pages 180–189). These are for single-class play. |
| Spell lists | ⚠️ Not extracted | Arcane spell list (pages 80–90), Holy spell list (pages 102–110). Individual spell names and descriptions. |
| Glamours list | ⚠️ Not extracted | Glamour names and descriptions (pages 94–96). |
| Mossling Knacks | ⚠️ Not extracted | Knack list (pages 112–113). |
| Character detail tables | ⚠️ Not extracted | Head/Face/Fur/Speech/Demeanour/Dress/Desires/Beliefs tables per kindred (used for extra character flavour). |
| Noble Houses | ⚠️ Not extracted | Noble houses of Dolmenwood (pages 176–177). |
| Religion tables | ⚠️ Not extracted | Religion details (pages 178–179). |
| Equipment (pages 120–134) | ⚠️ Partial | Horses & Vehicles (p120), Hounds (p122), Lodgings & Food (p124), Beverages (p126), Pipeleaf (p128), Fungi & Herbs (p130), Specialist Services (p132), Retainers (p134) not extracted. |
| Encumbrance rules | ⚠️ Not extracted | Slot-based encumbrance system (p148). |
| Combat rules | ⚠️ Not extracted | Full combat procedures (p166–170). |

---

## Verification Notes

- All class advancement tables verified against raw PDF text extraction
- All save targets verified to match book values
- Spell slot tables verified for Cleric, Friar, and Magician
- Ability modifier lookup table verified (3→-3 through 18→+3)
- Equipment costs, weights, and damage dice verified against raw text
- Hunter prime abilities corrected from initial parse (CON + DEX, not DEX + WIS)

---

## Files

| File | Contents |
|------|----------|
| `raw-text.txt` | Full raw text extraction from all 201 pages |
| `ability-modifiers.json` | Ability score → modifier lookup |
| `class-advancement.json` | 9 class advancement tables (levels 1–15) |
| `kindreds.json` | 6 playable kindreds with all traits |
| `spell-slots.json` | Spell slots for Cleric, Friar, Magician + Enchanter glamours |
| `skills.json` | Universal and class-based skill targets |
| `equipment.json` | Weapons, armour, adventuring gear |
| `name-tables.json` | Name tables for all 6 kindreds |
| `background-tables.json` | Background roll tables for all 6 kindreds |
| `EXTRACTION_REPORT.md` | This report |
