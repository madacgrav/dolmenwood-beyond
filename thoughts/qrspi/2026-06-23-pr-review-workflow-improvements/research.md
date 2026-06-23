# Research Findings

## Q1: How does `pr-review.yml` orchestrate its reviewer jobs?

### Findings
- **Trigger**: `pull_request` to `main`, types `opened, synchronize, reopened` (`pr-review.yml:3-6`). Permissions: `pull-requests: write`, `contents: read`, `models: read` (`pr-review.yml:8-11`).
- **Concurrency**: group keyed on PR number with `cancel-in-progress: true` — a new push cancels an in-flight review of the same PR (`pr-review.yml:13-15`).
- **Job structure**: five reviewer jobs, each its own job (not a matrix). Four share the composite action: `developer-architect` (`:23`), `devops` (`:33`), `security` (`:44`), `qa` (`:55`). Each does `actions/checkout@v4` then `./.github/actions/agent-review` with an `agent-file` input (`:27-31`, etc.). A comment in the file states they stay separate jobs so the consolidation summary keeps a per-agent status row (`pr-review.yml:17-21`).
- **Staggering**: rate-limit avoidance via increasing `sleep` inputs — dev-architect `0` (default), devops `20` (`:41`), security `40` (`:53`), qa `60` (`:63`), blogger `80` (`:114`).
- **Blogger is special** (`pr-review.yml:66-141`): conditional job that only acts when a PR changes `docs/blog/*.md` files (checked via `gh pr view --json files` jq filter, `:80-82`). It reviews full blog *content* (read with `cat`), not the diff, and calls the model inline rather than via the composite action (`:116-133`).
- **Consolidate job** (`pr-review.yml:143-198`): `needs: [all five]`, `if: always()`. Ensures the `auto-implement` label exists (`gh label create`, `:152-157`), then posts a summary comment with a per-agent status table built from `needs.<job>.result` (`:162-189`). It reads only job *result status* (success/failure/skipped), never the comment text. The summary instructs the user to add the `auto-implement` label or address feedback manually (`:191-195`).

## Q2: Inside the `agent-review` composite action, trace the full flow.

### Findings
- **Inputs** (`action.yml:6-16`): `agent-file` (required), `sleep` (default `'0'`), `github-token` (required).
- **Gather PR data** (`action.yml:21-45`): writes full diff to `pr.full.diff` via `gh pr diff`, then truncates to **12000 bytes** with `head -c 12000 > pr.diff` (`:32-33`). A comment explains the write-then-truncate avoids SIGPIPE/exit-141 from `gh` (`:27-31`). Changed-file list captured via `gh pr view --json files` (`:35-37`). Diff piped to step output through a random heredoc delimiter (`:39-45`).
- **Load persona** (`action.yml:47-57`): `cat ${{ inputs.agent-file }}` into a `system` step output via random delimiter.
- **Rate-limit buffer** (`action.yml:59-62`): `sleep ${{ inputs.sleep }}` only when non-zero.
- **Inference call** (`action.yml:64-81`): uses `actions/ai-inference@v1`, **`model: openai/gpt-4o`**, **`max-tokens: 800`**. `system-prompt` = the persona file contents; `prompt` embeds PR title, body (or `(none)`), changed files, and the truncated diff in a fenced ```diff block (`:71-81`).
- **Post output** (`action.yml:83-89`): the model `response` is posted verbatim as a PR comment via `gh pr comment` using the action token.
- **Note**: the entire pipeline runs on **GitHub Models / OpenAI gpt-4o**, not on Claude. The blogger inline job uses the same `model: openai/gpt-4o`, `max-tokens: 800` (`pr-review.yml:121-122`).

## Q3: What reviewer personas exist, which are wired in, and where do they overlap/leave gaps?

### Findings
- **14 files** exist in `.github/agents/`; 13 are `*.agent.md`, one is `blog-skill-documentation.md` (a process reference, not a persona).
- **Wired into `pr-review.yml`** (5): `developer-architect-review.agent.md` (`:30`), `devops-review.agent.md` (`:40`), `security-reviewer.agent.md` (`:51`), `qa-reviewer.agent.md` (`:62`), `blogger-review.agent.md` (`:107`).
- **Exist but NOT referenced by any workflow** (9): `api-architect`, `agent-governance-reviewer`, `azure-iac-generator`, `bicep-plan`, `devops-expert`, `github-actions-expert`, `arch`, `software-engineer-agent-v1`, `blog-skill-documentation`. (No workflow under `.github/workflows/` references these by path.)
- **Wired persona scopes & output formats** (all four PR reviewers emit a fixed `## <emoji> <Name> Review` markdown block with ✅ / ⚠️ / 💡 sections):
  - *developer-architect-review*: project conventions — rules-engine separation, Next.js 15 patterns (Promise params, SSR vs browser clients, `force-dynamic`), CSS custom properties (no hardcoded hex), 44px touch targets, monorepo boundaries, TS strict (`noUncheckedIndexedAccess`, no `any`), file naming.
  - *devops-review*: Dockerfile (standalone, non-root, `dumb-init`, secrets hygiene), Bicep IaC (managed identity, RBAC Key Vault, `httpsOnly`, ACR admin disabled, `imageTag`), Actions (OIDC, concurrency, env gates, action pinning), Supabase migration hygiene, build caching.
  - *security-reviewer*: secrets/credential exposure, Supabase RLS policies (`auth.uid()`), Next.js auth (middleware/server-action/OAuth), input validation (parameterized queries, no `dangerouslySetInnerHTML`), Bicep security, npm CVEs, Actions security.
  - *qa-reviewer*: `packages/rules-engine` (Vitest) test coverage/quality, deterministic dice mocking, TS correctness, rules correctness (XP modifier, AC, saves, encumbrance), wizard integration (13-step count).
  - *blogger-review*: editorial review of `docs/blog/*.md` across 6 dimensions, ending in a `LinkedIn Readiness Score: X/10`.
