# Code Reviewer ToolLoopAgent Refactor — Implementation Plan

## Overview

Refactor the single-file reviewer into a modular ToolLoopAgent-based package: extract schemas, prompts, and provider wiring into their own modules; build a reusable agent module; expose a clean public surface for future promptfoo evals; relocate the demo to a CLI entry.

## Current State Analysis

Single 52-line `src/index.ts` that:
- Parses config from env vars (`LLM_PROVIDER_API_KEY`, `LLM_PROVIDER_MODEL`)
- Creates an OpenAI provider via `@ai-sdk/openai`
- Calls `generateText` with inline prompt/instructions
- Returns unstructured text review
- Has hardcoded fibonacci test input mixed with agent logic
- No reusable exports, no structured output, no agent pattern

### Key Discoveries:

- AI SDK v7.0.99 — `ToolLoopAgent`, `Output` exported from `ai`
- Zod v4.6.5 — import from `zod`
- `@ai-sdk/openai` v4.0.66 — `createOpenAI` for provider setup
- Package: `"type": "module"`, `moduleResolution: "Node16"`, `rootDir: "src"`
- Env vars: `LLM_PROVIDER_API_KEY`, `LLM_PROVIDER_MODEL` (default `gpt-5.6-luna`)

## Desired End State

```
src/
  schemas/
    review.ts      — Severity, ReviewFinding, ReviewResult schemas + types
  prompts/
    review.ts      — system instructions + user-prompt builder
  provider/
    openai.ts      — env load, getOpenAI, model resolution
  agent/
    reviewer.ts    — ToolLoopAgent instance, reviewCode function
  index.ts         — barrel (reviewCode + schemas/types only)
  cli.ts           — demo runner
```

- `src/index.ts` barrel exports `reviewCode`, schemas, and types — clean public surface
- `src/agent/reviewer.ts` owns the `ToolLoopAgent` instance
- `src/cli.ts` runs demo review, prints structured JSON
- Agent produces structured `ReviewResult` output via `Output.object()`
- promptfoo can `import { reviewCode, ReviewResult } from "code-reviewer"`

### Verification:

- `npx tsc --noEmit` passes after each phase
- `pnpm start` runs demo, produces schema-valid structured output

## What We're NOT Doing

- No promptfoo eval configuration (explicitly out of scope)
- No tools (agent uses structured output only, no tool calling)
- No streaming (CLI uses `generate()`)
- No new dependencies
- No changes to `.env` / `.env.example` variable names

## Implementation Approach

Four-phase incremental refactor. Each phase is independently type-checkable. Schemas and prompts extracted first (pure data, no behavior change), then provider + agent wiring, then public surface + CLI relocation.

## Phase 1: Extract Schemas & Prompts

### Overview

Move structured output schemas and prompt strings into dedicated modules. Pure extraction — no behavior change.

### Changes Required:

#### 1. Review Schemas

**File**: `src/schemas/review.ts`

**Intent**: Define Zod schemas for the code review structured output — severity enum, individual finding, and top-level review result wrapping a findings array.

**Contract**: Exports `SeveritySchema` (z.enum), `ReviewFindingSchema` (z.object with line, severity, category, message, suggestedFix), `ReviewResultSchema` (z.object wrapping findings array). Also exports inferred types: `Severity`, `ReviewFinding`, `ReviewResult`.

#### 2. Review Prompts

**File**: `src/prompts/review.ts`

**Intent**: Extract system instructions into a constant and create a user-prompt builder function that wraps code input in a review request.

**Contract**: Exports `REVIEW_INSTRUCTIONS: string` (system persona + review criteria + output field expectations) and `buildReviewPrompt(code: string): string` (wraps code in markdown fence with review request).

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx tsc --noEmit`
- New modules are importable (no circular deps)

#### Manual Verification:

- Schemas match intended review output shape

**Implementation Note**: No wiring yet — these modules are standalone. Type check after creating both files.

---

## Phase 2: Provider + Agent Module

### Overview

Extract OpenAI provider setup and build the ToolLoopAgent instance that uses schemas and prompts from Phase 1.

### Changes Required:

#### 1. OpenAI Provider

**File**: `src/provider/openai.ts`

**Intent**: Isolate env var parsing and OpenAI provider creation. Expose a resolved model instance.

**Contract**: Exports `config` (parsed env), `openai` (provider instance from `createOpenAI`), and `model` (resolved model from `openai(config.model)`). Uses same `LLM_PROVIDER_API_KEY` / `LLM_PROVIDER_MODEL` env vars with Zod validation.

#### 2. Reviewer Agent

**File**: `src/agent/reviewer.ts`

**Intent**: Create the `ToolLoopAgent` instance wired to OpenAI provider, review schemas, and prompts. Expose a `reviewCode` convenience function.

**Contract**:
- Constructs `new ToolLoopAgent({ model, instructions: REVIEW_INSTRUCTIONS, output: Output.object({ schema: ReviewResultSchema }) })`
- Exports `codeReviewAgent` (the ToolLoopAgent instance)
- Exports `reviewCode(code: string): Promise<ReviewResult>` — calls `codeReviewAgent.generate({ prompt: buildReviewPrompt(code) })` and returns `result.output`

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx tsc --noEmit`

