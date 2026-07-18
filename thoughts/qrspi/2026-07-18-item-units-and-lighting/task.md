# Task — Individual-item counts everywhere + ability to light any light source

Follow-up to the 2026-07-18-inventory-fixes PR (#73). Two tester complaints remain:

1. **Set-based counts persist**: items like torches, ammo, rations, and marbles still
   display as "sets × number of sets" instead of individual items with a true count
   (e.g. one "Torch" row with quantity 3). Restock likewise sells in fixed bundles
   (`unit` multiplier, "×20 per purchase") rather than individual items. The unit
   semantics should be individual items end to end — labels singular, quantity = the
   real per-item count, restock buying N individual items.

2. **Light & Fire can't be started for most items**: the burn tracker exists (light /
   turn passes / extinguish), but the "Light X" button only appears when an inventory
   item's name exactly matches the tiny LIGHT_SOURCES registry (Torch, Oil Flask,
   Candle, Firewood — case-insensitive exact match). Plural names ("Torches"), variant
   names, or anything else never become lightable, so in practice there is no way to
   start usage.

Goal: normalize item naming/count semantics to individual items across restock, catalog,
display, and existing data; make lighting work for the items players actually have.
