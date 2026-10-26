# Plan 001: Run svelte-motion on Motion 14.6.0 and re-export `processFrame`

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself (lanes
> never edit it, see `.agents/.plans/motion-14-6-0/README.md` "Lane rules").
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4201**. Prefix every Playwright command with `PW_PORT=4201`.
> Port 4198 belongs to the maintainer; never use or kill it. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat 45a24c6e..HEAD -- package.json pnpm-lock.yaml src/lib/index.ts src/lib/index.spec.ts src/lib/utils/transform.svelte.spec.ts docs/src/routes/docs/vanilla-values src/routes/tests/reorder src/routes/tests/layout-id e2e/reorder e2e/layout-id src/routes/+page.svelte .changeset`
> Expected: no output (the batch's own `.agents/.plans/motion-14-6-0/` commit is not in that path list).
> If any listed file changed, compare the "Current state" excerpts below with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1 (plans 008 and 010 depend on it)
- **Effort**: M
- **Risk**: MED. The bump changes runtime behavior in several places (frameloop `immediate` re-runs, drag axis
  compensation, shared-layout transforms, WAAPI stop), so the full e2e triage in Step 7 is the real gate.
- **Depends on**: none
- **Wave**: 1
- **Category**: migration
- **Planned at**: commit `45a24c6e` (`origin/main`, v2.5.0, Motion 14.5.0), 2026-10-26

## Why this matters

svelte-motion mirrors upstream Motion and pins `motion` + `motion-dom` to one exact version (enforced by
`src/lib/__tests__/motionDependencies.spec.ts`). Motion 14.6.0 shipped on 2026-10-20. Most of it is in
`motion-dom` and arrives with the pin bump, because svelte-motion runs motion-dom's real
`VisualElementDragControls`, `HTMLProjectionNode`, frameloop, `NativeAnimation` and `transformValue`. This plan
bumps the pins, proves two of the arriving fixes work through svelte-motion's own code paths with ported
upstream e2e tests, adds a unit regression test for a third, re-exports the new public `processFrame`, documents
it, triages the full e2e suite, and writes the release note.

The maintainer will release this batch as **svelte-motion 2.6.0** (mirroring Motion 14.6). `package.json` is
already `"version": "2.5.0"`, and the release workflow bumps the minor version from the PR's `minor` label. **Do
not change `"version"`, and never add PR labels**: the maintainer does that.

## Current state

- `package.json:148-149`, the exact pins (no caret):
  ```json
          "motion": "14.5.0",
          "motion-dom": "14.5.0"
  ```
- `pnpm-workspace.yaml` has `minimumReleaseAge: 2880` but excludes `motion`, `motion-dom`, `motion-utils` and
  `framer-motion`, so same-week upstream versions install.
- `src/lib/index.ts:20-41` re-exports the vanilla layer from `motion`:
  ```ts
  // Re-export core animation functions plus the vanilla (component-free)
  // layer — element effects, gestures (including Motion 14.4's `drag()`), the
  // frameloop scheduler, generators, global config — straight from motion.
  export {
      MotionGlobalConfig,
      cancelFrame,
      delay,
      drag,
      frame,
      frameData,
      hover,
      inView,
      isMotionValue,
      press,
      resize,
      scroll,
      scrollInfo,
      spring,
      stagger,
      transform
  } from 'motion'
  ```
- `src/lib/index.spec.ts:85-95` shows the export-assertion style:
  ```ts
  it('re-exports Motion 14.5 scopeMotion, toMediaQuery and the useScopeMotion attachment', () => {
      expect(typeof scopeMotion).toBe('function')
      expect(typeof toMediaQuery).toBe('function')
      expect(typeof useScopeMotion).toBe('function')
  })
  ```
- `docs/src/routes/docs/vanilla-values/+page.svx`, section `## Scheduler, generators, config` (around lines
  112-131), lists `cancelFrame`, `frame`, `MotionGlobalConfig`, `scrollInfo`, `spring` in one code block.
- `src/lib/utils/transform.svelte.spec.ts:1-37` is the `useTransform` unit spec. It awaits a `nextFrame()` helper
  built on `frame.render(...)` and wraps hook calls in an `inRoot` helper using `$effect.root`.

