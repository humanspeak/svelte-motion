# Plan 006: Tighten 005 to upstream parity (mount detection, `didUpdate` on mount, narrower detach) + cleanups

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> The guard (your dispatcher) maintains the README index; don't edit it. Don't commit; the guard commits.
>
> **Revision 2026-10-14 (guard, after the first 006 run STOPPED at finding 4; maintainer decided)**:
> - Findings 1-3 are done in the working tree (uncommitted). Keep them.
> - **Finding 4 → option A.** Gate `detachTransformAnimations` on this element's own Motion transform values being
>   on the compositor: `value.animation?.liveValue?.() !== undefined` (public `MotionValueAnimation` type). No
>   private group access, no heuristic. React Motion reaches the same measured result: its `willUpdate` demotes
>   only `transformGroups.get(instance)` (`create-projection-node.ts:123-124, 707, 713, 1007`), so user transform
>   animations stay applied. You may change the SETUP of the existing unit test "detaches a transform animation for
>   the read" so it declares a Motion-accelerated value. Its assertion must not change.
> - **`layoutId` self-consume → fix it.** `src/lib/utils/layoutId.ts` is now in scope: tag each registry entry
>   with the element that wrote it, and don't let an element consume its own entry when its `layoutId` turns back
>   on (upstream: the node stays lead of its own stack, so nothing animates). `toggle-layout-id` must go green.
> - **Post-finish inline overwrite** (`stripToBaseTransforms` writes base over an inline `translateY(40px)`
>   committed by a finished `animate(el, {transform})`): don't change it. Compare with upstream `resetTransform`
>   (`create-projection-node.ts` ~998-1030, which also rewrites the inline transform for the read) and report
>   whether it's a real divergence.
> - The `_paintedFrames.ts` ResizeObserver sampler replaces the MessageChannel one in the plan. Accepted.
>
> **Revision 2 2026-10-14 (guard; maintainer: "these should be planned for and fixed as part of this build")**:
> findings 1-8 are done in the working tree (guard-verified: unit 1177 passed, `pnpm check` 0 errors, full e2e
> 607 passed / 2 skipped / 0 failed). Keep all of it. Work only **Step 5 (findings 9-11)** below, red tests first.
> The "don't change the post-finish inline overwrite" bullet above is replaced by finding 10.
>
> **Revision 3 2026-10-14 (maintainer)**: finding 13 added: a reactive layout commit landing after the frameloop
> painted one unprojected frame. It now flushes the frame steps the way upstream's `update()` does. Finding 10's
> target is corrected after the upstream fixture check: upstream DROPS a foreign inline transform in one frame
> (`applyProjectionStyles` writes `'none'`, `create-projection-node.ts` 2050-2055), so the box neither stays at
> +40 nor slides. Match that exactly, add an `animate(el, { y })` supported-path case, and don't touch
> `e2e/projection/nested-ancestor` without the maintainer.
>
> **Revision 4 2026-10-15 (maintainer)**: finding 14 added: declarative `animate={{ transform: '…' }}` on a
> `layout` element follows finding 10's rule (`upstreamKeptTransform`) but has no test. Work only finding 14.
>
> **Revision 5 2026-10-15 (maintainer)**: finding 15 added: the `layout-user-transform` tester page can't be driven
> by hand (every button toggles width 100↔300 with no reload or wait, so repeat presses stack layout animations on
> half-finished slides and verdicts go FAIL for scenarios that never ran). Work only finding 15.
>
> **Revision 6 2026-10-15 (maintainer)**: finding 16 added: after a mid-slide widen, upstream leaves boxes 2 and 5
> 40px down once their slides end; ours drops them back to their rows. Work only finding 16.
>
> **Revision 7 2026-10-16 (maintainer)**: finding 16 dropped (a measurement artifact of the guard's fixture,
> see item 16). Finding 17 added: check whether a commit with no layout change ends a finished projection the
> way a React re-render does. Work only finding 17.
>
> **Revision 8 2026-10-16 (maintainer)**: finding 18 added: in the sign-off browser, a reload of
> `layout-hydration` finishes the projection within 1ms of starting it. Work it after finding 17.
>
> **Revision 9 2026-10-16 (maintainer)**: finding 17 fixed (executor). Finding 18 closed as matching upstream: a
> same-size `resize` the sign-off browser fires before the first frame finishes the animation, as in React.
> Finding 19 added: the hydration tester page reports such a load as "not judged". Work only finding 19.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Workspace**: `/Users/jasonkummerl/Github/svelte-motion-1420`, branch `feat/motion-14.2.0`.
>
> **Drift check (run first)**: `git log --oneline -1` → this plan's revision-2 docs commit. `git status --short`
> lists only the uncommitted findings 1-8 work (`git diff --stat` touches the files named in "Current state", plus
> `layoutId.ts`, the new pages/specs/helpers and `.changeset/layout-mount-parity.md`). Anything else: STOP.

