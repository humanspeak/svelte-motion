# Plan 006: Tighten 005 to upstream parity (mount detection, `didUpdate` on mount, narrower detach) + cleanups

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> The guard (your dispatcher) maintains the README index; don't edit it. Don't commit; the guard commits.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Workspace**: `/Users/jasonkummerl/Github/svelte-motion-1420`, branch `feat/motion-14.2.0`.
>
> **Drift check (run first)**: `git log --oneline -1` → `f5df8fbb` (or this plan's own docs commit on top of it),
> and `git status --short` → empty apart from this plan file. Anything else: STOP.

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

In: the files above, new test pages under `src/routes/tests/independent-transforms/` (link each from
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

## Done criteria

- For each of findings 1-4: either (a) red output recorded before the fix + green after, or (b) "not reproduced"
  with the attempts and observations.
- Findings 5-8 done (or 6 explained).
- All Step 4 commands green; exact pass/fail counts reported.
- Report includes: `git diff --stat`, each red/green output excerpt, upstream line refs for each behaviour, and
  anything you were unsure about.

## STOP conditions

- Drift check fails.
- Port 4198 is in use.
- A fix needs a motion-dom internal import, a prototype patch, or a heuristic for finding 4 (report options).
- An existing spec fails and the fix would mean editing its assertion.
- 005's `layout-idle` / `layout-measure` / `basic` go red and you can't restore them within the plan's approach.
- Full e2e has a failure other than the known `pan-authored-transforms.spec.ts:74` flake.

## Maintenance notes

- If Motion later exports `transformGroups` (or a demote API), switch finding 4's identification to it.
- The mount-vs-update split must track `MeasureLayout.tsx` on every Motion bump: recheck 39-98 for changes to
  `componentDidMount` / `getSnapshotBeforeUpdate`.
