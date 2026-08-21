---
name: verify
description: Run full project verification — lint, type-check, tests, and Rust check. Use after making changes to confirm nothing is broken.
---

## Verify Skill

Run all checks to validate the codebase. Execute in order, stop on first failure:

1. **Lint + format**: `pnpm lint`
2. **TypeScript type-check**: `tsc --noEmit`
3. **Frontend tests**: `pnpm test`
4. **Rust check + tests**: `cd src-tauri && cargo test`

Report results clearly:
- If all pass: confirm all checks passed
- If any fails: show the error output and suggest fixes

Do not proceed with further changes until all checks pass.
