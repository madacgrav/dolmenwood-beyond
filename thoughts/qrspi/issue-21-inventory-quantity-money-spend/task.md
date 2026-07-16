# Task

Give players direct control over consumable/expendable resources on the character sheet. Three related pieces:

1. **GitHub issue #21 — Firewood, torch, and lamp usage tracker.** Track consumable light/heat resources (firewood, torches, lamp oil) and let them be burned down over time. Currently a V2 backlog item in `docs/prd.md` §10.
2. **Edit inventory item quantities.** Let a player change the count of any stackable item (torches, rations, ammunition, etc.) from the inventory UI, not just ammo.
3. **Spend/remove money.** Add an explicit "spend" button for custom amounts. Direct down-editing of the coin purse inputs does not work in the iPhone browser, and even where it works it is too slow for large amounts. A dedicated spend flow (enter amount, deduct) is required — the existing CoinPurse free-edit is not a substitute.

The unifying goal is one consistent "consume / spend down" experience for items and coins.
