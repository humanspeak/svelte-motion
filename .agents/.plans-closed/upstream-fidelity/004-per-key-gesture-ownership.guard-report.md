# Guard report — 004 per-key-gesture-ownership

**Recommendation: PASS** — the highest-blast-radius plan of the batch; both red
divergences confirmed (hover-during-press never applies opacity; hover-exit
mid-press strands it at 0.539), fix ports upstream `protectedKeys` semantics.
**Reviewed at** exec/plan-004 `6e2b971` · 2026-07-22 · **Planned at** `6746859`
**Integrated** — cherry-picked to `style/brutalist-examples` 2026-07-23, zero conflicts.

## Done criteria

| Criterion                                  | Result | Evidence                                                                      |
| ------------------------------------------ | ------ | ----------------------------------------------------------------------------- |
| `pnpm check` 0 errors; unit green          | met    | Guard reproduced: 645 passed incl. 4 new coordinator ownership cases          |
| No all-or-nothing application gate remains | met    | Remaining `isActive('tap')` checks gate only `stopAll`, verified in diff read |
| Red spec fails pre-fix, passes post-fix    | met    | Guard red-run at `06ec909` → 2 failed; restored → green                       |
| Eight-spec e2e regression set              | met    | Guard reproduced on port 4314: 14 passed                                      |
| Scope held (no `_MotionContainer` edits)   | met    | 6 in-scope files only                                                         |

## Spirit

Coordinator now records owned keys per gesture with directional protection
(`GESTURE_PRIORITY` cited to upstream variant-props.ts). Hover applies/restores
only the unprotected subset; `stopAll` is suppressed while tap is active (the
applied subset is disjoint by construction — documented). Tap release restores
orphaned hover keys via the already-exported `computeHoverBaseline` — which
satisfied Step 4's intent WITHOUT the anticipated out-of-scope `_MotionContainer`
wiring the plan had a STOP condition for. Overlapping-key arbitration
(scale in both) verified unchanged by the regression set.

## Scope & conduct

- Major documented deviation, accepted on merit: red tests drive the tap via
  keyboard Space, because headless Chromium dispatches `pointercancel` when a
  pressed pointer leaves the element — upstream `press()` source verified — so
  a mouse-held tap can never overlap a hover boundary. Faithful to the plan's
  scenario; rationale recorded in the spec header and commit message.
- All STOP conditions checked and none triggered. Executor: opus, single pass.
