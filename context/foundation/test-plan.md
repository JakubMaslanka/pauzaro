---
project: "Pauzaro"
version: 1
status: active
created: 2026-09-01
prd_version: 1
test_base_profile: sparse
---

# Test Plan: Pauzaro

> Phased rollout strategy for test coverage. Orchestrated by `/10x-test-plan`.
> Schema: `references/test-plan-schema.md`. Edit status cells in §3 only via the orchestrator.

## §1 Strategy

Three load-bearing principles — every rollout phase obeys these.

1. **Cost × signal.** Every test must answer: *what is the cheapest test that gives a real signal for this risk?* Do not promote to e2e because it "feels safer"; do not add an AI-native layer over a deterministic signal.

2. **User concerns are evidence.** Risks from the Phase 2 interview carry the same weight as PRD lines or hot-spot data.

3. **Risks are scenarios, not code locations.** The risk map (§2) cites evidence — PRD lines, interview answers, hot-spot directories with churn counts. It never asserts a file as "where the failure lives." File anchors belong in research (`/10x-research`), not in this plan.

## §2 Risk Map

| # | Risk (failure scenario) | Impact | Likelihood | Source(s) — evidence, not anchors |
|---|---|---|---|---|
| 1 | Overlay doesn't fire at scheduled time — user misses break, product worthless | High | High | Interview Q1 (top worry), Q3 (low-confidence area); PRD guardrail "powiadomienia muszą działać niezawodnie"; hot-spot dir `src-tauri/src/` 20 changes/30d |
| 2 | UTC/local timezone confusion — scheduler fires at wrong time or streak day boundaries shift by timezone offset | High | High | Interview Q2 (burned before on timezone bugs); CLAUDE.md rule "always use UTC dates"; hot-spot dir `src-tauri/src/` |
| 3 | Streak calculation silently wrong — user sees 14-day streak but reality is 10 | High | Medium | Interview Q4 (zero tests, scariest gap); PRD business logic section; hot-spot dir `src-tauri/src/commands/` 11 changes/30d |
| 4 | Snooze counter doesn't enforce 3x auto-fail — user snoozes forever, never gets "failed" state | High | Medium | PRD FR-007 "3x snooze = nawyk automatycznie oznaczony jako niewykonany"; US-02 AC |
| 5 | Dashboard shows stale state after overlay action — user marks done via overlay, dashboard still shows pending | Medium | Medium | Two-window architecture (overlay + main); hot-spot dir `src/components/dashboard/` 39 changes/30d |
| 6 | Cross-platform overlay divergence — overlay works on macOS but breaks on Windows (or vice versa) | Medium | Medium | Interview Q2 (burned on Tauri cross-platform); PRD NFR "macOS i Windows"; roadmap S-02 unknowns |

### Risk Response Guidance

| Risk # | What would prove protection | Must challenge | Context needed | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| 1 | Overlay window created and shown at exact scheduled time; missed schedule detected | "Timer set = overlay will fire" — timers can drift, sleep/wake can skip intervals | Entry point for schedule evaluation, timer mechanism, overlay creation path | Integration test (Rust: scheduler + mock clock) | Testing timer *setup* instead of timer *firing*; asserting "no error" instead of "overlay shown" |
| 2 | Dates stored as UTC in DB; streak boundaries use UTC midnight, not local midnight; schedule comparisons use UTC | "We use UTC everywhere" — one `new Date()` or `Local::now()` in the chain breaks it | All date creation/comparison paths in Rust + JS; DB schema date columns | Unit test (pure date logic in Rust) | Using production clock in test; asserting stored date format without checking calculation correctness |
| 3 | Given known completion pattern (done/missed/done/done/missed), streak count matches hand-computed expected value | "Streak = consecutive days" — day boundaries, partial days, multiple time slots per day complicate this | Streak calculation function, completion record shape, what constitutes "day completed" | Unit test (pure function, known inputs/outputs) | Oracle from implementation: copying the streak formula into the test instead of hand-computing expected values |
| 4 | After 3 snoozes on same overlay trigger, habit auto-marked as failed; no 4th snooze possible | "Counter increments on snooze" — counter could reset on window close/reopen, process restart | Snooze state storage (memory vs DB), overlay lifecycle, what triggers counter increment vs reset | Unit test (counter logic) + integration (overlay→counter→fail transition) | Testing counter increment in isolation without testing the "3 reached → mark failed" transition |
| 5 | After overlay "done" action, dashboard reflects completion within 1 render cycle without manual refresh | "Write to DB = UI updates" — Zustand store may not re-fetch after Tauri command completes | Tauri command → DB write → event/callback → Zustand invalidation → re-render chain | Integration test (Tauri command + store update) | Mocking the entire Tauri layer and testing only Zustand — misses the actual sync gap |
| 6 | Overlay window appears as always-on-top, captures focus, and accepts click on both macOS and Windows | "It works on my machine" — Tauri window flags may behave differently per OS | Tauri window configuration, OS-specific always-on-top behavior, focus-stealing policies | Manual smoke test + documented checklist | Writing an automated e2e for window focus behavior that only runs in CI on one OS |

