STATUS: STEP A PREPARED — STOPPED AT GUARD BROWSER CHECKPOINT

No project runtime, tests, docs, `.agents`, or Git metadata were edited. Browser execution was not performed.

## Files written

Under `/tmp/svelte-motion-react-parity-1320/`:

- [package.json](/tmp/svelte-motion-react-parity-1320/package.json) — exact dependency pins and transitive overrides
- [index.html](/tmp/svelte-motion-react-parity-1320/index.html) — Vite entry
- [src/cases.js](/tmp/svelte-motion-react-parity-1320/src/cases.js) — exported geometry, inputs, timing, and 29-case matrix
- [src/main.js](/tmp/svelte-motion-react-parity-1320/src/main.js) — public React Motion fixture and machine-readable instrumentation
- [src/style.css](/tmp/svelte-motion-react-parity-1320/src/style.css) — deterministic layout/scroll geometry
- [run-reference.mjs](/tmp/svelte-motion-react-parity-1320/run-reference.mjs) — Playwright browser driver and precondition assertions

No generated `dist` files remain.

## Exact commands

Start the dedicated Vite server:

```sh
cd /tmp/svelte-motion-react-parity-1320
./node_modules/.bin/vite --host 127.0.0.1 --port 4299 --strictPort
```

Run the browser reference in another terminal:

```sh
cd /tmp/svelte-motion-react-parity-1320
FEATURE_WORKTREE=/Users/jasonkummerl/Github/svelte-motion-transform-page-point \
REACT_PARITY_URL=http://127.0.0.1:4299 \
node ./run-reference.mjs
```

The runner prints the complete JSON report and writes:

```text
/tmp/svelte-motion-react-parity-1320/react-parity-results.json
```

A subset can be run with comma-separated fixture IDs:

```sh
PARITY_CASES=pan-page-scroll-held,drag-page-scroll-held node ./run-reference.mjs
```

## Pinned and resolved versions

Observed from the existing isolated installation:

- `react@19.1.1`
- `react-dom@19.1.1`
- `motion@13.2.0`
- `framer-motion@13.2.0`
- `motion-dom@13.2.0`
- `motion-utils@13.0.0`
- `vite@8.2.2`

`motion`, `framer-motion`, and `motion-dom` share `gitHead`:

```text
e871ba7f175d0609cef84f416f984e8e84be8333
```

`motion` and `framer-motion` internally declare caret ranges. Fixture metadata therefore overrides `framer-motion` and `motion-dom` to exactly `13.2.0`. `npm ls` confirmed both resolve to `13.2.0`, not a newer release.

The runner loads the worktree’s existing `@playwright/test@1.62.1` using `createRequire`; it adds no fixture/application dependency.

## Public API boundary

Fixture imports are limited to:

- `react`
- `react-dom/client`
- `motion/react`

The Motion imports are `MotionConfig`, `motion`, `useAnimationFrame`, `useDragControls`, and `useMotionValue`.

No private/deep imports, package export patches, feature-bundle extraction, vendored `PanSession`, or node-module symlinks are used.

## Cases covered

Fourteen pan fixtures:

- `pan-no-config-end`
- `pan-config-inherit`
- `pan-config-identity`
- `pan-config-explicit-undefined`
- `pan-uniform-scale`
- `pan-nonuniform-affine`
- `pan-page-scroll-at-start`
- `pan-page-scroll-held`
- `pan-ancestor-scroll-held`
- `pan-reference-replacement`
- `pan-stable-closure-scale`
- `pan-corrected-threshold`
- `pan-pointer-cancel`
- `pan-unmount-held`

Fifteen drag fixtures:

- `drag-no-config-end`
- `drag-uniform-scale`
- `drag-nonuniform-affine`
- `drag-page-scroll-at-start`
- `drag-page-scroll-held`
- `drag-ancestor-scroll-held`
- `drag-reference-replacement`
- `drag-stable-closure-scale`
- `drag-numeric-bounds`
- `drag-ref-bounds`
- `drag-ref-resize-regrab`
- `drag-controls-snap-scrolled`
- `drag-real-layout-shift-held`
- `drag-pointer-cancel`
- `drag-unmount-held`

