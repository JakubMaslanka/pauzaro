---
date: "2026-09-14T20:56:52Z"
researcher: Claude
git_commit: c017a7f7c5e835a871716e77f568679037dacfc2
branch: feature/add-code-reviewer
repository: pauzaro
topic: "CI/CD workflow for automated PR code reviews"
tags: [research, codebase, ci-cd, github-actions, code-reviewer, ai-review]
status: complete
last_updated: 2026-09-14
last_updated_by: Claude
---

# Research: CI/CD Workflow for Automated PR Code Reviews

**Date**: 2026-09-14T20:56:52Z
**Researcher**: Claude
**Git Commit**: c017a7f7c5e835a871716e77f568679037dacfc2
**Branch**: feature/add-code-reviewer
**Repository**: pauzaro

## Research Question

How to implement a GitHub Actions CI/CD workflow that runs the `code-reviewer` package on every PR to master, posting scored review comments and pass/fail labels — based on requirements from `context/changes/ci-cd-code-review/requirements.md`.

## Summary

The repo has **zero CI/CD** today — only local Lefthook pre-commit hooks. The `code-reviewer` package exists as a working prototype with structured output via Vercel AI SDK v7, but covers only 2 of 6 required criteria and lacks diff/PR input support. Building the GHA workflow requires two parallel workstreams: (1) upgrading the code-reviewer to accept diff + PR metadata and score all 6 criteria, and (2) creating the GHA workflow + composite action that wires it into the PR lifecycle.

## Detailed Findings

### 1. Current State of `code-reviewer` Package

The package lives at `packages/code-reviewer/` with 6 source files. Created and refactored on 2026-09-14 (commits `1693462` → `c017a7f`).

**Architecture:**
- **Agent**: `ToolLoopAgent` from AI SDK v7 with `Output.object()` for structured JSON (`src/agent/reviewer.ts:6-9`)
- **Provider**: OpenAI via `@ai-sdk/openai`, defaults to `gpt-5.6-luna` (`src/provider/openai.ts:6`)
- **Schema**: Zod-validated `ReviewResult` with `findings[]` array (`src/schemas/review.ts:5-19`)
- **Prompts**: Generic system prompt + code-wrapping user prompt (`src/prompts/review.ts:1-14`)
- **CLI**: Hardcoded demo only, no argument parsing (`src/cli.ts:3-17`)
- **Exports**: Barrel export of `reviewCode`, `codeReviewAgent`, schemas, and types (`src/index.ts`)

**Current output shape:**
```typescript
interface ReviewResult {
  findings: Array<{
    line: number;
    severity: "low" | "medium" | "high";
    category: string;      // freeform, not enum
    message: string;
    suggestedFix: string;
  }>;
}
```

**Gap analysis vs requirements:**

| Requirement | Current State | Gap |
|-------------|--------------|-----|
| Accept diff input | Code string only | Need diff parser, multi-file support |
| Accept PR title | Not supported | Need input parameter |
| Accept PR description | Not supported | Need input parameter (with truncation) |
| 6 scored criteria (1-10) | 2/6 partially (bugs, security) | Need schema + prompt overhaul |
| Overall verdict (pass/fail) | Not in schema | Need verdict field + threshold logic |
| CLI with arguments | Hardcoded demo | Need arg parser (or stdin) |
| Error resilience | Bare `.catch(console.error)` | Need retries, timeouts |

### 2. Current CI/CD State

**No CI/CD exists.** No `.github/` directory, no workflows, no composite actions, no third-party CI configs.

**What does exist:**
- Lefthook pre-commit hooks (`lefthook.yml`): lint, typecheck, test, rust-check, rust-test
- Tech stack foundation (`context/foundation/tech-stack.md:9-10`): `ci_provider: github-actions`, `ci_default_flow: auto-deploy-on-merge` — recorded but never implemented
- Roadmap (`context/foundation/roadmap.md:74`): explicitly notes "Deploy / infra: absent"

**Available CI building blocks** (root `package.json` scripts): `build`, `test`, `test:e2e`, `lint`

### 3. GHA Workflow Patterns (Research Results)

#### 3.1 Trigger Configuration

Combined trigger for automatic + on-demand review:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled]
    branches: [master]

