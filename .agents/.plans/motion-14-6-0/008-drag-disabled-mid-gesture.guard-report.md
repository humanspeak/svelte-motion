# Guard report — 008-drag-disabled-mid-gesture

**Recommendation: PASS** — upstream's #2248 trigger is ported line for line and proven red→green. Pending the maintainer's eye test of `/tests/drag/disable-from-ondrag`.
**Reviewed at** `5977e512` (lane/1460-drag, from `4d55a293`) · 2026-10-26 19:48 · **Plan planned at** `45a24c6e`, re-baselined to `b5e7e907` at dispatch
**Integrated** — not yet: batch convention is one branch, one PR.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `disable-from-ondrag.spec.ts` passes (onDrag case red first) | met | executor's red run (width jump received 0; and 1.40 with the fix removed after the restyle); guard: included in the 149 below |
| `visualElementCore.spec.ts` passes incl. the turns-off / stays-on cases | met | 61/61 |
| `e2e/drag e2e/reorder` pass | met | `PW_PORT=4208` → 149 passed, 1 skipped (existing `test.fixme` in `single-frame.spec.ts`) |
| `prevDrag && !drag` once | met | `visualElementCore.ts:386`; identical to upstream v14.6.0 `gestures/drag/index.ts:51-52`, comment included |
| `pnpm check` 0 errors; `pnpm test:only`; trunk; changeset; page linked; in scope | met | executor: 0 errors, 97 files / 1207 tests; hooks passed on all 4 commits; 6 in-scope files |

## Spirit

Turning `drag` off mid-gesture (for example from `onDrag`) now ends the gesture before the render's layout change is processed, so the card animates back to its slot and its layout child follows. This is upstream's fix for #2248. motion-dom 14.6.0 supplies the third `stop()` argument and the projection fix (`cbc357bab`), so no cast was needed.

## Scope & conduct

- In scope. The pre-flight re-baselined the drift check (001 had rewritten `e2e/drag/while-drag-transforms`, and other plans added links).
- Port adaptations: `.container` was renamed `.cards` because `app.css` styles `.container` globally (it squeezed the slots and made the control test fail). The layout child uses upstream's inline style. Per-card state lives in one `$state` array instead of a per-card component. Helpers use `data-testid`.
- A guided TesterPanel with per-card IN SLOT / RETURNING / STUCK chips, hidden under `@isPlaywright`.

## Residual risk / follow-ups

- Maintainer eye test of `/tests/drag/disable-from-ondrag`.