## Status

- **Priority**: P1 (findings 1-4 are parity gaps in code this branch ships); P3 for 5-8
- **Effort**: M
- **Risk**: MED. Touches the pre-update snapshot effects and the measurement helper every `layout` element uses.
- **Depends on**: 005 (`3ab94f92`), 003 (`3c51ee6b`), 004 (`735071af`)
- **Category**: bug (upstream parity) + cleanup
- **Planned at**: `f5df8fbb`, 2026-10-14
- **Source**: `/code-review` of the worktree against Motion v14.2.0 (2026-10-14). Its findings were NOT
  independently verified; the red tests below are the verification. A finding you can't make red is reported
  back with evidence, not "fixed".

## Upstream reference (Motion v14.2.0, `~/Github/motion`, `git show v14.2.0:<path>`)

- `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx`
  - `componentDidMount` (39-65): adds to layout group, registers with switch group, and
    **`if (hasTakenAnySnapshot) projection.root!.didUpdate()`** (51-53). Never calls `willUpdate()`.
  - `getSnapshotBeforeUpdate` (68-98): every later commit calls `willUpdate()` (subject to `layoutDependency`,
    `drag`, `isPresent`), including commits in the same render as other state.
  - The component (and so `componentDidMount`) re-mounts when the `layout` feature turns back on.
- `packages/motion-dom/src/projection/node/create-projection-node.ts`
  - `demoteTransforms = ({ instance }) => instance && transformGroups.get(instance)?.demote()` (123-124), used at
    707, 713 (`willUpdate` path) and 1007 (dirty `resetTransform`). Upstream only ever touches **Motion's own
    transform group** for the element. User WAAPI animations, `animate(el, { transform })` NativeAnimations and
    optimized-appear handoff animations stay applied while upstream measures.
- `transformGroups` is NOT exported from `motion-dom`'s public entry (`node_modules/motion-dom/dist/es/index.mjs`),
  and a group's WAAPI `segments` are closure-private (`animation/waapi/transforms/TransformAnimation.mjs` ~380-400,
  800-850). `TransformAnimation` instances do expose `this.group` (`.tracks`, `.isJS`) and `isAccelerated()`.

## Current state (svelte-motion)

- `src/lib/html/_MotionContainer.svelte`
  - ~2289 `let layoutUpdateMountedElement: HTMLElement | null = null`; ~2341-2362 the layout `$effect.pre`.
    `shouldProject = element && layoutProp && isLoaded === 'ready' && hasLayoutFeatures`. The first run where
    `shouldProject` is true AND `element` is new counts as the mount and returns early.
  - ~2504 `layoutIdUpdateMountedElement` + ~2513-2525 the `layoutId` fan-out `$effect.pre`, same pattern.
- `src/lib/utils/motionDomProjection.ts`
  - ~180-212 `detachTransformAnimations(el)`: detaches EVERY script-created animation on `el` whose keyframes
    contain `transform` (CSS animations/transitions skipped).
  - ~1325-1350 `stripToBaseTransforms()`: per adapter in `projection.path` + self, interleaves
    `detachTransformAnimations(el)` (calls `el.getAnimations()` + `getKeyframes()`) with `el.style.transform = base`
    writes.
- `src/lib/components/Reorder/Group.svelte` ~150-166: forwards `onpointerdowncapture` / `onclickcapture` with
  `typeof === 'function'` + cast.