jobs:
  code-review:
    if: >-
      github.event.action != 'labeled' ||
      github.event.label.name == 'ai-cr:review'
```

- `opened/synchronize/reopened` = automatic on every PR update
- `labeled` + `if:` guard = on-demand retry via `ai-cr:review` label
- `github.event.label.name` contains only the just-added label

#### 3.2 Composite Action Structure

Place at `.github/actions/code-review/action.yml`:
- `runs.using: composite` — every `run:` step **must** have explicit `shell:`
- `${{ github.action_path }}` resolves to action directory — use as `working-directory` for `pnpm install`
- Inputs via `${{ inputs.* }}` context, outputs via `$GITHUB_OUTPUT` in steps
- Code-reviewer package lives inside the composite action directory (or is referenced via path)

#### 3.3 Getting PR Data

- PR title: `${{ github.event.pull_request.title }}`
- PR description: `${{ github.event.pull_request.body }}` — truncate to ~2000 chars (~500 tokens) to control cost. Negligible vs diff cost.
- Diff: `git diff base_sha head_sha -- '*.ts' '*.tsx' '*.rs'` after `fetch-depth: 0` checkout. Filter excludes lock files and assets.

#### 3.4 Posting Comments (Sticky Pattern)

Use `actions/github-script@v7` with hidden HTML marker (`<!-- ai-code-review -->`) to find-and-update existing comment. Prevents duplicate comments on `synchronize` events.

```javascript
// Find by marker, updateComment if exists, createComment if not
// Uses issues.listComments / issues.createComment (PRs = issues in GH API)
```

#### 3.5 Label Management

```bash
# Idempotent label creation
gh label create "ai-cr:passed" --color "0E8A16" --force
gh label create "ai-cr:failed" --color "D93F0B" --force
gh label create "ai-cr:review" --color "0075CA" --force

