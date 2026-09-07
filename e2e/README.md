# E2E Testing Rules

## Locators

- Use `getByRole`, `getByLabel`, `getByText` as primary locators.
  Fall back to `getByTestId` only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM structure for locating elements.

## Test isolation

- Each test must be independently runnable — no shared state between tests.
- Use unique identifiers (e.g., timestamp suffix) for test data
  to avoid collisions in parallel runs.
- Playwright creates a fresh browser context per test — no explicit cleanup of
  mock data needed. Clean up real state (DB records) only if tests create them.

## Waiting

- Never use `page.waitForTimeout()`. Wait for specific conditions:
  `toBeVisible()`, `waitForURL()`, `waitForResponse()`.

## Assertions

- Assert the business outcome, not implementation details.
- Test name must bind to a risk in `context/foundation/test-plan.md`.
- Control question: would this assertion fail if the risk materialized?

## Tauri IPC mocking

- Import `{ test, expect }` from `./fixtures/tauri` (not from `@playwright/test` directly).
- Use `tauriMock.setResponses()` **before** `page.goto()` for initial state.
- Use `tauriMock.updateResponses()` to change state after page load.
- Use `tauriMock.emitEvent()` to simulate Rust backend events.
- The Vite dev server runs at `:1420` — no Rust backend needed.

## Running

```bash
pnpm test:e2e              # all E2E tests
pnpm test:e2e:ui           # interactive UI mode
npx playwright test seed   # single spec by name
```
