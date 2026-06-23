# Implementation Plan

## Overview
Restructure the `.github/` review system into a Claude-powered, review-only pipeline:
4 expert reviewers (Architect, DevOps, Security, QA) emit structured findings → a
synthesis agent dedupes and ranks them into one consolidated PR comment; the same
personas + synthesis script power a local `/review` slash command. Auto-implement
and the blogger reviewer are removed.

**Project commands** (from `ci.yml`): `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm build`. Workflow YAML is linted with `actionlint` when available. Node 20 is
preinstalled on `ubuntu-latest` runners and available locally.

**Prerequisite (manual, before Phase 2):** add repo secret `ANTHROPIC_API_KEY`
(GitHub → Settings → Secrets and variables → Actions). The pipeline will not call
Claude without it.

---

## Phase 1: Remove auto-implement & blogger

### Changes

#### 1. Delete the auto-implement workflow
**File**: `.github/workflows/implement-suggestions.yml`
**Action**: delete

#### 2. Remove blogger job, auto-implement label, and label copy from PR review
**File**: `.github/workflows/pr-review.yml`
**Action**: modify
- Delete the entire `blogger:` job (current `:66-141`).
- In `consolidate.needs`, remove `blogger` → `needs: [developer-architect, devops, security, qa]`.
- Delete the `blogger` row from the status table (`:189`) and the `BLOG_RESULT` env (`:166`).
- Delete the "Ensure auto-implement label exists" step (`:149-157`).
- In the summary body, remove the two `auto-implement` bullet lines (`:191-195`),
  leaving a line like: `echo "Review the individual agent comments above and address the feedback."`

`.github/agents/blogger-review.agent.md` stays on disk (now unwired).

### Verification
#### Automated
- [x] `actionlint .github/workflows/*.yml` passes (or `python -c "import yaml,glob;[yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]"` if actionlint absent)
- [x] `git grep -n "auto-implement" .github/` returns nothing
- [x] `git grep -n "blogger" .github/workflows/` returns nothing

#### Manual
- [ ] On a scratch PR to `main`: no blogger comment appears; the consolidation summary has no auto-implement instructions; adding a label named `auto-implement` triggers no workflow run.

---

## Phase 2: Claude engine + structured findings + truncation fix

### Changes

#### 1. Findings JSON schema (shared contract)
**File**: `.github/actions/agent-review/findings.schema.json`
**Action**: create
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "agent": { "type": "string" },
    "summary": { "type": "string" },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "severity": { "type": "string", "enum": ["critical", "warning", "suggestion"] },
          "file": { "type": "string" },
          "line": { "type": ["integer", "null"] },
          "title": { "type": "string" },
          "detail": { "type": "string" },
          "suggestion": { "type": "string" }
        },
        "required": ["severity", "file", "line", "title", "detail", "suggestion"]
      }
    }
  },
  "required": ["agent", "summary", "findings"]
}
```

#### 2. Rewrite the composite action to call Claude and emit findings
**File**: `.github/actions/agent-review/action.yml`
**Action**: modify
- Add inputs: `agent-name` (required — short id like `security`); keep `agent-file`,
  `github-token`; keep `sleep` (still used to stagger). Add input `anthropic-api-key` (required).
- **Gather PR data** step: raise the diff cap and fall back to per-file diffs:
  ```bash
  gh pr diff ${{ github.event.pull_request.number }} > pr.full.diff
  if [ "$(wc -c < pr.full.diff)" -gt 120000 ]; then
    # Too large: emit per-file diffs, each capped, to avoid mid-line cuts
    : > pr.diff
    for f in $(gh pr view ${{ github.event.pull_request.number }} --json files --jq '.files[].path'); do
      { echo "### $f"; git --no-pager diff origin/${{ github.base_ref }}...HEAD -- "$f" | head -c 20000; echo; } >> pr.diff
    done
  else
    cp pr.full.diff pr.diff
  fi
  ```
- Replace the `actions/ai-inference@v1` "Run review" step with a Claude call. Build the
  request body with `jq -n` (so diff content can't break JSON) and force the tool:
  ```bash
  PROMPT=$(printf 'Review this pull request for Dolmenwood Beyond.\n\nPR title: %s\nDescription: %s\nChanged files: %s\n\nReturn findings via the report_findings tool. Use severity critical/warning/suggestion; set line to null when not line-specific; suggestion may be an empty string.\n\nDiff:\n```diff\n%s\n```' \
    "${{ github.event.pull_request.title }}" "${{ github.event.pull_request.body }}" "$FILES" "$(cat pr.diff)")

  jq -n \
    --arg model "claude-sonnet-4-6" \
    --arg system "$(cat ${{ inputs.agent-file }})" \
    --arg prompt "$PROMPT" \
    --argjson schema "$(cat .github/actions/agent-review/findings.schema.json)" \
    '{model:$model, max_tokens:4000, system:$system,
      tools:[{name:"report_findings", description:"Report structured code-review findings.", input_schema:$schema, strict:true}],
      tool_choice:{type:"tool", name:"report_findings"},
      messages:[{role:"user", content:$prompt}]}' > body.json

  curl -sS https://api.anthropic.com/v1/messages \
    -H "x-api-key: ${{ inputs.anthropic-api-key }}" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d @body.json > resp.json

  # Extract the forced tool input (the ReviewOutput object)
  jq '(.content[] | select(.type=="tool_use") | .input) // empty' resp.json > findings-${{ inputs.agent-name }}.json
  # Fail loudly if Claude returned an error instead of findings
  if [ ! -s findings-${{ inputs.agent-name }}.json ]; then
    echo "::error::No findings produced"; jq '.' resp.json; exit 1
  fi
  ```
- **Render + post comment** step: run the shared renderer and post it:
  ```bash
  node .github/scripts/render-findings.mjs findings-${{ inputs.agent-name }}.json > comment.md
  gh pr comment ${{ github.event.pull_request.number }} --body-file comment.md
  ```
- **Upload artifact** step (new, last):
  ```yaml
  - uses: actions/upload-artifact@v4
    with:
      name: findings-${{ inputs.agent-name }}
      path: findings-${{ inputs.agent-name }}.json
  ```

#### 3. Shared renderer (ReviewOutput → markdown)
**File**: `.github/scripts/render-findings.mjs`
**Action**: create
```js
import { readFileSync } from "node:fs";