The matrix includes ordinary pan and drag separately, nested config inheritance, explicit identity, explicit undefined, uniform/nonuniform scale, affine translation, callback-reference replacement, stable-closure scale/CSS changes, threshold behavior, normal end, cancellation, teardown, numeric and ref constraints, ref resizing and re-grab, public `useDragControls` snap-to-cursor with nonzero page scroll, and a real flex-layout displacement without CSS translation.

## Trace and preconditions

Each case exports its viewport, geometry, transform, operations, pointer deltas, frame intervals, scroll changes, and configuration mutations.

The resulting trace records:

- Ordered raw DOM pointer events
- Callback sequence
- `point`, `delta`, `offset`, and `velocity`
- Callback event page/client/screen coordinates
- Every `transformPagePoint` input/output and callback identity
- Callback render/config state
- Window and ancestor scroll
- Target, board, slot, shell, stage, handle, and follower rectangles
- Motion-bound `x`/`y` values and pan follower offset
- Ref containment and raw layout offsets
- Driver inputs and deterministic timestamps

The runner asserts fixture validity only; it does not hardcode desired Svelte or React gesture results. Preconditions include:

- Exact `1000×760` viewport
- Finite target rectangle and expected scaled dimensions
- Public Motion frame execution against the controlled clock
- One controlled frame per declared interval
- Browser-derived `page = client + window scroll` pointer coordinates
- Exact nonzero window/ancestor scroll values
- Corresponding real stage rectangle displacement
- Ref constraint containment
- Actual board-width change before re-grab
- Actual slot `offsetLeft` change for layout shift
- Stable callback closure and matching CSS matrix change
- Nonzero scroll before `controls.start`

A precondition failure marks the case `precondition-failed`, preserves its partial trace, and causes a nonzero runner exit.

## Verification performed

Observed results:

- JavaScript syntax checks passed for all modules.
- Vite 8.2.2 production bundling passed: 420 modules transformed.
- `npm ls` confirmed the exact dependency graph.
- Public-import audit passed.
- Fixture matrix validation passed: 29 unique cases, 14 pan and 15 drag.

Browser results:

- Not run, per executor restrictions.
- No numerical React gesture outcomes are claimed.
- `react-parity-results.json` does not exist until the guard runs the browser runner.

## Source-derived mismatch leads

These are internal-source leads only, not browser observations:

- Ordinary React `PanGesture` constructs its session without `element`; React drag supplies the element. Pan and drag can therefore differ during held window/ancestor scrolling.
- `MotionConfig` inherits an omitted child property, while an explicitly supplied `transformPagePoint={undefined}` appears to overwrite the inherited value.
- Sessions capture the transform callback at construction, while pan handler callbacks can be refreshed during an active session.
- A captured stable callback can observe changed closure state because retained raw move information is transformed again on later frames; prior history samples are not necessarily remapped identically.
- Public drag controls pass the raw extracted pointer point into snap-to-cursor, while projection geometry can be transformed/measured in a different domain.
- Viewport box corners are transformed before projection-root scroll is added, which remains a likely source of scrolled snap/constraint differences.

The fixture explicitly distinguishes these possibilities so the guard can record actual public React behavior before Step B.

## Limitations and scope state

- Browser verification is intentionally left to the guard.
- Native `PointerEvent.timeStamp` is recorded but is not used for velocity timing; Motion’s public animation-frame hook is driven by the controlled `performance.now`/RAF clock.
- No root lockfile was authored. Guard-owned dependency installation may refresh installation metadata; exact overrides are already present.
- No Step B runtime correction or Svelte comparison was attempted.
- Final project status showed an untracked `.agents/.plans/motion-config-transform-page-point/resume-environment.md`; it was not authored or touched by this task.