#### Manual Verification:

- Agent construction compiles with correct Output typing

**Implementation Note**: Old `src/index.ts` still exists and works during this phase. Type check after both files created.

---

## Phase 3: Public Surface & CLI

### Overview

Replace `src/index.ts` with a barrel file. Move demo to `src/cli.ts`. Update `package.json` scripts.

### Changes Required:

#### 1. Barrel Export

**File**: `src/index.ts`

**Intent**: Replace the monolith with a clean public surface exporting only what external consumers need — `reviewCode` function, schemas, and types.

**Contract**: Re-exports `reviewCode`, `codeReviewAgent` from `./agent/reviewer.js`. Re-exports all schemas and types from `./schemas/review.js`. Does NOT export provider internals.

#### 2. CLI Entry

**File**: `src/cli.ts`

**Intent**: Move the demo runner (fibonacci test input, console output) to a dedicated CLI file.

**Contract**: Imports `reviewCode` from `./index.js`. Runs `reviewCode(brokenFibonacci)`, prints structured JSON via `console.log(JSON.stringify(result, null, 2))`. Self-executing `main().catch(console.error)`.

#### 3. Package Scripts

**File**: `package.json`

**Intent**: Point `start` and `dev` scripts at `src/cli.ts`. Add `exports` field for package consumers.

**Contract**:
- `"start": "tsx --env-file=.env src/cli.ts"`
- `"dev": "tsx --env-file=.env watch src/cli.ts"`
- `"exports": { ".": "./src/index.ts" }` (source-level export for promptfoo/tsx consumers)

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx tsc --noEmit`
- `pnpm start` runs and produces structured JSON output

#### Manual Verification:

- Barrel exports are minimal — no provider leaking
- Demo output contains findings array with all schema fields

**Implementation Note**: This phase removes the old monolith content from `src/index.ts`. After automated verification, pause for manual smoke test.

---

## Phase 4: Verify

### Overview

Final end-to-end verification — type check + live run confirming schema-valid output.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes clean
- `pnpm start` produces valid structured output

#### Manual Verification:

- Output contains findings array with `severity`, `category`, `message`, `suggestedFix` per finding
- `import { reviewCode, ReviewResult } from "code-reviewer"` pattern works conceptually

---

## Testing Strategy

### Manual Testing Steps:

1. `npx tsc --noEmit` after each phase
2. `pnpm start` after Phase 3 — confirm structured JSON output
3. Verify each finding has `line`, `severity`, `category`, `message`, `suggestedFix` fields
4. Confirm barrel only exports public API (no provider internals)

## References

- AI SDK ToolLoopAgent docs: `node_modules/ai/docs/03-agents/02-building-agents.mdx`
- AI SDK structured output docs: `node_modules/ai/docs/03-ai-sdk-core/10-generating-structured-data.mdx`
- AI SDK skill: `packages/code-reviewer/.claude/skills/ai-sdk/SKILL.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extract Schemas & Prompts

#### Automated

- [ ] 1.1 Type check passes after schema + prompt extraction

#### Manual

- [ ] 1.2 Schemas match intended review output shape

### Phase 2: Provider + Agent Module

#### Automated

- [ ] 2.1 Type check passes after provider + agent wiring

#### Manual

- [ ] 2.2 Agent construction compiles with correct Output typing

### Phase 3: Public Surface & CLI

#### Automated

- [ ] 3.1 Type check passes
- [ ] 3.2 `pnpm start` produces structured JSON output

#### Manual

- [ ] 3.3 Barrel exports are minimal — no provider leaking
- [ ] 3.4 Demo output contains findings array with all schema fields

### Phase 4: Verify

#### Automated

- [ ] 4.1 Final `npx tsc --noEmit` clean
- [ ] 4.2 Final `pnpm start` smoke run — schema-valid output
