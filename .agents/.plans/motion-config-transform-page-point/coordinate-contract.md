# transformPagePoint coordinate contract — STOPPED draft

## Subsequent review correction — 2026-09-08

The user selected **exact observable React Motion 13.2.0 parity**, with reuse limited to APIs intended for public reuse. The custom scroll/snap amendment is superseded and unapproved. Implementation remains paused for review; source snapshot `13ec152` is unchanged.

React's installed `gestures/pan/index.mjs` passes `transformPagePoint` and `contextWindow` to `PanSession`, but omits `element`. Scroll tracking is conditional on that option. Svelte `attachPan` and the guard's isolated class probe pass `element`. The numerical probe results below remain valid for that class configuration, but cannot establish ordinary React `onPan` behavior or justify calling the custom correction a React bug fix. React drag requires its own adapter-level comparison.

`PanSession` is marked `@internal` and is not publicly exported by these packages. No private imports, patched exports, internal feature extraction, or assumed permission to vendor it. Public React components in pinned, matched reference fixtures must establish the expected behavior before revising implementation or assertions. Earlier raw-scroll, history-remapping, element-wide capture, and no-config preservation requirements are provisional where they conflict with that reference. See the [governing plan revision](001-transform-page-point.md#governing-revision--2026-09-08-paused-for-review).

Historical results below are preserved. Guard's final snapshot run supersedes earlier “not run” entries: 903 units passed; targeted browser tests had 9 passes and 5 failures. Those failures remain undiagnosed, and full browser/changed-docs final gates remain outstanding. React parity has not been verified.

## Pinned dependency evidence

Authoritative installed packages:

- `motion-dom@13.2.0`
  - package `gitHead`: `e871ba7f175d0609cef84f416f984e8e84be8333`
  - lock integrity: `sha512-N6gdSoWRDk0Rh/fVtlqUtLs+fEN3ELFZI3cn3IQE9Mnf3E+Mh8wjO6MstzCOPFh4Yf0L1as5m2eUyYWj8ylVSQ==`
- `framer-motion@13.2.0`
  - package `gitHead`: `e871ba7f175d0609cef84f416f984e8e84be8333`
  - lock integrity: `sha512-9E33ebgMaO33w1nN/jEdW8z3/GO483fMi4rqbMG9rt83XgW9QLKRe4NcmJ8s+fQ3O34++UHrIQwlIWGIWTITjA==`

The local upstream checkout is SHA
`1b037b0032578b52af94b06ff3920bfa0aaa5e36`, package version
`13.1.1`. It does not match installed 13.2.0 and is not the release
contract.

Relevant installed-source semantics:

- `motion-dom/dist/es/projection/geometry/conversion.mjs:20-30`
  maps DOMRect top-left and bottom-right through the callback.
- `motion-dom/dist/es/projection/utils/measure.mjs:4-14`
  maps the viewport rectangle first, then adds projection-root scroll.
- `motion-dom/dist/es/render/VisualElement.mjs:413-415`
  returns `props.transformPagePoint`.
- `motion-dom/dist/es/render/html/HTMLVisualElement.mjs:43-45`
  forwards the callback into viewport measurement.
- `framer-motion/dist/es/events/event-info.mjs:3-9`
  extracts pointer points from `event.pageX/pageY`.
- `framer-motion/dist/es/gestures/pan/PanSession.mjs:12,111-118`
  captures the callback in the session constructor and maps the initial point.
- `PanSession.mjs:55-86`
  re-transforms retained raw move information through the captured callback each frame.
- `PanSession.mjs:173-202`
  applies raw scroll deltas directly to transformed retained point/history values.
- `VisualElementDragControls.mjs:146-158`
  passes `visualElement.getTransformPagePoint()` into each new PanSession.
- `VisualElementDragControls.mjs:356-374`
  compares its snap point with the center of the projection layout box.

Portable upstream citation:
`https://github.com/motiondivision/motion/tree/e871ba7f175d0609cef84f416f984e8e84be8333/packages/framer-motion/src/gestures`

## Red-first evidence

Command:

`./node_modules/.bin/vitest run src/lib/utils/drag.spec.ts -t 'transformPagePoint'`

Pre-production result:

- exit 1
- configured ×2 case: expected bound x `40`, received `20`
- exact assertion: `AssertionError: expected 20 to be 40`
- no-config case: passed with x `20`
- totals: 1 failed, 1 passed, 18 skipped

After implementation, drag/projection and focused suites pass.

## Executed measurement primitives

Input DOMRect:

- left `100`
- top `200`
- width `80`
- height `40`
- corners `(100,200)` and `(180,240)`

Callback:

`({x,y}) => ({x:x/0.5,y:y/2})`

Observed:

- callback inputs: exactly `(100,200)` and `(180,240)`
- viewport x: `[200,360]`
- viewport y: `[100,120]`
- root scroll: x `10`, y `30`
- page x: `[210,370]`
- page y: `[130,150]`

Therefore root scroll is added after callback mapping.

Other executed mappings:

- identity: x `[100,180]`, y `[200,240]`
- affine `x + 25`, `y - 75`: x `[125,205]`, y `[125,165]`

## Implemented session-capture policy

The element keeps an explicit active-session boolean plus a captured callback,
so captured `undefined` is distinguishable from idle state.

At pointerdown, before pointer history and ref geometry are read:

1. Capture the resolved inherited callback reference.
2. Expose that captured callback to the VisualElement and gesture utilities.
3. Retain it through pointerup, pointercancel, forced teardown, and interrupted-session terminal computation.
4. Clear it only after terminal payload/release information is captured.

Replacing the config function while active is queued for the next gesture.
An explicit identity callback resets an inherited mapping. A stable callback may
read mutable state without changing its function identity.

The draft pan implementation retains raw samples and remaps them through the
captured callback per frame. Scroll deltas are first applied to raw samples, then
mapped once. This policy is internally consistent but deliberately differs from
the observed installed 13.2.0 scroll behavior and is therefore unapproved.

## Executed unit integration observations

| Case | Status | Observation |
| --- | --- | --- |
| No-config drag | Passed | raw x `10→30`; bound x `20` |
| ×2 drag regression | Passed after implementation | raw x `10→30`; corrected/bound x `40` |
| Nonuniform drag payload | Passed | raw `(20,10)` produced local `(40,30)` |
| Affine drag delta | Passed | raw delta `20` produced corrected delta `40`; translation cancelled |
| Numeric constraint | Passed | corrected move `40` clamped to authored `25` |
| Ref constraint math | Passed | top `-10`, left `-40`, right `120`, bottom `30` |
| Controlled snap math | Passed | raw pointer x `130` mapped `260`; mapped measured center `220`; local x `40` |
| Deterministic drag velocity | Passed | raw `10px/10ms` mapped to `20`; velocity `2000` local units/s |
| Callback replacement between drags | Passed | captured ×2 delta `20`; next ×3 delta `30`; accumulated x `50` |
| No-config pan | Passed | move `(10,20)→(20,35)` gives offset `(10,15)`; terminal `(25,40)` gives `(15,20)` |
| Nonuniform translated pan | Passed | start `(120,10)`, move `(140,40)`, offset `(20,30)` |
| Corrected pan threshold | Passed | raw x delta `2`, mapped delta `4`, crosses threshold `3` |
| Pointercancel | Passed | last corrected point `(40,20)`, offset `(20,0)` retained after callback state changed |
| Teardown lifecycle | Passed | end/session-end/start-notification/end-notification each exactly once |
| Page scroll in draft pan | Passed locally but contract STOPPED | ×2 mapping: offset x `20→30` after raw page scroll `5` |
| Ancestor scroll in draft pan | Passed locally but contract STOPPED | offset x `30→40` after raw ancestor scroll `5` |
| Stable closure scale change | Passed for offset | scale `2→4`; point x `80`, offset x `40` |
| Mounted config/session capture | Passed | active old callback retained; replacement used by next gesture |

## Guard-observed installed upstream scroll result

This was executed by guard against installed `framer-motion@13.2.0`, not by the
executor:

- callback: point ×2
- pointerdown `(10,10)`, move `(30,30)`
- point `(60,60)`, offset `(40,40)`
- held-pointer window scroll y `20`: offset remained `(40,40)`
- subsequent ancestor scroll y `20`: offset became `(40,60)`

This disagrees with the draft raw-domain scroll policy. The plan’s source/observed
mismatch STOP applies.

## Pending/blocked browser integration matrix

| Case | Status | Expected |
| --- | --- | --- |
| 50%, 100%, 200%, nonuniform physical drag | Blocked/not run | card center follows pointer within 2 screen px |
| Ref constraints, both edges | Blocked/not run | rendered card edges remain within 2 px |
| Ref resize during/after drag | Blocked/not run | constraints remeasure in captured domain |
| Numeric bounds | Blocked/not run | authored ±180 local units remain unchanged |
| Second drag/re-grab | Blocked/not run | no jump; correct accumulated position |
| Layout-slot compensation | Blocked/not run | held pointer stays pinned through slot shift |
| Scrolled snap-to-cursor | Blocked/not run; known arithmetic concern | card center aligns in x and scrolled y |
| Config callback replacement | Blocked/not run | old callback through release; new one next pointerdown |
| Active page/ancestor pan scroll | Blocked/not run; semantic STOP | outcome requires approved contract |
| Stable callback/live scale | Blocked/not run | consistent point/offset/velocity and physical follower |
| Cancellation/end cleanup | Blocked/not run | exactly one terminal lifecycle |
| Full drag/reorder/layout/pan regressions | Blocked/not run | no regressions |

No numerical browser outcomes are claimed.

## Command/result ledger

- Pinned npm-exec pnpm: no output/no completion; local binaries used.
- Step 1 red Vitest: exit 1, exact expected `40`/received `20`.
- Measurement Vitest: exit 0, 4 passed.
- Red confirmation after measurement: same sole required failure.
- Config API Vitest: exit 0, 4 passed.
- Initial root svelte-check: exit 0, 0 errors/39 warnings.
- Drag/projection Vitest: exit 0, 42 passed after two fixture corrections.
- Pan/config Vitest: exit 0, 13 passed after two fixture corrections.
- Focused final Vitest: exit 0, 74 passed.
- Full Vitest: exit 0, 82 files/903 tests.
- Root Vite build: exit 0, 741 modules.
- Docs metadata Vitest: exit 0, 5 passed.
- Catalog sync: exit 0 with stale-pattern warning; no output change.
- Docs Vite build: exit 1 after route/card generation; missing
  `github-stats.json` and `generated/registry-data`.
- Package generation: completed with existing Reorder declaration warning.
- Default publint packing: hung and interrupted, exit 130.
- `publint run . --pack false`: exit 0.
- Post-Step-6 svelte-check: exit 139; retry exit 1 with installed-file
  SyntaxError at line 118187.
- Scoped ESLint excluding container: exit 0.
- Container ESLint: seven findings; HEAD baseline produced the same seven.
- Non-SVX Prettier check: exit 0; SVX parser unavailable.
- Trunk default cache: exit 1, permission denied.
- Trunk `/tmp` cache: exit 1, network download failure.
- Working and cached diff checks: exit 0.
- Browser/Playwright: not run.

## Operator/guard reproduction ledger

# Guard baseline evidence — 2026-09-08

Source baseline: 14046a5 (main v1.2.0, includes PR #480). Initial unit/docs check/metadata runs used original fcf6452 worktree; scoped source diff to 14046a5 is empty. Package and production docs build reproduced in isolated 14046a5 worktrees.

- Frozen install with pnpm 11.24.0: exit 0; no lockfile changes.
- Trunk install: exit 0.
- Full unit suite: 80 files, 875 tests passed; 27.41 s. `/tmp/transform-page-point-baseline-unit.log`.
- Package build/publint: exit 0; existing Reorder declaration-generation warnings. `/tmp/transform-page-point-baseline-package.log`, repeated `/tmp/transform-page-point-baseline2-package.log`.
- Docs check: exit 1; 5 errors/13 warnings in 10 files. Existing errors: keyframes/demos/Wildcard.svelte:36 rejects x:null; transform-template/demos/Default.svelte:14,19 reports rune/store-name self-reference and untyped type arguments. No diff in either file to main. `/tmp/transform-page-point-baseline-docs-check.log`.
- Docs metadata: 1 file, 5 tests passed. `/tmp/transform-page-point-baseline-docs-seo.log`.
- Docs production build at 14046a5: exit 0. `/tmp/transform-page-point-baseline-docs-build.log`. Generated artifacts isolated under /tmp/svelte-motion-transform-baseline.
- In-app browser selection failed, discovery returned []; no visual session.
- Playwright Chromium executable exists in the shared browser cache.
- Original worktree retains only the pre-existing intel edit and untracked improve plan; no source edits by conductor.

No implementation results are recorded here. These runs establish the existing baseline only.

## Additional installed-upstream scroll probe

Executed directly against framer-motion 13.2.0 PanSession in jsdom, with a parent `overflow-y:auto`, map point*2, pointerdown (10,10), pointermove (30,30), and manual frame update. Before scroll: point (60,60), offset (40,40). After window.scrollY=20, handleScroll(window) and updatePoint(): point (60,60), offset (40,40). After parent.scrollTop=20, handleScroll(parent) and updatePoint(): point (60,60), offset (40,60).

This directly observed upstream class behavior, not a Svelte integration/browser result. Source lines 58-61 re-transform retained raw info each frame; handleScroll lines 173+ mutates corrected info/history with raw scroll deltas. Correcting this in Svelte would need an explicit compatibility policy under plan Step 5/6 STOP conditions; copying it silently would violate the corrected-unit requirement. Initial probe setup errors (bad module path, missing internal move-info argument) were fixed before the successful numerical probe; they were not feature failures.


Guard focused unit run: 5 files / 74 tests passed before the final import/type-only cleanups. Final snapshot verification remains pending.

## Final guard checkpoint at 13ec152 — 2026-09-08 05:32

- Full units: 903/903, 82 files, exit 0.
- Snapshot formatting/lint/Svelte hooks passed after executor-only import/type fixes.
- App build/package validation during Playwright startup passed.
- New browser files: 9 passed, 5 failed. See guard report for exact failures. Snap test passed but does not prove actual nonzero scroll; do not treat it as resolved.
- Full browser and changed-docs final gates remain unrun. Coordinate amendment awaiting operator approval; status BLOCKED/NO-PASS.
