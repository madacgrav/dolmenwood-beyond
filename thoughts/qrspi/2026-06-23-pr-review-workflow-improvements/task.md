# Task: Improve the multi-agent PR review & auto-implement workflows

Evaluate the existing GitHub Actions PR-review pipeline (`pr-review.yml`, the
`agent-review` composite action, the `.github/agents/*` reviewer personas, and
`implement-suggestions.yml`) and determine a better way to have the different
expert agents review pull requests. The goal is a stronger review process —
better coverage, less redundancy/noise across reviewers, and a more reliable path
from review feedback to applied changes — while keeping the workflow practical to
run on every PR.
