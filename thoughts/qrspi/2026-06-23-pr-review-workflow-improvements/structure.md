# Structure Outline

## Approach
Restructure the `.github/` review system in five vertical slices: first remove the
dead weight (auto-implement, blogger), then re-engine the shared review path to
Claude + structured findings, then add real synthesis, then change the CI trigger,
then add a local pre-PR command that reuses the same personas + findings schema.
Each phase is independently valuable and verifiable on a scratch PR. The findings
**schema** and the **persona files** are the shared contracts across CI and local.

---

## Phase 1: Remove auto-implement & blogger (cleanup)
Delete the fragile auto-commit path and the blogger reviewer before touching the
core mechanism, shrinking the surface the later phases must reason about.

**Files**: delete `.github/workflows/implement-suggestions.yml`; edit
`.github/workflows/pr-review.yml` (remove `blogger` job `:66-141`, remove its row
from the `consolidate` table `:166,189`, remove `auto-implement` label creation
`:149-157` and the label instructions in the summary `:191-195`).
`blogger-review.agent.md` stays on disk, unwired.

**Key changes**:
- `pr-review.yml` reviewer jobs drop from 5 → 4; `consolidate.needs` drops `blogger`.
- No workflow retains `permissions: contents: write` for review feedback.

**Verify**: `actionlint .github/workflows/*.yml` passes; on a scratch PR, no blogger
comment appears and adding an `auto-implement` label triggers nothing.

---

## Phase 2: Claude engine + structured findings + truncation fix
Re-engine the shared composite action to call Claude and emit a structured findings
artifact per reviewer (plus its rendered comment). Update all 4 personas to the
output schema. This is the core mechanism, proven end-to-end via the existing jobs.

**Files**: `.github/actions/agent-review/action.yml` (rewrite the "Run review",
diff-gather, and post steps); all 4 wired personas
(`developer-architect-review`, `devops-review`, `security-reviewer`, `qa-reviewer`)
— append the findings schema + JSON output instruction; add repo secret
`ANTHROPIC_API_KEY`.

**Key changes** (findings contract — the shared type):
```
Finding {
  severity: "critical" | "warning" | "suggestion"
  file: string
  line: number | null
  title: string          // one-line
  detail: string         // why it matters
  suggestion?: string    // concrete fix, optional
}
ReviewOutput { agent: string; summary: string; findings: Finding[] }
```
- Composite-action call: Anthropic Messages API (`curl` to `/v1/messages`),
  `model: claude-sonnet-4-6`, system = persona file, JSON output enforced
  (tool-use / prefill); replaces `actions/ai-inference@v1` (`action.yml:64-81`).
- Diff gather: raise byte cap well above 12000 and, when exceeded, emit per-file
  diffs instead of cutting mid-line (`action.yml:32-37`).
- New step: write `ReviewOutput` to `findings-<agent>.json`, `upload-artifact`;
  still post a rendered markdown comment for traceability.
- `sleep` stagger input retained for now (revisit if Claude retry handles it).

**Verify**: scratch PR → each of the 4 jobs runs on Claude, uploads a
schema-valid `findings-<agent>.json` artifact (validate with `jq`), and posts a
comment. No `gpt-4o`/`ai-inference` strings remain (`grep -r` is clean).

---

## Phase 3: Synthesis job
Replace the status-only `consolidate` with a synthesis step that ingests all
findings artifacts, dedupes overlaps (e.g. Bicep/secrets from DevOps + Security),
ranks by severity, and posts ONE consolidated review comment. Logic lives in a
reusable script so the local command can share it.

**Files**: new `.github/scripts/synthesize-findings.mjs`; edit `pr-review.yml`
`consolidate` job (download artifacts → run script → post comment; keep the
per-agent status table).

**Key changes**:
- `synthesize(reports: ReviewOutput[]): { markdown: string; merged: Finding[] }`
  — dedupe key `file:line:normalizedTitle`, severity order critical>warning>suggestion,
  attribute merged findings to the agents that raised them.
- `consolidate` now `download-artifact` (all `findings-*`) → `node synthesize-findings.mjs`
  → `gh pr comment --body-file`.

**Verify**: scratch PR where two reviewers flag the same issue → consolidated
comment lists it once, severity-ordered, with both agents attributed; status table
still present. Unit-check the script: `node synthesize-findings.mjs fixtures/*.json`.

---

## Phase 4: CI trigger change (opened/reopened + on-demand)
Stop auto-reviewing on every push; review on PR open/reopen and on an explicit
on-demand request, to control Claude cost.

**Files**: `pr-review.yml` (`on:` block `:3-6`, add `issue_comment`; add a guard
job/step).

**Key changes**:
- `on.pull_request.types` → `[opened, reopened]` (drop `synchronize`); add
  `on.issue_comment.types: [created]`.
- Gate the reviewer jobs on `github.event_name == 'pull_request' || (issue_comment
  && pull_request && contains(body,'/review'))`; resolve the PR head ref explicitly
  for the comment path (runs from default branch).
- Keep `concurrency` cancel-in-progress.

**Verify**: scratch PR → reviews run on open; a follow-up push does NOT trigger
reviews; commenting `/review` does trigger a fresh run against the latest head.

---

## Phase 5: Local pre-PR slash command
A Claude Code slash command runs the same 4 personas against the working diff
locally and prints a consolidated review — fast feedback before `gh pr create`,
no secret, no GitHub round-trip.

**Files**: new `.claude/commands/review.md` (slash command); reuses
`.github/agents/*.agent.md` and `.github/scripts/synthesize-findings.mjs`.

**Key changes**:
- Command flow: detect base branch → `git diff <base>...HEAD` → spawn 4 sub-reviews
  (one per persona file) producing `ReviewOutput` each → feed to the same
  `synthesize-findings.mjs` → print consolidated review to the terminal.
- Shares the persona files + findings schema with CI (single source of truth);
  orchestration differs (local subagents vs Actions jobs), Claude auth is the local
  session (no `ANTHROPIC_API_KEY`).

**Verify**: on a branch with changes, run `/review` → consolidated, severity-ranked
output matching the CI format; confirm no network calls to GitHub and the same
personas drive both surfaces.

---

## Testing Checkpoints
- **After P1**: 4 reviewers only; no blogger; no auto-implement workflow/label; CI green.
- **After P2**: all reviews on Claude; valid `findings-*.json` artifacts + comments; no gpt-4o.
- **After P3**: one deduped, severity-ranked consolidated comment per run; status table intact.
- **After P4**: reviews on open + `/review` comment only; pushes don't auto-run.
- **After P5**: `/review` locally yields the same consolidated review from shared personas/schema.

## Slicing note
P2 is the one phase that necessarily touches the shared composite action and all 4
personas together (they share one action), so it cannot be sliced per-reviewer
without temporarily running two engines. It stays a single phase but is still
vertical: it delivers Claude-powered structured reviews visible end-to-end as
comments + artifacts.
