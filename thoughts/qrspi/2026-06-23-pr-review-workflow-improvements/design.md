# Design Discussion

## Current State

A GitHub Actions pipeline reviews every PR to `main` with five blind, parallel
expert agents and an optional auto-implement step. Key facts from research:

- **Engine**: every call is `openai/gpt-4o` via `actions/ai-inference@v1`
  (`action.yml:68`, `implement-suggestions.yml:73`), with `max-tokens: 800` for
  reviews. No Claude is used anywhere in `.github/`.
- **Orchestration**: 5 reviewer jobs (Architect, DevOps, Security, QA, Blogger)
  staggered by `sleep` (0/20/40/60/80s) to dodge rate limits (`pr-review.yml:22-141`);
  a `consolidate` job posts a status table from `needs.<job>.result` only — it never
  reads the findings (`pr-review.yml:162-189`).
- **Blind & stateless**: reviewers have no `needs:` on each other; each re-fetches
  the diff and posts its own comment (`pr-review.yml:22-64`, `action.yml:32-37,83-89`).
- **Overlap with no merge**: DevOps and Security carry near-identical Bicep/secrets/
  action-pinning checklists and even disagree on pin thresholds (`devops-review` vs
  `security-reviewer`) → duplicate comments.
- **Truncation**: diffs cut at 12000 bytes (review) / 6000 bytes (implement) via
  byte-based `head -c`, mid-line (`action.yml:33`, `implement-suggestions.yml:42`).
- **Lossy auto-implement**: label-gated `implement-suggestions.yml` feeds prose
  comments + a 6k diff to a single gpt-4o call that must emit a strict unified diff,
  then `git apply` (clean→3way→fail) (`implement-suggestions.yml:70-141`).
- **Output is prose**: reviewers emit `## <emoji> Review` blocks with ✅/⚠️/💡 free
  text — not machine-structured.
- **Unused personas**: 9 of 14 `.github/agents/*` files are wired to nothing.

## Desired End State

A Claude-powered, review-only system with two surfaces that share the SAME persona
files: (1) an authoritative CI pipeline where 4 per-domain expert reviewers
(Architect, DevOps, Security, QA) emit **structured findings** that a **synthesis
agent** merges and ranks into one consolidated review comment; (2) a local
**pre-PR slash command** that runs the same experts against the working diff for
fast feedback before `gh pr create`. The fragile auto-implement path is retired.

**Verifiable when:**
- Opening/reopening a PR triggers the expert reviewers on Claude; later pushes do
  NOT auto-re-run — a re-review is requested on demand (a `/review` comment or
  label). No `gpt-4o` references remain in `.github/`.
- Each reviewer produces structured findings (severity, file, line, title, detail,
  suggestion) persisted as a job artifact, not just a comment.
- A single consolidated review comment appears per run, with duplicate findings
  (e.g. the same Bicep/secrets issue from DevOps + Security) merged once and ordered
  by severity. The per-agent status table remains.
- The blogger reviewer is removed from the pipeline.
- `implement-suggestions.yml` and the `auto-implement` label machinery are removed;
  no workflow writes to `contents: write` from review feedback.
- A local slash command runs the same 4 personas on the local diff and prints a
  consolidated review, with no GitHub round-trip and no repo secret required.
- Diff truncation no longer silently cuts mid-line for typical PRs (raised bound +
  per-file fallback).

## Patterns to Follow

- **Composite-action shape** (`action.yml:18-89`): keep the gather-diff → load-persona
  → call-model → emit pattern. It is clean and reusable; only the model call and the
  output handling change.
- **Per-job separation for status rows** (`pr-review.yml:17-21`): the rationale for
  separate jobs (per-agent status) still holds — keep reviewers as distinct jobs.
- **Heredoc/random-delimiter step outputs** (`action.yml:39-45`): reuse for passing
  multi-line content safely.
- **Persona files as system prompts** (`.github/agents/*.agent.md`): keep the wired 5
  as the source of each expert's lens; extend their prompts to specify the structured
  output schema.
- **Patterns NOT to follow**:
  - Status-only consolidation (`pr-review.yml:162-189`) — replace with real synthesis.
  - Byte-truncation mid-line (`action.yml:33`) — replace with a higher bound + per-file
    handling.
  - Prose→unified-diff translation (`implement-suggestions.yml:70-111`) — drop entirely.
  - Manual `sleep` rate-limit staggering as the primary mechanism — revisit once on
    Claude (may be unnecessary or replaced by retry/backoff).

## Design Decisions

