---
starter_id: tauri
package_manager: cargo
project_name: pauzaro
hints:
  language_family: rust
  team_size: solo
  deployment_target: self-host
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: false
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Solo developer building a lightweight desktop break-reminder app (macOS + Windows) with overlay notifications, streak tracking, and local-only data storage. Tauri is the vetted recommended default for (desktop, rust) — Rust backend for system-level overlay windows and scheduling, web frontend (React + TypeScript) for the dashboard UI. All four agent-friendly criteria pass: typed (Rust + TypeScript), convention-based (Tauri project structure), popular in training data (within Rust ecosystem), and well-documented. Zero network calls and ≤50MB RAM requirement align with Tauri's lightweight footprint versus Electron. Bootstrapper confidence is verified — scaffolding will be smooth.
