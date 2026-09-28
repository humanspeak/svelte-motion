# Plan 007: Give LayoutGroup upstream's projection node group

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. This plan has an explicit **checkpoint** after Step 4 — report to
> the maintainer there before continuing. If anything in the "STOP conditions"
> section occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `.agents/.plans/motion-13.4.5/README.md`.
>
> Revision 2026-09-28 (guard pre-flight): Plan 005 landed (8747d80e, 5f9abf50). Baseline moved to
> `5f9abf50`. The red specs live in `e2e/layout/layout-group-parity/` and the red/green matrix is in the
> batch README ("LayoutGroup parity matrix") — that matrix is your acceptance list. 005 also added
> `src/lib/components/__tests__/NestedLayoutGroupProbeHarness.svelte` and extra cases in
> `layoutGroup.context.spec.ts` (both now in scope), plus tester panels in `src/routes/tests/layout/_parity/`
> and the five `src/routes/tests/layout/*` parity pages: you may update ONLY their "Status on this build"
> text when cases flip green; do not change fixtures. Report matrix changes in your final report
> instead of editing the README (the guard maintains it).
>
> **Drift check (run first)**: `git diff --stat 5f9abf50..HEAD -- src/lib/components/LayoutGroup.svelte src/lib/components/layoutGroup.context.ts src/lib/components/layoutGroup.context.spec.ts src/lib/components/__tests__/LayoutGroupProbe.svelte src/lib/utils/motionDomProjection.ts src/lib/html/_MotionContainer.svelte`
> Plan 005 is expected to have added test pages/specs only. Any library
> change in these files since `67815169` → compare with the excerpts, STOP on mismatch.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (touches the layout commit path every `layout` element uses)
- **Depends on**: 005 (its red specs + parity matrix are this plan's acceptance tests)
- **Category**: bug / upstream parity
- **Planned at**: commit `67815169`, 2026-09-28; re-baselined to `5f9abf50` (guard pre-flight)
- **Upstream reference** (`~/Github/motion`, tag `v13.4.5`):
  `packages/framer-motion/src/components/LayoutGroup/index.tsx`,
  `packages/framer-motion/src/context/LayoutGroupContext.ts`,
  `packages/motion-dom/src/projection/node/group.ts`,
  `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx` (lines ~40–160),
  `packages/framer-motion/src/motion/index.tsx` (`useLayoutId`, ~line 175),
  `packages/framer-motion/src/components/AnimatePresence/index.tsx` (`forceRender`, ~line 186–221),
  `packages/framer-motion/src/utils/use-force-update.ts`

## Why this matters

Upstream `LayoutGroup` does two things; ours does one:

1. **Scopes `layoutId`** — we do this (#311).
2. **Owns a projection node group** — every `layout` node in the group is
   snapshotted when any member updates or unmounts, so siblings animate
   together; `inherit="id"` and `inherit={false}` create a *separate* group, so
   those nodes are *not* snapshotted and instead follow their parent via
   motion-dom's relative projection. Motion 13.4.5's #3839 fix
   (`syncRelativeLayout`) exists precisely for that separate-group case.

We don't implement (2) — `inherit="id"` is documented as identical to `true`
(`src/lib/components/LayoutGroup.svelte:26-33`). The maintainer requires full
parity in this batch. Plan 005 ported upstream's LayoutGroup tests and recorded
which fail; this plan makes them pass (with Plan 006's motion-dom 13.4.5 bump
for the #3839 cases).

## Upstream behavior (the contract to reproduce)

```tsx
// LayoutGroup/index.tsx
const shouldInheritGroup = (inherit) => inherit === true
const shouldInheritId = (inherit) => shouldInheritGroup(inherit === true) || inherit === "id"
// once per instance:
if (shouldInheritId(inherit) && upstreamId) id = id ? upstreamId + "-" + id : upstreamId
context = { id, group: shouldInheritGroup(inherit) ? parent.group || nodeGroup() : nodeGroup() }
value = { ...context, forceRender }          // forceRender = frame.postRender(re-render this subtree)

// motion-dom projection/node/group.ts
const notify = (node) => !node.isLayoutDirty && node.willUpdate(false)
nodeGroup(): add(node)   → subscribe node 'willUpdate' → dirtyAll
             remove(node) → unsubscribe; dirtyAll()
             dirty()      → dirtyAll

// MeasureLayout.tsx
componentDidMount:    if (layoutGroup.group) layoutGroup.group.add(projection)
componentWillUnmount: projection.scheduleCheckAfterUnmount(); layoutGroup.group?.remove(projection)

// motion/index.tsx
layoutId scoped as `${layoutGroupId}-${layoutId}`   (we use `::` today)

// AnimatePresence: when every exit completes → forceRender?.() from the nearest LayoutGroup
```

Consequences a user can see:
- Siblings in one group animate together when one member changes or unmounts.
- A node inside `<LayoutGroup inherit="id">` (or `inherit={false}`) is not
  snapshotted by the outer group's updates; it rides its parent's projection
  (no independent jump, no independent FLIP) unless it itself changes.

## Current state (our architecture — read carefully)

Our layout pipeline is **observer-driven**, not render-driven:

- `src/lib/html/_MotionContainer.svelte`
  - `:299-302` reads the group context (string id) and builds `scopedLayoutId`.
  - `:1120-1131` constructs `new MotionDomProjectionAdapter({ parent, getBaseTransform, visualElement })`.
  - `:2085-2098` `updateOptions(...)` then `mount(element)`; cleanup `unmount()`.
  - `:2283-2297` `$effect.pre` — the **reactive path**: when this component's
    own layout-affecting props change, it measures a pre-patch rect and calls
    `motionDomProjection?.willUpdate()` (→ `projection.willUpdate()`), then a
    post-effect defers `runReactiveCommit` to `frame.postRender`, which calls
    `commitObservedLayoutChange(prev)` or `didUpdate()`.
  - `:~2470-2660` the **observer path**: per-element observers call
    `commitObservedLayout()`, which diffs the cached `lastRect` against a fresh
    `measureLayoutRect()` and on change calls
    `motionDomProjection?.commitObservedLayoutChange(previous)`.
    `refreshGatedLayoutCache()` (`refreshLayout({ silent: true })`) is the
    existing "update the cache, don't animate" primitive.
  - Arbitration between the two paths: `lastRect`, `observerCommitSerial`,
    `reactiveCommitSerialAtSchedule` (see comments at `:2300-2380`).
- `src/lib/utils/motionDomProjection.ts` — `MotionDomProjectionAdapter`
  - static `adapters: WeakMap<projection, adapter>`; `lastLayout` cache.
  - `commitObservedLayoutChange(previousRect?)` (`:634-657`):
    `root.startUpdate()` → `seedCachedSnapshotsForSubtree(this.projection, snapshot)`
    → `root.didUpdate()` → `refreshCachedLayout()`.
  - `seedCachedSnapshotsForSubtree` (`:~725-745`) seeds the committing node
    with the given snapshot and **recursively seeds every descendant** from its
    adapter's `lastLayout` — i.e. today a commit behaves like "this node and
    its entire subtree re-rendered", regardless of groups.
  - `unmount()` (`:293-308`) calls `projection.scheduleCheckAfterUnmount()`.
- `src/lib/components/LayoutGroup.svelte` / `layoutGroup.context.ts` — context
  is `string | undefined`; `scopeLayoutId` returns `` `${groupId}::${layoutId}` ``.
- Consumers of the context: `_MotionContainer.svelte:299`,
  `src/lib/components/__tests__/LayoutGroupProbe.svelte`,
  `src/lib/components/layoutGroup.context.spec.ts` (asserts `tabs-a::underline`,
  `outer::thumb`, `outer-x::thumb`), `e2e/layout/group.spec.ts:14` (comment only).
- `AnimatePresence`: `src/lib/components/AnimatePresence.svelte` passes
  `onExitComplete` into `src/lib/utils/presence.ts` (`:323-370`), which fires it
  once all exits settle.

### Why motion-dom's `nodeGroup` alone isn't enough

`nodeGroup` fans out by calling `willUpdate(false)` on members, which measures
the **current** DOM. That's correct on our reactive path (runs pre-patch, like
React's `getSnapshotBeforeUpdate`), but wrong on the observer path (runs
post-change — the snapshot would equal the new layout, so nothing animates).
The observer path must fan out with each member's **cached** `lastLayout`,
exactly as `seedCachedSnapshotsForSubtree` already does for descendants.

## Design (implement exactly this)

**D1 — Context object.** `LayoutGroupContext` becomes
`{ id?: string; group?: NodeGroup; forceRender?: () => void } | undefined`
(`NodeGroup` and `nodeGroup` are exported by `motion-dom`). `LayoutGroup.svelte`
computes it once at init with upstream's rules (above). No enclosing group →
context `undefined` → nodes have no group (current behavior preserved).

**D2 — layoutId separator.** `scopeLayoutId` returns `` `${groupId}-${layoutId}` `` (upstream).

**D3 — Membership.** `MotionDomProjectionOptions` gains `group?: NodeGroup`.
The adapter stores it; `mount()` → `group?.add(this.projection)`;
`unmount()` → after `scheduleCheckAfterUnmount()`, `group?.remove(this.projection)`.
Also keep a static `groupMembers: WeakMap<NodeGroup, Set<MotionDomProjectionAdapter>>`
updated alongside, for D5. `_MotionContainer` passes `getLayoutGroupContext()?.group`.

**D4 — Reactive path fan-out** comes free: `projection.willUpdate()` emits
`willUpdate` and the `nodeGroup` snapshots non-dirty siblings pre-patch;
`root.didUpdate()` animates them. Siblings' own observers will then see the
same change — they must NOT restart it. After a `didUpdate` in which a node
was layout-dirty, its container must adopt the new rect as `lastRect` without
committing. Implement via an adapter hook (e.g. subscribe to the projection's
`didUpdate` event in `mount()`; expose `onProjectionCommit(listener)`) that
`_MotionContainer` uses to set `lastRect = measureLayoutRect()` and bump
`observerCommitSerial` — reuse the existing arbitration, don't invent a new one.

**D5 — Observer path fan-out and group boundaries.** In
`commitObservedLayoutChange`:
- (a) seed the committing node (as today);
- (b) for every *other* member of the committing node's group (from
  `groupMembers`) that isn't already layout-dirty, seed its cached `lastLayout`
  as its snapshot (the cached-snapshot equivalent of `nodeGroup.dirty()`);
- (c) when recursing into descendants, **only seed a descendant whose group
  equals the committing node's group, or which has no group while the
  committing node also has none** (preserves today's no-LayoutGroup behavior).
  A descendant in a different group is left unseeded → motion-dom keeps it on
  its relative target (and 13.4.5's `syncRelativeLayout` handles it if it's
  mid-animation).

**D6 — Separate-group observer suppression.** In the container's
`commitObservedLayout`, before committing: if this node has a group, is not
layout-dirty, and the change is fully explained by its nearest projecting
ancestor's update (its rect's offset relative to that ancestor's current
layout equals the offset relative to that ancestor's previous `lastLayout`),
then treat it like `refreshGatedLayoutCache()` — update the cache, no commit.
Put the offset comparison in the adapter (`isFollowingAncestorUpdate(nextRect)`),
unit-tested.

**D7 — forceRender.** `LayoutGroup` provides
`forceRender = () => frame.postRender(() => <commit cached-snapshot update for every member of this group>)`,
and `AnimatePresence` calls the nearest group's `forceRender` when all exits
complete (next to where it fires `onExitComplete`). Because our observers
already react to clone removal, this should be a no-op in most cases; the
arbitration from D4 must keep it from double-animating.

## Commands you will need

| Purpose       | Command | Expected |
| ------------- | ------- | -------- |
| Focused unit  | `pnpm exec vitest run src/lib/components src/lib/utils/motionDomProjection.spec.ts` | all pass |
| Full unit     | `pnpm test` | all pass |
| Typecheck     | `pnpm check` | 0 errors |
| Build         | `pnpm build` | exit 0 |
| Parity e2e    | `pnpm exec playwright test e2e/layout/layout-group-parity --project=chromium` | see steps |
| Layout e2e    | `pnpm exec playwright test e2e/layout e2e/layout-id e2e/animate-presence e2e/reorder e2e/projection --project=chromium` | all pass |
| Full e2e      | `pnpm test:e2e` | all pass (pre-existing skips excepted) |
| Lint/format   | `trunk check` / `trunk fmt` | no new issues |

E2E server: port **4198**; never kill an existing server there. Use
build+preview for gates (several specs differ under `vite dev`).

## Scope

**In scope**:

- `src/lib/components/LayoutGroup.svelte`
- `src/lib/components/layoutGroup.context.ts`, `layoutGroup.context.spec.ts`
- `src/lib/components/__tests__/LayoutGroupProbe.svelte`, `NestedLayoutGroupProbeHarness.svelte`
- `src/routes/tests/layout/_parity/*.svelte` and the five parity pages — "Status on this build" text only
- `src/lib/utils/motionDomProjection.ts`, `motionDomProjection.spec.ts`
- `src/lib/html/_MotionContainer.svelte` (only: context read, adapter construction, D4 hook, D6 check)
- `src/lib/components/AnimatePresence.svelte` and/or `src/lib/utils/presence.ts` (only the D7 call)
- `e2e/layout/layout-group-parity/*.spec.ts` (only: `test.fail` → `test` as cases turn green)
- `e2e/layout/group.spec.ts` (comment only: `::` → `-`)
- `docs/src/routes/docs/layout-group/**` or wherever LayoutGroup is documented (find with `grep -rln "inherit" docs/src/routes/docs | xargs grep -l LayoutGroup`) — update the `inherit` description
- `.changeset/layout-group-node-groups.md` (create; `minor` — new behavior)

**Out of scope**:

- `SwitchLayoutGroupContext` / `DeprecatedLayoutGroupContext` equivalents.
- Reworking the observer architecture itself, `runLayoutSizeAnimation`, or
  presence placeholders.
- `package.json` / motion version (Plan 006).

## Git workflow

- Branch `chore/motion-13.4.5`. One commit per step group, conventional:
  `refactor(layout-group): publish id, node group, and forceRender context`,
  `feat(layout-group): register projection nodes with the group`, etc.
- Do NOT push or open a PR.

## Steps

### Step 1: Confirm the red baseline

Read the "LayoutGroup parity matrix" in the batch README (from Plan 005).
Run the parity e2e → exit 0 with the recorded `test.fail` cases.
Add unit tests (red):
- `layoutGroup.context.spec.ts`: `scopeLayoutId('tabs-a','underline')` → `'tabs-a-underline'`
  (update the three existing `::` expectations to `-`); probe exposes `group`:
  nested `inherit` (default) shares the parent's group object; `inherit="id"`
  and `inherit={false}` get a new one; `inherit="id"` still chains the id,
  `inherit={false}` doesn't.
- `motionDomProjection.spec.ts`: two adapters with the same `group`, mount
  both, `a.willUpdate()` → `b.projection.snapshot` is defined (D4 via nodeGroup);
  `unmount(a)` → b snapshotted (remove → dirtyAll).

**Verify**: `pnpm exec vitest run src/lib/components/layoutGroup.context.spec.ts src/lib/utils/motionDomProjection.spec.ts` → the new tests FAIL (context is a string; no group).

### Step 2: D1 + D2 + D3

Implement the context object, separator, and membership. Update
`_MotionContainer.svelte:299` to `getLayoutGroupContext()?.id` and pass
`group` into the adapter. Update `LayoutGroupProbe` and the doc comment in
`LayoutGroup.svelte` (remove "same as `true` in this implementation"; describe
upstream semantics).

**Verify**: Step 1 unit tests PASS; `pnpm check` 0 errors;
`pnpm build && pnpm exec playwright test e2e/layout/group.spec.ts --project=chromium` → pass.

### Step 3: D4 (reactive fan-out arbitration)

Add the adapter commit hook and wire `_MotionContainer` to adopt `lastRect`
after a projection update that consumed its change. Unit test: a group
sibling snapshotted via fan-out, after `root.didUpdate()`, notifies its hook exactly once.

**Verify**: unit tests pass; `pnpm build`; layout e2e command → all pass (no regressions).

### Step 4: D5 + D6 (observer fan-out and group boundaries) — then CHECKPOINT

Implement D5 in `seedCachedSnapshotsForSubtree` / `commitObservedLayoutChange`
and D6 (`isFollowingAncestorUpdate`) with unit tests:
- same-group descendant is seeded; different-group descendant is not;
  no-group descendant of no-group committer is seeded (unchanged behavior);
- `isFollowingAncestorUpdate` true when relative offset is unchanged, false when the node's own offset changed.

Run: `pnpm build`, parity e2e, layout e2e command.

**CHECKPOINT — report to the maintainer before Step 5** with: the parity
matrix now (which reds turned green), any regression in the layout e2e
command (with spec names), and whether the measurement-count specs
(`layout-group-interrupt-measurements`, `relative-child-measurements`) are
green. Those count `getBoundingClientRect` reads; our observer path may still
measure a grouped node to *detect* a change even when it then suppresses the
commit. If they stay red only because of observer detection reads, say so —
the maintainer decides whether to pursue read-free detection. Wait for the
go-ahead.

### Step 5: D7 (forceRender)

Add `forceRender` to the context and call it from AnimatePresence on
all-exits-complete. Add an e2e case to
`e2e/layout/layout-group-parity/layout-group-unmount.spec.ts`: two `layout`
siblings in a `LayoutGroup`, one inside `AnimatePresence` exiting; after its
exit completes, the other animates into the freed space (intermediate frames)
and there's exactly one animation (no restart: track `onLayoutAnimationStart`
count = 1).

**Verify**: parity e2e + `e2e/animate-presence` pass.

### Step 6: Flip greens, docs, changeset, full gate

1. Change each now-passing `test.fail(` in `e2e/layout/layout-group-parity` to
   `test(`. Cases red only because they need motion-dom 13.4.5 (#3839
   interrupt cases) stay `test.fail` with comment updated to
   `// Needs motion-dom 13.4.5 (Plan 006).` Update the README matrix.
2. Docs: update the LayoutGroup page's `inherit` description to upstream semantics.
3. `.changeset/layout-group-node-groups.md` (`minor`):
   "`LayoutGroup` now owns a projection node group like Motion: members animate together when any member changes or unmounts, `inherit="id"` and `inherit={false}` start a separate group whose nodes follow their parent instead of re-animating, and scoped `layoutId`s use Motion's `group-id` separator."
4. Gate: `trunk fmt`; `trunk check`; `pnpm check`; `pnpm test`; `pnpm build`;
   `pnpm --dir docs build && pnpm --dir docs check`; `pnpm test:e2e`.

**Verify**: all pass (pre-existing skips excepted).

## Test plan

- Red anchors: Plan 005's parity specs (recorded matrix) + Step 1 unit tests.
- Regression net: every layout-adjacent e2e directory (command above), then the full e2e suite.
- New unit tests for D3–D6 in `motionDomProjection.spec.ts`; pattern: existing tests in that file.

## Done criteria

- [ ] `grep -n "same as \`true\` in this implementation" src/lib/components/LayoutGroup.svelte` → no match
- [ ] `grep -rn "::" src/lib/components/layoutGroup.context.ts` → no match
- [ ] Parity e2e: every case green except those annotated "Needs motion-dom 13.4.5 (Plan 006)" (and any maintainer-approved exception from the checkpoint, recorded in README)
- [ ] `pnpm test`, `pnpm check`, `pnpm build`, docs build/check, `pnpm test:e2e` pass
- [ ] Changeset exists; README row + matrix updated

## STOP conditions

- Any existing e2e outside `layout-group-parity` regresses and the cause isn't
  an obvious bug in the new code — report spec names and the step.
- D4 arbitration can't be done with the existing `lastRect`/serial mechanism
  without restructuring the observer path.
- `nodeGroup` / `NodeGroup` aren't exported by the installed `motion-dom` —
  check `grep -n "nodeGroup" node_modules/motion-dom/dist/index.d.ts` first.
- A no-LayoutGroup test page changes behavior (D5c must keep it identical).
- The Step 4 checkpoint (always stop there).

## Maintenance notes

- The observer path and the reactive path now both participate in group
  fan-out; any future change to `commitObservedLayoutChange` must keep D5's
  group-boundary rule.
- Upstream's measurement-count specs are the canary for "grouped nodes
  measured when they shouldn't be".
