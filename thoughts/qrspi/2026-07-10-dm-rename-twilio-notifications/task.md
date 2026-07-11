# Task

Two changes to Dolmenwood Beyond:

1. **Rename the "Referee" role to "Dungeon Master" / "DM"** across the app — user-facing copy, and (where sensible) code identifiers, types, authz helpers, and role values.

2. **Ship real WhatsApp + email scheduling notifications via Twilio.** Notifications should fire on two scheduling events: (a) a new session date is *suggested* (proposal created), and (b) a session date is *agreed upon* (proposal confirmed). Email already fires on confirmation; this adds the "new suggestion" trigger and adds WhatsApp as a real delivery channel (Twilio) alongside email.

Why: "Dungeon Master" is the term the target audience actually uses. Real out-of-band notifications (WhatsApp + email) get players and the DM to respond to scheduling without needing to sit in the app.

This continues the deferred work from `thoughts/qrspi/2026-07-09-email-sms-notifications/` (which shipped the outbox/dispatch pipeline and email channel, stubbing WhatsApp/SMS). See `prior-cycle-notes.md` in this directory for carryover decisions, Twilio/WhatsApp provider research, and what remains out of scope. Design/Plan phases should read it; Research should not.
