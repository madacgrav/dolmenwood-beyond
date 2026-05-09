---
title: "Dev Log #5 — Six Features in a Week, and the Code Review That Found a Mechanic Backwards"
date: 2026-05-09
author: Adam Graves
status: draft
tags: [dolmenwood, rpg, nextjs, supabase, postgresql, github-copilot, devlog, code-review, security]
excerpt: >
  Six features shipped across three pull requests since the last post. Then four specialized
  AI review agents read all of it and found that the core skill check mechanic had been
  implemented backwards the entire time.
---

Six features. Three pull requests. One week. Then a code review that found the core skill check mechanic had been implemented backwards since day one.

That's what this post covers.

---

## XP Flows to the Party

The first piece of work after Dev Log #4 was making the XP system real. Previously, characters had XP fields but nothing wrote to them. Now referees can award XP to any character in their campaign, and the math actually runs.

The XP modifier chain in Dolmenwood is layered. Every character has prime ability scores determined by class — the stats that matter most for that archetype. If those scores are high enough, the character gains a bonus to all XP they receive. Humans with the Spirited trait get an additional +10%. The award system had to apply all of that correctly.

The implementation lives as a `SECURITY DEFINER` RPC on the database — `award_xp` — so the function runs with elevated privileges that bypass row-level security, but only after explicitly verifying the caller is the campaign referee. The application layer never has direct write access to XP values. Referees only.

When a character crosses an XP threshold, a level-up event is logged. That log becomes a timestamp record: when the character leveled, what level they reached, what their XP total was at the time. It's small, but it turns character progression into something you can look back on.

---

## The Character Sheet Gets Hands

With the XP system working, the next batch of features was about making the character sheet interactive. Three things shipped together.

**Combat dice rollers.** Attacking in Dolmenwood requires rolling to hit and then rolling damage. Previously the character sheet showed attack bonus and damage die as static text — you looked at them and went to roll physical dice. Now there are tap targets on the CombatTab that roll inline. To-hit shows the d20 result plus your attack bonus and compares it against a target AC. Damage shows the appropriate die (d4, d6, d8, whatever the weapon uses) plus any strength modifier. The rolls animate briefly and the result persists until you tap again.

**Inventory catalog.** Dolmenwood's equipment list is long. The inventory management tab now includes a searchable catalog of all gear from the player's book: weapons, armor, adventuring equipment, provisions. Filter by category, search by name, tap to add. Encumbrance updates immediately when items are added, and that feeds back into the speed calculation on the character sheet.

**Retainer management.** Retainers are hirelings — NPCs that travel with the party and take a share of treasure. Each retainer gets a card with their name, class, level, wage per session, and treasure share percentage. The interface lets referees and players track which retainers are active and what they cost. Retainer loyalty is a stat in Dolmenwood, and it's displayed alongside the other numbers.

These three features landed together in `feature/next3` because they were all about the same thing: making the character sheet a tool you use during play, not just a reference you look at before play.

---

## The Big Feature Wave

The next pull request — `feature/next4` — was larger.

**Spell slot tracking.** Spellcasting characters needed a way to track which slots they'd used each session. The MagicTab now shows slot circles by rank: filled circles for slots used, empty circles for slots remaining. Tap a circle to cast or recover. Below the circles are two areas: the spell book (all spells the character knows, added from a class-filtered dropdown) and today's prepared spells (for classes that prepare spells day-by-day). The spell preparation system respects class rules — Magicians and Enchanters work differently from Clerics.

Enchanters were an interesting case. They don't use spell slots at all — they use *glamours*, a separate pool that scales with level. The system handles both patterns. Bards are partial casters with ranks 1–3 and a slower progression. All of that comes from data in `spell-slots.json` and `spells.json` in the rules engine package, not from the application code.

**Skills d6 roller.** Thieves and Hunters in Dolmenwood have class skills resolved by rolling a d6. The StatsTab now shows these skills with their targets and a die icon. Tap it, see the roll, see the outcome. A simple thing, but satisfying to get right (more on this in the next section).

**Campaign party dashboard.** Players joining a referee's campaign needed to see who else was there. The OverviewTab now shows a party view: each character's name, class, level, HP, and AC. This required solving an RLS problem — normally a player can only read their own character rows. The party view is implemented as a `SECURITY DEFINER` RPC called `get_campaign_party_data` that verifies the caller is a campaign member, then returns the party's character data. Direct queries from the client side would have returned nothing and failed silently.

**Super-admin dashboard.** A server-rendered page at `/admin` shows account totals, character counts, and campaign statistics. Access is gated by an `is_admin` flag on the accounts table, enforced by an RLS-backed RPC. The page shows the full user list, all characters with their classes and levels, and all campaigns with member counts. Useful for understanding whether the app is actually being used.

---

## The Review That Found the Backwards Mechanic

After `feature/next4` merged, I ran four specialized review agents against the full diff: Security Reviewer, Developer Architect Reviewer, QA Reviewer, and DevOps Reviewer. They came back with 24 findings across critical, high, medium, and low categories. All of them were addressed before merging.

The most embarrassing one was QA finding B1.

Dolmenwood uses a d6 for skill checks. To pick a lock with a target of 5, you roll one die and need a 5 or higher. That's a 2-in-6 chance. Simple.

The implementation had it backwards: `roll <= target`. Rolling under 5 would pass, which means rolling 1, 2, 3, or 4 — a 4-in-6 chance. The Thief would have been succeeding at roughly twice the correct rate, and failing on the high rolls that should have been successes.

The label was also wrong. A target of 5 should display as a "2-in-6" chance (`7 - target`). It was displaying "5-in-6".

The fix was a one-line change: `roll >= skill.target`. But the fact that it was wrong is notable. The game mechanic was inverted and didn't have a test. Once the QA agent flagged it and a test was written, the inversion was obvious. Until then it was invisible.

The security findings were more structurally interesting. The `is_admin` column had a row-level security policy for updates with `USING (auth.uid() = id)` but no explicit `WITH CHECK` clause. In PostgreSQL, when `WITH CHECK` is omitted from an UPDATE policy, it defaults to the `USING` expression. The `USING` expression only checks that the row belongs to the current user — it says nothing about what values are being written. Any authenticated user could have sent a `PATCH` to their own accounts row with `is_admin: true` and the database would have accepted it.

The fix adds an explicit `WITH CHECK` that reads the current `is_admin` value from the database and requires it to be unchanged unless the caller already has admin rights.

The `SUPABASE_DB_URL` connection string was stored as a GitHub Actions variable (plaintext) rather than a secret (encrypted). That's now corrected in the workflow.

The Bard class was missing from `spell-slots.json` entirely, so the spell system had nowhere to look up Bard progressions. Cleric had rank-6 spells in `spells.json` despite the slot data capping Cleric at rank 5. Both data files were corrected to match each other.

The party dashboard had a potential race condition: if two browser tabs loaded the same character simultaneously and both tried to insert the initial `spell_slots` row, one would fail with a `23505` duplicate key violation. The original code swallowed that error silently and left the tab with an empty slot list. The fix detects the `23505` code and falls back to fetching the existing rows.

24 findings. All addressed. 132 tests passing after.

---

## What's Next

The app is functionally complete for basic play sessions. The gaps that remain are around polish and edge cases rather than missing features.

The most useful next additions would probably be around the campaign experience — session notes, XP history views, and referee tools for managing the party during play. The combat tracker is a common pain point for Dolmenwood groups given the initiative and morale systems.

The code is at [github.com/madacgrav/dolmenwood-beyond](https://github.com/madacgrav/dolmenwood-beyond) if you want to read any of it.
