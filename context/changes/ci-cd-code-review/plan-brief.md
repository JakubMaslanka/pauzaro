# CI/CD Automated PR Code Review — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Research: `context/changes/ci-cd-code-review/research.md`

## What & Why

Wire automated AI code reviews into every PR to master. The project has zero CI/CD today — only local Lefthook hooks. The existing `code-reviewer` prototype needs upgrading to score 6 criteria and deliver pass/fail verdicts, then embedding into GitHub Actions so every PR gets reviewed with a scored comment and status label.

## Starting Point

`packages/code-reviewer/` exists as a 6-file prototype: AI SDK v7 `ToolLoopAgent` with OpenAI, Zod-validated structured output. Covers 2 of 6 required criteria, accepts raw code strings (not diffs), CLI is a hardcoded demo. No `.github/` directory or CI workflows exist.

## Desired End State

Every PR to master automatically receives a sticky comment with 6 criterion scores (1–10), an LLM-decided verdict, summary, and top findings — plus an `ai-cr:passed` or `ai-cr:failed` label. Developers can re-trigger review by adding `ai-cr:review` label. Large diffs (>3000 LOC) are truncated with a note. Failures exit cleanly without false labeling.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Pass/fail verdict | LLM-authoritative | Model has full context to judge holistically; numeric thresholds are arbitrary and gameable. | Plan |
| Package location | Stay in `packages/` | Follows monorepo convention and stays reusable; composite action references by path. | Research / Plan |
| Comment verbosity | Scores + top findings | Actionable at a glance — both health overview and specific issues to fix. | Plan |
| Diff size limit | 3000 LOC truncation | Controls cost and stays within context window; most PRs are well under this. | Plan |
| Retry policy | No retries | Single attempt, fail fast; keeps implementation simple, manual retry via label. | Plan |
| File filter | All except lockfiles/assets | Broad coverage including configs; only binary and generated files excluded. | Plan |

## Scope

**In scope:**
- New schema with 6 scored criteria + LLM verdict + findings
- Criterion-specific prompt rubrics from requirements doc
- CLI with file-based diff input and JSON output
- 3000 LOC truncation
- Composite action wrapping setup + execution
- Workflow with PR triggers + on-demand retry
- Sticky comment (find-and-update pattern)
- Label management (passed/failed/review)

**Out of scope:**
- Per-file chunked review
- LLM retry logic
- Build step for the package
- Cross-platform CI runners
- node_modules caching
- Score-threshold-based verdict

## Architecture / Approach

Three-layer design: (1) the code-reviewer CLI accepts a diff file + PR metadata and outputs scored review JSON, (2) a composite action at `.github/actions/code-review/` encapsulates Node setup + dependency install + CLI execution, (3) a workflow at `.github/workflows/` handles triggers, diff generation, comment posting, and label management. Each layer has a clean interface — the workflow only passes inputs and reads outputs, never touches the review logic.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Code-Reviewer Upgrade | Schema (6 criteria + verdict), prompts with rubrics, CLI with file I/O, LOC truncation | LLM scoring consistency across criteria; prompt engineering may need iteration |
| 2. Composite Action | `.github/actions/code-review/action.yml` wrapping setup + execution | Path resolution for monorepo package from composite action context |
| 3. Workflow Orchestration | Full workflow with triggers, diff gen, sticky comment, labels, retry-via-label | Diff generation edge cases (merge commits, empty diffs, binary files in filter) |

**Prerequisites:** Repository secret `LLM_PROVIDER_API_KEY` must exist before first workflow run.
**Estimated effort:** ~2-3 sessions across 3 phases.

## Open Risks & Assumptions

- LLM scoring may be inconsistent across runs for the same diff — no retry or averaging mechanism
- Very large PRs (>3000 LOC) only get partial review with truncation note
- `gpt-5.6-luna` cost per review is unknown at scale — monitor after first real runs
- Composite action path resolution assumes `actions/checkout` puts repo at workspace root (standard behavior)

## Success Criteria (Summary)

- Every PR to master gets a review comment with 6 scores, verdict, and findings within ~2 minutes
- Pass/fail label applied correctly, visible on PR list
- On-demand retry via `ai-cr:review` label works and cleans up after itself