- `countTransformAnimations` is duplicated in `src/routes/tests/independent-transforms/{basic,layout-idle,layout-measure}/+page.svelte`
  and `src/routes/tests/motion/on-update/+page.svelte`.
- `src/lib/html/index.ts` (~356 and each repeat): per-tag JSDoc callback lists omit `onUpdate`.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Targeted e2e | `pnpm playwright test <spec> --repeat-each=5` | see steps |
| Layout area | `pnpm playwright test e2e/layout e2e/layout-id e2e/projection e2e/animate-layout e2e/animate-presence e2e/reorder e2e/drag e2e/motion e2e/independent-transforms` | all pass |
| Full e2e | `pnpm test:e2e` | 0 failed (pre-existing flake `pan-authored-transforms.spec.ts:74` may need one re-run; report it) |
| Unit | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint | `trunk fmt` then `trunk check` | clean |

**Port rule**: before any Playwright run, `lsof -ti :4198 -sTCP:LISTEN`. If anything listens, STOP and ask. Never
kill it. Do NOT set `PW_REUSE_SERVER`. Leave port 4199 (maintainer's preview) and 9991 (upstream fixture) alone.
Verify against the built preview (Playwright default), not `vite dev`.

## Scope

In: the files above, `src/lib/utils/layoutId.ts` (revision 2026-10-14), new test pages under `src/routes/tests/independent-transforms/` (link each from
`src/routes/+page.svelte`), new specs under `e2e/independent-transforms/`, unit tests in
`src/lib/utils/motionDomProjection.spec.ts` / `src/lib/html/_MotionContainer.spec.ts`, one patch changeset
(`.changeset/layout-mount-parity.md`) if any library behaviour changes.

Out: anything not listed; disabling acceleration; editing existing assertions to make them pass (STOP instead);
the README index.

Test pages a human will look at need the guided `TesterPanel` (steps, expected, live verdicts) hidden under
`@isPlaywright=true`, as in `layout-measure`.

## Steps

### Step 1: Red tests for findings 1-4 (against the current code, before any fix)

Write each test, run it against the unfixed code, and record the failing output. If a test can't be made to
fail after an honest attempt, record what you tried and the observed behaviour, mark that finding
"not reproduced", and skip its fix in Step 2. Don't weaken a test to make it fail or pass.

1. **Late mount detection (finding 1).** A `layout` element WITH an enter animation (`initial` + `animate`, so
   `isLoaded` reaches `'ready'` 1-2 frames after mount) whose `class` or `style` width changes in the same flush
   where it becomes ready (drive it from the same frame; e.g. change on `onAnimationStart`, or on a rAF chain
   timed to the ready flip; find a trigger that lands in that flush and explain it). Expected (upstream): the
   change animates (FLIP from the old box); assert no single-frame jump larger than the expected per-frame step,
   sampled after all rAF callbacks (MessageChannel post from a rAF, NOT inside a rAF callback; reading inside
   rAF before Motion's frameloop gives stale main-thread values).
2. **Toggle `layout` off → on (finding 2).** An element animating `x` on the compositor, `layout={on}`; flip
   `on` true → false → true while it's idle and mid-animation. Expected (upstream re-mounts `MeasureLayout`, so
   the re-enable is a mount, not an update): re-enabling does NOT demote (`countTransformAnimations(id)` stays 1
   while `x` is in flight) and causes no layout animation. Cover the `layoutId` fan-out effect too (an element
   with `layoutId`, no `layout`, inside a `LayoutGroup`, with its group-membership condition toggled).
3. **No `didUpdate` on mount (finding 3).** Upstream runs `projection.root.didUpdate()` on mount once any snapshot
   has been taken. Construct the case the review describes: a `layout` element whose box moves between
   projection mount and `'ready'` (e.g. a sibling or font change during the enter frames), then a later layout
   change; assert the later FLIP starts from the correct origin. Unit-level is fine if e2e can't isolate it:
   assert the mount path calls `root.didUpdate()` / `refreshCachedLayout()` when a snapshot has been taken.
4. **Over-wide detach (finding 4).** Unit test in `motionDomProjection.spec.ts` plus one e2e: a `layout` element
   that also has a NON-Motion transform animation (`el.animate([{ transform: 'translateY(40px)' }], { fill: 'forwards', duration: 1000 })`)
   and one with `animate(el, { transform: 'translateY(40px)' })` from `motion`. Trigger a svelte-motion
   measurement (layout change). Expected (upstream): the measurement includes the user animation, so no
   spurious 40px FLIP/projection delta.

### Step 2: Fixes (only for findings whose red test failed)

- **Findings 1 + 2 (one mechanism).** Replace the element-identity mount markers with "projection just switched
  on" tracking that matches `MeasureLayout`'s mount/re-mount: the mount is the run where the projection
  condition goes false → true (the feature mounting), independent of later `isLoaded` timing, so a
  layout-affecting change in a later flush (including the one where `'ready'` lands) gets its snapshot +
  `willUpdate()`. Apply the same mechanism to both `$effect.pre` blocks (layout and `layoutId` fan-out); no copy
  of the old marker pattern should remain. Work out from the code what "the feature mounts" corresponds to here
  (adapter mount, `hasLayoutFeatures`, `layoutProp`, `isLoaded`) and justify the choice in the comment with the
  upstream line refs. Keep 005's guarantees: `layout-idle`, `layout-measure`, `basic` specs stay green.
- **Finding 3.** On the mount pass, mirror `MeasureLayout.tsx:51-53`: when any snapshot has been taken
  (svelte-motion's equivalent of `hasTakenAnySnapshot`; find or add it, module-level like upstream), run the
  root `didUpdate()` path / `refreshCachedLayout()` so the cached layout isn't stale. Must not reintroduce a
  mount-time `willUpdate()` (that was 005's bug).
- **Finding 4.** Narrow `detachTransformAnimations` to Motion's own accelerated transform animations, as close to
  upstream's `transformGroups.get(instance)` as the public API allows. `transformGroups` isn't exported, so
  investigate what IS reachable (the element's VisualElement motion values → `value.animation` →
  `TransformAnimation` with `.group` / `isAccelerated()`; anything else) and pick the narrowest RELIABLE
  identification. Do not import from motion-dom internals (`dist/es/animation/...` deep paths) and do not
  monkey-patch `Element.prototype.animate`. If no reliable public handle exists, STOP and report the options with
  trade-offs; don't ship a heuristic without the guard's agreement.

### Step 3: Cleanups (findings 5-8)

5. `stripToBaseTransforms`: collect every adapter element's animations (and detach them) BEFORE any inline
   `style.transform` write, so a chain of N elements costs one style recalc, not N. Same restore order guarantees.
   Don't call `getKeyframes()` more than once per animation.
6. `Reorder/Group.svelte`: type the destructured capture props narrowly so the forwarding is
   `onpointerdowncapture?.(event)` / `onclickcapture?.(event)` like upstream `Group.tsx`, with no cast. If
   Svelte's handler types make that impossible, keep the current form and say why in one comment line.
7. Move `countTransformAnimations` into one shared helper under `src/routes/tests/independent-transforms/`
   (e.g. `_countTransformAnimations.ts`), used by all four pages, still exposed on `window` for the specs.
8. `src/lib/html/index.ts`: add `onUpdate` to every per-tag JSDoc callback list (Google-style, matching the
   existing entries).

### Step 4: Verify

1. Every Step 1 test: green, `--repeat-each=5` for e2e.
2. 005/003/004 specs: `e2e/independent-transforms` (all), `e2e/reorder`, `e2e/motion/on-update.spec.ts`,
   `--repeat-each=3`, all green.
3. Layout area command: all pass.
4. `pnpm test:only`, `pnpm check`, `trunk fmt`, `trunk check`: clean.
5. Full e2e `pnpm test:e2e`: 0 failed. Any failure outside the pre-existing flake: STOP (CLAUDE.md: failures are
   reviewed with the maintainer one at a time).

### Step 5: Findings 9-11 (revision 2)

Same rules as Step 1: record each red output against the current working tree before changing code; a case you
can't make red after an honest attempt is reported "not reproduced" with what you tried, not fixed blind.

9. **The detach-scope unit test proves nothing (test-only).** `motionDomProjection.spec.ts` "never detaches
   non-transform animations or CSS animations/transitions" (~409) passes because the element has no
   Motion-accelerated transform, so `stripToBaseTransforms` never collects anything. Change its SETUP only: give
   the VisualElement a transform value whose `animation.liveValue()` returns a number (the way "detaches a
   transform animation for the read" does after finding 4), and add one Motion transform effect next to the
   three it already has. The existing assertion (opacity / CSS animation / CSS transition stay attached on every
   read) must not change; add one assertion that the Motion transform effect IS detached during the read, so the
   test fails if the gate ever goes back to "detach nothing". Prove it bites: temporarily make
   `collectTransformEffects` skip the `animationName` / `transitionProperty` check, see it go red, restore it.
   Record that red output.
10. **Post-finish inline overwrite (library).** Upstream `resetTransform()` (motion-dom
    `create-projection-node.ts` @ v14.2.0, 999-1031) only writes the inline transform when
    `hasProjection || hasTransform(this.latestValues) || transformTemplateHasChanged`; `HTMLProjectionNode.ts:23`
    writes the template value or `'none'`. An element whose inline transform came from someone else (a finished
    `animate(el, { transform: 'translateY(40px)' })` that committed its styles, or page code writing
    `el.style.transform`) and that has no Motion transform values, no projection delta and no template is measured
    WITH that transform upstream. Ours writes base (`'none'`) over it for every read (`stripToBaseTransforms`,
    `motionDomProjection.ts` ~1414-1420), so the measured box is 40px off from upstream's.
    - **Red e2e** (`e2e/independent-transforms/layout-user-transform.spec.ts`, new case, same page or a new
      `layout-inline-transform` page with a TesterPanel): a `layout` element; `await animate(el, { transform:
      'translateY(40px)' }).finished`, then a layout change (widen). Expected (upstream): no vertical
      jump/FLIP at the change; the element stays at +40px throughout (paint-sampled, `_paintedFrames.ts`).
      Also a unit test in `motionDomProjection.spec.ts`: inline `translateY(40px)`, no Motion transform values,
      no projection delta → the read sees the inline transform untouched. Before writing the e2e, confirm the
      upstream behaviour on the fixture server (port 9991, `~/Github/motion/dev/react-19`, already running; add
      no files to `~/Github/motion`; if you need a fixture there, STOP and ask) or justify it from the source
      with line refs.
    - **Fix**: skip the strip for an element exactly when upstream's `resetTransform` would skip it: no
      non-zero projection delta (`isDeltaZero` is exported from `motion-dom`), `hasTransform(latestValues)`
      false (`hasTransform` is exported), and no `transformTemplate` change. Keep the `'' → 'none'` write
      for elements that DO qualify, keep the read-all-then-write ordering, keep base-transform handling for
      elements with a user `style` transform (`getBaseTransform`), and update the JSDoc on
      `stripToBaseTransforms` with the line refs. Don't touch the detach gate (finding 4).
    - Must stay green: `layout-idle`, `layout-measure`, `basic`, `layout-user-transform` (existing cases),
      `e2e/layout`, `e2e/transform-template`, `e2e/drag`, `e2e/reorder`.
11. **Hydrated (server-rendered) mount (library).** SvelteKit renders every test page on the server, so a full
    `page.goto` hydrates, while a client-side navigation or a `{#if}` mount (what `layout-mount-ready` does with
    its Mount button) does not. The 006 run flagged that a layout change made during the hydrating flush (a
    parent `onMount` / `$effect` that changes the element's size or class on first run) may be folded into the
    mount pass and snap, where React (hydrate → `componentDidMount` → `useEffect` setState → a new commit →
    `getSnapshotBeforeUpdate` → `willUpdate()`, `MeasureLayout.tsx` 39-98) animates it.
    - **Red e2e** (new page `layout-hydration` with a TesterPanel, new spec): a `layout` box whose width goes
      100 → 300 from the page's `onMount` (and a second box from a `$effect`). Load it two ways: `page.goto`
      (hydrated) and client navigation from the index (`page.click` on its link, not `goto`). Expected: both
      animate (paint-sampled widths between 100 and 300 over the transition), same as the client-mounted case.
      If the hydrated path animates too, record "not reproduced" with the sampled widths for both paths and
      skip the fix.
    - **Fix** (only if red): make the mount pass the run where `MeasureLayout` mounts on the hydrated element,
      and treat any later flush as an update, same rule as finding 1. Justify it in the
      `createMeasureLayoutMountTracker` comment with the upstream refs. No mount-time `willUpdate()` (005).
12. Changeset: extend `.changeset/layout-mount-parity.md` (patch) with one line each for 10 and 11 if fixed.
13. Verify: Step 4 in full again (targeted `--repeat-each=5`, area, unit, check, `trunk fmt` / `trunk check`,
    full e2e). Report exact counts, every red/green excerpt, `git diff --stat`, and upstream line refs.

14. **Declarative `transform` string on a `layout` element (test-only unless red).** Finding 10 keeps a
    VisualElement's `transform` string as the read base (`upstreamKeptTransform`, `motionDomProjection.ts` ~248,
    used ~1476), but every test drives it imperatively (`animate(el, …)` / page-written inline). Nothing covers
    `<motion.div layout animate={{ transform: 'translateY(40px)' }}>`.
    - **Upstream first**: on the React fixture server you used for finding 10, record painted frames for the same
      shape (`<motion.div layout animate={{ transform: 'translateY(40px)' }}>`, wait for it to finish, then
      widen; also widen mid-animation). Add no files to `~/Github/motion`; if confirming needs a new fixture
      there, STOP and ask. Cite the source lines that explain what you see (`build-styles` handling of the
      `transform` key, `has-transform.ts`, `resetTransform` 999-1031, `applyProjectionStyles` 2050-2076).
    - **Tests**: a fifth box on `layout-user-transform` (`#user-declarative`) with its own TesterPanel verdict
      rows, plus e2e cases in `layout-user-transform.spec.ts` (paint-sampled via `_paintedFrames.ts`, after
      finish and mid-animation, matching the upstream frames), plus a unit test in `motionDomProjection.spec.ts`
      for the read base when the VisualElement's `transform` string comes from a declarative animation.
    - **Prove they bite**: temporarily make `upstreamKeptTransform` return `undefined`, record the red output,
      restore it. If a case can't be made red, say so. If the current code does NOT match upstream for this
      shape, record it red and STOP with options before fixing.
    - Also fix the stale step 2 text on that page ("Both boxes… Neither jumps…") so it names the boxes it
      means. Don't change existing assertions or existing e2e files other than adding cases.
    - Verify: targeted `layout-user-transform` `--repeat-each=5`, `pnpm test:only`, `pnpm check`,
      `trunk fmt` / `trunk check`, and the area run (`e2e/independent-transforms`, `e2e/layout`,
      `e2e/projection`). Report exact counts.

15. **Make `layout-user-transform` drivable by a human (page-only; no library change).**
    - **One button = one complete scenario.** Replace the tester buttons with three scenario buttons: "Widen
      mid-slide (boxes 1, 2)", "Widen after finish (boxes 2-5)", "Widen the declarative box mid-slide (box 5)".
      Each one reloads the page with a query (e.g. `?scenario=after-finish`), waits the right time itself
      (showing a countdown such as "Waiting for the slides to finish… 3s"), widens once, samples, and shows the
      verdict. Pressing any button again just starts that scenario fresh from a reload. While a scenario runs,
      the buttons are disabled. No button ever toggles the width back.
    - **Only judge what ran.** Verdict rows for scenarios that didn't run show "not run" (not FAIL, not stale
      PASS). If the precondition doesn't hold when the widen fires (e.g. box 5 already stopped), say so
      ("precondition missed: reload") instead of FAIL.
    - **Label the boxes on the page**: a short caption beside each box (1: page WAAPI animation, 2: Motion
      `animate(el, { transform })`, 3: page-written inline transform, 4: Motion `y`, 5: `animate={{ transform }}`),
      and, for the running scenario, dim the boxes it doesn't judge. Each scenario's "Expected" text says, box by
      box, what you see. Fix the stale "both rows below" status text.
    - **Keep the Playwright surface unchanged.** `window.widenAndSample` / `widenAndSampleTops` and everything the
      spec uses must behave exactly as now under `@isPlaywright=true` (no auto-run, no reload, no dimming). The
      TesterPanel stays hidden there. Existing e2e must pass without edits; add one e2e case that loads each
      `?scenario=` URL in tester mode and waits for its PASS.
    - **Repeat-press check, report only.** On the same React fixture as finding 14, record painted frames for
      "widen mid-slide, then narrow back 300ms later" (boxes 2 and 5 shapes), run the same on our page via
      `widenAndSampleTops`, and report whether they match. Don't add it to the page or fix anything; if they
      differ, STOP after the page work and report the frames.
    - Verify: targeted `layout-user-transform` `--repeat-each=5`, `pnpm check`, `trunk fmt` / `trunk check`.
      Check the tester page yourself at 1920 wide: each button, pressed twice in a row, ends with its rows PASS.

16. **Dropped (revision 7).** The guard's React fixture (port 4212) re-rendered its whole App every 100ms for a
    countdown, and those re-renders kept boxes 2 and 5 at +40. Without them, React Motion 14.2.0 drops them to
    their rows when the slide ends, exactly like ours, and finding 14's mid-slide assertions stand (executor
    measurement; guard re-ran it: +40 with the countdown, 0 without, at 4.5s and 6s). Box 1 holds +40 on both.

17. **A commit with no layout change ends a finished projection (check; fix only if red).** Upstream, a
    finished layout animation keeps `target`, so every later render writes `none` via the projecting path
    (`create-projection-node.ts` 2042-2075; `completeAnimation` 1791-1805 leaves it). A React re-render whose
    layout didn't change runs `didUpdate` → `finishAnimation` (615-617, 2445-2448), which clears `target`, and
    the element's own transform renders again (with one re-render at 3000ms, boxes 2 and 5 end at +40, and box
    4's inline value turns into `translateY(40px)`).
    - **Check**: in ours, does a Svelte commit on a `layout` element that doesn't move it (e.g. a style-prop
      change such as a colour, or a `layoutDependency`-free prop change) run the `willUpdate` → `didUpdate`
      pair the way a React re-render does, so the same thing happens? Use the executor's variant fixture
      `/tmp/sm-react-f16` (`?countdown=0&rerenderAt=3000`) as the upstream reference, and record painted frames
      on both.
    - **If it differs**: red e2e first (a new box or page state on `layout-user-transform` that changes a
      non-layout prop once after the layout animation ends; assert the end offset matches upstream), a unit
      test at the bug's level if one fits, then the fix, citing lines. Don't regress findings 10, 14 or 15.
    - **If it matches**: add the e2e case anyway as coverage and report it as green.
    - Verify: targeted `layout-user-transform` `--repeat-each=5`, the area run (`e2e/independent-transforms`,
      `e2e/layout`, `e2e/projection`), `pnpm test:only`, `pnpm check`, `trunk fmt` / `trunk check`. Report
      exact counts and the red/green excerpts.

18. **Hydration widen is finished instantly when the app starts before the first frame (library; red first).**
    The maintainer's sign-off browser (T3 Code in-app, Electron 44 / Chrome 152, 1280×800 at 2x) fails
    `layout-hydration` on every reload: both rows FAIL with "first widths 300, 300, …". Headless Chromium passes
    (18 reloads), and so do a fresh tab, a client-side navigation and an iframe load in the same browser.
    Guard trace from a `<head>` probe, injected by a local proxy on 4217 in front of 4199 (no repo change;
    `/tmp/sm-proxy/proxy.mjs`). Times are performance.now() in ms, values are `#hydrate-mount`'s inline transform:

    | Load | Projection starts | Ends | First rAF frames |
    | --- | --- | --- | --- |
    | Navigate (PASS) | 108: `translate3d(-100px…) scale(0.333…)` | animates over 1s | 31, 50, 66 (before hydration), then 109, 112, … |
    | Reload (FAIL) | 55: `translate3d(-100px…) scale(0.333…)` | 56: `none` (under 1ms later) | 55, then 59: width 300 |

    On the reload, the app hydrates before the first frame and the projection is finished within a millisecond,
    before it ever ticks. That matches upstream's rule for a `didUpdate` with no layout change on a node whose
    animation hasn't started (`create-projection-node.ts` @ v14.2.0, 610-617 → `finishAnimation` 2445-2448).
    So the suspicion is that ours runs a second, no-change update cycle right after the widen commit.
    - **Find the second cycle**: what calls `willUpdate`/`didUpdate` (or `finishAnimation`/`root.didUpdate`)
      after the widen commit on this page, before the first frame? Candidates: the adapter mount effect's
      `didMount()` ordering, the observer path, the `isTester` / `verdicts` state flush, or the second box's
      `$effect` flush. Cite our file:line. Check what upstream does for the same React shape (hydrate, an
      effect widens, one more parent re-render before the first frame) on a fixture; add no files to
      `~/Github/motion`.
    - **Red first**: make the race deterministic in a test (e.g. a unit test that hydrates and flushes
      before any frame, or an e2e that holds `requestAnimationFrame` until hydration finishes via
      `page.addInitScript`). The red must show the projection finished before its first tick.
    - **Fix** to match upstream, citing lines. Don't regress findings 1-15 or 17.
    - Verify: targeted `layout-hydration` and `layout-user-transform` `--repeat-each=5`, the area run
      (`e2e/independent-transforms`, `e2e/layout`, `e2e/projection`), `pnpm test:only`, `pnpm check`,
      `trunk fmt` / `trunk check`. Report exact counts and the red/green excerpts. The guard re-checks it in
      the sign-off browser.

19. **`layout-hydration` page: don't judge a load where the browser resized before the first frame (page-only).**
    Finding 18 closed as matching upstream. In the sign-off browser a `resize` (same size: 1467×1210 before and
    after) fires at ~86ms on reload, before Motion's first `frame.read` stores `innerWidth` (root resize
    listener, `create-projection-node.ts` @ v14.2.0 482-508; `finishAnimation` 505-508). That finishes the
    animation the same way React Motion 14.2.0 does (executor's `/tmp/sm-react-f18` fixture; guard probe on
    4217 logged `resize` at 86, inline `none` at 87). Maintainer decision: match React; fix the page only.
    - Record `resize` events from page start until the verdict is in (as early as the page script can).
      If one fired before the first painted frame, each row shows "not judged: the browser sent a resize
      before the first frame (Motion finishes layout animations on resize, same as React)" with a neutral
      chip, not FAIL. Keep the PASS/FAIL logic for every other load.
    - Add one sentence to the page's checks text explaining this. The Playwright surface is unchanged and the
      TesterPanel stays hidden under `@isPlaywright=true`. Existing e2e must pass without edits; add an e2e
      case that dispatches a `resize` before the first frame in tester mode (e.g. `page.addInitScript`) and
      expects "not judged", and one without it that expects PASS.
    - Verify: targeted `layout-hydration` `--repeat-each=5`, `pnpm check`, `trunk fmt` / `trunk check`.

