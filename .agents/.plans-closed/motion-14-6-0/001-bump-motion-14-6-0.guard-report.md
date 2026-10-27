# Guard report — 001-bump-motion-14-6-0

**Recommendation: PASS** — pins at 14.6.0, three arriving upstream fixes proven red→green, and the full e2e suite is green. Pending the maintainer's eye test of `/tests/drag/while-drag-transforms`.
**Reviewed at** `772ad117` (feat/motion-14.6.0) · 2026-10-26 19:24 · **Plan planned at** `45a24c6e` (batch committed at `0422640d`)
**Integrated** — not yet: batch convention is one branch, one PR, after the final gate and the maintainer's live sign-off.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `motion` + `motion-dom` exactly 14.6.0; `"version"` untouched | met | `package.json:148-149` → 14.6.0; `:3` → 2.5.0; `motionDependencies.spec.ts` passes |
| Red on 14.5.0, green on 14.6.0: wrap-axis-x, #2280 unit; scale-handoff recorded | met | executor's red runs (`translateY(-30px)` left; 100 vs 125); guard: `index.spec` + `transform.svelte.spec` + `motionDependencies.spec` → 49/49 |
| `processFrame` re-exported and documented | met | `src/lib/index.ts`, `index.spec.ts`, docs vanilla-values "Driving frames yourself" |
| `pnpm check` 0 errors, `pnpm test:only`, `pnpm build` | met | 0 errors (33 pre-existing warnings); 91 files / 1152 tests; publint "All good!" |
| `e2e/reorder e2e/layout-id e2e/drag` | met | 148 passed, 1 skipped |
| Full e2e result reported (Step 7) | met | guard ran it alone on 4201: **653 passed, 2 skipped, 0 failed** (18.7 min) |
| Changeset; only in-scope files | met | `.changeset/motion-14-6-0.md` (minor); diff limited to the amended scope list |

## Spirit

svelte-motion now runs on Motion 14.6.0. The fixes that arrive with the pins are proven through svelte-motion's own code paths: the stale translateY after a wrapped axis-x drag (#2255), chained useTransform immediate re-runs (#2280), and the shared-element transform guard (#2284). The new public `processFrame` is re-exported and documented. The one behavior change the bump brought (a non-drag axis now follows its layout) was reviewed in the browser with the maintainer and adopted, as upstream intends.

## Scope & conduct

- PLAN AMENDED twice on 2026-10-26, both maintainer-approved. (1) `e2e/drag/while-drag-transforms.spec.ts:30` was ruled stale after a browser repro on 14.6.0 (88 px follow, translateY 0), and Step 6a rewrote it against upstream's `layout-compensation.test.tsx`. (2) A guided `TesterPanel` with a live verdict was added for the eye test.
- The executor stopped correctly at Step 6 instead of editing the spec unapproved. Step 7 was run by guard per the dispatch override (no other lane on Playwright).
- The executor restored a Playwright headless shell that another install had removed from the shared cache (`pnpm exec playwright install chromium`).

## Residual risk / follow-ups

- Maintainer eye test of the cross-axis card on `/tests/drag/while-drag-transforms` (sign-off before PR).
- `while-drag-transforms.spec.ts` was not shown red on 14.5.0 (inferred: the card held still there).
