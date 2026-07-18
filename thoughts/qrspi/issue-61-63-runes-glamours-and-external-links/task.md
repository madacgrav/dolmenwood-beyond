# Task

Two bundled tester-feedback enhancements:

- **#61 — Magic tab: runes and glamours.** The Magic section only handles spells today. Add Dolmenwood runes (Breggle/knight-style rune magic) and glamours (fairy magic) alongside spells: a known list plus add form for each, shown for the correct classes/kindreds, reusing the existing spell section components where possible. A partial hook already exists — `getSpellSlots` can return `{ glamours: n }` and the Enchanter glamour path is wired end to end; runes have no representation at all.

- **#63 — Link out to the Dolmenwood wiki.** Add a discoverable external reference link to the Dolmenwood wiki (https://www.dolmenwood.necroticgnome.com/rules/doku.php?id=wiki:welcome). Ignore the chatbot link request from the issue. Short-term cheap version ahead of the long-term in-app compendium (#22).

Why: tester feedback. Both are low-risk UX additions that extend existing patterns (magic sections; external `<a>` links).
