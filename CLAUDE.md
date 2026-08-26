# CLAUDE.md

## Project Overview

Pauzaro is a desktop habit-tracking app (Tauri 2 + React 19 + TypeScript + Rust). Think "Duolingo for building habits" — reminds developers to take breaks and do exercises. See `@idea-notes.md` for full product vision.

## Data handling

- always use UTC dates, not local JS time new Date()

## Architecture Decisions

- **Frontend**: React 19 with Zustand for state management
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

## Communication

- Respond in English
- Code comments in English