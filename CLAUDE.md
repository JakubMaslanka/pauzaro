# CLAUDE.md

## Project Overview

Pauzaro is a desktop habit-tracking app (Tauri 2 + React 19 + TypeScript + Rust). Think "Duolingo for building habits" — reminds developers to take breaks and do exercises. See `@idea-notes.md` for full product vision.

## Data handling

- Use local time everywhere — `new Date()` in JS, `Local::now()` in Rust. App runs locally on one device; no server, no timezone sync needed. Never use `getUTC*()` or `Date.UTC()` in frontend, never use `chrono::Utc` in Rust.

## Architecture Decisions

- **Frontend**: React 19 with Zustand for state management
- **UI Library**: Mantine 9 with custom theme (see `src/theme.ts`)
- **Backend**: Rust via Tauri 2 (commands, system notifications, window management)
- **Persistence**: SQLite via Tauri SQL plugin
- **Bundler**: Vite 7
- **Package manager**: pnpm

## Code Style

- Biome for linting and formatting (tab indentation, double quotes)
- Prefer `interface` for object shapes, `type` for unions/intersections/utility types
- Use discriminated unions for state variants

## Commands

| Task | Command |
|------|---------|
| Dev (frontend only) | `pnpm dev` |
| Dev (full Tauri app) | `pnpm tauri dev` |
| Build production | `pnpm tauri build` |
| Type-check | `tsc --noEmit` |
| Rust check | `cd src-tauri && cargo check` |
| Rust tests | `cd src-tauri && cargo test` |
| Frontend test | `pnpm test` |
| Test (watch) | `pnpm test:watch` |
| Lint + format check | `pnpm lint` |
| Lint + format fix | `pnpm lint:fix` |
| Format only | `pnpm format` |

## Git Conventions

- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`
- Scope optional: `feat(notifications): add break reminder`
- Never append `Co-Authored-By` or `Claude-Session` lines to commit messages

## Communication

- Respond in English
- Code comments in English

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
