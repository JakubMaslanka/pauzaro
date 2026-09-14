# CI/CD Automated PR Code Review — Implementation Plan

## Overview

Upgrade the `code-reviewer` package to score PRs across 6 criteria (1–10) with an LLM-authoritative pass/fail verdict, then wire it into GitHub Actions via a composite action and workflow that posts sticky review comments and applies `ai-cr:passed` / `ai-cr:failed` labels on every PR to master — with on-demand retry via `ai-cr:review` label.

## Current State Analysis

The `code-reviewer` package exists as a working prototype at `packages/code-reviewer/` (6 source files, AI SDK v7 `ToolLoopAgent`, OpenAI `gpt-5.6-luna`, Zod structured output). It accepts a raw code string and returns a `findings[]` array with line/severity/category/message/suggestedFix — covering only bugs and security partially.

No CI/CD exists. No `.github/` directory, no workflows. Only local Lefthook pre-commit hooks. `context/foundation/tech-stack.md` records `ci_provider: github-actions` but it was never implemented.

### Key Discoveries:

- `ToolLoopAgent` with `Output.object({ schema })` forces validated JSON output — solid foundation, schema just needs expanding (`packages/code-reviewer/src/agent/reviewer.ts:6-9`)
- Provider config is clean with env-validated Zod (`packages/code-reviewer/src/provider/openai.ts:4-12`) — env var is `LLM_PROVIDER_API_KEY`, model via `LLM_PROVIDER_MODEL`
- CLI is hardcoded demo with no argument parsing (`packages/code-reviewer/src/cli.ts:3-17`)
- Package uses raw TS exports (`"exports": { ".": "./src/index.ts" }`), no build step — GHA needs `node --import tsx`
- Repo is private, no forks — `pull_request` trigger (not `pull_request_target`) is safe and gives write `GITHUB_TOKEN` + secret access

## Desired End State

Every PR to master automatically receives:
1. A sticky PR comment with a table of 6 criterion scores (1–10), an LLM-decided pass/fail verdict, a summary, and top findings with file references
2. A label: `ai-cr:passed` (green) or `ai-cr:failed` (red)
3. On-demand re-review by adding `ai-cr:review` label

The code-reviewer CLI accepts a diff file + PR metadata, truncates at 3000 LOC, and outputs structured JSON. The composite action encapsulates setup + execution. The workflow handles triggers, diff generation, comment posting, and label management.

## What We're NOT Doing

- Per-file chunked review (single diff, truncated at 3000 LOC)
- Retry logic on LLM API failure (single attempt, clean error exit)
- Score-threshold-based verdict (LLM decides pass/fail directly)
- Moving the package out of `packages/code-reviewer/`
- Build step for the package (keep raw TS with `node --import tsx`)
- Cross-platform CI (GitHub-hosted Ubuntu runners only)
- Caching `node_modules` in GHA (premature optimization)

---

## Phase 1: Code-Reviewer Package Upgrade

### Overview

Overhaul schema, prompts, input contract, and CLI so the code-reviewer accepts a diff file + PR metadata, scores 6 criteria, and outputs a complete review JSON to a file.

### Changes Required:

#### 1. Review Schema

**File**: `packages/code-reviewer/src/schemas/review.ts`

**Intent**: Replace the current `findings[]`-only schema with a complete review schema that includes 6 scored criteria (1–10 each), an LLM-decided verdict (passed/failed), a summary, and a findings array. The LLM is authoritative on the verdict — no numeric threshold.

**Contract**: Export `ReviewResultSchema` as a Zod object with shape:
```typescript
{
  criteria: {
    implementationCorrectness: { score: z.number().int().min(1).max(10), reasoning: z.string() },
    idiomaticity: { score: z.number().int().min(1).max(10), reasoning: z.string() },
    complexity: { score: z.number().int().min(1).max(10), reasoning: z.string() },
    testRiskCoverage: { score: z.number().int().min(1).max(10), reasoning: z.string() },
    documentation: { score: z.number().int().min(1).max(10), reasoning: z.string() },
    securityAndSafety: { score: z.number().int().min(1).max(10), reasoning: z.string() },
  },
  verdict: z.enum(["passed", "failed"]),
  summary: z.string(),
  findings: z.array(ReviewFindingSchema),
}
```
Keep `ReviewFindingSchema` largely as-is but add a `file` field (string, the file path from the diff) alongside `line`.

