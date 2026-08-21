# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pauzaro is a desktop habit-tracking app (Tauri 2 + React 19 + TypeScript + Rust). Think "Duolingo for building habits" — reminds developers to take breaks and do exercises. See `@idea-notes.md` for full product vision.

## Architecture Decisions

- **Frontend**: React 19 with Zustand for state management
- **Backend**: Rust via Tauri 2 (commands, system notifications, window management)
- **Persistence**: SQLite via Tauri SQL plugin
- **Bundler**: Vite 7
- **Package manager**: pnpm

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

## Code Style

- Biome for linting and formatting (tab indentation, double quotes)
- TypeScript strict mode with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Prefer `interface` for object shapes, `type` for unions/intersections/utility types
- Use discriminated unions for state variants
- Tauri commands in `src-tauri/src/` expose to frontend via `@tauri-apps/api/core` invoke

## Git Conventions

- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`
- Scope optional: `feat(notifications): add break reminder`

## Communication

- Respond in English
- Code comments in English

## Project Structure

- `src/` — React frontend (TypeScript)
- `src-tauri/src/` — Rust backend (Tauri commands)
- `src-tauri/tauri.conf.json` — Tauri app config (identifier: `com.nondescriptstudio.pauzaro`)

For module-specific instructions, add `CLAUDE.md` files in subdirectories — they load automatically when working in those directories. For cross-cutting rules (e.g., code style, testing), use `.claude/rules/` with focused files.