### Abuse/Security Assessment

No auth, no payments, no network calls, no server. User input (habit names, descriptions, schedules) goes to local SQLite only via Tauri SQL plugin (parameterized queries). Attack surface negligible for local single-user desktop app. No abuse rows warranted.

## §3 Phased Rollout

| # | Phase name | Goal | Risks covered | Test types | Status | Change folder | Linear |
|---|---|---|---|---|---|---|---|
| 1 | Critical-path backend logic | Prove streak calculation, snooze 3x auto-fail rule, and UTC date handling are correct via pure Rust unit tests — cheapest layer for densest untested business logic | #2, #3, #4 | Rust unit tests | change opened | context/changes/testing-critical-path-backend/ | [JAC-13](https://linear.app/jacobs-agents-playground/issue/JAC-13/t-01-critical-path-backend-logic-tests) |
| 2 | Scheduler + overlay reliability | Prove scheduler fires correctly at configured times, handles timezone correctly, and overlay→completion→dashboard path works end-to-end | #1, #2, #5 | Rust integration tests, Tauri command round-trip tests | not started | — | [JAC-14](https://linear.app/jacobs-agents-playground/issue/JAC-14/t-02-scheduler-overlay-reliability-tests) |
| 3 | Cross-platform smoke + quality gates | Prove overlay behavior on both platforms; wire `cargo test` + `pnpm test` into pre-commit or CI when available | #6 | Manual smoke checklist, optional CI configuration | not started | — | [JAC-15](https://linear.app/jacobs-agents-playground/issue/JAC-15/t-03-cross-platform-smoke-quality-gates) |

## §4 Stack

- **Language/framework:** Rust (Tauri 2 backend) + TypeScript (React 19 frontend, Zustand state, Mantine 9 UI)
- **Test runners:** Vitest 4.x (frontend, configured in `package.json`), `cargo test` (Rust, standard)
- **Test-base profile:** sparse — vitest configured, 7 test files (6 in `src/components/dashboard/` + `src/components/onboarding/`, 1 Rust integration test in `src-tauri/tests/`). Backend business logic effectively untested.
- **Stack grounding tools (current session):**
  - Docs: Context7 MCP available — can query Tauri 2, React 19, Vitest, Mantine 9 docs; checked: 2026-09-01
  - Search: Exa.ai MCP available — web search for current Tauri testing patterns; checked: 2026-09-01
  - Runtime/browser: not available in current session
  - Provider/platform: Linear MCP available — issue tracking; checked: 2026-09-01

## §5 Negative Space

What is explicitly NOT tested and why:

- **Mantine/UI library internals** — Interview Q5: "testing third-party component rendering is their job." No component rendering tests for Mantine primitives.
- **Cloud sync / multi-device** — PRD non-goal: "zero network calls, pełna prywatność." No network tests.
- **Social features / leaderboard** — PRD non-goal: "solo app." Not applicable.
- **i18n / localization** — PRD FR-010 demoted to v2. Single language in MVP.
- **Dark/light theme switching** — PRD FR-011 demoted to v2.
- **Multi-habit management** — PRD FR-005 demoted to v2. MVP = 1 habit.

## §6 Cookbook

### Phase 1: Critical-path backend logic

**Patterns shipped:** (TBD — see §3 Phase 1 for streak calculation correctness, snooze 3x auto-fail enforcement, UTC date boundary verification patterns)
**Location:** (TBD — change folder path)
**How to add a test in this area:** (TBD — recipe added by `/10x-implement`)

### Phase 2: Scheduler + overlay reliability

**Patterns shipped:** (TBD — see §3 Phase 2 for scheduler timing verification, timezone handling, overlay→completion→dashboard sync patterns)
**Location:** (TBD — change folder path)
**How to add a test in this area:** (TBD — recipe added by `/10x-implement`)

### Phase 3: Cross-platform smoke + quality gates

**Patterns shipped:** (TBD — see §3 Phase 3 for cross-platform overlay smoke checklist, CI/pre-commit gate wiring)
**Location:** (TBD — change folder path)
**How to add a test in this area:** (TBD — recipe added by `/10x-implement`)

## §7 Refresh Cadence

Re-run `/10x-test-plan --refresh` when:
- New top-3 risk surfaces (e.g., streak freeze implementation in S-04 adds new business logic)
- Stack grounding tool `checked:` date > 3 months old (currently 2026-09-01)
- Tech stack changes (new test framework, Tauri major version, etc.)
- §5 negative-space no longer matches what you believe should stay untested