const ICON = { critical: "🚨", warning: "⚠️", suggestion: "💡" };
const ORDER = { critical: 0, warning: 1, suggestion: 2 };

export function renderFindings(review) {
  const lines = [`## ${review.agent}`, "", review.summary, ""];
  const sorted = [...review.findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  if (sorted.length === 0) lines.push("✅ No issues found.");
  for (const f of sorted) {
    const loc = f.line != null ? `${f.file}:${f.line}` : f.file;
    lines.push(`- ${ICON[f.severity] ?? "•"} **${f.title}** (\`${loc}\`)`, `  ${f.detail}`);
    if (f.suggestion) lines.push(`  _Suggestion:_ ${f.suggestion}`);
  }
  return lines.join("\n");
}

// CLI: node render-findings.mjs findings-x.json
if (import.meta.url === `file://${process.argv[1]}`) {
  const review = JSON.parse(readFileSync(process.argv[2], "utf8"));
  process.stdout.write(renderFindings(review) + "\n");
}
```

#### 4. Pass the new inputs from each reviewer job
**File**: `.github/workflows/pr-review.yml`
**Action**: modify — for each of the 4 jobs, add `agent-name:` and
`anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}` to the `with:` block, e.g.:
```yaml
- uses: ./.github/actions/agent-review
  with:
    agent-name: security
    agent-file: .github/agents/security-reviewer.agent.md
    sleep: '40'
    github-token: ${{ github.token }}
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```
Add `models: read` is no longer needed; leave existing `permissions` (pull-requests: write, contents: read).

#### 5. Append the output contract to each persona
**File**: each of `developer-architect-review.agent.md`, `devops-review.agent.md`,
`security-reviewer.agent.md`, `qa-reviewer.agent.md`
**Action**: modify — append a short section instructing the model to report through
the `report_findings` tool, mapping its existing ✅/⚠️/💡 categories to
`severity` (warning/critical for issues, suggestion for 💡), and to set `agent` to its
display name. Keep each persona's domain checklist unchanged.

### Verification
#### Automated
- [x] `actionlint .github/workflows/*.yml` passes (YAML parse fallback — actionlint not installed locally)
- [x] `node -e "JSON.parse(require('fs').readFileSync('.github/actions/agent-review/findings.schema.json'))"` exits 0
- [x] `node .github/scripts/render-findings.mjs <(echo '{"agent":"X","summary":"s","findings":[{"severity":"warning","file":"a.ts","line":1,"title":"t","detail":"d","suggestion":""}]}')` prints markdown
- [x] `git grep -n "ai-inference\|openai/gpt-4o" .github/` returns nothing

#### Manual
- [ ] On a scratch PR: each of the 4 reviewer jobs runs on Claude, posts a comment, and uploads a `findings-<agent>.json` artifact that validates against the schema (download and check with `jq`).

---

## Phase 3: Synthesis job

### Changes

#### 1. Synthesis script (ReviewOutput[] → consolidated markdown)
**File**: `.github/scripts/synthesize-findings.mjs`
**Action**: create
```js
import { readFileSync, readdirSync } from "node:fs";
import { renderFindings } from "./render-findings.mjs";

const ORDER = { critical: 0, warning: 1, suggestion: 2 };
const ICON = { critical: "🚨", warning: "⚠️", suggestion: "💡" };
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function synthesize(reviews) {
  const byKey = new Map();
  for (const r of reviews) {
    for (const f of r.findings) {
      const key = `${f.file}:${f.line}:${norm(f.title)}`;
      const cur = byKey.get(key);
      if (!cur) byKey.set(key, { ...f, agents: [r.agent] });
      else {
        cur.agents.push(r.agent);
        if (ORDER[f.severity] < ORDER[cur.severity]) cur.severity = f.severity;
      }
    }
  }
  const merged = [...byKey.values()].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const lines = ["## 🤖 Consolidated Review", ""];
  if (merged.length === 0) lines.push("✅ No issues raised by any reviewer.");
  for (const f of merged) {
    const loc = f.line != null ? `${f.file}:${f.line}` : f.file;
    lines.push(`- ${ICON[f.severity]} **${f.title}** (\`${loc}\`) — _${[...new Set(f.agents)].join(", ")}_`,
               `  ${f.detail}`);
    if (f.suggestion) lines.push(`  _Suggestion:_ ${f.suggestion}`);
  }
  return lines.join("\n");
}

// CLI: node synthesize-findings.mjs <dir-of-findings-json>
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? ".";
  const reviews = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
  process.stdout.write(synthesize(reviews) + "\n");
}
```

#### 2. Replace status-only consolidation with synthesis
**File**: `.github/workflows/pr-review.yml`
**Action**: modify the `consolidate` job — after the status table step, add:
```yaml
- uses: actions/download-artifact@v4
  with:
    pattern: findings-*
    path: findings
    merge-multiple: true
- name: Post consolidated review
  if: always()
  env:
    GH_TOKEN: ${{ github.token }}
  run: |
    if ls findings/*.json >/dev/null 2>&1; then
      node .github/scripts/synthesize-findings.mjs findings > consolidated.md
      gh pr comment ${{ github.event.pull_request.number }} --body-file consolidated.md
    fi
```
Keep the existing per-agent status table step (it reads `needs.*.result`).

### Verification
#### Automated
- [x] Fixture test: create two findings JSONs that flag the same `file:line:title`, run
  `node .github/scripts/synthesize-findings.mjs <dir>`, confirm the finding appears once with both agents attributed and severity = the higher of the two.
- [x] `actionlint .github/workflows/pr-review.yml` passes (YAML parse fallback)

#### Manual
- [ ] On a scratch PR where Security and DevOps both flag the same Bicep/secrets issue: exactly one consolidated comment appears, merged once, severity-ordered; the per-agent status table is still posted.

---

## Phase 4: CI trigger change (opened/reopened + on-demand)

### Changes

#### 1. Triggers and run gate
**File**: `.github/workflows/pr-review.yml`
**Action**: modify
- Change `on:`:
  ```yaml
  on:
    pull_request:
      branches: [main]
      types: [opened, reopened]
    issue_comment:
      types: [created]
  ```
- Add a `setup` job that resolves PR number + head sha and a run flag:
  ```yaml
  setup:
    runs-on: ubuntu-latest
    if: >-
      github.event_name == 'pull_request' ||
      (github.event.issue.pull_request && startsWith(github.event.comment.body, '/review'))
    outputs:
      pr: ${{ steps.r.outputs.pr }}
      sha: ${{ steps.r.outputs.sha }}
    steps:
      - id: r
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            PR=${{ github.event.pull_request.number }}
          else
            PR=${{ github.event.issue.number }}
          fi
          echo "pr=$PR" >> $GITHUB_OUTPUT
          echo "sha=$(gh pr view $PR --repo ${{ github.repository }} --json headRefOid --jq .headRefOid)" >> $GITHUB_OUTPUT
  ```
- Each reviewer job and `consolidate`: add `needs: setup` (consolidate keeps the
  reviewer needs too), and `actions/checkout@v4` with `ref: ${{ needs.setup.outputs.sha }}`.
- Replace `github.event.pull_request.number` references in the jobs/action calls with
  `${{ needs.setup.outputs.pr }}` (pass it into the composite action as a new `pr-number`
  input, used in place of `github.event.pull_request.number` inside `action.yml`).
- Keep the existing `concurrency` block but key it on the resolved PR:
  `group: pr-review-${{ github.event.pull_request.number || github.event.issue.number }}`.

> Note: this phase touches the composite action again only to add the `pr-number`
> input; the model call from Phase 2 is unchanged.

### Verification
#### Automated
- [ ] `actionlint .github/workflows/pr-review.yml` passes
- [ ] `git grep -n "synchronize" .github/workflows/pr-review.yml` returns nothing

#### Manual
- [ ] Open a scratch PR → reviews run. Push another commit → reviews do NOT auto-run.
  Comment `/review` on the PR → a fresh review run starts against the latest head SHA.

---

## Phase 5: Local pre-PR slash command

### Changes

#### 1. `/review` slash command
**File**: `.claude/commands/review.md`
**Action**: create — a command that reuses the same personas and synthesis script:
```markdown
---
description: Run the expert PR reviewers locally on the working diff before opening a PR
---

# Review — Local multi-expert pre-PR review

Run the same four expert reviewers used in CI against the current branch's diff,
then print one consolidated review. No GitHub calls, no API key — uses this Claude
Code session.

## Process
1. Detect base branch: `git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'` (fallback `main`).
2. Capture the diff: `git diff <base>...HEAD`.
3. For EACH persona file below, run a sub-review (use the Agent tool, one per persona,
   in parallel). Give the sub-agent the persona file contents as its instructions and
   the diff, and require it to return a JSON object matching
   `.github/actions/agent-review/findings.schema.json` (fields: agent, summary, findings[]).
   Personas:
   - `.github/agents/developer-architect-review.agent.md`
   - `.github/agents/devops-review.agent.md`
   - `.github/agents/security-reviewer.agent.md`
   - `.github/agents/qa-reviewer.agent.md`
4. Write each returned object to a temp dir as `findings-<agent>.json`.
5. Run `node .github/scripts/synthesize-findings.mjs <temp-dir>` and print the result.

## Rules
- Reuse the persona files verbatim — do not restate their checklists here.
- If the diff is empty, say so and stop.
- This is advisory; CI remains the authoritative review.
```

### Verification
#### Automated
- [ ] `node .github/scripts/synthesize-findings.mjs <dir-with-two-fixtures>` prints a consolidated review (same script the command calls).

#### Manual
- [ ] On a branch with changes, run `/review` → a consolidated, severity-ranked review prints, driven by the four persona files; confirm no GitHub API calls were made and no `ANTHROPIC_API_KEY` was required.

---

## Testing Checkpoints
- **After P1**: 4 reviewers only; no blogger; no auto-implement workflow/label; CI green.
- **After P2**: all reviews on Claude; valid `findings-*.json` artifacts + per-agent comments; no `gpt-4o`/`ai-inference`.
- **After P3**: one deduped, severity-ranked consolidated comment per run; status table intact.
- **After P4**: reviews on open/reopen + `/review` comment only; pushes don't auto-run.
- **After P5**: `/review` locally yields the same consolidated review from shared personas/schema.

## Notes / deviations from structure
- Added `.github/scripts/render-findings.mjs` (per-agent comment rendering) — implied by
  structure's "still post a rendered markdown comment" but not separately named.
- Phase 4 adds a `pr-number` input to the composite action (needed so the action works
  for both `pull_request` and `issue_comment` triggers); flagged inline.
- Default reviewer model is `claude-sonnet-4-6` per the design decision; raise to an
  Opus-tier id in `action.yml` if review depth proves insufficient.
