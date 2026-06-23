---
description: Run the expert PR reviewers locally on the working diff before opening a PR
---

# Review — Local multi-expert pre-PR review

Run the same four expert reviewers used in CI against the current branch's diff,
then print one consolidated review. No GitHub calls, no API key — this uses the
current Claude Code session. CI remains the authoritative review; this is the fast
pre-flight before `gh pr create`.

## Process

1. Detect the base branch:
   `git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`
   (fall back to `main` if that fails).
2. Capture the diff: `git diff <base>...HEAD`. If it is empty, say so and stop.
3. For EACH persona file below, run a sub-review using the Agent tool — launch all
   four in parallel (one message, multiple tool calls). Give each sub-agent the
   persona file's contents as its instructions plus the diff, and require it to
   return ONLY a JSON object matching
   `.github/actions/agent-review/findings.schema.json`
   (fields: `agent`, `summary`, `findings[]` with
   `severity`/`file`/`line`/`title`/`detail`/`suggestion`).
   Personas:
   - `.github/agents/developer-architect-review.agent.md`
   - `.github/agents/devops-review.agent.md`
   - `.github/agents/security-reviewer.agent.md`
   - `.github/agents/qa-reviewer.agent.md`
4. Write each returned object to a temp directory as `findings-<agent>.json`
   (e.g. `findings-security.json`).
5. Run `node .github/scripts/synthesize-findings.mjs <temp-dir>` and print its output
   — the same dedupe/rank/format used by CI.

## Rules

- Reuse the persona files verbatim as the sub-agents' instructions — do not restate
  or summarize their checklists here.
- Each sub-agent must return strictly valid JSON for the schema; if one returns
  prose, re-run it asking for JSON only.
- This is advisory and local-only. Do not post to GitHub. CI is authoritative.
