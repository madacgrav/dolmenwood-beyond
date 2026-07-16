# Task

A character's Armor Class displays inconsistently across the app — one screen shows one value, another screen shows a different value for the same character. Make AC calculation consistent everywhere, correctly accounting for base AC, equipment (equipped armor/shield), and skill/ability modifiers.

## Why
AC is currently derived independently at every display site (character sheet Stats tab, Combat tab, roster card, creation wizard, PDF export), each assembling its own inputs. Some sites hardcode the armor bonus to 0 while others fetch equipped inventory, so the same character reads differently depending on where you look. The fix should collapse these onto one source of truth.