### Upstream facts (verified in `~/Github/motion` at tag `v14.6.0`; cite these in code comments)

Read any of these with `git -C ~/Github/motion show v14.6.0:<path>`.

- `processFrame(timestamp = time.now())` is new and public: `packages/motion-dom/src/frameloop/process-frame.ts`,
  exported from `packages/motion-dom/src/index.ts:78` and therefore from `motion`. It processes every frame step
  now, is ignored when called inside a frame, and clamps delta to 1–40 ms unless
  `MotionGlobalConfig.useManualTiming` is on. Its JSDoc lists the limits: with `useManualTiming` on, Motion runs
  WAAPI-eligible animations in JS instead, except `motion/mini`, view transitions, optimized appear animations,
  and colours only the browser can mix (like `oklch()`), which jump to their end.
- `supportsWaapi()` returns false while `MotionGlobalConfig.useManualTiming` is on
  (`motion-dom/src/animation/waapi/supports/waapi.ts:27-29`, commits `db3132f2b`, `713787a0f`).
- `render-step.ts`: a callback scheduled with `immediate` during a step now re-runs if it already ran in that
  step (the running callback excluded), commits `83c7d1785`, `e27a93e7e`, `a77e7fc21`, `0af864e70`, `d555095ca`.
  This fixes #2280, "combined useTransform misses chained transform updates" (test
  `packages/framer-motion/src/value/__tests__/issue-2280.test.tsx`).
- `VisualElementDragControls`' layout-change compensation now only offsets axes the gesture drags (#2255,
  `9632e2c3d`). Fixture `dev/react/src/tests/issue-2255.tsx`, spec `tests/react/issue-2255.spec.ts`.
