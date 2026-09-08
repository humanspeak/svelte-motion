Steps B–D are implemented. Step E browser parity remains for Conductor; I am not claiming full 29-case parity until that run completes.

### Implemented

- Corrected `MotionConfig` inheritance: omission inherits; explicit `undefined` clears.
- Gesture input captures its callback per session, while VisualElement/config geometry remains live.
- Unified local pan/drag bookkeeping with previous-frame `delta`, gesture-relative `offset`, and reference-matched velocity history.
- Drag-only ancestor scroll tracking; terminal page-scroll payload remains distinct from rendered translation.
- Matched React unmount behavior: pan emits no synthetic end; detached drag continues through the terminal event and resets bound values.
- Preserved projection ownership for layout displacement and imperative snap behavior.
- Added 29-case-capable query fixtures across the two whitelisted routes, 15 focused browser tests, documentation, README claims, and changeset.
- No dependency, lockfile, workflow, projection-engine, or unrelated feature changes.
- Runtime contains no `.agents`, `/tmp`, or reference-artifact imports.

Key files:

- [MotionConfig.svelte](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/components/MotionConfig.svelte)
- [pan.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/utils/pan.ts)
- [drag.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/utils/drag.ts)
- [_MotionContainer.svelte](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/html/_MotionContainer.svelte)
- [pan fixture](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/routes/tests/transform-page-point/pan/+page.svelte)
- [drag fixture](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/routes/tests/transform-page-point/drag/+page.svelte)
- [documentation](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/docs/src/routes/docs/transform-page-point/+page.svx)
- [temporary comparison runner](/tmp/svelte-motion-react-parity-1320/run-svelte-reference.mjs)

### Prior expectations corrected from React evidence

- Child `undefined` inheritance → explicit `undefined` clears; only omission inherits.
- Element-wide callback freezing → pointer input is captured, measurements/config remain live.
- Cumulative drag delta/absolute callback offset → frame-relative delta and session-relative offset. A second drag reports offset `(30,15)` with bound position `(100,55)`.
- Old release velocity `2000` → canonical sequence `0`, `(100,50)`, terminal `(750,500)`.
- Pan scroll correction → ordinary pan remains `(60,40)` while held; page-scroll terminal becomes `(150,180)`.
- Drag page-scroll rendering → bound translation remains `(60,40)` while terminal payload becomes `(150,180)`.
- Transformed ancestor-scroll correction → raw delta `(45,55)` changes drag `(60,40)` to `(105,95)`.
- Stable-history reprojection → retained mapped history, including the verified large live-scale jumps.
- Synthetic pan teardown end → no public `onPanEnd`.
- Drag teardown lock release → active detached session continues until pointerup, then reports bound `(0,0)`.
- Physical snap-to-cursor expectation → verified projection values `(-49,-436)`, then `(1,-406)`.
- CSS transform “layout shift” fixture → real 60px layout displacement, producing bound `60→0`, then `(20,40)`.
- Nonuniform fixture now asserts local `(60,10)` and physical `(30,20)` without tolerance increases.
- Ref/resize assertions now use verified bounds, including `246/-174` and resized regrab `-174`.

### Validation

- Focused unit/characterization suite: **75 passed**
- Full unit suite: **899 passed, 5 failed out of 904**
- `svelte-check`: **0 errors, 39 existing warnings**
- SEO policy: **5 passed**
- `svelte-package`: passed; existing Reorder declaration warnings remain
- `publint --pack npm`: **All good**
- Changed-code ESLint: passed
- Prettier-supported changed files and `git diff --check`: passed
- Playwright discovery: **15 tests across two files**
- Temporary comparison runner syntax: passed
- Docs client/SSR bundles completed; final adapter startup was blocked only by sandbox `listen 127.0.0.1 EPERM`.

The five full-suite failures are confined to the out-of-whitelist [Reorder component tests](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/components/Reorder/reorder.component.spec.ts). They dispatch `pointermove` and immediately assert before Motion’s required frame sample. Failures are three `x expected 30, received 0`, one missing immediate `onReorder`, and one unset immediate drag-active dataset. I left them unchanged as instructed.

### Step E handoff

```sh
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

Then:

```sh
cd /tmp/svelte-motion-react-parity-1320
SVELTE_PARITY_URL=http://127.0.0.1:4173 \
SVELTE_PARITY_OUTPUT=/tmp/svelte-motion-react-parity-1320/svelte-parity-results.json \
node ./run-svelte-reference.mjs
```

And the shipped browser coverage:

```sh
./node_modules/.bin/playwright test \
  e2e/drag/transform-page-point.spec.ts \
  e2e/motion/pan-transform-page-point.spec.ts \
  --reporter=line
```

The pre-existing `.agents/.../resume-environment.md` modification remains untouched. No commit was created.
