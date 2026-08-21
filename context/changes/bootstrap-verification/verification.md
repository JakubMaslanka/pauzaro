---
starter_id: tauri
project_name: pauzaro
phase_3_status: skipped
reason: "Tauri app already scaffolded via npm create tauri-app prior to bootstrapper invocation"
---

## Hand-off

Consumed from `context/foundation/tech-stack.md`:

- **Starter**: tauri — Tauri
- **Package manager**: cargo (Rust) + pnpm (frontend)
- **Language family**: rust
- **Bootstrapper confidence**: verified
- **Path taken**: standard
- **Deployment target**: self-host
- **CI provider**: github-actions
- **CI default flow**: auto-deploy-on-merge

### Why this stack

Solo developer building a lightweight desktop break-reminder app (macOS + Windows) with overlay notifications, streak tracking, and local-only data storage. Tauri is the vetted recommended default for (desktop, rust) — Rust backend for system-level overlay windows and scheduling, web frontend (React + TypeScript) for the dashboard UI. All four agent-friendly criteria pass: typed (Rust + TypeScript), convention-based (Tauri project structure), popular in training data (within Rust ecosystem), and well-documented. Zero network calls and ≤50MB RAM requirement align with Tauri's lightweight footprint versus Electron. Bootstrapper confidence is verified — scaffolding will be smooth.

## Pre-scaffold verification

Skipped — project already scaffolded.

## Scaffold log

**Status**: Skipped. Tauri app was already scaffolded via `npm create tauri-app` (commit c6567a0: "Init 10xdev + tauri app") before bootstrapper invocation. Re-scaffolding would create conflict noise with no benefit.

Existing scaffold fingerprint:
- `src-tauri/Cargo.toml` — Rust backend
- `src-tauri/tauri.conf.json` — Tauri config
- `src-tauri/build.rs` — build script
- `src/App.tsx`, `src/main.tsx` — React frontend
- `package.json`, `pnpm-lock.yaml` — JS dependencies
- `vite.config.ts` — build tooling
- `index.html` — entry point

## Post-scaffold audit

Not run (scaffold skipped).

## Hints recorded but not acted on

These hint values from the hand-off are preserved for future tooling (CLAUDE.md/AGENTS.md generation, CI scaffolding):

- `team_size`: solo
- `deployment_target`: self-host
- `ci_provider`: github-actions
- `ci_default_flow`: auto-deploy-on-merge
- `quality_override`: false
- `self_check_answers`: null (standard path)
- `has_auth`: false
- `has_payments`: false
- `has_realtime`: false
- `has_ai`: false
- `has_background_jobs`: false

## Next steps

Project is scaffolded and ready for implementation. Recommended next actions:

1. Review existing Tauri scaffold structure
2. Begin implementing features per PRD user stories (US-01 onboarding, US-02 core habit loop)
3. A future skill will set up agent context (CLAUDE.md, AGENTS.md)
