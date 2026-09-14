# Code Reviewer ToolLoopAgent Refactor — Plan Brief

> Full plan: `context/changes/tool-loop-agent/plan.md`

## What & Why

Refactor the single-file reviewer into a modular ToolLoopAgent-based package. The monolith mixes config, prompts, agent logic, and demo code in one file — no structured output, no reusable exports, no eval surface.

## Starting Point

Single 52-line `src/index.ts` — raw `generateText` call, inline prompts, unstructured text output, hardcoded fibonacci test input. AI SDK v7.0.99, Zod v4.6.5, `@ai-sdk/openai` v4.0.66 already installed.

## Desired End State

6 files across `schemas/`, `prompts/`, `provider/`, `agent/` folders. `reviewCode` function + schemas exportable from barrel `src/index.ts`. CLI demo in `src/cli.ts`. Structured `ReviewResult` (findings array) via `Output.object()`. Clean public surface for future promptfoo evals.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|----------|--------|-------------------|
| Output schema | Findings array (`ReviewResult`) | Per-finding granularity maps directly to promptfoo eval assertions |
| Input contract | Code string only | Simplest testable contract — no file/diff context yet |
| Export style | Instance + `reviewCode` function + schemas | Agent ready to use, convenience function for evals, schemas for type-safe assertions |
| Provider | OpenAI (`@ai-sdk/openai`) | Already installed, matches existing env var contract |
| File layout | `schemas/`, `prompts/`, `provider/`, `agent/` folders | Groups by concern, scales for future additions |

## Scope

**In scope:** Schema extraction, prompt extraction, provider isolation, ToolLoopAgent setup, barrel exports, CLI relocation, package.json scripts + exports

**Out of scope:** promptfoo eval config, tool calling, streaming, new deps, .env var name changes

## Architecture / Approach

Four-phase incremental extraction. Each phase type-checkable independently:
1. Pure data out (schemas + prompts)
2. Wiring (provider + agent)
3. Surface (barrel + CLI + package.json)
4. Final verification

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Extract Schemas & Prompts | `schemas/review.ts`, `prompts/review.ts` | None — pure extraction |
| 2. Provider + Agent Module | `provider/openai.ts`, `agent/reviewer.ts` | Output typing must align with ToolLoopAgent generics |
| 3. Public Surface & CLI | Barrel `index.ts`, `cli.ts`, updated scripts | Old index.ts replaced — must not break `pnpm start` |
| 4. Verify | End-to-end smoke run | Model might not populate all schema fields reliably |

**Prerequisites:** None — all dependencies installed
**Estimated effort:** ~1 session, 4 incremental phases

## Open Risks & Assumptions

- Model must respect structured output schema — instructions need to specify field expectations clearly
- Zod v4 `z.infer` assumed compatible with AI SDK `Output.object()` (verified in bundled type defs)

## Success Criteria (Summary)

- `pnpm start` produces structured JSON findings with all schema fields populated
- `npx tsc --noEmit` passes clean after every phase
- `reviewCode` + schemas importable from barrel `src/index.ts`
