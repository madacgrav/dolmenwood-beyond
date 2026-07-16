# Research Questions

## Context
Focus on the character-sheet inventory and money subsystems in `apps/web`: the Cosmos data models for inventory entries and coins, the server-tier data modules and API routes that read and mutate them, and the React components/hooks that render and edit them. The combat-tab ammunition tracker and the restock flow are relevant existing examples of quantity and spend behavior.

## Questions
1. How is an inventory item's quantity stored, read, and mutated end-to-end — from the `InventoryEntryDoc` shape through the server data module, the API route, the client API wrapper, and the hook/component that renders it? Which callers currently change a quantity, and by what mechanism?

2. How are a character's coins (gp/sp/cp) modeled, displayed, and modified? Trace every distinct path that writes coin values, including the direct coin-purse edit and the bank transaction flow, and note how signed amounts and full-replace vs. delta writes are handled.

3. What does the combat-tab ammunition tracker do, and how does it decrement, increment, and recover a quantity over the course of use (including any "battle mode" and recovery logic)? What state and API calls back it?

4. How does the restock flow work — how does it merge purchased items into existing quantities or create new ones, and how does it deduct cost from coins? What shared helpers does it use?

5. What are the reusable UI patterns for adjusting a numeric value on the inventory tab (e.g. +/- steppers, editable number inputs, delete controls), and which components own item rows, the coin purse, and any modals?

6. What is the shared mutation and authorization path for updating a character document (owner assertion, ETag guarding, the `mutateOwnedCharacterDoc` choke point), and how do the inventory, coins, and bank routes each enforce access?

7. Are there any existing concepts of time-based or event-based consumption/burn-down in the codebase (per-turn, per-rest, or per-session decrement of a resource), and where would such logic live relative to the current inventory and combat systems?
