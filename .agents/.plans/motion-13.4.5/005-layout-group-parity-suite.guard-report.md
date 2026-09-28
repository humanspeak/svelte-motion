# Guard report — 005-layout-group-parity-suite

**Recommendation: PASS** — upstream LayoutGroup suite ported faithfully (measured-tops amendment), 11 reds anchored for plan 007/006, tester panels isolated from specs
**Reviewed at** 8747d80e · 2026-09-28 19:48 · **Plan planned at** 67815169 (amended 2026-09-28)
**Integrated** — committed on chore/motion-13.4.5; no PR mid-batch

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 5 pages + parity specs exist; links added | met | git show --stat 8747d80e |
| Parity run exits 0 with reds as test.fail | met | guard rerun e2e/layout 38 passed; 11 test.fail markers |
| README contains the parity matrix | met | README "LayoutGroup parity matrix" |
| No src/lib source modified | met | only layoutGroup.context.spec.ts + new test harness (approved) |

## Spirit

Gives plan 007 an executable, upstream-faithful definition of done. The reds match the operator's visual observation (button snaps instead of gliding).

## Scope & conduct

- In-scope: yes, plus the approved harness and the operator-requested _parity/ tester components.
- STOP respected: yes (Checkpoint 1).
- Amendments: measured tops (operator), harness allowance (guard, disclosed).

## Residual risk / follow-ups

- Measurement-count specs count getBoundingClientRect reads; our observer architecture may read rects to detect changes, see plan 007's checkpoint.
- Maintainer visual sign-off of the tester panel pending.
