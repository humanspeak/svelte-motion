# Plan 005: Mounting a `layout` element doesn't fake a layout update, so its transforms stay on the compositor

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update this plan's status row in
> `.agents/.plans/motion-14-2-0/README.md`, unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Workspace**: `/Users/jasonkummerl/Github/svelte-motion-1420`, branch `feat/motion-14.2.0`
> (Motion 14.2.0 installed by plan 001).
>
> **Drift check (run first)**: `git diff --stat a483a4ab..HEAD -- src/lib/html/_MotionContainer.svelte src/routes/tests/independent-transforms e2e/independent-transforms`
> Plan 004 may have run first and added an `onUpdate` destructure and one `buildMotionNodeProps` line to
> `_MotionContainer.svelte`. That's expected. Any change to the two `$effect.pre` blocks quoted below means STOP.

## Status

- **Priority**: P1 (blocks plan 001's parity spec; 002 now depends on this)
- **Effort**: S
- **Risk**: MED. Touches the pre-update snapshot every `layout` / grouped `layoutId` element runs.
- **Depends on**: 001 (landed `a5e4da8d`)
- **Category**: bug (upstream parity; exposed by the 14.2.0 bump)
- **Planned at**: commit `a483a4ab`, 2026-10-13

## Why this matters

Motion 14.2.0 runs `x`/`y`/`scale`/`rotate` animations on the compositor as one WAAPI `transform` animation per
element. It moves them back to the main thread ("demotes") whenever the projection node's `willUpdate()` runs,
because a layout update is about to measure and animate the element.

svelte-motion calls `willUpdate()` once when a `layout` element **mounts**. Upstream never does that:
`MeasureLayout.componentDidMount` (framer-motion `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx:39-65`
@ `v14.2.0`) only registers the node and calls `root.didUpdate()`. `willUpdate()` runs only in
`getSnapshotBeforeUpdate`, i.e. on **updates** (lines 68-98).

Result: every `layout` element with an entry animation loses compositor acceleration immediately after mount,
so the upstream parity spec fails:

```
e2e/independent-transforms/basic.spec.ts:92  "a layout animation moves the element to the main thread"
expect(await count(page, 'layout')).toBe(1)   →   Expected: 1, Received: 0     (at ~150 ms, before any width change)
```

It's also wrong on its own terms. The mount snapshot is taken **after** the entry animation has started on the
compositor, so it includes the in-flight `x` (WAAPI overrides inline style, so svelte-motion's strip-inline-
transform trick doesn't remove it). It then diffs against the real layout and starts a **spurious 0.8 px layout
animation** at mount.

### Evidence (guard probe, 2026-10-13, built branch on port 4199, `#layout` box of the parity page)

The probe hooked the node's `projection.willUpdate` / `startAnimation` (via a `WeakMap.prototype.set` init-script spy on
`visualElementStore`):

```
t=621ms  willUpdate      (from a Svelte effect flush, i.e. the layout $effect.pre)
t=632ms  startAnimation  snapshot.x = [0.8, 100.8]  layout.x = [0, 100]  latestValues.x = 2.8
         → projection.currentAnimation = true, isProjecting() = true, element.getAnimations() = 0
```

Before t≈600 the node had `isProjecting() = false` and no layout animation. Nothing on the page changed.

## Current state

`src/lib/html/_MotionContainer.svelte`:

1. The mount effect sets the state and starts the entry animation in the same synchronous block
   (e.g. ~line 3253-3254 and the other `isLoaded = 'ready'` sites at ~2061, 3272, 3308, 3319, 3327):
   ```ts
                   isLoaded = 'ready'
                   runAnimation()
   ```
2. The `layout` pre-update effect (~line 2325-2340). Its first run with `shouldProject` true is the mount pass:
   ```ts
    $effect.pre(() => {
        const shouldProject = element && layoutProp && isLoaded === 'ready' && hasLayoutFeatures
        // Track common layout-affecting props so Svelte-owned updates can
        // snapshot before the DOM patch, matching upstream MeasureLayout.
        trackLayoutProjectionDependencies()

        if (!shouldProject) {
            explicitLayoutSnapshot = null
            return
        }

        // 'snapshot' phase: the pre-patch side of the update boundary.
        explicitLayoutSnapshot = measureLayoutRect('snapshot')
        motionDomProjection?.willUpdate()
        motionDomProjectionUpdatePending = true
    })
   ```
   Its paired `$effect` (~line 2438-2460) consumes `motionDomProjectionUpdatePending` and either calls
   `motionDomProjection?.didUpdate()` (no snapshot) or schedules `runReactiveCommit` on `frame.postRender`.
3. The grouped `layoutId`-only pre-update effect (~line 2487-2493) has the same shape and the same mount pass:
   ```ts
    $effect.pre(() => {
        const shouldFanOut = shouldFanOutLayoutIdUpdate()
        trackLayoutProjectionDependencies()
        if (!shouldFanOut) return
        motionDomProjection?.willUpdate()
        layoutIdGroupUpdatePending = true
    })
   ```

The comments in this file cite upstream line by line (see the paragraph above `runReactiveCommit` and
`trackLayoutProjectionDependencies`). Match that style: one short comment citing `MeasureLayout.tsx`.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| New red spec | `pnpm playwright test e2e/independent-transforms/layout-idle.spec.ts` | see steps |
| Parity spec | `pnpm playwright test e2e/independent-transforms/basic.spec.ts` | see steps |
| Layout area | `pnpm playwright test e2e/layout e2e/layout-id e2e/projection e2e/animate-presence e2e/reorder e2e/motion` | all pass |
| Full e2e | `pnpm test:e2e` | see Step 4 |
| Unit | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint | `trunk fmt` then `trunk check` | clean |

**Port 4198 rule**: before any Playwright run, check `lsof -ti :4198 -sTCP:LISTEN`. If anything is listening,
STOP and ask. Never kill it. Do NOT set `PW_REUSE_SERVER`. Port 4199 may be serving a build for the
maintainer; leave it alone.

## Scope

**In scope**:

- `src/lib/html/_MotionContainer.svelte` (only the two `$effect.pre` blocks quoted above, plus one non-reactive variable)
- `src/routes/tests/independent-transforms/layout-idle/+page.svelte` (create) + one link in `src/routes/+page.svelte`
  (the "Independent transforms (Motion 14.2)" section, ~line 407)
- `e2e/independent-transforms/layout-idle.spec.ts` (create)
- `.changeset/layout-mount-no-update.md` (create, `patch`)

**Out of scope**:

- `src/lib/utils/motionDomProjection.ts`: plan 002 handles measuring around an accelerated transform.
- `e2e/independent-transforms/basic.spec.ts` and its page (upstream ports, must stay unchanged).
- The mount effect's `isLoaded`/`runAnimation` ordering. Don't reorder it: AnimatePresence wait mode and
  optimized-appear depend on it (see CLAUDE.md "AnimatePresence wait mode").
- Any existing e2e spec. If one regresses, STOP (see below).

## Steps

### Step 1: Red test

Page `src/routes/tests/independent-transforms/layout-idle/+page.svelte`, modelled on
`src/routes/tests/independent-transforms/basic/+page.svelte`: same `countTransformAnimations` helper on `window`,
same fixed top-left `.fixture`, same `TesterPanel` (hidden under `@isPlaywright=true`). Boxes, 100×50, all with
`animate={{ x: 100 }}` and `transition={{ duration: 1, ease: 'linear' }}`. Nothing on the page changes after mount:

- `#layout`: `layout`
- `#layout-dependency`: `layout layoutDependency={0}`
- `#layout-id`: `layoutId="idle-shared"` inside a `LayoutGroup` (`import { LayoutGroup, motion } from '$lib'`, as other test pages do)
- `#control`: no layout props

Spec `e2e/independent-transforms/layout-idle.spec.ts` (viewport 500×500, `?@isPlaywright=true`). For each of the
four ids, sample `countTransformAnimations` at 150, 450 and 800 ms after `#control` is attached: every sample is `1`.
Name the tests `<id> stays accelerated when nothing changes layout`.

**Verify**: `pnpm playwright test e2e/independent-transforms/layout-idle.spec.ts` → `#control` PASSES; `#layout` FAILS
with `Expected: 1, Received: 0` at the first sample. Report what `#layout-dependency` and `#layout-id` do, whichever way
they go. If `#layout` passes on unfixed code, STOP: the diagnosis above is wrong.

### Step 2: Skip the mount pass in both pre-update effects

Add one non-reactive variable next to `explicitLayoutSnapshot` (a plain `let`, **not** `$state`, so writing it
can't retrigger effects):

```ts
    // The element whose mount pass the pre-update effects have already seen.
    // Upstream's MeasureLayout calls `willUpdate()` only in getSnapshotBeforeUpdate
    // (updates), never on mount (componentDidMount → root.didUpdate() only).
    // A mount-time willUpdate demotes Motion 14.2's compositor transforms and
    // snapshots the entry animation's first frame as if it were a layout change.
    let layoutUpdateMountedElement: HTMLElement | null = null
```

In the `layout` `$effect.pre`, after the `!shouldProject` early return and before measuring:

```ts
        if (layoutUpdateMountedElement !== element) {
            layoutUpdateMountedElement = element
            explicitLayoutSnapshot = null
            return
        }
```

Apply the same guard in the grouped `layoutId` `$effect.pre`, with its own variable
(`layoutIdUpdateMountedElement`), so the two effects never consume each other's mount pass. Don't touch the paired
post-effects: with no pending flag set, they already return early.

Deps are unchanged: the guard comes **after** `trackLayoutProjectionDependencies()` / `shouldFanOutLayoutIdUpdate()`,
so the effects still subscribe on the mount pass and the first real update still snapshots.

**Verify**:

- `pnpm playwright test e2e/independent-transforms/layout-idle.spec.ts` → all pass.
- `pnpm playwright test e2e/independent-transforms/basic.spec.ts` → the `layout` test now gets past both `count`
  assertions (lines 92 and 94). It may still fail on the `x` range (lines 96-97) or the final bounds. That would be
  plan 002's measurement bug, now reachable. Quote the outcome exactly; it isn't a STOP.

### Step 3: Gate the layout area

**Verify**:

- `pnpm playwright test e2e/layout e2e/layout-id e2e/projection e2e/animate-presence e2e/reorder e2e/motion` → all pass.
- `pnpm test:only` → all pass. `pnpm check` → 0 errors. `trunk fmt` then `trunk check` → clean.

### Step 4: Full suite, link, changeset

1. Link "Layout elements stay accelerated at rest" in `src/routes/+page.svelte` (Independent transforms section).
2. `.changeset/layout-mount-no-update.md` (`patch`): mounting a `layout` element no longer runs a layout update, which
   moved its entry animation off the compositor and could start a tiny layout animation.
3. `pnpm test:e2e`. Compare against plan 001's baseline: 587 passed; 2 failed (both in `independent-transforms/basic`);
   1 flaky (`motion/ai-glow-border` frame budget).

**Verify**: no failures beyond plan 001's baseline (minus any this plan fixed). Report a table of every failure.

## Test plan

- Red anchor: `e2e/independent-transforms/layout-idle.spec.ts` (`#layout` fails before Step 2, passes after it).
- Upstream anchor: `e2e/independent-transforms/basic.spec.ts` `layout` test passes its `count` assertions.
- Regression net: the layout / layout-id / projection / presence / reorder e2e directories, then the full suite.

## Done criteria

- [ ] Red observed (quote the failure), green after Step 2
- [ ] Parity `layout` test's `count` assertions pass (exact outcome for the rest quoted)
- [ ] Layout-area e2e all pass; full e2e has no failures beyond plan 001's baseline
- [ ] `pnpm test:only` passes; `pnpm check` 0 errors; `trunk check` clean
- [ ] `git status` shows only in-scope files; changeset and index link present

## STOP conditions

- `#layout` passes in Step 1 on unfixed code.
- Any existing spec in the layout-area command fails after Step 2, especially `onProjectionUpdate` event counts
  (`e2e/projection/sibling-swap.spec.ts`), layoutId hand-offs, AnimatePresence re-entry, or Reorder. Report the
  spec, the assertion and the output. Don't adjust the test, and don't widen the guard (e.g. "skip only when
  animating"). The maintainer reviews each failure.
- The fix seems to need changes outside the two `$effect.pre` blocks.
- Port 4198 occupied.

## Maintenance notes

- If svelte-motion ever needs a mount-time measurement (e.g. to seed `lastRect`), do it in the mount effect via
  `measureLayoutRect()` **without** `willUpdate()`. `willUpdate` is what demotes compositor transforms and marks the
  tree dirty.
- The guard is keyed by element identity, so a re-mounted element (new node) gets its own skipped mount pass,
  matching a React remount.