- **Observed overlaps** (same concern claimed by multiple wired personas):
  - *Bicep/Azure infra security*: devops-review and security-reviewer carry near-identical checklists (`httpsOnly`, RBAC Key Vault, `adminUserEnabled: false`, managed identity).
  - *Action version pinning*: devops-review accepts `@v[major]`; security-reviewer flags that as insufficient and wants commit-SHA pinning — different thresholds for the same property.
  - *Dockerfile secrets hygiene* and *secrets in workflow `run:` steps*: covered by both devops-review and security-reviewer.
- **Concern areas no wired persona claims** (present only in non-wired files): AI agent governance (`agent-governance-reviewer`), DORA/full CI-CD lifecycle & observability (`devops-expert`), general NFR architecture docs (`arch`), Actions hardening like SBOM/`actionlint`/Dependabot (`github-actions-expert`), blog *drafting/publishing* stages (`blog-skill-documentation`), pre-code IaC planning (`bicep-plan`), and Terraform/Pulumi IaC (`azure-iac-generator`).

## Q4: How does `implement-suggestions.yml` turn feedback into committed code?

### Findings
- **Trigger** (`implement-suggestions.yml:3-5`): `pull_request` type `labeled`; job guarded by `if: github.event.label.name == 'auto-implement'` (`:17`). Permissions include `contents: write` (`:7-10`).
- **Checkout** the PR head branch with a writable token so commits push back (`:20-24`).
- **In-progress comment** posted immediately (`:26-33`).
- **Gather feedback** (`:34-68`): diff via `gh pr diff | head -c 6000` → `pr.diff` (**6000 bytes**, `:42`); changed files via `gh pr view --json files` (`:44-47`); comments via jq filter `select(.author.login == "github-actions")` joined with `---`, truncated to **3000 bytes** (`:50-53`). Diff and comments pushed to step outputs via heredocs.
- **Generate patch** (`:70-111`): `actions/ai-inference@v1`, `model: openai/gpt-4o`, **`max-tokens: 1500`**. System prompt instructs: output a **unified diff ONLY** (no prose/fences), change only what reviewers explicitly asked, ignore subjective/"consider" feedback, act only on concrete unambiguous requests, and emit exactly `NO_CHANGES` if nothing actionable (`:76-97`).
- **Apply patch** (`:113-141`): trims output; if `NO_CHANGES`/empty → `applied=false, reason=no_changes` (`:120-125`). Otherwise writes `suggestions.patch` and tries `git apply --check` then `git apply` (clean, `reason=clean`); falls back to `git apply --3way` (`reason=3way`); else `applied=false, reason=conflict` with a `::warning::` (`:130-141`).
- **Commit & push** only if applied (`:143-155`): commits as `github-actions[bot]` with message `fix: apply automated agent review suggestions`, co-authored-by Copilot.
- **Cleanup** (`:157-164`): always removes the `auto-implement` label.
- **Result comment** (`:166-204`): branches on applied/reason — success (notes 3-way caveat), no-actionable-changes, or conflict-with-rebase-instructions.