1. **Engine → Claude** (user): Replace `actions/ai-inference@v1`/`gpt-4o` with an
   Anthropic API call inside the composite action, gated on an `ANTHROPIC_API_KEY`
   repo secret. Default model `claude-sonnet-4-6` for reviewers (cost/latency); the
   synthesis step may use a stronger model. Large context window lets us raise the
   diff bound substantially.
2. **Architecture → parallel experts + synthesis agent** (user): Keep the 5 expert
   jobs running in parallel. Add a `synthesize` job (`needs: [all reviewers]`) that
   downloads every reviewer's structured findings, dedupes overlaps, ranks by
   severity, and posts ONE consolidated review comment plus the existing status table.
3. **Output → structured findings** (user): Each reviewer returns a JSON findings
   array (`severity`, `file`, `line`, `title`, `detail`, optional `suggestion`).
   Persisted via `actions/upload-artifact` so the synthesis job can read all of them
   (current comment-only channel can't be machine-merged). Reviewers may still post
   their own rendered comment for traceability, or defer all rendering to synthesis
   (decided in structure phase).
4. **Auto-implement → dropped** (user): Delete `implement-suggestions.yml`, the
   `auto-implement` label creation in `consolidate`, and the related summary copy.
   The pipeline becomes review-only; fixes are applied by a human or a local Claude
   Code/qrspi session (consistent with the existing `pr13-review-feedback` flow).
5. **Truncation → raised bound + per-file fallback**: With Claude's context, lift the
   review diff cap well above 12k and, when a PR still exceeds it, iterate per changed
   file rather than cutting mid-line. Exact bound set in the structure phase.
6. **Findings channel → artifacts**: Reviewers write `findings-<agent>.json` artifacts;
   synthesis downloads them. This is the new inter-job data contract.
7. **Blogger → removed** (user): Drop the blogger job from `pr-review.yml`; the
   pipeline reviews only the 4 code-domain experts. `blogger-review.agent.md` stays on
   disk but unwired (joins the other unused personas).
8. **CI trigger → opened/reopened + on-demand** (user): Auto-run on `opened`/`reopened`;
   stop auto-running on every `synchronize`. Provide an on-demand re-review path (an
   `issue_comment` containing `/review`, or a label) to control Claude cost while
   letting the author opt into a re-review after pushing fixes.
9. **Review home → CI authoritative + local pre-PR command** (user): CI is the
   enforced, recorded, gateable review. A local Claude Code slash command runs the
   SAME persona files against the working diff before PR creation for fast feedback.
   A blocking git hook was rejected (slow, bypassable, reviews local not canonical
   state, only protects one machine).
10. **Persona files = single source of truth**: `.github/agents/*.agent.md` are
    consumed by BOTH the CI composite action and the local command. No duplicated
    review logic; editing a persona updates both surfaces.

## What We're NOT Doing

- **Not wiring the 9 unused personas** (governance, gh-actions hardening, architecture
  NFRs, DORA, Terraform/Pulumi, etc.). Adding new expert *domains* is a future follow-up;
  this effort restructures the existing 5.
- **Not changing CI** (`ci.yml`) or coupling it to review. They stay decoupled.
- **Not building a custom severity UI / dashboard** — the consolidated PR comment (and
  the local command's terminal output) is the surface.
- **Not auto-committing code** in any form (auto-implement is removed, not replaced).
- **Not keeping the blogger reviewer** — it is removed from the pipeline this effort.
- **Not adding a git pre-push/pre-commit hook** — rejected in favor of an opt-in local
  slash command (see decision 9).
- **Not wiring blogger into the local command** either — local command covers the same
  4 code experts as CI.

## Open Risks

- **Anthropic API in Actions**: no existing example in this repo; need to confirm the
  call mechanism (raw `curl` vs an official action) and secret wiring. The composite
  action currently assumes `actions/ai-inference` semantics.
- **Structured-output reliability**: Claude must return parseable JSON; need a schema +
  a tolerant parse/fallback so a malformed response doesn't fail the whole run.
- **Artifact passing between jobs**: upload/download-artifact adds steps and a small
  latency; must confirm artifact naming survives the matrix-free job layout.
- **Local/CI parity**: the local command and CI must invoke Claude differently
  (local uses the dev's Claude Code auth / CLI; CI uses the API + secret) while sharing
  persona files. Need a clean seam so the personas + findings schema are reused without
  duplicating the orchestration. Risk of drift if the two surfaces diverge.
- **On-demand re-review plumbing**: `issue_comment`/label triggers run from the default
  branch's workflow and need the PR's head ref resolved explicitly; more moving parts
  than the simple `synchronize` trigger.
- **Cost**: moving 4 reviewers + synthesis to Claude has a real per-run cost vs the free
  GitHub Models tier; the opened/reopened + on-demand trigger and concurrency-cancel are
  the cost controls.
