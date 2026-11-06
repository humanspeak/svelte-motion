# Guard report — 005 drag-14-10-surface

**Recommendation: PASS** — `drag()` x/y now type-check with this library's motion values (red reproduced). `immediate` and `getProps` are tested and documented.
**Reviewed at** 4e3e025d · 2026-11-06 14:30 · **Plan planned at** f93a1d92 (drift note amended 2026-11-06)
**Integrated** — committed on `feat/motion-14.10.1`. No PR mid-batch.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `pnpm check` 0 errors | met | 1833 files, 0 errors |
| `pnpm test:only` all pass | met | 1586/1586 |
| `e2e/drag` all pass | met | 121 passed, 1 skipped (pre-existing fixme) |
| immediate ≥3 matches | met | 5 |
| getProps in drag docs | met | 2 |
| docs build + check | met | exit 0; 0 errors |
| Only in-scope files | met | the 17 planned files |

## Spirit

Upstream's headline headless-drag example now compiles with this library's own `motionValue()`. Before, it didn't. The three 14.10 drag additions are discoverable in the docs and covered by tests through our wiring.

## Scope & conduct

- In scope: yes. STOP respected: none fired. Amendments: drift note only.

## Residual risk / follow-ups

- The new pages and the Dial demo were not reviewed visually. The maintainer's sign-off covers that.