## Done criteria

- For each of findings 1-4: either (a) red output recorded before the fix + green after, or (b) "not reproduced"
  with the attempts and observations.
- Findings 5-8 done (or 6 explained).
- Findings 9-11 (revision 2): red then green, or "not reproduced" with evidence; finding 9 shown to bite.
- All Step 4 commands green; exact pass/fail counts reported.
- Report includes: `git diff --stat`, each red/green output excerpt, upstream line refs for each behaviour, and
  anything you were unsure about.

## STOP conditions

- Drift check fails.
- Port 4198 is in use.
- Finding 10's upstream behaviour can't be confirmed from the fixture or the source.
- A fix needs a motion-dom internal import, a prototype patch, or a heuristic for finding 4 (report options).
- An existing spec fails and the fix would mean editing its assertion.
- 005's `layout-idle` / `layout-measure` / `basic` go red and you can't restore them within the plan's approach.
- Full e2e has a failure other than the known `pan-authored-transforms.spec.ts:74` flake.

## Maintenance notes

- If Motion later exports `transformGroups` (or a demote API), switch finding 4's identification to it.
- The mount-vs-update split must track `MeasureLayout.tsx` on every Motion bump: recheck 39-98 for changes to
  `componentDidMount` / `getSnapshotBeforeUpdate`.