#### 2. Review Prompts

**File**: `packages/code-reviewer/src/prompts/review.ts`

**Intent**: Replace the generic system prompt with criterion-specific scoring rubrics matching the requirements doc. The prompt must instruct the model to: (a) score each of the 6 criteria on a 1–10 scale using the provided rubric definitions, (b) decide pass/fail based on its overall assessment of review quality, and (c) extract concrete findings with file paths and line numbers from the diff.

**Contract**: Export `REVIEW_INSTRUCTIONS` (system prompt with all 6 rubrics from `requirements.md`) and `buildReviewPrompt(input: ReviewInput): string` that formats diff + PR title + PR description into the user message. The rubric text for each criterion (1 = worst, 10 = best) comes verbatim from `context/changes/ci-cd-code-review/requirements.md`.

#### 3. Input Contract

**File**: `packages/code-reviewer/src/schemas/review.ts`

**Intent**: Define a typed input contract so the reviewer accepts structured PR data instead of a raw code string.

**Contract**: Export `ReviewInputSchema` as:
```typescript
{
  diff: z.string(),
  prTitle: z.string(),
  prDescription: z.string().optional(),
}
```
Export `type ReviewInput = z.infer<typeof ReviewInputSchema>`.

#### 4. Reviewer Agent

**File**: `packages/code-reviewer/src/agent/reviewer.ts`

**Intent**: Update `reviewCode` to accept `ReviewInput` instead of a raw string, and pass it through `buildReviewPrompt`. Keep `ToolLoopAgent` + `Output.object` pattern unchanged.

**Contract**: `reviewCode(input: ReviewInput): Promise<ReviewResult>` — signature change from `string` to `ReviewInput`.

#### 5. LOC Truncation Utility

**File**: `packages/code-reviewer/src/utils/truncate.ts` (new)

**Intent**: Truncate diffs exceeding 3000 lines and report whether truncation occurred, so the CLI can include a note in output.

**Contract**: Export `truncateDiff(diff: string, maxLines?: number): { diff: string; truncated: boolean; originalLines: number }`. Default `maxLines` = 3000.

#### 6. CLI Overhaul

**File**: `packages/code-reviewer/src/cli.ts`

**Intent**: Replace hardcoded demo with a real CLI that reads diff from a file, accepts PR metadata via flags, applies LOC truncation, runs the review, and writes JSON output to a file. No retries — single attempt with clean exit codes.

**Contract**: CLI accepts flags:
- `--diff-file <path>` — path to diff file (required)
- `--pr-title <string>` — PR title (required)
- `--pr-description <string>` — PR description (optional)
- `--output <path>` — output JSON file path (required)

Exit codes: `0` = review completed (check `verdict` in output), `1` = review failed (LLM error, missing input, etc.). On error, write `{ "error": "<message>" }` to output file so the workflow always has parseable JSON.

Use `process.argv` parsing (no external dep) or Node.js built-in `util.parseArgs`.

#### 7. Barrel Exports

**File**: `packages/code-reviewer/src/index.ts`

**Intent**: Update barrel exports to include new types and utilities.

**Contract**: Add exports for `ReviewInputSchema`, `type ReviewInput`, `truncateDiff`.

### Success Criteria:

#### Automated Verification:

- Type-check passes: `cd packages/code-reviewer && npx tsc --noEmit`
- CLI prints usage when called with no args: `node --import tsx src/cli.ts` exits with code 1
- CLI with valid input produces JSON output file with all 6 criteria scores, verdict, summary, and findings array

#### Manual Verification:

- Run CLI against a real diff file from this repo, verify review quality and scoring makes sense
- Verify truncation works by testing with a diff > 3000 lines

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Composite Action

### Overview

Create a GitHub Actions composite action at `.github/actions/code-review/action.yml` that encapsulates: Node.js + pnpm setup, dependency installation for the code-reviewer package, and execution of the review CLI. The action takes diff + PR metadata as inputs and outputs the review JSON path.

### Changes Required:

#### 1. Composite Action Definition

**File**: `.github/actions/code-review/action.yml` (new)