- Projection: a node resuming from a shared-layout stack member applies its own transforms once, not twice
  (#2284, `597fc2c91`, `create-projection-node.ts` `skipOwnTransform`). Fixture `dev/react/src/tests/issue-2284.tsx`,
  spec `tests/react/issue-2284.spec.ts`.
- `NativeAnimation.stop()` also stops a finished-but-not-yet-notified instant animation (`a11b0cd47`).
- `IProjectionNode.applyTransform` gained an optional 4th parameter. svelte-motion only calls the 2-argument form
  (`src/lib/utils/motionDomProjection.ts`, around line 842), so nothing to change.
- `rootProjectionNode` moved to `motion-dom/src/projection/node/root.ts`; still exported under the same name.
- Every symbol svelte-motion imports from `motion` / `motion-dom` still exists at v14.6.0 (checked during
  planning). If `pnpm check` disagrees, that is a STOP.
- `14.6.0`'s `framer-motion` pins `motion-dom` exactly, so both pins must move together or two copies of
  motion-dom (two frameloops) install.
- The upstream CHANGELOG's "Changed: `MotionGlobalConfig.useManualTiming`:" entry is empty, and its "Added:
  `stepFrames`" refers to a helper that only exists in upstream test folders. Do not copy either claim into the
  changeset.

### svelte-motion's own paths these fixes run through

- **#2255**: svelte-motion's `DragGestureFeature` (`src/lib/utils/visualElementCore.ts`) creates motion-dom's
  `VisualElementDragControls` and calls its `addListeners()`, which registers the projection `didUpdate`
  compensation listener that #2255 changed. So the fix should arrive with the pin.
- **#2284**: svelte-motion's main `layoutId` takeover runs through its own rect registry
  (`src/lib/utils/layoutId.ts` and `commitObservedLayoutChange` in `src/lib/html/_MotionContainer.svelte`, around
  lines 2756-2790), not motion-dom's `resumeFrom`. The overshoot may not reproduce on 14.5.0 at all; the test is
  still a regression guard.

### Conventions

- Test pages live in `src/routes/tests/<area>/<page>/+page.svelte` and import from `$lib`. Specs live in
  `e2e/<area>/<name>.spec.ts` and load `/tests/<area>/<page>?@isPlaywright=true`. Model a Reorder page on
  `src/routes/tests/reorder/axis-x/+page.svelte` (a `$state` array, `Reorder.Group axis="x"`,
  `onReorder={(next) => (tiles = next)}`, a `data-testid="order"` readout). Model the e2e pointer driving on
  `e2e/reorder/axis-x.spec.ts` (mouse down, 12 stepped `mouse.move`s with `waitForTimeout(16)`, mouse up).
- Every test page is linked from `src/routes/+page.svelte`. The Reorder section starts around line 517
  (`<h2 class="mb-3 text-xl font-medium">Reorder</h2>`); copy one of its `<a href={resolve('/tests/reorder/…') + searchParams}>`
  list items. Put the layout-id page next to the existing layout-id links.
- Unit tests run in jsdom (`vitest.config.ts`). jsdom has no WAAPI.
- Svelte has no `createPortal`. A `position: fixed; inset: 0` overlay rendered with `{#if}` at the end of the page
  (outside any transformed ancestor) is the Svelte equivalent of upstream's portal for these fixtures.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install` (if global pnpm refuses the pinned version: `npx -y pnpm@12.6.0 install`) | exit 0 |
| Typecheck | `pnpm check` | 0 errors (record the warning count before and after) |
| Unit tests | `pnpm test:only` | all pass |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| Lint/format | `trunk fmt <files>` then `trunk check <files>`; never `pnpm lint` / prettier directly | no new issues |
| Package | `pnpm build` (vite build + svelte-package + publint) | exit 0 |
| One e2e spec | `PW_PORT=4201 pnpm exec playwright test <path>` | all pass |
| Full e2e | `PW_PORT=4201 pnpm test:e2e` | see Step 7 |

## Scope

**In scope**:

- `package.json` (the two pins only), `pnpm-lock.yaml` (regenerated by install)
- `src/lib/index.ts` (add `processFrame` to the `motion` re-export block), `src/lib/index.spec.ts` (one new `it`)
- `src/lib/utils/transform.svelte.spec.ts` (one new `it`)
- `src/routes/tests/reorder/wrap-axis-x/+page.svelte`, `e2e/reorder/wrap-axis-x.spec.ts` (create)
- `src/routes/tests/layout-id/scale-handoff/+page.svelte`, `e2e/layout-id/scale-handoff.spec.ts` (create)
- `src/routes/+page.svelte` (two links)
- `docs/src/routes/docs/vanilla-values/+page.svx` (the `## Scheduler, generators, config` section)
- `.changeset/motion-14-6-0.md` (create)
- e2e spec files **only after the maintainer approves each change in Step 7**

**Out of scope**:

- `"version"` in `package.json`; PR labels.
- `src/lib/utils/visualElementCore.ts` (plan 008 ports the drag-disable fix there).
- `src/lib/utils/testing.ts` and any spec migration to `processFrame` (plan 010).
- `src/lib/utils/attachable.ts`, `src/lib/utils/scroll.svelte.ts` (plan 002), `src/lib/components/Reorder/**`
  (plans 003, 004, 009), `src/lib/utils/inView.svelte.ts` (plan 005), `src/lib/utils/layoutId.ts` and
  `_MotionContainer.svelte` (plan 006), `src/lib/utils/animationFrame.ts` (plan 007).

## Git workflow

- Lane branch: `feat/motion-14.6.0` itself, in the worktree `../svelte-motion-1460` (the dispatcher creates it
  from the wave-0 commit; see the README).
- Conventional commits matching `git log`, for example `test: cover Reorder wrap on axis x and layoutId scale handoff`,
  `chore(deps): bump motion and motion-dom to 14.6.0`, `feat: re-export processFrame`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Confirm the upstream release exists

**Verify**: `npm view motion@14.6.0 version && npm view motion-dom@14.6.0 version` → prints `14.6.0` twice.

### Step 2: Red tests on the current pins (14.5.0)

1. **#2255, Reorder wrap on axis x.** Create `src/routes/tests/reorder/wrap-axis-x/+page.svelte`, a Svelte port
   of upstream `dev/react/src/tests/issue-2255.tsx` (read it with `git -C ~/Github/motion show v14.6.0:dev/react/src/tests/issue-2255.tsx`).
   Seven string items (`apple, banana, kiwi, watermelon, fig, grape, pear`) in a `$state` array; a
   `<div data-testid="order">{items.join(',')}</div>`; a `Reorder.Group axis="x"` with
   `style="display:flex; flex-wrap:wrap; gap:10px; width:300px; list-style:none; padding:0; margin:0"`; each
   `Reorder.Item` has `value={item}`, `data-testid={item}`, `transition={{ duration: 0.1 }}` and
   `style="background:#ddd; padding:10px; height:20px; white-space:nowrap"`. Header comment: a port of upstream
   #2255, commit `9632e2c3d`.
2. Create `e2e/reorder/wrap-axis-x.spec.ts`, a port of upstream `tests/react/issue-2255.spec.ts` (read it the same
   way). Load `/tests/reorder/wrap-axis-x?@isPlaywright=true`, wait for `apple`, drag it right 220 px in 20 steps
   with `waitForTimeout(30)`, recording `el.style.transform` each step. Then assert: the order changed; the
   transform polls to `'none'`; the final transform has no `translateY` / `translate3d`; the drawn-vs-layout y
   offset is ~0 (upstream's `offsetY` helper); and no recorded mid-drag transform contains `translateY` or
   `translate3d`.
3. **#2284, layoutId scale handoff.** Create `src/routes/tests/layout-id/scale-handoff/+page.svelte`, a port of
   upstream `dev/react/src/tests/issue-2284.tsx`. Read `linear` and `static` from `location.search` in `onMount`
   (store in `$state`). A red `motion.div` `data-testid="card"` with `layoutId="card"`, 100×150 px, `onclick` sets
   `open = true`. When `open`, render a fixed full-screen flex-centred overlay (see Conventions) holding a blue
   `motion.div` `data-testid="modal"` with `layoutId="card"`, 100×150 px, and `animate={isStatic ? undefined : { scale: 1.5 }}`.
   Both get `transition={linear || isStatic ? { duration: 2, ease: 'linear' } : undefined}` and, when `static`,
   `style` `scale: 0.5`. Header comment: port of upstream #2284, commit `597fc2c91`.
4. Create `e2e/layout-id/scale-handoff.spec.ts`, a port of upstream `tests/react/issue-2284.spec.ts`: for each mode
   in `default`, `linear`, `static`, load the page (`?@isPlaywright=true` plus `&linear` / `&static`), click
   `card`, wait for `modal`, sample `modal.getBoundingClientRect().width` every rAF for 3 s, then apply upstream's
   assertions (static: every sample ≈ 50; others: final ≈ 150; linear: max ≤ final + 1 and non-decreasing within
   1 px; default: max ≤ final × 1.05).
5. **#2280, chained `useTransform`.** In `src/lib/utils/transform.svelte.spec.ts`, add
   `it('#2280: a combined transform sees chained transform updates', …)`, ported from upstream
   `packages/framer-motion/src/value/__tests__/issue-2280.test.tsx`: inside `inRoot`, `a = useMotionValue(0)`,
   `aHalf = useTransform(a, (v) => v / 2)`, `aQuarter = useTransform(aHalf, (h) => h / 2)`,
   `result = useTransform([a, aQuarter], ([av, q]) => av + q)` (push each `[av, q]` into `seen`). `await nextFrame()`,
   `a.set(100)`, `await nextFrame()`, then expect `aQuarter.get()` 25, `result.get()` 125, and the last `seen`
   entry `[100, 25]`.
6. Link both pages in `src/routes/+page.svelte` (Reorder section and the layout-id links).

**Verify** (on 14.5.0):
- `PW_PORT=4201 pnpm exec playwright test e2e/reorder/wrap-axis-x.spec.ts` → expected to **FAIL** (a
  `translateY` during the drag or left over after it).
- `PW_PORT=4201 pnpm exec playwright test e2e/layout-id/scale-handoff.spec.ts` → record the result per mode.
  Passing on 14.5.0 is acceptable (see "svelte-motion's own paths"); note it in your report and continue.
- `pnpm exec vitest run src/lib/utils/transform.svelte.spec.ts` → record whether the #2280 test fails on 14.5.0.
  Either result is acceptable; note it.
- If `wrap-axis-x` PASSES on 14.5.0, record that and continue; it is not a STOP, keep it as a guard.

Commit (`test: cover Reorder wrap on axis x, layoutId scale handoff and chained useTransform`).

### Step 3: Bump the pins

Edit `package.json`: `"motion": "14.6.0"`, `"motion-dom": "14.6.0"` (exact, no caret; edit the file directly).
Run `pnpm install`.

**Verify**:
- `pnpm why motion-dom | grep -oE "motion-dom@[0-9]+\.[0-9]+\.[0-9]+" | sort -u` → exactly `motion-dom@14.6.0`
- `pnpm why motion-utils | grep -oE "motion-utils@[0-9]+\.[0-9]+\.[0-9]+" | sort -u` → exactly `motion-utils@14.6.0`
- `pnpm exec vitest run src/lib/__tests__/motionDependencies.spec.ts` → pass
- `pnpm check` → 0 errors

### Step 4: Re-export `processFrame` and document it

1. Add `processFrame` to the `motion` re-export block in `src/lib/index.ts` (alphabetical among the lower-case
   names, after `press`). Extend the block comment's list with "`processFrame` (Motion 14.6) for driving the
   frameloop from a loop other than `requestAnimationFrame`".
2. In `src/lib/index.spec.ts`, import `processFrame` from `./index.js` alongside the others and add
   `it('re-exports Motion 14.6 processFrame', () => { expect(typeof processFrame).toBe('function') })`.
3. In `docs/src/routes/docs/vanilla-values/+page.svx`, section `## Scheduler, generators, config`: add
   `processFrame` to the import list with the comment `// process a frame now, e.g. from an XRSession loop`. Below
   the code block add a short `### Driving frames yourself` subsection: what `processFrame()` does, that it is
   ignored inside a frame, the `MotionGlobalConfig.useManualTiming = true` + `processFrame(ms)` pattern for a
   timeline you control, and the limits from upstream's JSDoc (WAAPI-eligible animations run in JS while manual
   timing is on, except view transitions, optimized appear animations, and `oklch()`-style colours, which jump to
   their end). Mention that `@humanspeak/svelte-motion/three` schedules on `frame.preRender`, so a WebXR
   `renderer.setAnimationLoop` callback can call `processFrame()` to keep Motion in step.

**Verify**: `pnpm exec vitest run src/lib/index.spec.ts` → pass; `pnpm check` → 0 errors.

### Step 5: Static and unit gates

**Verify**: `pnpm test:only` → all pass. `trunk check` → no new issues. If a unit test fails, STOP and report the
test name and assertion (likely sources: the `immediate` re-run change in `render-step.ts`, or
`supportsWaapi()` under manual timing).

### Step 6: Green on the new pins

**Verify**:
- `PW_PORT=4201 pnpm exec playwright test e2e/reorder/wrap-axis-x.spec.ts e2e/layout-id/scale-handoff.spec.ts` → all pass
- `pnpm exec vitest run src/lib/utils/transform.svelte.spec.ts` → all pass
- `PW_PORT=4201 pnpm exec playwright test e2e/reorder e2e/layout-id e2e/drag` → all pass

### Step 7: Full e2e triage (STOP-and-review gate)

Run `PW_PORT=4201 pnpm test:e2e` while no other lane is running Playwright, and save the list of failing specs.

- Fully green: continue to Step 8.
- Any failure: **do not edit tests or library code.** For each failure, re-run that spec alone once (parallel
  lanes compete for CPU). If it fails again, record the spec, test name and assertion, and re-run it on
  `origin/main` in a scratch worktree (never stash) to separate new failures from pre-existing ones. Then STOP and
  hand the table to the maintainer: the repo's CLAUDE.md requires failed e2e runs to be reviewed one at a time with
  the maintainer. Specs most likely to move: `e2e/drag` (axis compensation), `e2e/reorder` (wrapped layouts),
  `e2e/layout-id` and `e2e/layout` (shared-layout transforms), anything sampling `useVelocity` or chained
  `useTransform` (immediate re-runs).

**Verify**: a written failure table (or "0 failures") in your report.

### Step 8: Changeset

Create `.changeset/motion-14-6-0.md` in the style of `.changeset/motion-14-5-0.md`, bump type `minor`. List what
users get: Motion/motion-dom 14.6.0; `processFrame` re-exported (drive Motion from a WebXR or custom loop);
`Reorder` wrapped `axis="x"` groups no longer leave a stray vertical offset after a drag (#2255); shared `layoutId`
elements that also animate `scale` no longer apply it twice (#2284); combined `useTransform`s see chained updates
in the same frame (#2280); stopped instant WAAPI animations stop cleanly; layout children keep animating with a card
whose drag ended mid-render. Do not mention keyboard reordering, `onReorder`'s `moved`, `useInView`,
`useAnimationFrame`, drag-disable-from-`onDrag` or the `layoutId` `initial` fix: other plans add their own
changesets.

**Verify**: `trunk check .changeset/motion-14-6-0.md` → clean.

### Step 9: Final gate

**Verify**: `pnpm build` (exit 0), `pnpm check` (0 errors), `pnpm test:only` (all pass),
`PW_PORT=4201 pnpm exec playwright test e2e/reorder/wrap-axis-x.spec.ts e2e/layout-id/scale-handoff.spec.ts` (pass),
`git status` shows only in-scope files.

## Test plan

- Red-first anchor: `e2e/reorder/wrap-axis-x.spec.ts` is expected to fail on 14.5.0 and pass on 14.6.0.
- Regression guards that may already pass on 14.5.0 (recorded, not a STOP): `e2e/layout-id/scale-handoff.spec.ts`
  (three modes) and the #2280 unit test in `transform.svelte.spec.ts`.
- `src/lib/index.spec.ts` asserts the new `processFrame` export. `processFrame` is a re-export with no
  svelte-motion behavior of its own, so it has no red test; plan 010 exercises it.
- The full e2e run (Step 7) catches other behavior shifts; the maintainer triages them.

## Done criteria

- [ ] `package.json` pins `motion` and `motion-dom` to exactly `14.6.0`; `"version"` unchanged (`2.5.0`)
- [ ] `pnpm why` shows a single `motion-dom@14.6.0` and `motion-utils@14.6.0`
- [ ] `grep -n "processFrame" src/lib/index.ts src/lib/index.spec.ts docs/src/routes/docs/vanilla-values/+page.svx` → at least one hit in each
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0; `trunk check` clean
- [ ] Both new e2e specs exist and pass on 14.6.0; their 14.5.0 results are in the report
- [ ] Full e2e result reported (green, or a failure table handed to the maintainer)
- [ ] `.changeset/motion-14-6-0.md` exists; both test pages are linked from `src/routes/+page.svelte`

## STOP conditions

- Port 4201 is occupied before a Playwright run (`lsof -ti :4201 -sTCP:LISTEN` prints a PID).
- `pnpm why` shows more than one motion-dom or motion-utils version.
- After the bump, `pnpm check` reports any error.
- A unit test fails after the bump.
- Any full-suite e2e failure: report it, do not fix it.
- A fix seems to need any out-of-scope file.

## Maintenance notes

- Every future Motion bump moves both pins together (spec-enforced).
- `processFrame` + `MotionGlobalConfig.useManualTiming` change WAAPI eligibility globally. If a user reports
  "animations stopped being hardware-accelerated", ask whether manual timing is on.
- svelte-motion's `flushFrameSteps` in `_MotionContainer.svelte` (around lines 2227-2240) runs
  `frameSteps.*.process()` directly, mirroring upstream `create-projection-node.ts`. The 14.6 `immediate` re-run
  semantics apply there too. If a mid-frame flush starts double-running a callback, look there first.
- Upstream's next release (14.7, unreleased at planning time) reworks `transition.out`, `layoutRoot` handoffs and
  bundle size. Plan it as a separate batch once it is tagged.
