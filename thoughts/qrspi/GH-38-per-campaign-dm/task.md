# Task

GitHub issue #38: Remove the global account role (`player` / `referee`). Every account is a player; creating a campaign makes the creator that campaign's DM. Sign-up drops the role choice, all `role === 'referee'` gates become per-campaign DM checks (campaign creator/owner), and existing `referee` accounts/campaigns need migrating onto the new model. An account can be DM of one campaign and a player in another.