**Intent**: Self-contained composite action that sets up the runtime and runs the code-reviewer. Isolates all setup/execution detail so the calling workflow stays declarative.

**Contract**: Composite action with:

Inputs:
- `diff-file` (required) — path to diff file
- `pr-title` (required) — PR title string
- `pr-description` (optional) — PR description string
- `llm-api-key` (required) — LLM provider API key (passed from workflow secret)
- `llm-model` (optional, default from provider config) — model override

Outputs:
- `result-file` — path to the review JSON output
- `verdict` — "passed" or "failed" or "error"

Steps (all with explicit `shell: bash`):
1. Set up pnpm + Node.js 22 via `pnpm/action-setup@v4` and `actions/setup-node@v4`
2. Install dependencies: `cd packages/code-reviewer && pnpm install --frozen-lockfile`
3. Run review CLI: `node --import tsx packages/code-reviewer/src/cli.ts --diff-file ... --pr-title ... --output ...` with `LLM_PROVIDER_API_KEY` env var
4. Parse verdict from output JSON and write to `$GITHUB_OUTPUT`

### Success Criteria:

#### Automated Verification:

- `action.yml` is valid YAML: `python3 -c "import yaml; yaml.safe_load(open('.github/actions/code-review/action.yml'))"`
- All inputs and outputs declared
- Every `run:` step has explicit `shell:` key

#### Manual Verification:

- Action file structure matches GitHub composite action spec (inputs, outputs, runs.using: composite, steps with shell)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Workflow Orchestration

### Overview

Create the GitHub Actions workflow at `.github/workflows/ai-code-review.yml` that triggers on PR events, generates the diff, calls the composite action, posts a sticky review comment, and manages `ai-cr:passed` / `ai-cr:failed` / `ai-cr:review` labels.

### Changes Required:

#### 1. Workflow File

**File**: `.github/workflows/ai-code-review.yml` (new)

**Intent**: Orchestrate the full review lifecycle: trigger on PR events (including on-demand retry via label), generate a filtered diff, call the composite action, format and post a sticky PR comment, apply verdict labels, and clean up the retry label.

**Contract**:

**Triggers:**
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled]
    branches: [master]
```

**Job-level guard** — skip when `labeled` event is for any label other than `ai-cr:review`:
```yaml
if: >-
  github.event.action != 'labeled' ||
  github.event.label.name == 'ai-cr:review'
```

**Permissions:**
```yaml
permissions:
  contents: read
  pull-requests: write
```

**Steps (in order):**

1. **Checkout** — `actions/checkout@v4` with `fetch-depth: 0` (full history for diff)

2. **Idempotent label pre-creation** — `gh label create` with `--force` for all three labels (`ai-cr:passed` green `0E8A16`, `ai-cr:failed` red `D93F0B`, `ai-cr:review` blue `0075CA`). Env: `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`

3. **Generate diff** — `git diff` between PR base and head SHAs, filtered to exclude lockfiles and assets (`-- . ':!*.lock' ':!package-lock.json' ':!*.png' ':!*.jpg' ':!*.svg' ':!*.ico' ':!*.woff' ':!*.woff2'`). Write to `$RUNNER_TEMP/pr.diff`. Use `${{ github.event.pull_request.base.sha }}` and `${{ github.event.pull_request.head.sha }}`.

4. **Call composite action** — `uses: ./.github/actions/code-review` with inputs from PR event context and `llm-api-key: ${{ secrets.LLM_PROVIDER_API_KEY }}`

5. **Post sticky comment** — `actions/github-script@v7` step that:
   - Reads the review JSON output file
   - Formats a markdown comment with: verdict badge (✅/❌), 6-criteria score table, summary, top findings (max 5) with file:line references, truncation note if applicable
   - Uses hidden HTML marker `<!-- ai-code-review -->` to find existing comment
   - Updates existing comment if found, creates new one otherwise
   - Uses `github.rest.issues.listComments` / `createComment` / `updateComment`

6. **Apply verdict label** — Remove both `ai-cr:passed` and `ai-cr:failed` (ignore errors), then add the verdict label. Use `gh pr edit` with `--add-label` / `--remove-label`.

7. **Remove retry label** — If the trigger was `labeled` with `ai-cr:review`, remove that label: `gh pr edit $PR --remove-label "ai-cr:review"`. Conditional on `github.event.action == 'labeled'`.

8. **Handle review error** — If composite action output verdict is `"error"`, post a comment noting the failure and skip labeling. Don't apply `ai-cr:failed` for infrastructure errors — only for genuine review failures.

### Success Criteria:

#### Automated Verification:

- Workflow YAML is valid: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ai-code-review.yml'))"`
- Workflow has correct `on.pull_request` triggers and `if:` guard
- Permissions block present with `contents: read` and `pull-requests: write`

