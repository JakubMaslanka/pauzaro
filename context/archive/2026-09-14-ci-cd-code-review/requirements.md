## Overall concept

- GHA workflow run for every new pull request to master
- composite action for the review itself so that main workflow is easy to reason about

## Input parameters

- pull request title
- pull request description (?? cost tradeoff)
- git diff

## Code Review Criteria

Each criterion is scored on a 1–10 scale, where 1 is the worst outcome and 10 is the best.

1) **Implementation Correctness**
   Does the code do what the PR claims it does, without introducing bugs or regressions?
   - **1:** Logic is fundamentally broken — wrong outputs, crashes, or silent data corruption on common paths.
   - **10:** Every code path produces correct results; edge cases and error states are handled faithfully.

2) **Idiomaticity**
   Does the code follow the language, framework, and project conventions already established in the codebase?
   - **1:** Fights the stack — ignores established patterns, reinvents utilities that exist, mixes conflicting styles.
   - **10:** Reads like it was written by someone who knows the codebase; consistent naming, structure, and idioms throughout.

3) **Complexity**
   Is the solution as simple as it can be while still meeting the requirements?
   - **1:** Over-engineered or convoluted — unnecessary abstractions, deep nesting, hard to follow control flow.
   - **10:** Straightforward and minimal; a new contributor can understand the intent and mechanics on first read.

4) **Test / Risk Coverage**
   Are the riskiest paths exercised by tests, and do the tests actually catch breakage?
   - **1:** No meaningful tests; critical logic is completely unguarded against regressions.
   - **10:** High-value paths and edge cases are tested with clear assertions; confidence in safe refactoring is high.

5) **Documentation**
   Are non-obvious decisions, public interfaces, and setup steps explained where a future reader will need them?
   - **1:** Zero context — no comments on tricky logic, no docstrings on public API, no updated README for new behavior.
   - **10:** Every "why" that isn't self-evident is documented inline or in docs; public surface has clear contracts.

6) **Security and Safety**
   Does the code avoid introducing vulnerabilities, unsafe data handling, or dangerous defaults?
   - **1:** Open to injection, leaks secrets, trusts untrusted input, or bypasses existing safety checks.
   - **10:** Inputs are validated, secrets are handled properly, permissions are enforced, and failure modes are safe.

## Parked for later

- business alignment (require broader context)
- architectural fit (require broader context)

## Expected side-effects

- PR comment with summary
- labels: `ai-cr:failed` (red) OR `ai-cr:passed` (green)

## Expected behavior

- on-demand retry when label `ai-cr:review` is added