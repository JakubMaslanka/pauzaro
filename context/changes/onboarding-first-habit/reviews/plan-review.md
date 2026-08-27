<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Onboarding + First Habit Creation

- **Plan**: context/changes/onboarding-first-habit/plan.md
- **Mode**: Deep
- **Date**: 2026-08-27
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 0 critical · 5 warnings · 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓, Progress↔Phase 4/4 ✓ (28 items)

## Findings

### F1 — greet removal in Phase 1 while frontend still calls it

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Change 8
- **Detail**: Phase 1 removes `greet` from Rust invoke_handler. Phase 2 deletes App.tsx which calls `invoke("greet")`. Between commits, clicking the greet button triggers unhandled promise rejection.
- **Fix**: Move greet removal from Phase 1 Change 8 to Phase 2 Change 8. Phase 1 keeps greet registered alongside new commands.
- **Decision**: FIXED — greet removal moved to Phase 2 Change 8

### F2 — Routing guard specified identically in Phase 2 and Phase 4

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Change 6 + Phase 4 Change 4
- **Detail**: Phase 2 builds full beforeLoad redirect in index.tsx. Phase 4 re-specifies identical logic in same file. Implementer may be confused about stub vs real.
- **Fix A ⭐ Recommended**: Build real guard in Phase 2, remove Phase 4 Change 4.
- **Fix B**: Stub in Phase 2 (always → onboarding), real guard in Phase 4.
- **Decision**: DISMISSED — user considers duplication acceptable for clarity

### F3 — Dynamic lucide-react icon rendering unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 Change 4 (IconPicker) + Phase 4 Change 1 (HabitCard)
- **Detail**: Plan says HabitCard renders icon "dynamically by name" but lucide-react exports named components — no built-in name→component lookup. Plan doesn't specify import strategy or shared helper.
- **Fix**: Add note to Phase 3 Change 4 specifying `import { icons } from "lucide-react"` approach and shared DynamicIcon helper.
- **Decision**: FIXED — icon import strategy and DynamicIcon helper added to Phase 3 Change 4

### F4 — Mid-onboarding app close creates duplicate profiles

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 Change 5 (UserProfileRepository) + Phase 3 Change 3 (NameStep)
- **Detail**: If user closes after NameStep (profile created, onboarding_completed=false) then relaunches, wizard restarts, NameStep creates duplicate profile. getUserProfile() returns first (old name).
- **Fix A ⭐ Recommended**: Make UserProfileRepository::create an upsert.
- **Fix B**: NameStep checks existing profile before creating.
- **Decision**: FIXED via Fix B — NameStep checks existing profile before creating

### F5 — Component file structure contradicts src/CLAUDE.md

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 + Phase 4 component paths
- **Detail**: src/CLAUDE.md prescribes directory-per-component with co-located tests. Plan used `__tests__/` subfolder pattern.
- **Fix**: Update plan test paths to co-locate with components.
- **Decision**: FIXED — test paths updated to co-locate per src/CLAUDE.md

### F6 — Orphaned scaffold files and stale HTML title

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Change 8
- **Detail**: Phase 2 deletes App.tsx and App.css but misses `src/assets/react.svg` (orphaned) and `index.html` title ("Tauri + React + Typescript" → "Pauzaro").
- **Fix**: Add react.svg deletion and index.html title update to Phase 2 Change 8.
- **Decision**: FIXED — react.svg deletion and title update added
