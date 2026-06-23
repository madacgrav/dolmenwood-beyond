# Research Questions

## Context
Focus on the automated review machinery under `.github/`. Relevant areas: the
workflow `.github/workflows/pr-review.yml`; the reusable composite action at
`.github/actions/agent-review/action.yml`; the reviewer persona/system-prompt
files under `.github/agents/*.agent.md`; the `.github/workflows/implement-suggestions.yml`
workflow; and the CI workflow `.github/workflows/ci.yml`. The aim is to document
exactly how these pieces work today, end to end.

## Questions
1. How does `pr-review.yml` orchestrate its reviewer jobs — what events trigger
   it, how is concurrency handled, how are the individual jobs structured and
   staggered, and how does the `consolidate` job collect and present the per-agent
   results?

2. Inside the `agent-review` composite action, trace the full flow: how is PR data
   gathered and bounded, what model and parameters are used for the inference call,
   how is the per-agent persona injected as the system prompt, and how is the
   model's output posted back to the PR?

3. What reviewer persona files exist under `.github/agents/`, what does each one
   instruct the model to do and look for, which of them are actually wired into
   `pr-review.yml`, and where do their stated responsibilities overlap or leave
   areas uncovered?

4. How does `implement-suggestions.yml` turn review feedback into committed code —
   what triggers it, which inputs (comments, diff, file list) does it collect and
   how are they bounded, how is the patch generated and applied (including fallback
   paths), and how are success/no-op/failure outcomes handled?

5. What information flows between the reviewer agents, the consolidation step, and
   the implement step — do the reviewers see each other's output, which comments
   does the implement step select and how, and is there any ordering or dependency
   relationship with the CI workflow (`ci.yml`)?

6. Across the whole pipeline, what are the concrete input/output limits and
   filters — diff truncation sizes, `max-tokens` settings, comment-author filters,
   and any content selection rules — and in what format is each reviewer's output
   produced and consumed downstream?
