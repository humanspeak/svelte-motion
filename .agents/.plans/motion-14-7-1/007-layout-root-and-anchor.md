# Plan 007: Add the `layoutRoot` and `layoutAnchor` props, so shared `layoutId` animations can run relative to a layout root (#1935)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4216** (`PW_PORT=4216`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Requires plans 001 and 006, in this same lane.** motion-dom 14.7.1 carries the #1935 math, and plan 006 has
> already rewritten `updateOptions` and the container's `layoutId` handling. Before starting, confirm all three
> print a line, otherwise STOP:
> `grep -n '"motion-dom": "14.7.1"' package.json`,
> `grep -n 'switchLayoutId' src/lib/utils/motionDomProjection.ts`,
> `grep -n 'isShared && resizeSnapshot' node_modules/motion-dom/dist/es/projection/node/create-projection-node.mjs`.
> (If the last path doesn't exist, run `grep -rln "isShared && resizeSnapshot" node_modules/motion-dom/dist`. Any
> match is fine.)
>
> **Drift check (run first)**: `git diff --stat f8ac71aa..HEAD -- src/lib/types.ts src/lib/utils/motionDomProjection.ts src/lib/utils/motionDomProjection.spec.ts src/lib/html/_MotionContainer.svelte src/routes/tests/layout-root e2e/layout docs/src/routes/docs/layout-root docs/src/routes/docs/layout-animations docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts src/routes/+page.svelte`
> Expected: plan 006's commits (`motionDomProjection.ts`, its spec, `_MotionContainer.svelte`,
> `src/routes/+page.svelte`, `layout-animations/+page.svx`), plan 008's two `_MotionContainer.svelte` regions
> (around lines 696 and 718-723), and other plans' links in `src/routes/+page.svelte`. For anything else,
> compare the "Current state" excerpts with the live code; on a mismatch, STOP. Line numbers below are at
> `f8ac71aa`. Plan 006 shifts `_MotionContainer.svelte` and `motionDomProjection.ts` lines, so find the excerpts by
> content.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (changes when the observer path snapshots `layoutRoot` ancestors; new public props)
- **Depends on**: 006 (same lane: it rewrites `updateOptions`' `setOptions` call, which this plan extends, and
  edits the same container regions), 001 (motion-dom 14.7.1 carries the #1935 math)
- **Wave**: 2 (lane `layoutid`, after 006)
- **Category**: direction (upstream parity: new props plus #1935)
- **Planned at**: commit `f8ac71aa` (main after the 14.6.0 release, svelte-motion 2.5.0), 2026-10-27

## Why this matters

Motion has two projection props svelte-motion lacks. `layoutRoot` makes an element a layout root: its descendants'
layout animations resolve relative to it, and since Motion 14.7.1 (#1935) that includes shared `layoutId`
animations when the old element was inside the root too. That fixes the docs' tabs example. When a sidebar appears
in the same render as the tab change, the tab list jumps, and the underline should slide one tab within the list
instead of flying in from where the old tab used to be on the page. `layoutAnchor` picks the point on the parent a
child's relative projection is anchored to (`{ x: 0.5, y: 0.5 }` keeps a centered child centered while its parent
resizes), or turns relative projection off with `false`. Today both props fall through `...rest` onto the DOM as
junk attributes (`layoutroot="true"`, `layoutanchor="[object Object]"`). motion-dom never sees them, although the
adapter already reads `node.options.layoutRoot`. This plan adds both props with JSDoc. It passes `layoutRoot` to the projection node
at mount, as upstream does at creation, and passes `layoutAnchor`, plus `layoutDependency` (which upstream also
syncs), on every update, as upstream's `MeasureLayout` `layoutOptions()` does. It also ports the #1935 and `layoutAnchor` tests and fixes the
observer-path snapshot of a `layoutRoot` ancestor if those tests need it.

## Current state

### svelte-motion

- `src/lib/types.ts:706-786`, the layout props of `MotionProps`: `layout`, `onProjectionUpdate`,
  `onLayoutMeasure`, `layoutId` (721, one-line JSDoc at 720), `layoutScroll` (737, JSDoc with `@example` at
  722-736), `layoutDependency` (786, JSDoc 738-785). There is no `layoutRoot` or `layoutAnchor`.
- `src/lib/html/_MotionContainer.svelte:150-220`: `Props = MotionProps & {...}`, destructured from `$props()`.
  Layout props are pulled out by name (`layout: layoutProp, layoutId: layoutIdProp, layoutScroll:
  layoutScrollProp, layoutDependency: layoutDependencyProp`, 211-214). Everything else lands in `...rest` (219),
  which becomes `spreadAttrs` (1565-1578) and then `derivedAttrs` (1580+): DOM attributes. So a `layoutRoot` or
  `layoutAnchor` prop today renders as an attribute and does nothing else.
- `_MotionContainer.svelte:1878-1888` (reactive) and `1907-1915` (inside the mount effect, untracked) both call
  `motionDomProjection.updateOptions({ layout, layoutId, layoutScroll, transition, style, alwaysMeasureLayout })`.
- `src/lib/utils/motionDomProjection.ts`:
  - `MotionDomProjectionUpdateOptions` (lines 90-104): `layout`, `layoutId`, `layoutScroll`, `transition`,
    `style`, `alwaysMeasureLayout`.
  - `updateOptions` → `this.projection.setOptions({...})` (403-411 at `f8ac71aa`; plan 006 changed how `layoutId`
    is passed). motion-dom's `setOptions` merges (`create-projection-node.ts:1237-1244 @ v14.7.1`), so a key
    passed as `undefined` overwrites.
  - `prepareSnapshotPath` (1325-1339) is the only current reader of `layoutRoot`. It runs inside every
    seeded (post-DOM) commit: `seedCachedSnapshotsForGroup`, `seedOwnOnScreenSnapshot`,
    `seedCachedSnapshotsForSubtree`, which `commitObservedLayoutChange` and `commitGroup` call.
    ```ts
    // motionDomProjection.ts:1325-1339
        private prepareSnapshotPath<Instance>(projection: ProjectionTreeNode<Instance>): void {
            projection.root!.hasTreeAnimated = true
            for (const node of projection.path) {
                node.shouldResetTransform = true
                node.updateScroll('snapshot')
                if (node.options.layoutRoot) {
                    node.willUpdate(false)
                }
            }
        }
    ```
    `node.willUpdate(false)` measures now. On these paths the DOM has already changed, so a `layoutRoot`
    ancestor's "before" snapshot would be its new layout. The observer path avoids exactly that for group members
    by seeding cached layouts (`seedCachedSnapshotsForGroup` comment, 1199-1205: "the change has already hit the
    DOM, so `willUpdate(false)` would snapshot the new layout and nothing would animate").
  - The shared `layoutId` handoff from the registry seeds a page-space rect:
    `commitObservedLayoutChange(previousRect)` → `measurementsFromRect(previousRect, this.lastLayout ?? this.projection.layout)`
    (996-998), where
    ```ts
    // motionDomProjection.ts:154-160
    const measurementsFromRect = (rect: RectLike, base: Measurements | undefined): Measurements => ({
        animationId: base?.animationId ?? 0,
        measuredBox: boxFromRect(rect),
        layoutBox: boxFromRect(rect),
        latestValues: { ...(base?.latestValues ?? {}) },
        source: base?.source ?? 0
    })
    ```
    `source` is the arriving node's own id (motion-dom `measure()` returns `source: this.id`,
    `create-projection-node.ts:1101 @ v14.7.1`). So `notifyLayoutUpdate`'s `isShared = snapshot.source !==
    node.layout.source` (2242) is **false** for a registry handoff. The `isShared` branches #1935 added (2279,
    2288, 2325, 2350) don't run, and the snapshot rect, already the old element's on-screen box
    (`currentVisualPageRect`), is treated as this node's own previous layout. Whether the node has a
    `resumeFrom` depends on whether the old node was still its stack's lead when the new one mounted. That
    decides the `layoutRoot` guard in `notifyLayoutUpdate` (2302-2305):
    `!node.resumeFrom || (relativeParent?.options.layoutRoot && node.resumeFrom.path.includes(relativeParent))`.
    With no `resumeFrom`, the snapshot is always made relative to the closest projecting parent. That is right
    when the old element was inside the root, and wrong (it should stay in page space) when it was outside. Step 3
    measures which case each fixture is in.
- svelte-motion has no shared-layout crossfade with an exiting element. Direct `AnimatePresence` children exit as
  detached clones with no projection node (`_MotionContainer.svelte:337-341`), and nothing calls
  `projection.relegate()`. The six `exit=true` #1935 cases need that, so they can't pass here (Step 5).

### Upstream (verified at `~/Github/motion`, tag `v14.7.1`)

- Props, `packages/motion-dom/src/node/types.ts@v14.7.1`:
  ```ts
  // 957-975
      /**
       * Whether an element should be considered a "layout root", where
       * all children will be forced to resolve relatively to it. This
       * includes shared `layoutId` elements, which animate within the root
       * when the previous element was also inside it.
       * Currently used for `position: sticky` elements in Framer.
       */
      layoutRoot?: boolean

      /**
       * The anchor point for relative layout projection. This defines which
       * point on the parent is used as the reference for the child's position.
       *
       * `{ x: 0, y: 0 }` (default) anchors to the top-left corner.
       * `{ x: 0.5, y: 0.5 }` anchors to the center, useful for centered layouts
       * (e.g., flexbox) to prevent drift during parent layout animations.
       * `false` disables relative projection entirely.
       */
      layoutAnchor?: { x: number; y: number } | false
  ```
  The installed motion-dom already types both on `ProjectionNodeOptions`
  (`node_modules/motion-dom/dist/index.d.ts`: `layoutRoot?: boolean`, `layoutAnchor?: Point | false`,
  `layoutDependency?: unknown`).
- Passed at creation (`packages/framer-motion/src/motion/utils/use-visual-element.ts@v14.7.1`, 229-248:
  `layoutScroll, layoutRoot, layoutAnchor`). Synced on every update by `MeasureLayout.tsx@v14.7.1` 43-52
  (`layoutOptions = ({ layout, layoutDependency, layoutAnchor }) => ({ layout, layoutDependency, layoutAnchor, animationType })`),
  which runs in `componentDidMount` (139-143) and every `getSnapshotBeforeUpdate` (170-173). `layoutRoot` is **not**
  in `layoutOptions`: upstream sets it only at creation (`use-visual-element.ts:246`), so changing it after mount
  has no effect. This plan adopts that.
- Semantics in motion-dom `create-projection-node.ts@v14.7.1`:
  - `layoutAnchor !== false` gates creating a relative target (1323-1325, 1403-1404). Otherwise it is the anchor
    argument of every `calcRelativePosition`/`calcRelativeBox` call (1367, 1473, 1751, 2315).
  - `layoutRoot`: always projecting (`isProjecting`, 1452-1458), so it is its children's relative parent.
    `willUpdate` snapshots `layoutRoot` ancestors (765-767). Its own layout animation is instant (`type: false`,
    631-637). Children resolve relative to it (1698, 1802).
  - #1935: `notifyLayoutUpdate` (2236-2372) makes a resumed snapshot relative to a `layoutRoot` that contains both
    elements (2302-2305), re-applies the old element's ancestor transforms below the root (2325-2333), and resizes
    a shared snapshot relative to the root too (2350). The attempt step (1403-1412) keeps a root-relative target
    for shared children of a root.
  - Commits: `012185841`, `79a4865e7`, `64c6818bb`, `95c017019` (motion-dom, ship with 001's bump) and
    `b6ba961a9` (the type doc above).
- Tests: `dev/react/src/tests/issue-1935.tsx` + `tests/react/issue-1935.spec.ts` (13 cases);
  `dev/react/src/tests/layout-anchor.tsx` + `packages/framer-motion/cypress/integration/layout-anchor.ts`
  (2 cases); unit `packages/framer-motion/src/projection/__tests__/layout-id-change.test.tsx:102-112` ("keeps
  layoutAnchor in sync").

### Conventions

- New public props get Google-style JSDoc with an `@example`, like `layoutScroll` (`types.ts:722-737`: JSDoc 722-736, prop 737).
- Test pages, specs, TesterPanel, home links: as in plan 006 (exemplars
  `src/routes/tests/drag/disable-from-ondrag/+page.svelte`, `e2e/layout-id/takeover-initial.spec.ts`).
- Docs pages: `docs/src/routes/docs/<name>/+page.svx` + `+page.ts`, exemplar `docs/src/routes/docs/layout-dependency/`
  and its nav entry `docs/src/lib/docsNav.ts:85`. Examples: `docs/src/routes/examples/<name>/+page.svelte` with demos
  in `docs/src/lib/examples/<name>/demos/*.svelte` and an entry in `docs/src/lib/examplesIndex.ts`, exemplar
  `layout-dependency`. The docs consume the built package: run `pnpm build` before the docs build.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Unit files | `pnpm exec vitest run <paths>` | all pass |
| All unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| E2E | `PW_PORT=4216 pnpm exec playwright test <paths>` | all pass |
| Build | `pnpm build` | exit 0 |
| Package | `pnpm package` | exit 0 (publint clean) |
| Docs | `pnpm --dir docs build`, `pnpm --dir docs check`, `pnpm --dir docs test`, `pnpm --dir docs test:geo-seo` | exit 0 |
| Format/lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

## Scope

**In scope**:

- `src/lib/types.ts` (two new props next to `layoutScroll`)
- `src/lib/html/_MotionContainer.svelte`: the props destructuring (211-214) and the two `updateOptions` calls
  (1878-1888, 1907-1915)
- `src/lib/utils/motionDomProjection.ts`: `MotionDomProjectionUpdateOptions`, the `setOptions` call in
  `updateOptions`, and `prepareSnapshotPath` (Step 4 only)
- `src/lib/utils/motionDomProjection.spec.ts` (new `describe` block)
- `src/lib/html/__tests__/layoutOptions.svelte.spec.ts`, `LayoutOptionsHarness.svelte` (create)
- `src/routes/tests/layout-root/+page.svelte`, `src/routes/tests/layout-root/anchor/+page.svelte` (create)
- `e2e/layout/layout-root.spec.ts`, `e2e/layout/layout-anchor.spec.ts` (create)
- `src/routes/+page.svelte` (two links next to the layout links, ~1023-1095)
- `docs/src/routes/docs/layout-root/+page.svx`, `+page.ts` (create), `docs/src/lib/docsNav.ts` (one entry),
  `docs/src/routes/docs/layout-animations/+page.svx` (API rows plus one "Related" link)
- `docs/src/routes/examples/layout-root/+page.svelte`, `docs/src/lib/examples/layout-root/demos/SidebarTabs.svelte`,
  `docs/src/lib/examples/layout-root/demos/CenteredAnchor.svelte` (create), `docs/src/lib/examplesIndex.ts` (one
  entry)
- `.changeset/layout-root-and-anchor.md` (create)

**Out of scope**:

- Shared-layout crossfades with exiting elements (`relegate`, a projection node for the exit clone). The six
  `exit=true` cases become `test.fixme` (Step 5). Don't try to make them pass.
- `layoutCrossfade`, `presence.ts`, `PresenceChild.svelte`, `layoutId.ts`.
- Redesigning the registry handoff into a true `resumeFrom` handoff (see STOP conditions).
- `package.json`, `"version"`, PR labels.

## Git workflow

- Same lane as plan 006: branch `lane/1471-layoutid` in `../svelte-motion-1471-layoutid`. Continue on top of
  006's commits.
- Conventional commits, for example `test(layout): layoutRoot and layoutAnchor parity (#1935)`,
  `feat(layout): add layoutRoot and layoutAnchor props (Motion 14.7.1, #1935)`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red tests

**1a. Unit.**

- `src/lib/utils/motionDomProjection.spec.ts`: `describe('MotionDomProjectionAdapter layout options sync (#1935)')`.
  `updateOptions({ layout: true, layoutRoot: true, layoutAnchor: { x: 0, y: 0 }, layoutDependency: 1 })` →
  `projection.options` has all three. A second call with `layoutAnchor: { x: 1, y: 1 }`, `layoutDependency: 2`
  and no `layoutRoot` key → anchor and dependency updated (the port of "keeps layoutAnchor in sync", upstream
  `layout-id-change.test.tsx:102-112`), and `layoutRoot` still `true`. A call that omits the key must not clear
  it, because `setOptions` merges and an explicit `undefined` overwrites. Also check `layoutAnchor: false`.
- `src/lib/html/__tests__/layoutOptions.svelte.spec.ts` + `LayoutOptionsHarness.svelte` (a
  `<motion.div layout {layoutRoot} {layoutAnchor}>` with props; model on `layoutIdTeardown.svelte.spec.ts`):
  - the element has no `layoutroot`/`layoutRoot`/`layoutanchor`/`layoutAnchor` attribute;
  - `visualElementStore.get(el)!.projection!.options.layoutRoot === true` and `layoutAnchor` equals the prop;
  - after `rerender` with a new `layoutAnchor`, the option follows;
  - after `rerender` with `layoutRoot={false}`, `options.layoutRoot` is still `true` (creation-time only, as
    upstream).

All of these fail today (TS errors on the unknown keys count as failing; to see the runtime failure, run vitest,
which doesn't typecheck).

**1b. E2E: `layoutRoot` (#1935).** Create `src/routes/tests/layout-root/+page.svelte`, a port of
`issue-1935.tsx@v14.7.1` with every query param (`layoutRoot`, `exit`, `outside`, `offset`, `offsetScale`,
`outsideX`, `layout`, `innerX`, `scroll`, `underlineX`), the `record()` rAF loop into `window.records`, and
`window.recording`. Port notes:

- Each tab's underline is `<AnimatePresence>{#if item === selected}<motion.div key="underline" class="underline" layoutId="underline" …/>{/if}</AnimatePresence>`
  (svelte-motion requires a `key` on direct `AnimatePresence` children). `style={{ x: underlineX }}`, and
  `exit={exit ? { opacity: 0 } : undefined}`.
- `<motion.ul layout={layoutRoot} layoutRoot={layoutRoot}>`, `.scroller` is `<motion.div layoutScroll>`, the
  `offset` wrapper is `<motion.div style={{ x: 50, y: 50, scale: offsetScale }}>`, `.inner` is
  `<motion.div style={{ x: innerX }}>`.
- Keep upstream's CSS verbatim, but scope it. The route layout (`src/routes/+layout.svelte`: `.container` →
  `main#sandbox`) must not shift the fixture: wrap everything in a `div` with
  `position: fixed; inset: 0; overflow: hidden; background: white`. Put `.window` inside it (and the `offset`
  wrapper when set). With a 1000 px viewport and no sidebar the list's left edge must be 350 px, as upstream's
  `before` values assume. Fix the page CSS, never the spec numbers.
- Tabs are `<li id="tomato|lettuce|cheese">` with the upstream `onclick` (start recording, then set
  `showSidebar` and `selected`).
- Header comment: #1935, the four motion-dom commits, upstream fixture path.

Create `e2e/layout/layout-root.spec.ts`, a port of `issue-1935.spec.ts@v14.7.1`. Keep `selectLettuce` (goto
`/tests/layout-root?@isPlaywright=true&<query>`), `expectSlideAcrossList`, `expectCrossfade` and `leadOffsets`
verbatim, and all 13 tests with upstream's names and numbers.

**1c. E2E: `layoutAnchor`.** Create `src/routes/tests/layout-root/anchor/+page.svelte`, a port of
`layout-anchor.tsx@v14.7.1`: `#parent` / `#parent-no-anchor` (`layout`, 200→400 px on click, linear 1 s), children
`#child-anchored` (`layout`, `layoutAnchor={{ x: anchorX, y: anchorY }}`, delay 0.5) and `#child-no-anchor`, and the
slider/preset panel. Both parents toggle the same `expanded` state. Create `e2e/layout/layout-anchor.spec.ts` from
`cypress/integration/layout-anchor.ts`: load, wait 50 ms, click `#parent`, wait 250 ms, then (1) the anchored
child's center is within 15 px of `#parent`'s center on both axes, and (2) the unanchored child's center is more
than 5 px from `#parent-no-anchor`'s center on x.

Link both pages from `src/routes/+page.svelte` after the `/tests/layout/relative-children` link:
"layoutRoot — shared layoutId animates relative to its layout root (#1935)" and
"layoutAnchor — a centered child stays centered while its parent resizes".

**Verify** (expected RED):

- `pnpm exec vitest run src/lib/utils/motionDomProjection.spec.ts src/lib/html/__tests__/layoutOptions.svelte.spec.ts`:
  the new cases fail.
- `PW_PORT=4216 pnpm exec playwright test e2e/layout/layout-root.spec.ts e2e/layout/layout-anchor.spec.ts`.
  Write down every result. Expected:
  - RED: the inside-the-root cases "…inside a layoutRoot animates relative to it", "…inside a translated
    layoutRoot…", `layout="position"`, `layout="size"`, "…from a translated box inside a layoutRoot starts from its
    visual position", and layout-anchor case (1). Today the `ul` reaches motion-dom with `layout` but without
    `layoutRoot`. So a red case may fail because the **list animates instead of jumping** (`list` not within
    0.5 px of 200 in every frame, since its layout animation is no longer instant), and not only because the
    underline moves in page space. Either failure is the expected red, not a STOP. Record which assertion failed.
    When reading Step 3's diagnostics after Step 2, a list that still animates means `layoutRoot` didn't reach
    the `ul`'s node (check `listNode.options.layoutRoot`) before you look at the underline.
  - Probably GREEN: "…without a layoutRoot animates in page space", "…from outside a layoutRoot starts from its
    page position", and layout-anchor case (2). These are guards.
  - RED for a reason this plan doesn't fix: the six crossfade cases (`exit=true`, all names containing
    "Crossfading"). They fail at `crossfading.length > 20` or `expectCrossfade`, because the old underline is a
    detached exit clone.

If a case listed as RED passes, STOP. Commit (`test(layout): layoutRoot and layoutAnchor parity (#1935)`).

### Step 2: Add the props and sync the options

1. `src/lib/types.ts`: after `layoutScroll`, add `layoutRoot?: boolean` and
   `layoutAnchor?: { x: number; y: number } | false`. Base the JSDoc on upstream's text above, plus:
   `layoutRoot` also animates shared `layoutId` elements relative to the root when the previous element was inside
   it too (Motion 14.7.1), and the root's own layout change is instant. Give each an `@example`, e.g.
   `<motion.ul layout layoutRoot>` around a tab list, and `<motion.div layout layoutAnchor={{ x: 0.5, y: 0.5 }} />`
   inside a centered flex parent.
2. `_MotionContainer.svelte`: destructure `layoutRoot: layoutRootProp, layoutAnchor: layoutAnchorProp` next to
   `layoutScroll` (211-214) so they leave `...rest`. Add `layoutAnchor: layoutAnchorProp, layoutDependency: layoutDependencyProp`
   to both `updateOptions` calls. Add `layoutRoot: layoutRootProp` **only** to the untracked call inside the mount
   effect (1907-1915). That is upstream's creation-time option (`use-visual-element.ts:229-248 @ v14.7.1`), and
   `layoutOptions` (`MeasureLayout.tsx:43-52`) excludes it. Comment saying so.
3. `motionDomProjection.ts`: add the three fields to `MotionDomProjectionUpdateOptions` with one-line docs
   (`layoutDependency`: "forwarded so `NodeStack.promote` can compare it, as upstream `layoutOptions` does"), and
   pass them through in `updateOptions`' `setOptions` call. Spread `layoutRoot` only when the key is present
   (`...('layoutRoot' in options ? { layoutRoot: options.layoutRoot } : {})`), so the reactive call can't clear it.
   Leave plan 006's `layoutId` handling as it is. Add a
   comment citing `MeasureLayout.tsx:43-52 @ v14.7.1` and `use-visual-element.ts:229-248 @ v14.7.1`.

**Verify**: the Step 1a cases pass. `pnpm check` gives 0 errors.
`PW_PORT=4216 pnpm exec playwright test e2e/layout/layout-anchor.spec.ts` passes both cases. Re-run
`e2e/layout/layout-root.spec.ts` and write down the results again.

### Step 3: Find out what the root-relative cases see

For every `layout-root` case that still fails apart from the six crossfade cases, add a **temporary** diagnostic to
the page and record its output. Expose `window.__layoutRootDebug = () => …` that reads, via
`visualElementStore` from `motion-dom`, the last `.underline` element's projection node and the `ul`'s node, and
returns:

- `hasResumeFrom`, and `resumeFromPathHasList` (`node.resumeFrom?.path.includes(listNode)`);
- `isShared` (`node.snapshot?.source !== node.layout?.source`, read in a `didUpdate` listener you attach on
  mount);
- `relativeParentIsList` (`node.getClosestProjectingParent() === listNode`);
- the list node's `snapshot.layoutBox.x.min` and `layout.layoutBox.x.min` at that `didUpdate`.

Call it from a throwaway spec, or from the browser console on `pnpm dev`, and put the values in your report.
Remove the diagnostic before committing.

How to read them:

- **List snapshot equals its new layout** (`x.min` 200 in the default case, not 350): the `layoutRoot` ancestor was
  measured after the DOM changed. This is the `prepareSnapshotPath` problem. Do Step 4.
- **`hasResumeFrom` false in the "outside" case while it fails**: motion-dom can't tell the old element was outside
  the root. STOP (redesign; see STOP conditions).
- Anything else: STOP and report the values.

If nothing but the crossfade cases fails, skip Step 4.

### Step 4 (only if Step 3 says so): seed a `layoutRoot` ancestor from its cached layout

In `prepareSnapshotPath`, replace `node.willUpdate(false)` for a `layoutRoot` path node with the observer path's
seeding. If the node isn't already layout-dirty and its adapter
(`MotionDomProjectionAdapter.adapters.get(node)`) has a cached snapshot (`onScreenSnapshot()`), set
`node.snapshot` to it and `node.isLayoutDirty = true`. Otherwise fall back to `node.willUpdate(false)`. Comment
why: every `prepareSnapshotPath` caller runs after the DOM changed (the same reason
`seedCachedSnapshotsForGroup` seeds cached layouts, 1199-1205), while upstream's `willUpdate` snapshots
`layoutRoot` ancestors before the DOM commit (`create-projection-node.ts:765-767 @ v14.7.1`). Add a unit case in
the Step 1a `describe`: a seeded commit on a child of a mounted `layoutRoot` adapter whose element moved leaves the
root's snapshot at its cached (pre-move) box.

**Verify**: `pnpm exec vitest run src/lib/utils/motionDomProjection.spec.ts` (all pass).
`PW_PORT=4216 pnpm exec playwright test e2e/layout/layout-root.spec.ts`: every non-crossfade case passes. If not,
STOP with Step 3's diagnostics re-run.

### Step 5: Mark the crossfade cases as known gaps

For each of the six crossfade cases, confirm the failure is about the old underline (not enough two-underline
frames, or the two underlines apart), not the new underline's path. Run the case with the `expectCrossfade` /
`crossfading` assertions commented out once, locally: its `expectSlideAcrossList` should pass. If it does, change
the case to `test.fixme(...)` and keep its full body. Add this comment above the six:
"svelte-motion's `AnimatePresence` exits a direct child as a detached clone with no projection node, and nothing
relegates the exiting lead, so it can't follow the new lead in a crossfade. Un-fixme when shared-layout
crossfades with exiting elements are ported (plan 012 in .agents/.plans/motion-14-7-1)." If a crossfade case's new-underline path fails, STOP.

### Step 6: TesterPanel, docs, example, changeset

1. `src/routes/tests/layout-root/+page.svelte`: a `TesterPanel` (`eyebrow="Motion 14.7.1 · #1935"`). Model it on
   `src/routes/tests/drag/disable-from-ondrag/+page.svelte`. Steps: click Lettuce, and expect the list to jump
   left with the sidebar while the underline slides exactly one tab. Then open `?layoutRoot=false`, where the
   underline should drift in from Tomato's old page position. The live verdict comes from the recorded frames:
   **RELATIVE ✓** if the underline's offset from the list rises monotonically from ~0 to ~100, **PAGE SPACE**
   otherwise. Skip it under `@isPlaywright=true`.
2. Docs page `docs/src/routes/docs/layout-root/+page.svx` + `+page.ts` (frontmatter, SEO block and `Example`
   import as in `docs/src/routes/docs/layout-dependency/+page.svx`). Title "layoutRoot & layoutAnchor". Sections:
   what a layout root is, and that it is read when the element mounts (toggle it with `{#key}`); shared `layoutId` inside a root (the tabs-and-sidebar case, the "previous element was
   inside the root too" rule, and that the root's own layout change is instant); `layoutAnchor` with the three
   forms (default top-left, `{ x: 0.5, y: 0.5 }`, `false`); API table; a "Not yet supported" note that crossfades
   with an exiting element don't follow the root. Add `{ title: 'layoutRoot', href: '/docs/layout-root', icon: … }`
   to `docs/src/lib/docsNav.ts` next to `layoutDependency` (line 85), using an icon already imported there. In
   `docs/src/routes/docs/layout-animations/+page.svx`, add `layoutRoot` / `layoutAnchor` rows to the API reference
   and a "Related" link.
3. Example `docs/src/routes/examples/layout-root/+page.svelte`, modelled on
   `docs/src/routes/examples/layout-dependency/+page.svelte`, with two sections:
   - `SidebarTabs.svelte`: the #1935 tabs in a centered window, a sidebar on Lettuce, and a `layoutRoot` on/off
     toggle. The wow moment: the whole tab bar jumps but the underline glides exactly one tab.
   - `CenteredAnchor.svelte`: a parent resizing 200↔400 with a centered child, anchor presets. The wow moment:
     with `{ x: 0.5, y: 0.5 }` the child never drifts off center mid-animation.
   Register `'layout-root'` in `docs/src/lib/examplesIndex.ts` next to `'layout-scroll'`.
4. `.changeset/layout-root-and-anchor.md` (`minor`): "Add the `layoutRoot` and `layoutAnchor` props. Inside a
   `layoutRoot`, shared `layoutId` animations now move relative to the root when the previous element was inside
   it too, so a tab underline slides one tab even when the tab bar jumps in the same update (Motion 14.7.1, #1935).
   `layoutAnchor` sets the point a child's relative layout projection is anchored to, or `false` to turn it off.
   Both props no longer leak onto the DOM as attributes."

**Verify**: `pnpm build`, then `pnpm --dir docs build`, `pnpm --dir docs check` (0 errors), `pnpm --dir docs test`,
`pnpm --dir docs test:geo-seo` all pass. If the docs build rewrites the tracked
`docs/static/r/animated-tabs.json`, restore it.

### Step 7: Gate

`pnpm build`, `pnpm check` (0 errors), `pnpm package`, `pnpm test:only` (all pass), then
`PW_PORT=4216 pnpm exec playwright test e2e/layout e2e/layout-id e2e/independent-transforms e2e/animate-layout e2e/animate-presence e2e/drag e2e/reorder`
(all pass apart from the six `fixme` cases; re-run a failing spec alone once and say so),
`pnpm exec playwright test --config docs/playwright.config.ts` (all pass), `trunk fmt` + `trunk check` on every
changed file, `git diff --check`, and `git status` (only in-scope files).

## Test plan

- Red-first anchors: the Step 1a unit cases, the five inside-the-root `layout-root` cases, and layout-anchor case
  (1). All fail before Step 2 (or Step 4) and pass after.
- Guards: "without a layoutRoot animates in page space", "from outside a layoutRoot starts from its page
  position", layout-anchor case (2), and every existing `e2e/layout`, `e2e/layout-id` and `e2e/reorder` spec.
  Reorder has `layoutDependency`-gated items, now forwarded to the projection.
- Known gaps, kept as `test.fixme` with their full upstream bodies: the six crossfade cases (Step 5).
- `layoutDependency` forwarding changes motion-dom's `NodeStack.promote`. Two `layoutId` elements with the same
  non-`undefined` `layoutDependency` no longer resume from each other, as upstream (`stack.ts:57-71 @ v14.7.1`).
  The `e2e/layout-id` suite covers the common paths.

## Done criteria

- [ ] `grep -n "layoutRoot?: boolean\|layoutAnchor?:" src/lib/types.ts` → two matches with JSDoc above them
- [ ] `grep -n "layoutRoot: layoutRootProp" src/lib/html/_MotionContainer.svelte` → exactly two matches: the destructuring and the mount-effect `updateOptions` call (not the reactive one)
- [ ] Step 1 tests exist; the RED ones failed before and pass now; six crossfade cases are `test.fixme` with the comment
- [ ] `pnpm check` 0 errors; `pnpm test:only` and `pnpm package` pass; docs build/check/test/geo-seo and docs Playwright pass
- [ ] `e2e/layout`, `e2e/layout-id`, `e2e/independent-transforms`, `e2e/animate-layout`, `e2e/animate-presence`, `e2e/drag`, `e2e/reorder` pass
- [ ] Docs page + nav entry, example + index entry, two home-page links, changeset exist; no temporary diagnostic left (`grep -rn "__layoutRootDebug" src` → nothing)
- [ ] No out-of-scope files modified

## STOP conditions

- The preconditions (motion-dom 14.7.1, plan 006's `switchLayoutId`, the #1935 code in motion-dom's dist) don't
  hold.
- A case listed as RED in Step 1 passes before Step 2.
- Step 3 shows the "outside" case fails because the arriving node has no `resumeFrom` (it can't tell the old
  element was outside the root), or any non-crossfade case fails for a reason other than the `layoutRoot`
  ancestor's post-DOM snapshot. Fixing that means making the registry handoff a real motion-dom resume (keeping
  the departing projection node and setting `resumeFrom`, or giving the seeded snapshot a foreign `source`). That
  is a redesign of the plan 006 handoff and out of scope here. Report the diagnostics.
- Step 4 makes any existing `e2e/layout`, `e2e/layout-id` or `e2e/reorder` spec fail twice, or makes the `ul`'s
  own observer commit animate the list a second time (the list must jump: `list` within 0.5 px of 200 in every
  recorded frame).
- A crossfade case fails on the new underline's path, not on the old underline.
- Forwarding `layoutDependency` breaks an existing spec (twice). Report it, and don't drop the forwarding without
  the dispatcher's agreement.

## Maintenance notes

- `prepareSnapshotPath` (if Step 4 ran) now seeds `layoutRoot` ancestors from cache. Any new post-DOM commit path
  must keep doing that, never `willUpdate(false)` after the DOM changed.
- The registry handoff is still non-shared to motion-dom (`isShared` false, see Current state). #1935's
  ancestor-transform re-application (`95c017019`) therefore never runs for a registry handoff. The ported "inner
  translated box" case passes only because the registry rect is already the old element's visual box. If a case
  needs `isShared`, that is the redesign named in STOP conditions.
- Gap shared with plan 006, owned by plan 012 (`012-presence-exit-shared-layout-relegate.md`, a spike in this
  same lane): crossfades and relegation for elements exiting through `AnimatePresence`. 012 un-fixmes the six cases.
- `layoutRoot` is creation-time only, as upstream. A consumer who toggles it must remount the element (e.g.
  `{#key}`). The docs page says so.

## Amendments (operator-approved 2026-10-28)

### A1: hand the departing lead's snapshot to motion-dom (fixes the Step 3 STOP)

At Step 3, the five non-crossfade inside-the-root cases fail. The cause isn't the `layoutRoot` ancestor's snapshot.
Svelte detaches the departing `layoutId` lead before its teardown, so its unmount-time `willUpdate()` measures a
detached element. The zero box is thrown away, and `promote()` (`projection/shared/stack.ts:45-74` @v14.7.1) hands
over no snapshot. The arriving node then falls back to its own snapshot, so `isShared` is false and #1935's shared
branches never run. Three Svelte-side faults stack on top of that:

- A moving list's observed commit runs `seedCachedSnapshotsForSubtree`, which overwrites the arriving underline's
  snapshot with its cached new layout. There is no dirty or snapshot check for descendants.
- The registry rect counts ancestor or own transforms twice, because the cached boxes are already visual and
  `currentVisualPageRect` applies the transforms again. This affects translated roots and `innerX`.
- `consumeLayoutIdHandoff` returns early for elements with `layout`, so `layout="position"` and `layout="size"` get no
  handoff at all.

Match upstream's data flow, where the departing lead is snapshotted while still attached and `promote()` hands it
over with a foreign `source`. The operator's prototype is saved at `/tmp/sm007-prototype.diff`; re-derive it red first
rather than pasting it.

1. Widen the scope to `src/lib/utils/motionDomProjection.ts` `unmount()`, `mount()` and
   `seedCachedSnapshotsForSubtree`, and to `_MotionContainer.svelte` `consumeLayoutIdHandoff` (about line 2972).
2. **`unmount()`.** Before `visualElement.unmount()`, give a detached `layoutId` lead with no snapshot the snapshot
   upstream would have taken:
   - `measuredBox`: its on-screen box (`visualTargetBox() ?? latestLayoutBox ?? lastLayout.layoutBox`), with no
     second `applyTransform`.
   - `layoutBox`: `projection.removeTransform(measuredBox)`.
   - `source`: its own id.
   - Then run `root.startUpdate()` and `prepareSnapshotPath()`, and set `isLayoutDirty = true`.
   - Cite `create-projection-node.ts` `unmount`, `willUpdate`, `updateSnapshot` and `measure`/`removeTransform`.
3. **`mount()`.** After the projection mounts, set `mountedFromSharedSnapshot = !!resumeFrom?.snapshot`. When it is
   set, run `prepareSnapshotPath()` and set `isLayoutDirty`, so the pass re-measures the arriving node with its path
   transforms reset, as upstream's `update()` does.
4. **`seedCachedSnapshotsForSubtree`.** Skip a non-committer descendant that is already layout-dirty or already
   holds a snapshot.
5. **`consumeLayoutIdHandoff`.** When `mountedFromSharedSnapshot` is set, only drop the registry entry, mirroring
   `consumeLayoutIdHandoffAfterSwitch`. The registry stays the fallback when there is no `resumeFrom`. The early
   return for `layout` elements must not stop that fallback when there is no shared snapshot.
6. **Existing bug, red first.** With `layoutRoot=false` and `layout="position"` (or `"size"`), a `layoutId` element
   that moves to a new tab doesn't animate at all. Add an e2e case to `layout-root.spec.ts` (variant
   `?layoutRoot=false&layout=position`, plus `size`) that slides as upstream's does.
7. **Out of scope (moved to plan 015a, 3o/3p).** `currentVisualPageRect` double-counts transforms on the registry
   fallback (`layoutRoot=false&offset=true` starts at 500 instead of 400). Don't fix it here. If a 007 case still
   depends on it after steps 2–5, STOP.
8. **Red first.** Add unit cases in `motionDomProjection.spec.ts`, each shown failing before its fix:
   - the detached-lead unmount seed hands a `promote()` snapshot with a foreign source (`isShared`);
   - the subtree seed does not overwrite a descendant's existing snapshot;
   - a mount from a shared snapshot drops the registry entry and doesn't double-animate.

   Keep 006 A1's guards green (no extra pass on a plain mount, a registry handoff after a real removal, the
   cached-box fallback).
9. **Crossfade cases.** The six crossfade cases fail only because the old underline doesn't follow the new one (no
   relegate on the exit clone). Mark them `test.fixme` with `// Plan 012: no relegate on the exit clone`, as the plan
   already allows. In the `innerX` crossfade, the crossfade check runs before the slide check. Reorder it, or add a
   separate slide-only assertion, so its slide path is verified.
10. **Gate.** Run the full Done-criteria e2e set, plus `e2e/reorder`, `e2e/animate-presence`, `e2e/drag`,
    `e2e/independent-transforms`, `e2e/animate-layout` and `e2e/projection`, and the unit suite. 006's
    `e2e/layout-id` must stay green, with only its plan-012 `fixme` skipped.
