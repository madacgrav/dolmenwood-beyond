# Task

Fix several inventory bugs in the character sheet, centered on ammunition (arrows, quarrels, sling stones) and the restock/purchase flow.

Reported problems:
1. **Ammo weight wrong** — a single ammo stack shows a weight of 20 (the "set" size) instead of a realistic per-unit weight; the bug appears specifically when quantity is 1.
2. **Label carries the "set" string** — items display as e.g. "Quiver of arrows x 20" instead of a clean name like "Arrows" or "Stones".
3. **Restock button does not add items** — submitting the restock sheet fails to insert/merge items into inventory.
4. **No button to initiate purchase** — there is no clear entry point to start a purchase/restock.

Goal: ammo stacks show correct per-unit weight and clean singular labels, and the restock/purchase flow reliably adds items to inventory with a working trigger.
