# Task — Inventory fixes

Bundle of character-inventory fixes from tester feedback:

- **#64** — Ammunition (arrows/bolts/stones) weighs too much: per-unit weight is multiplied by quantity, but Dolmenwood weighs ammo per bundle/quiver. Restock also inserts ammo rows with `weight_coins: 0`, so weights are inconsistent by entry path — fix both directions.
- **#66** — Inventory numeric inputs should start blank (not `0`) and the weight field should accept decimals (e.g. pipeleaf). Applies to the add-item form and any qty/weight editors; a shared numeric input fixes it everywhere.
- **#67** — Let the user manually reorder inventory items (drag or up/down), persisted per character. Needs a sort-order field and an update API.
- **#68** — Add an editable `notes` field on inventory items (schema + API + UI) for custom/quest/oddity gear.
- **Display bug** — Some items show a count baked into the label ("Torches x 3", "Bag of marbles") while the quantity chip shows 1. Should be a single-item label with the correct number in the count.

Goal: correct ammo encumbrance, better numeric input UX, reorderable list, per-item notes, and clean label/count separation.
