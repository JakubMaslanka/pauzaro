# Test Plan Schema — `context/foundation/test-plan.md`

> Reference for `/10x-test-plan` Phase 4. The schema is fixed; content adapts to the project's seed brief.

## §1 Strategy

Three load-bearing principles. Include verbatim.

1. **Cost × signal.** Every test must answer: *what is the cheapest test that gives a real signal for this risk?* Do not promote to e2e because it "feels safer"; do not add an AI-native layer over a deterministic signal.
2. **User concerns are evidence.** Risks from the Phase 2 interview carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** The risk map (§2) cites evidence (PRD lines, interview answers, hot-spot directories). It never asserts a file as "where the failure lives." File anchors belong in research, not in the plan.

## §2 Risk Map

Table with columns: `#`, `Risk (failure scenario)`, `Impact` (H/M/L), `Likelihood` (H/M/L), `Source(s) — evidence, not anchors`.

### Impact rubric

- **High** — Core product value lost, data corruption, or silent wrong result the user trusts.
- **Medium** — Degraded experience, workaround exists, or affects secondary feature.
- **Low** — Cosmetic, rare edge case, or internal-only impact.

### Likelihood rubric

- **High** — Hot-spot area (top-5 churn), user burned before, or multiple change paths touch it.
- **Medium** — Moderate churn, or one fragile path exists.
- **Low** — Stable code, rarely changed, no prior incidents.

### Source column rules

**Allowed:** PRD/roadmap/archive section refs, interview Q#, hot-spot **directories** with churn counts, tech-stack constraints, CLAUDE.md rules.

**Forbidden:** `file:line`, function names, schema names, module names.

### Risk Response Guidance

For each top risk, include a response guidance table:

| Risk # | What would prove protection | Must challenge | Context needed | Likely cheapest layer | Anti-pattern to avoid |

## §3 Phased Rollout

Status table — the orchestrator reads this on every invocation.

| # | Phase name | Goal | Risks covered | Test types | Status | Change folder |

**Status vocabulary (parser literals):** `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

## §4 Stack

- Language/framework
- Test runners configured
- Test-base profile (none/sparse/meaningful) + justification
- Stack grounding tools checked in current session (with `checked:` dates)

## §5 Negative Space

What is explicitly NOT tested and why. Entries from interview Q5 + project non-goals.

## §6 Cookbook

Per-phase placeholder sections. Filled in as each rollout phase ships.

```markdown
### Phase N: <name>

**Patterns shipped:** (TBD until phase completes)
**Location:** (TBD — change folder path)
**How to add a test in this area:** (TBD — recipe added by `/10x-implement`)
```

## §7 Refresh Cadence

When to re-run `/10x-test-plan --refresh`:
- New top-3 risk surfaces
- Tool `checked:` date > 3 months old
- Tech stack changes
- §5 negative-space no longer matches team beliefs
