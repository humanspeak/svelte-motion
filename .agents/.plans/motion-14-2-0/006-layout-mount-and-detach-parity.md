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
