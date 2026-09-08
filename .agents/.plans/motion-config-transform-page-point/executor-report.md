STATUS: STOPPED

STEPS:

- Step 1 — done.
  - Pinned `npm exec` produced no output and did not complete; local fallback used.
  - `./node_modules/.bin/vitest run src/lib/utils/drag.spec.ts -t 'transformPagePoint'`
  - Required red result: exit 1; `AssertionError: expected 20 to be 40`; 1 failed, 1 passed, 18 skipped. No-config case received 20 as expected.
- Step 2 — done.
  - Measurement characterization: exit 0; 4 passed, 12 skipped.
  - Immediate red regression rerun again failed only on expected 40/received 20.
- Step 3 — done.
  - Config API: exit 0; 4/4 passed.
  - `./node_modules/.bin/svelte-check --tsconfig ./tsconfig.json`: exit 0; 0 errors, 39 existing warnings.
- Step 4 — done.
  - First combined run exposed two test-fixture errors; repaired fixture math/clock setup.
  - Final drag/projection run: exit 0; 42/42 passed.
- Step 5 — stopped on semantic reconciliation.
  - First run exposed two test-fixture issues; repaired secondary-pointer and overflow setup.
  - Final pan/config run: exit 0; 13/13 passed.
  - Playwright was not run per sandbox/user constraint.
  - Guard later executed installed Framer Motion and demonstrated transformed-scroll behavior different from the implemented raw-domain policy. This triggers the plan’s explicit upstream/source mismatch STOP.
- Step 6 — authored, browser verification skipped.
  - Both demo pages, links, and e2e files were created.
  - No browser or Playwright invocation was attempted.
- Step 7 — authored; feasible checks partially done.
  - Root Vite build: exit 0, 741 modules.
  - Docs metadata test: exit 0, 5/5.
  - Catalog sync exited 0 but reported it could not find the obsolete inline examples-object pattern; it made no change because the route now imports `EXAMPLES`.
  - Docs Vite build recognized the new route and generated 252 social cards/mirrors, then exited 1 because `src/lib/github-stats.json` and `src/lib/generated/registry-data` were absent. The full docs script’s network-fetch prerequisite was not run.
  - Generated feature mirrors exist under `docs/static/`.
- Step 8 — partially done before STOP.
  - Focused unit suite: exit 0; 5 files, 74/74.
  - Full unit suite: exit 0; 82 files, 903/903.
  - Root `svelte-kit sync` and `svelte-package` completed (`src/lib -> dist`) with the existing `reorder.ts` declaration warning.
  - Publint’s default pnpm packing hung and was interrupted: exit 130. `publint run . --pack false`: exit 0, “All good!”
  - Post-Step-6 `svelte-check` rerun first exited 139, then exited 1 with a `SyntaxError` at installed `svelte-check/dist/src/index.js:118187`. It had passed earlier and dependencies were not changed.
  - Scoped ESLint excluding `_MotionContainer.svelte`: exit 0. Including it found seven errors; linting the HEAD version through stdin produced the same seven baseline findings.
  - Non-SVX Prettier check: exit 0. Local Prettier could not infer an SVX parser.
  - `trunk --version`: exit 1 because its default cache was unwritable. With `XDG_CACHE_HOME=/tmp/transform-page-point-trunk-cache`, it attempted to download Trunk 1.25.0 and failed due network access.
  - `git diff --check` and `git diff --cached --check`: exit 0.
  - Full Playwright, docs check, authoritative Trunk gates, and final guard verification were not run.

STOPPED BECAUSE:

The plan says to stop when pan scroll behavior disagrees with the installed upstream implementation. Guard’s installed `framer-motion@13.2.0` probe used a ×2 callback with pointerdown `(10,10)` and move `(30,30)`, producing point `(60,60)` and offset `(40,40)`. A held-pointer window scroll of 20 left offset unchanged at `(40,40)`; a subsequent ancestor scroll of 20 produced `(40,60)`. The draft Svelte implementation instead stores scroll changes in the raw domain and remaps them, intentionally producing corrected scroll displacement. That is an unresolved semantic divergence requiring operator approval.

Guard also identified a snap-to-cursor domain error: mapped page pointer coordinates are compared with a mapped viewport center plus unscaled root scroll, leaving an error of `(k - 1) × scroll` under scale factor `k`. The browser test was strengthened to assert the scrolled y-axis before this evidence was read, but was not executed and runtime was not changed afterward.

FILES CHANGED:

- `.changeset/motion-config-transform-page-point.md`
- `README.md`
- `docs/src/lib/docsNav.ts`
- `docs/src/lib/examples/transform-page-point/demos/Default.svelte`
- `docs/src/lib/examplesIndex.ts`
- `docs/src/lib/seo-title-policy.spec.ts`
- `docs/src/routes/docs/motion-config/+page.svx`
- `docs/src/routes/docs/motion-config/+page.ts`
- `docs/src/routes/docs/transform-page-point/+page.svx`
- `docs/src/routes/docs/transform-page-point/+page.ts`
- `docs/src/routes/examples/transform-page-point/+page.svelte`
- `docs/src/routes/examples/transform-page-point/+page.ts`
- `e2e/drag/transform-page-point.spec.ts`
- `e2e/motion/pan-transform-page-point.spec.ts`
- `src/lib/components/MotionConfig.svelte`
- `src/lib/components/MotionConfig.transformPagePoint.spec.ts`
- `src/lib/components/__tests__/TransformPagePointHarness.svelte`
- `src/lib/html/_MotionContainer.svelte`
- `src/lib/index.spec.ts`
- `src/lib/index.ts`
- `src/lib/types.ts`
- `src/lib/utils/drag.spec.ts`
- `src/lib/utils/drag.ts`
- `src/lib/utils/motionDomProjection.spec.ts`
- `src/lib/utils/pan.spec.ts`
- `src/lib/utils/pan.ts`
- `src/routes/+page.svelte`
- `src/routes/tests/transform-page-point/drag/+page.svelte`
- `src/routes/tests/transform-page-point/pan/+page.svelte`

NOTES:

- No dependency, lockfile, projection-runtime, plan, commit, push, browser, or Playwright action was performed.
- All scoped changes unexpectedly appeared staged after package validation, despite no git-mutating command being issued. The index was not touched afterward.
- Publint created `.pnpm-store/`; that exact executor-created temporary cache was removed.
- `.agents/.plans/motion-config-transform-page-point/proposed-amendment.md` appeared from the guard during execution. I did not create, modify, or remove it.
- The last production adjustments before discovering the STOP were:
  - Active drag constraint refresh now keeps the session-captured transform.
  - Pan cancel/teardown retains its last valid corrected point.
  - The snap browser assertion now checks both x and scrolled y.
  - Ref-bound e2e covers both edges; numeric-bound e2e covers authored ±180 local units.
- The proposed contract amendment is explicitly unapproved, so implementation is frozen pending a decision.

Coordinate-contract draft/evidence:

```md
# transformPagePoint coordinate contract — STOPPED draft

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
```