#### Manual Verification:

- Open a test PR to master — verify workflow triggers, review comment appears, label applied
- Push a new commit to same PR — verify comment is updated (not duplicated), label swaps if verdict changes
- Add `ai-cr:review` label — verify re-review triggers and label is removed afterward
- Verify large diff (>3000 LOC) shows truncation note in comment
- Verify LLM API error produces error comment, not `ai-cr:failed` label

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `truncateDiff` — under limit returns unchanged, at limit returns unchanged, over limit truncates and reports correctly
- `ReviewInputSchema` — validates valid input, rejects missing required fields
- `ReviewResultSchema` — validates complete result with all 6 criteria, rejects invalid scores (0, 11, non-integer)

### Integration Tests:

- CLI end-to-end with mock diff file — verify JSON output structure (requires LLM API key, so run manually or with test key)

### Manual Testing Steps:

1. Run CLI against a real diff from this repo, verify output JSON has all fields
2. Open a PR, verify the full workflow end-to-end
3. Test the on-demand retry via `ai-cr:review` label
4. Test with a diff > 3000 LOC to verify truncation

## Performance Considerations

- Diff capped at 3000 LOC to control token cost and stay within model context window
- No retries — single LLM call per review, fail fast on error
- Sticky comment pattern avoids duplicate comments on `synchronize` events
- File filtering (`':!*.lock'` etc.) reduces diff noise and token cost

## Migration Notes

- Repository secret `LLM_PROVIDER_API_KEY` must be created before first workflow run
- Labels are created idempotently by the workflow — no manual setup needed
- No existing CI to migrate from — this is greenfield

## References

- Requirements: `context/changes/ci-cd-code-review/requirements.md`
- Research: `context/changes/ci-cd-code-review/research.md`
- Current schema: `packages/code-reviewer/src/schemas/review.ts:1-19`
- Current agent: `packages/code-reviewer/src/agent/reviewer.ts:6-17`
- Current prompts: `packages/code-reviewer/src/prompts/review.ts:1-14`
- Current CLI: `packages/code-reviewer/src/cli.ts:1-20`
- Provider config: `packages/code-reviewer/src/provider/openai.ts:1-18`
- Tech-stack CI decision: `context/foundation/tech-stack.md:9-10`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Code-Reviewer Package Upgrade

#### Automated

- [x] 1.1 Type-check passes: `cd packages/code-reviewer && npx tsc --noEmit`
- [x] 1.2 CLI prints usage with no args (exit code 1)
- [x] 1.3 CLI with valid input produces JSON with all 6 criteria, verdict, summary, findings

#### Manual

- [ ] 1.4 Run CLI against real diff, verify review quality and scoring
- [ ] 1.5 Verify truncation works with diff > 3000 lines

### Phase 2: Composite Action

#### Automated

- [x] 2.1 `action.yml` is valid YAML
- [x] 2.2 All inputs and outputs declared
- [x] 2.3 Every `run:` step has explicit `shell:` key

#### Manual

- [ ] 2.4 Action structure matches GitHub composite action spec

### Phase 3: Workflow Orchestration

#### Automated

- [x] 3.1 Workflow YAML is valid
- [x] 3.2 Correct `on.pull_request` triggers and `if:` guard
- [x] 3.3 Permissions block with `contents: read` and `pull-requests: write`

#### Manual

- [ ] 3.4 Open test PR — workflow triggers, comment appears, label applied
- [ ] 3.5 Push commit to same PR — comment updated (not duplicated)
- [ ] 3.6 Add `ai-cr:review` label — re-review triggers, label removed
- [ ] 3.7 Large diff shows truncation note
- [ ] 3.8 LLM API error produces error comment, not `ai-cr:failed`