# Swap labels based on verdict
gh pr edit $PR --remove-label "ai-cr:passed" 2>/dev/null || true
gh pr edit $PR --remove-label "ai-cr:failed" 2>/dev/null || true
gh pr edit $PR --remove-label "ai-cr:review" 2>/dev/null || true
# Then add verdict label
```

#### 3.6 Security

- **`pull_request` (not `pull_request_target`)** — repo is private, no forks. Same-repo PRs get write `GITHUB_TOKEN` and secret access.
- **Permissions block**: `contents: read` + `pull-requests: write`
- **Secret storage**: `OPENAI_API_KEY` as repository secret. Dedicated CI key with usage caps recommended.
- Switch to `pull_request_target` only if accepting fork contributions (with safe diff-only pattern — never checkout untrusted code).

#### 3.7 Node.js Setup

- `pnpm/setup@v2` with `runtime: node@22` — single step installs pnpm + Node.js + runs `pnpm install`
- Run CLI via `node --import tsx src/cli.ts` — matches current package setup, no build step needed
- Write review output to file (not stdout) to avoid shell escaping issues with large JSON

### 4. Decisions and Tradeoffs

#### PR Description: Include or Skip?

**Include with truncation.** PR description costs ~500 tokens at 2000 chars. Diffs run 10k-100k+ tokens. The description provides intent context that improves review quality (why the change was made, linked issues). Truncate at 2000 chars.

#### Composite Action vs Inline Steps?

**Composite action.** Requirements explicitly call for it. Keeps main workflow declarative. Action encapsulates: Node setup, dependency install, review execution. Workflow handles: diff generation, comment posting, label management.

#### Where Does the Code-Reviewer Package Live?

Two options:
1. **Inside `.github/actions/code-review/`** — self-contained, versioned with the workflow
2. **Stay at `packages/code-reviewer/`**, referenced by path — reusable by other consumers

**Recommendation: option 1** — move/duplicate into the action directory. A composite action's `${{ github.action_path }}` references its own directory. Keeping it in `packages/` requires the workflow to `cd` around. Since no other consumer exists yet, colocation is simpler.

#### Pass/Fail Threshold

Requirements don't specify a threshold. Options:
- Any criterion score < 4 = fail
- Average score < 5 = fail
- Any "high" severity finding = fail

This is a prompt/schema design decision for the planning phase.

## Code References

- `packages/code-reviewer/src/agent/reviewer.ts:6-17` — ToolLoopAgent definition + reviewCode function
- `packages/code-reviewer/src/schemas/review.ts:1-19` — Current Zod schemas and types
- `packages/code-reviewer/src/prompts/review.ts:1-14` — System prompt + user prompt builder
- `packages/code-reviewer/src/provider/openai.ts:1-18` — OpenAI provider config with env validation
- `packages/code-reviewer/src/cli.ts:1-20` — Hardcoded demo CLI
- `packages/code-reviewer/src/index.ts` — Barrel exports
- `packages/code-reviewer/package.json:15-18` — Dependencies: ai@7.0.99, @ai-sdk/openai@4.0.66, zod@4.6.5
- `lefthook.yml:1-21` — Existing pre-commit hooks (lint, typecheck, test, rust)
- `context/foundation/tech-stack.md:9-10` — CI provider decision (github-actions, never implemented)
- `context/foundation/roadmap.md:50,74` — CI backlog item + "absent" note

## Architecture Insights

1. **AI SDK v7 structured output** works well for the review use case — `Output.object({ schema })` forces the LLM to return validated JSON matching the Zod schema. This eliminates parsing and validation boilerplate.

2. **ToolLoopAgent without tools** is effectively a structured-output generator. The agent abstraction adds no value over `generateObject()` today, but provides extension point for future tool use (e.g., reading referenced files, checking test coverage).

3. **Monorepo structure** (`packages/code-reviewer/`) with raw TS exports (`"exports": { ".": "./src/index.ts" }`) means no build step — consumers use tsx or similar TS-aware runtimes. GHA needs `node --import tsx` to run it.

4. **Provider abstraction** is minimal but clean — env-validated config with Zod, single model instance export. Switching providers requires changing only `src/provider/`.

## Historical Context

- `context/changes/tool-loop-agent/plan.md` — Completed refactor from monolith to modular structure. Explicitly scoped out: promptfoo evals, tool calling, streaming, new deps. All 4 phases complete.
- `context/changes/tool-loop-agent/plan-brief.md:55` — Key risk flagged: "Model must respect structured output schema."
- `context/foundation/roadmap.md:50` — T-03 backlog item: "test runner wired into CI/pre-commit"
- No prior CI/CD changes in archive — this is genuinely the first CI/CD work for the project.

## Implementation Roadmap (for Planning Phase)

### Workstream A: Upgrade Code-Reviewer Package

1. **New schema** — Add 6 scored criteria (1-10 each), overall verdict (pass/fail), summary text
2. **New prompts** — Criterion-specific scoring rubrics, diff-aware review instructions
3. **Input contract** — Accept `{ diff: string, prTitle: string, prDescription?: string }`
4. **CLI overhaul** — Accept `--diff <path>`, `--pr-title`, `--pr-description` flags (or stdin JSON)
5. **Verdict logic** — Threshold-based pass/fail from criterion scores
6. **Error handling** — Retries, timeouts, structured errors

### Workstream B: GHA Workflow + Composite Action

1. **Create `.github/actions/code-review/action.yml`** — composite action wrapping the reviewer
2. **Create `.github/workflows/ai-code-review.yml`** — trigger, diff, comment, labels
3. **Create labels** — `ai-cr:passed`, `ai-cr:failed`, `ai-cr:review`
4. **Add repository secret** — `OPENAI_API_KEY`
5. **Test with a real PR**

### Dependency Order

Workstream A must complete first (or at least produce a CLI that accepts diff input and returns verdict). Workstream B can be scaffolded in parallel but cannot be tested until A produces usable output.

## Open Questions

1. **Pass/fail threshold** — What score threshold determines pass vs fail? Per-criterion minimum? Average? Both?
2. **Diff size limit** — Should the workflow truncate or chunk large diffs to stay within model context window / control cost?
3. **Package location** — Move code-reviewer into `.github/actions/code-review/` or keep at `packages/` and reference by path?
4. **Model selection** — Stay with OpenAI `gpt-5.6-luna` or switch to a cheaper/faster model for CI cost control?
5. **Retry policy** — How many retries on LLM API failure before marking the check as errored (not failed)?
6. **Review comment format** — Minimal (scores + verdict) or verbose (per-finding details with suggested fixes)?