## Q5: What information flows between agents, consolidate, and implement? Relation to CI?

### Findings
- **Reviewers are blind to each other**: the four reviewer jobs have no `needs:` and reference no other job (`pr-review.yml:22-64`). Each independently calls `gh pr diff`/`gh pr view` inside the composite action (`action.yml:32-37`); there is no shared artifact, step output, or file between reviewers.
- **Output storage**: each reviewer's only output is one PR comment via `gh pr comment` (`action.yml:83-89`). No artifact upload, no inter-job output. Comments exist in isolation.
- **Consolidate** reads only `needs.<job>.result` status strings, never the comment bodies (`pr-review.yml:162-189`).
- **Implement → reviewer linkage** is *only* via PR comments: the gather step's filter `select(.author.login == "github-actions")` (`implement-suggestions.yml:52`) matches the bot identity used to post reviewer comments (`action.yml:89` uses `github.token`). It therefore also captures the consolidate summary comment and the implement workflow's own in-progress comment (same `github-actions` identity).
- **CI is fully decoupled**: `ci.yml` triggers on `pull_request`/`push` to `main` (path-filtered to `apps/**`, `packages/**`, `supabase/**`, root configs) and also exposes `workflow_call` (`ci.yml:3-31`). Jobs: `lint`, `typecheck`, `test` run in parallel; `build` gates on all three via `needs: [lint, typecheck, test]` (`ci.yml:81-84`). Neither `pr-review.yml` nor `implement-suggestions.yml` declares `needs:` on CI or invokes its `workflow_call`. The three workflows run independently with no ordering or gating between review and CI.

## Q6: What are the input/output limits, filters, and formats across the pipeline?

### Findings
- **Diff truncation**: review composite action `12000` bytes (`action.yml:33`); implement workflow `6000` bytes (`implement-suggestions.yml:42`). Both byte-based (`head -c`), so a diff can be cut mid-line.
- **Comment truncation**: implement gather truncates aggregated reviewer comments to `3000` bytes (`implement-suggestions.yml:50-53`).
- **Token caps**: reviews `max-tokens: 800` (`action.yml:69`, `pr-review.yml:122`); patch generation `max-tokens: 1500` (`implement-suggestions.yml:74`).
- **Model**: `openai/gpt-4o` everywhere (`action.yml:68`, `pr-review.yml:121`, `implement-suggestions.yml:73`).
- **Comment-author filter**: `select(.author.login == "github-actions")` (`implement-suggestions.yml:52`) — exact string match, no scoping to specific reviewer agents.
- **Output formats**: each PR reviewer persona prescribes a fixed markdown block (`## <emoji> <Name> Review` with ✅/⚠️/💡 subsections) — free-form prose inside, not machine-structured (no JSON/severity field). The implement step requires a strict unified-diff or literal `NO_CHANGES` (`implement-suggestions.yml:81-97`). The consolidate summary is a markdown status table (`pr-review.yml:183-189`).
- **Blog detection**: blogger job filters PR files to `docs/blog/*.md`, reads only the first matched file's content (`head -2` candidates, first used) (`pr-review.yml:80-89`).

## Cross-Cutting Observations
- The pipeline is entirely **GitHub Models / gpt-4o**, despite the project being developed in a Claude Code environment; no Claude model is invoked anywhere in `.github/`.
- **Coverage is bounded by byte-truncation, not semantic chunking** — large PRs are silently cut (12k for review, 6k for implement) with no pagination or per-file iteration.
- Reviewers operate **fully independently and statelessly**; the only cross-component channel is the PR comment stream, consumed by `implement-suggestions.yml` via a broad author filter.
- Reviewer output is **human-readable prose**, while the implement step expects **machine-precise unified diffs** produced by a separate single gpt-4o call from those prose comments + a 6k diff — a lossy comment→patch translation.
- There is a **large library of unused personas** (9 of 14), several of which (governance, github-actions hardening, architecture NFRs, DORA) cover concerns the wired reviewers do not.

## Open Areas
- **Actual review quality/accuracy** (e.g. false-positive rates) cannot be assessed from source alone; only the *mechanism* is documented here. (The `2026-06-23-pr13-review-feedback` artifacts record one real instance of triaging this feedback, but per process rules were not used as input to this research.)
- **Whether the unused personas were intentionally retired or are pending wiring** is not determinable from the code; they simply exist unreferenced.
- The `actions/ai-inference@v1` action's internal retry/error behavior on rate limits (beyond the manual `sleep` stagger) is external to this repo and not documented here.
