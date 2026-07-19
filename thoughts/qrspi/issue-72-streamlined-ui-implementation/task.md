# Task

Implement the streamlined UI redesign for the app's three core surfaces — the
character sheet, the campaign hub, and the app shell/navigation — per the
approved mockups and design decisions in GitHub issue #72. The redesign reduces
visual density via progressive disclosure (collapsible secondary sections,
nothing deleted), gives the character sheet an immersive "personal document"
style and the campaign hub a denser "table dashboard" style from the same token
family, and reclaims the shell header into a real app-bar (back · page title ·
contextual action · notification bell) with a slimmer bottom nav.

The design exploration and approved mockups were produced 2026-07-17
(`thoughts/qrspi/2026-07-17-streamlined-ui-mockups/`). This task is the real
implementation. Note: the app has changed since that exploration — in
particular the Magic tab gained Kindred Abilities / Runes sections and a shared
`NumberField` input primitive was introduced — so the current-state research
for this task must re-verify the surfaces rather than trust the 2026-07-17
snapshot.
