# Plan 006: A `layoutId` that changes after mount moves the element to the new shared-layout stack (#1411)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4216** (`PW_PORT=4216`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Requires plan 001** (pins at Motion 14.7.1). The port uses `projection.needsShow` and the "only hide a node
> that follows another lead" render rule, which exist only in motion-dom 14.7.1. Before starting, confirm both
> print a line, otherwise STOP:
> `grep -n '"motion-dom": "14.7.1"' package.json` and
> `grep -n 'needsShow' node_modules/motion-dom/dist/index.d.ts`.
>
> **Drift check (run first)**:
> `git diff --stat f8ac71aa..HEAD -- src/lib/utils/motionDomProjection.ts src/lib/utils/motionDomProjection.spec.ts src/lib/utils/layoutId.ts src/lib/html/_MotionContainer.svelte src/lib/html/__tests__ src/routes/tests/layout-id e2e/layout-id src/routes/tests/independent-transforms/layout-toggle e2e/independent-transforms/layout-toggle.spec.ts docs/src/routes/docs/layout-animations src/routes/+page.svelte`
> Plan 001 should not appear. Plan 008 of this batch may have changed `_MotionContainer.svelte` around lines 696 and
> 718-723 (presence registration) and other plans may have added links to `src/routes/+page.svelte`; that is fine.
> For any other change, compare the "Current state" excerpts with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (touches the shared-layout handoff that every `layoutId` user relies on)
- **Depends on**: 001 (motion-dom 14.7.1: `needsShow`, `21bdf13d3` follower-only hiding)
- **Wave**: 2 (lane `layoutid`, before plan 007 in the same lane)
- **Category**: bug (upstream parity, NEEDS-PORT)
- **Planned at**: commit `f8ac71aa` (main after the 14.6.0 release, svelte-motion 2.5.0), 2026-10-27

## Why this matters

A motion-dom projection node joins its `layoutId`'s shared-layout stack once, when it mounts. svelte-motion forwards
a later `layoutId` change only with `projection.setOptions({ layoutId })`, which does not move stacks. So the
element stays in its old stack and never joins the new one. Common patterns break: tabs that render every highlight
and give only the selected one the id (`layoutId={selected ? 'highlight' : undefined}`), an open detail card whose
`layoutId={open}` changes to the next item, and an element that takes the id of one already on screen. Worse, after
the change the node's `getStack()` (which reads `options.layoutId`) points at a stack whose lead is another element,
so motion-dom treats it as a follower and can hide it. Motion 14.7.1 fixed this in framer-motion's `MeasureLayout`
(#1411, seven commits). This plan ports that logic into svelte-motion's projection adapter and container. When it
lands, a `layoutId` change acts like an unmount and remount with the new id: the element joins the new stack, it
animates from the old holder when the id moved in the same update, and it takes over instantly when the old holder
is still on screen with the id.

## Current state

### svelte-motion

- `src/lib/utils/motionDomProjection.ts` holds the Svelte adapter around motion-dom's `HTMLProjectionNode`.
  `updateOptions` (lines 383-413) writes `layoutId` into the projection options on every call. Nothing else
  touches stacks:
  ```ts
  // motionDomProjection.ts:383-413 (abridged)
      updateOptions(options: MotionDomProjectionUpdateOptions): void {
          this.layout = options.layout
          this.layoutId = options.layoutId
          this.transition = options.transition
          // ... visualElement.update(...) ...
          this.projection.setOptions({
              layout: options.layout,
              layoutId: options.layoutId,
              layoutScroll: options.layoutScroll,
              alwaysMeasureLayout: options.alwaysMeasureLayout,
              animationType: animationTypeForLayout(options.layout),
              transition: options.transition,
              visualElement: this.visualElement
          })
          this.syncGroupMembership()
      }
  ```
  Other adapter methods used here: `willUpdate()` (lines 535-543: returns early unless mounted and
  `this.layout || this.layoutId`), `didMount()` (562-566), `didUpdate()` (590-595: returns early unless
  `this.layout || this.layoutId`, then `projection.root?.didUpdate()`, `visualElement.scheduleRenderMicrotask()`,
  `refreshCachedLayout()`), `commitObservedLayoutChange(previousRect)` (986-1014, seeds a snapshot from a
  page-space rect via `measurementsFromRect`, lines 154-160).
- `src/lib/html/_MotionContainer.svelte`, the component behind every `motion.*` element:
  - `scopedLayoutId` (lines 283-285): `layoutIdProp ? scopeLayoutId(layoutGroupId, layoutIdProp) : undefined`
    (format `"<groupId>-<id>"`, `src/lib/components/layoutGroup.context.ts:95-97`).
  - Handoff-rect effect (lines 775-820). While a `layoutId` element is mounted it tracks its on-screen rect; its
    cleanup writes that rect to the `layoutId` registry:
    ```ts
    // _MotionContainer.svelte:805-819
            return () => {
                stopWatching()
                offMeasure?.()
                offCommit?.()
                const rect = adapter?.currentVisualPageRect() ?? layoutIdLastRect
                layoutIdLastRect = null
                if (rect && scopedLayoutId) {
                    layoutIdRegistry.snapshot(
                        scopedLayoutId,
                        new DOMRect(rect.left, rect.top, rect.width, rect.height),
                        mergedTransition ?? {},
                        target
                    )
                }
            }
    ```
    The effect reads `layoutIdProp`, so it re-runs, and this cleanup runs, every time the id changes while the
    element stays mounted. Svelte 5.56 teardowns read the value from before the write
    (`node_modules/svelte/src/internal/client/runtime.js:651-671`, `reactivity/sources.js:183-188`:
    `old_values`), so the cleanup snapshots the OLD id with a rect of an element that is still on screen. On a
    real removal Svelte detaches the DOM before teardowns run, which
    `src/lib/html/__tests__/layoutIdTeardown.svelte.spec.ts` pins (`teardowns` equals `[false]`).
  - Reactive options effect (lines 1878-1888) calls `motionDomProjection.updateOptions({ layout, layoutId:
    scopedLayoutId, layoutScroll, transition, style, alwaysMeasureLayout })`. The mount effect (1902-1931) calls
    `updateOptions` untracked, then `motionDomProjection.mount(mountTarget)`. motion-dom's `mount()` registers
    the node with `options.layoutId` at that moment.
  - `measureLayoutMounted` (lines 2082-2084):
    `(hasLayoutFeatures && !!(layoutProp || scopedLayoutId)) || (hasDragFeatures && !!dragProp)`. It goes false
    in the same flush that removes the id from a `layoutId`-only element.
  - `trackLayoutProjectionDependencies` (2179-2184) includes `scopedLayoutId` unless `layoutDependency` gates
    measurement. The `layout` pre-update effect (2186-2212) snapshots (`measureLayoutRect('snapshot')`,
    `motionDomProjection?.willUpdate()`) and sets `motionDomProjectionUpdatePending = true`. Its commit runs on
    a microtask (`runReactiveCommit`, ~2330-2370) through `commitObservedLayoutChange` or a plain
    `root.didUpdate()`.
  - `layoutId`-only nodes inside a `LayoutGroup` fan out through a pre/post pair (2376-2405,
    `shouldFanOutLayoutIdUpdate`). Ungrouped `layoutId`-only nodes have no update pair.
  - Consume effect (lines 2792-2809) runs whenever `scopedLayoutId` changes, not only on mount:
    ```ts
    $effect(() => {
        if (!(element && scopedLayoutId && layoutIdRegistry && isLoaded === 'ready' && hasLayoutFeatures))
            return
        const prev = layoutIdRegistry.consume(scopedLayoutId, element)
        if (!prev) return // First appearance, no animation needed
        if (motionDomProjection && layoutProp) return
        motionDomProjection?.commitObservedLayoutChange(prev.rect)
    })
    ```
- `src/lib/utils/layoutId.ts:141-155`: module-level registry. `snapshot(id, rect, transition, owner)`,
  `consume(id, consumer)` (one-shot, never hands an element its own entry, line 152), `has(id)`. Entries live
  through a handoff window of two frames and at least 100 ms. The doc comment (lines 16-22) says the registry is
  also written "when its `layoutId` turns off".
- Existing tests that must stay green (or change only as Step 5 says): `e2e/layout-id/*.spec.ts` (basic,
  read-budget, scale-handoff, scrolled, shift-swap, takeover-initial), `src/lib/utils/layoutId.spec.ts`,
  `src/lib/html/__tests__/layoutIdTeardown.svelte.spec.ts`, the `MeasureLayout` mount tests in
  `src/lib/html/_MotionContainer.spec.ts:1103-1159` (including "does not willUpdate a grouped layoutId node when
  its layoutId is turned back on", which still matches upstream), and
  `e2e/independent-transforms/layout-toggle.spec.ts`.
- `layoutCrossfade` is not a svelte-motion prop (`grep -rn layoutCrossfade src/lib` prints nothing). Upstream
  cases that set it are ported without it (see Test plan).

### Upstream (verified at `~/Github/motion`, tag `v14.7.1`)

Commits: `7f85889ed`, `21bdf13d3`, `32abe31f7`, `c3b7305ba`, `f58782f0e`, `fd97ac411`, `518b90659`. Read with
`git -C ~/Github/motion show v14.7.1:<path>`.

- `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx@v14.7.1`, lines 59-106, `switchLayoutId`:
  ```ts
  const switchLayoutId = (projection: IProjectionNode, layoutId?: string) => {
      const { snapshot } = projection
      const stack = projection.getStack()
      stack?.remove(projection)
      // If this node led the old stack (so remove() made it the prevLead of the new lead), the new lead
      // animates from this node's snapshot, which it now holds. Unlike a node that unmounts, this one stays
      // mounted, so unlink them.
      const lead = stack?.lead
      if (stack?.prevLead === projection && lead!.resumeFrom === projection)
          lead!.resumeFrom = lead!.currentAnimation = projection.resumingFrom = undefined
      projection.options.layoutId = layoutId
      // A node that followed another no longer does, so clear the styles that hid it.
      if (!layoutId) {
          projection.needsShow = true
          return
      }
      projection.root!.registerSharedNode(layoutId, projection)
      // Like a mounting node, this one animates from the lead it replaces. But if that lead is still on
      // screen with this layoutId, this node takes over instantly: it keeps its own snapshot, and the lead
      // is hidden. A lead that left the stack in this commit, or one that's exiting, is animated from.
      return () => {
          const { resumeFrom } = projection
          if (resumeFrom?.isPresent !== false && projection.getStack()!.members.includes(resumeFrom!)) {
              resumeFrom!.hide()
              projection.resumeFrom = undefined
              projection.snapshot = snapshot
          }
      }
  }
  ```
  - `componentDidMount` (116-147): when `MeasureLayout` mounts on an already-mounted element that gains an id
    (no `layout`/`drag`), `if (projection.options.layoutId !== layoutId) switchLayoutId(projection, layoutId)?.()`.
    No `willUpdate()`. The takeover runs right away.
  - `getSnapshotBeforeUpdate` (149-204):
    `this.takeOver = prevProps.layoutId !== layoutId ? (projection.willUpdate(), switchLayoutId(projection, layoutId)) : undefined`.
    This runs before the DOM commit, for every node in the commit, and regardless of `layoutDependency`.
  - `componentDidUpdate` (206-218): `this.takeOver?.()` and then `projection.root!.didUpdate()`. So every node
    has switched before any takeover decides.
  - `packages/framer-motion/src/motion/index.tsx@v14.7.1` (`git diff v14.6.0 v14.7.1 -- <path>`): `MeasureLayout`
    is also rendered while `projection.options.layoutId` is still set, i.e. for the render that removes the id
    from a `layoutId`-only element. That render is an update (`willUpdate()` + switch to `undefined`), not an
    unmount.
- motion-dom `projection/node/create-projection-node.ts@v14.7.1`: `setOptions` (1237-1244) only merges options.
  `mount()` (540-542) is the only place that calls `registerSharedNode`. `registerSharedNode` (1938-1953) adds
  the node to the stack and promotes it. Render (`applyProjectionStyles`, 2060-2063): a node is hidden only when
  `!this.isVisible && lead !== this` (`21bdf13d3`). Lines 2081-2083: `needsShow` clears visibility and opacity on
  the next render (`fd97ac411`).
- motion-dom `projection/shared/stack.ts@v14.7.1`, `NodeStack`: `remove` (25-32) promotes the last remaining
  member if the removed node was lead. `promote` (45-74) sets `node.resumeFrom = prevLead`, copies
  `prevLead.snapshot`, and hides `prevLead` when `crossfade === false`.
- Fixtures and specs: `dev/react/src/tests/issue-1411.tsx`, `issue-1411-crossfade.tsx`, `issue-1411-tabs.tsx`,
  `issue-1411-takeover.tsx`, `issue-1411-open-change.tsx`, and the matching `tests/react/issue-1411*.spec.ts`.
  Unit tests: `packages/framer-motion/src/projection/__tests__/layout-id-change.test.tsx`.

### Conventions

- Test pages: `src/routes/tests/<area>/<name>/+page.svelte`, read query params from `page.url.searchParams`
  (exemplar `src/routes/tests/layout-id/takeover-initial/+page.svelte`). Specs: `e2e/<area>/<name>.spec.ts`,
  load `?@isPlaywright=true` (exemplar `e2e/layout-id/takeover-initial.spec.ts`).
- Pages a human reviews get a guided `TesterPanel` (steps, expected result, live verdict), which renders nothing
  under `?@isPlaywright=true`. Exemplar: `src/routes/tests/drag/disable-from-ondrag/+page.svelte` with
  `src/routes/tests/layout/_parity/TesterPanel.svelte`.
- Component unit tests: `src/lib/html/__tests__/*.svelte.spec.ts` with harness components next to them.
  `pnpm exec vitest run` uses `vitest.config.ts`, which runs every spec in JSDOM with `conditions: ['browser']`
  (there is no separate server project in that config). Don't write SSR or server-render assertions here. Exemplar: `layoutIdTeardown.svelte.spec.ts` + `LayoutIdTeardownHarness.svelte`.
  Read a node with `visualElementStore.get(element)!.projection!` (`motion-dom` export).
- Adapter unit tests: `src/lib/utils/motionDomProjection.spec.ts` (exemplar: the
  `describe('MotionDomProjectionAdapter node-group gaps (plan 007 Step 4b)')` block's `mount` helper, ~1113-1140).
- Comments cite upstream as `file:line @ v14.7.1`, as the surrounding code does.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Unit files | `pnpm exec vitest run <paths>` | all pass |
| All unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| E2E | `PW_PORT=4216 pnpm exec playwright test <paths>` | all pass (the web server builds first) |
| Build | `pnpm build` | exit 0 |
| Docs | `pnpm --dir docs build` then `pnpm --dir docs check` | exit 0, 0 errors |
| Format/lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

## Scope

**In scope**:

- `src/lib/utils/motionDomProjection.ts`: new `switchLayoutId` and `commitLayoutIdChange` methods, a new public
  `get isMounted(): boolean` getter (`this.element !== null`; `element` is private, line 310), and the `layoutId`
  handling in `updateOptions`
- `src/lib/utils/motionDomProjection.spec.ts`: a new `describe` block
- `src/lib/html/_MotionContainer.svelte`, only these regions: the handoff-rect effect cleanup (775-820), the
  consume effect (2776-2809), and a new pre/post effect pair placed directly after the `layoutId` fan-out pair
  (after line 2405)
- `src/lib/utils/layoutId.ts`: the doc comment only (lines 13-33)
- `src/lib/html/__tests__/layoutIdChange.svelte.spec.ts`, `LayoutIdChangeHarness.svelte`,
  `LayoutIdGalleryHarness.svelte` (create)
- `src/routes/tests/layout-id/change-after-mount/+page.svelte`, `move-to-sibling/+page.svelte`,
  `tabs/+page.svelte`, `takeover/+page.svelte`, `open-change/+page.svelte` (create)
- `e2e/layout-id/change-after-mount.spec.ts`, `tabs.spec.ts`, `takeover.spec.ts`, `open-change.spec.ts` (create)
- `e2e/independent-transforms/layout-toggle.spec.ts` and the doc comment of
  `src/routes/tests/independent-transforms/layout-toggle/+page.svelte`, only as Step 5 says
- `src/routes/+page.svelte` (links next to the existing `layout-id` links, ~967-1020)
- `docs/src/routes/docs/layout-animations/+page.svx` (the `layoutId` "How it works" list and API row)
- `.changeset/layout-id-change-after-mount.md` (create)

**Out of scope**:

- `layoutRoot`, `layoutAnchor` and the other `layoutOptions` syncing: that is plan 007 in this lane.
- A `layoutCrossfade` prop, and shared-layout crossfades with an element that is exiting through
  `AnimatePresence`. svelte-motion's direct `AnimatePresence` children exit as detached clones with no projection
  node (`_MotionContainer.svelte:337-341`), and nothing calls `projection.relegate()`/`promote()`. These are
  existing gaps, not #1411.
- `src/lib/utils/layoutId.ts` behaviour (`snapshot`/`consume`/`has` and the handoff window).
- `package.json`, `"version"`, PR labels.
- `_MotionContainer.svelte` regions other than those listed (other plans in this batch edit them).

## Git workflow

- Lane branch `lane/1471-layoutid` in `../svelte-motion-1471-layoutid`, created by the dispatcher from
  `feat/motion-14.7.1` after plan 001 is committed. Plan 007 continues on this branch after you finish.
- Conventional commits, for example `test(layout-id): layoutId changes after mount (#1411)` and
  `fix(layout-id): move a node to its new layoutId's stack after mount (Motion 14.7.1, #1411)`. End each message
  with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red tests

**1a. Component unit tests.** Create `src/lib/html/__tests__/layoutIdChange.svelte.spec.ts`. Model the
lifecycle (real timers, `frames(n)` helper, registry reset in `beforeEach`) on `layoutIdTeardown.svelte.spec.ts`.
Harnesses:

- `LayoutIdChangeHarness.svelte`: props `items: Array<{ key: string; layoutId?: string; layout?: boolean; layoutDependency?: unknown }>`
  and `group?: string`. It renders a keyed `{#each}` of `<motion.div id={item.key} layoutId={item.layoutId} layout={item.layout} layoutDependency={item.layoutDependency}>`,
  wrapped in `<LayoutGroup id={group}>` when `group` is set.
- `LayoutIdGalleryHarness.svelte`: thumbnails `one`/`two` (`layoutId={id}`, `data-box={id}`) and, when `open`
  is set, a card (`id="card"`, `data-box="card"`, `layoutId={open}`), all with
  `transition={{ type: 'tween', ease: 'linear', duration: 10 }}`. Add a `thumbLayoutId` prop for thumbnail
  `one` (default `'one'`) for the "loses its layoutId" case.

Mock `HTMLElement.prototype.getBoundingClientRect` from `data-box`, as upstream does
(`one: [0,0,100,50]`, `two: [200,0,100,50]`, `card: [50,200,400,300]`, anything else zero). Port these upstream
cases (`layout-id-change.test.tsx@v14.7.1`), comparing nodes by identity:

| # | Case (upstream line) | Expected on current code |
| --- | --- | --- |
| 1 | moves the node to the new layoutId's stack (21) | RED |
| 2 | can add and remove a layoutId, with `layout` (39) | RED |
| 3 | takes over the new layoutId's lead instantly, `layoutDependency` `undefined` and `1` (62) | RED |
| 4 | namespaces the new layoutId by its LayoutGroup (114): `sharedNodes.get('group-b')` | RED |
| 5 | joins the new stack once (134). No StrictMode in Svelte: change `a`→`b`→`a`→`b` and assert the node appears exactly once in `b`'s members | RED |
| 6 | keeps an element visible after its layoutId moves to another, both orders (162), without `layoutCrossfade` | guard (may pass) |
| 7 | joins and leaves a stack without the `layout` prop (212) | RED |
| 8 | tabs: animates the layoutId from a to b and b to a, `layout` `true` and `undefined` (235): `next.getStack()?.lead === next`, `next.resumeFrom === prev`, neither hidden, `prev` opacity not `'0'` | RED |
| 9 | gallery: the old thumbnail resumes from the card's box (375) | RED |
| 10 | gallery: the card switches instantly and the new thumbnail is hidden (385) | RED |
| 11 | gallery: shows a follower again once it loses its layoutId (452), the `crossfade undefined` variant only | record |

Skip upstream's "keeps layoutAnchor in sync" (plan 007) and "takes a layoutId back from an exiting element" (needs
an exiting projection node, out of scope). Where upstream asserts synchronously right after `rerender`, assert
after `await tick()`: that is when Svelte's pre-update effects have run.

**1b. Adapter unit tests.** In `src/lib/utils/motionDomProjection.spec.ts` add
`describe('MotionDomProjectionAdapter.switchLayoutId (#1411)')`, using the same `mount` helper pattern as the
plan 007 Step 4b block:

- `updateOptions({ layoutId: 'b' })` on a mounted adapter registered with `'a'` leaves
  `projection.options.layoutId === 'a'` (only `switchLayoutId` changes it). RED: today it becomes `'b'`.
- `switchLayoutId('b')` removes the node from `'a'`'s members and makes it `'b'`'s lead (RED: method missing).
- When the switching node led `'a'` and another member took over, the new lead's `resumeFrom` and
  `currentAnimation` are cleared.
- `switchLayoutId(undefined)` sets `projection.needsShow` and returns `undefined`.
- The returned takeover hides a lead still in the stack (`isVisible === false`, `resumeFrom === undefined`, the
  node's pre-switch snapshot restored). It leaves alone a lead that is not a member or has `isPresent === false`.

**1c. E2E pages and specs.** Port the upstream fixtures. Each page has a header comment citing #1411, the upstream
fixture path and the commit(s), and uses `transition` values exactly as upstream:

- `src/routes/tests/layout-id/change-after-mount/+page.svelte` ← `issue-1411.tsx`. Query params `changed`,
  `away`, `late`, `bid` as upstream. The mount-time change is `onMount(() => { if (!late) layoutId = target })`.
  Keep the ids `#toggle`, `#change`, `#current-id`, `#a`, `#b` and the absolute positions (A at left 0, B at left
  400, both top 50, 100×100, inside a 600×400 `position: relative` box).
- `src/routes/tests/layout-id/move-to-sibling/+page.svelte` ← `issue-1411-crossfade.tsx`, without
  `layoutCrossfade` (header comment says why).
- `src/routes/tests/layout-id/tabs/+page.svelte` ← `issue-1411-tabs.tsx` (`?layout=true`), plus the TesterPanel
  from Step 4.
- `src/routes/tests/layout-id/takeover/+page.svelte` ← `issue-1411-takeover.tsx`. Drop the nested React root
  (Svelte doesn't re-render a sibling whose props didn't change). Keep B's `layoutDependency={1}`.
- `src/routes/tests/layout-id/open-change/+page.svelte` ← `issue-1411-open-change.tsx`. Keep the rAF `record()`
  loop into `window.frames` and the `mark('changedAt' | 'closedAt')` buttons. Wrap the card in `<AnimatePresence>`
  with `key="card"` as upstream. Drop the `strict` variant.

Specs (keep upstream's helpers, timings and thresholds):

- `e2e/layout-id/change-after-mount.spec.ts` ← `issue-1411.spec.ts`: the four `measureAfterSwap` cases and
  "layoutId moved to a sibling keeps the previous element visible" (against `move-to-sibling`). Add one
  Svelte-specific case: "layoutId changed away just before the swap doesn't animate from the previous element":
  `away=true&late=true`, click `#change`, wait 50 ms (one update pass, inside the registry's handoff window), click
  `#toggle`, wait 1000 ms, expect B's left to be 400. Upstream, A has already left stack `shared`. Today A's
  handoff-effect cleanup wrote a registry entry under the old id `shared`, and B animates from it.
- `e2e/layout-id/tabs.spec.ts` ← `issue-1411-tabs.spec.ts` (both `layout` values).
- `e2e/layout-id/takeover.spec.ts` ← `issue-1411-takeover.spec.ts`.
- `e2e/layout-id/open-change.spec.ts` ← `issue-1411-open-change.spec.ts`. Split the first upstream test in two:
  "changing an open card's layoutId switches it instantly" (everything up to and including "Thumbnail two
  disappears") and "closing then shrinks the card into thumbnail two" (the same setup, then the close
  assertions). Keep "changing the card's layoutId mid-open lets it finish opening".

Link the five pages from `src/routes/+page.svelte` after the `takeover-initial` link, in the same `<li><a>` format,
labelled "layoutId — … (#1411)".

**Verify** (expected RED):

- `pnpm exec vitest run src/lib/html/__tests__/layoutIdChange.svelte.spec.ts src/lib/utils/motionDomProjection.spec.ts`:
  the cases marked RED fail. Write down which "guard"/"record" cases pass.
- `PW_PORT=4216 pnpm exec playwright test e2e/layout-id/change-after-mount.spec.ts e2e/layout-id/tabs.spec.ts e2e/layout-id/takeover.spec.ts e2e/layout-id/open-change.spec.ts`:
  expect RED for both tabs cases (the new highlight snaps or is drawn on the old one), the takeover case (`#b`
  visibility is `visible`, not `hidden`), "switches instantly" and "mid-open" in open-change, and the
  Svelte-specific "changed away just before the swap" case. The four upstream `measureAfterSwap` cases and
  move-to-sibling may already pass: the registry is keyed by the current id. They are guards. Write down every
  result, including the close case.

If a case marked RED passes, STOP. Commit the tests (`test(layout-id): layoutId changes after mount (#1411)`).

### Step 2: Port `switchLayoutId` into the adapter

In `src/lib/utils/motionDomProjection.ts`:

1. Add `switchLayoutId(layoutId: string | undefined): (() => void) | undefined`, a line-for-line port of upstream
   `switchLayoutId` (excerpt above), operating on `this.projection`, with upstream's comments and a citation
   `MeasureLayout.tsx:59-106 @ v14.7.1`. It also sets `this.layoutId = layoutId`, then calls
   `this.syncGroupMembership()`. Google-style JSDoc with an `@example`, like the other public methods.
2. Add `commitLayoutIdChange(takeOver?: () => void): void`. It runs `takeOver?.()`, then
   `this.projection.root?.didUpdate()`, `this.visualElement.scheduleRenderMicrotask()` and
   `this.refreshCachedLayout()`. It runs even when the node no longer has `layout`/`layoutId`. That is upstream's
   `componentDidUpdate` (206-211) for the render that removed the id, which `didUpdate()`'s guard would skip.
3. In `updateOptions`, once mounted, stop writing the id. Pass
   `layoutId: this.element ? this.projection.options.layoutId : options.layoutId` to `setOptions`, and set
   `this.layoutId` the same way. Before mount, the id still flows in so `mount()` registers it. Comment: upstream
   `setOptions` in `MeasureLayout` spreads `projection.options` and never passes `layoutId` (`layoutOptions`,
   43-52), and only `switchLayoutId` moves a mounted node.
4. Add `get isMounted(): boolean { return this.element !== null }` with a one-line JSDoc. The container needs it:
   `element` is private (line 310) and there is no other public mounted check.

**Verify**: `pnpm exec vitest run src/lib/utils/motionDomProjection.spec.ts`. The Step 1b cases pass and nothing
else regresses. `pnpm check` gives 0 errors.

### Step 3: Wire the switch into the container

In `src/lib/html/_MotionContainer.svelte`:

1. **New pre/post pair**, directly after the `layoutId` fan-out pair (after line 2405), with a comment block citing
   `MeasureLayout.tsx @ v14.7.1` 116-147 / 149-173 / 206-211 and `motion/index.tsx`. Keep one plain
   (non-reactive) variable, `measuredBeforeLayoutIdChange`, refreshed at the end of every post run to
   `(hasLayoutFeatures && !!layoutProp) || (hasDragFeatures && !!dragProp)`. This is whether upstream's
   `MeasureLayout` was rendered for a reason other than the id.
   - `$effect.pre`. It reads `scopedLayoutId`. It returns unless `element`, `motionDomProjection` and
     `hasLayoutFeatures` are set and `motionDomProjection.isMounted` (Step 2.4). Let
     `current = untrack(() => motionDomProjection.projection.options.layoutId)`. If `current === scopedLayoutId`,
     return. If `measuredBeforeLayoutIdChange || current !== undefined` (upstream `getSnapshotBeforeUpdate`
     runs), call `motionDomProjection.willUpdate()` and then
     `pendingLayoutIdTakeOver = motionDomProjection.switchLayoutId(scopedLayoutId)`. Set
     `layoutIdChangePending = true`.
     Also record, in a plain variable of this pair,
     `layoutCommitCoversLayoutIdChange = untrack(() => motionDomProjectionUpdatePending)`. The `layout` pre-effect
     (2186-2212) is declared earlier, so it has already run in this flush and set that flag if it will commit. Read
     the flag here, never in the post effect. The `layout` post effect (2334-2343) is also declared earlier and
     clears `motionDomProjectionUpdatePending` before this pair's post effect runs, so a post-time read is always
     `false` and would double-commit `layout` nodes.
     Otherwise (not measured before, and no current id) do nothing here: `MeasureLayout` is mounting, which the
     post effect handles.
   - `$effect` (post). It reads `scopedLayoutId`. Same guards.
     - If `layoutIdChangePending`: clear it and take the takeover. If `layoutCommitCoversLayoutIdChange`, run
       only `takeOver?.()`, because the `layout` effects' reactive commit (queued on a microtask,
       `reactiveCommitQueued`, ~2356) closes the update. Otherwise call
       `motionDomProjection.commitLayoutIdChange(takeOver)`. Reset `layoutCommitCoversLayoutIdChange`.
     - Else, if `current === undefined && scopedLayoutId !== undefined` (an id gained while `MeasureLayout`
       mounts, upstream `componentDidMount` 133-134), call `motionDomProjection.switchLayoutId(scopedLayoutId)?.()`
       and then `motionDomProjection.didMount()`.
       Two things here look like ordering problems but aren't, so don't STOP on them. On an id gain, the `layout`
       pre-effect's mount tracker may already have called `didMount()` in this flush (2196-2200: `pass ===
       'mount'`). And upstream's `componentDidMount` calls `root.didUpdate()` (125-127) **before**
       `switchLayoutId` (133-134). Both are harmless: `root.didUpdate()` only schedules the update pass on
       motion-dom's microtask (`create-projection-node.ts:881-886 @ v14.7.1`, coalesced by `updateScheduled`), so
       the pass runs after this effect has switched stacks. A second `didMount()` is coalesced the same way.
     - In both gain cases, run the registry fallback (below).
     - Update `measuredBeforeLayoutIdChange`.
2. **Registry fallback** for an id gained on a mounted element. Factor it into one local function and call it from
   the consume effect too. Read `const projection = motionDomProjection.projection` after the switch and the
   takeover. If the takeover found a live lead (it cleared `resumeFrom` and hid that lead) or
   `projection.resumeFrom?.snapshot` exists, motion-dom already has what it animates from: only drop the entry
   (`layoutIdRegistry.consume(scopedLayoutId, element)`, ignore the result). Otherwise, the old holder was removed
   from the DOM earlier in this flush, before it could be resumed from (Svelte teardown order). Behave exactly as
   the mount consume does: `const prev = layoutIdRegistry.consume(scopedLayoutId, element)`, and if `prev` is set
   and `!layoutProp`, call `commitObservedLayoutChange(prev.rect)`. To tell the two takeover outcomes apart,
   have the adapter's takeover closure report whether it hid a lead. One option is a
   `lastSwitchTookOver: boolean` field that `switchLayoutId`'s closure sets. Document whichever you choose.
3. **Consume effect** (2792-2809): make it the mount path only. It consumes once per mounted element, on its first
   `isLoaded === 'ready'` run. Record the element in a plain variable even when it has no id yet. Later id
   changes on the same element go through the pair above. Keep the comment block, add a line about #1411.
4. **Handoff-rect cleanup** (805-819): write the registry only if the element was really removed. Write the
   condition exactly as `if (!target.isConnected && rect && scopedLayoutId) {` so the Done-criteria grep finds it. An id change on an element that stays mounted is a stack switch, not a handoff. Add a comment
   citing the Svelte `old_values` behaviour and `layoutIdTeardown.svelte.spec.ts` (detached on removal).
5. `src/lib/utils/layoutId.ts` doc comment: the registry is written when an element with a `layoutId` is removed
   from the DOM. A `layoutId` change on a mounted element moves its projection node between motion-dom stacks
   instead (#1411). Behaviour unchanged.

**Verify**:

- `pnpm exec vitest run src/lib/html/__tests__ src/lib/utils/motionDomProjection.spec.ts src/lib/utils/layoutId.spec.ts src/lib/html/_MotionContainer.spec.ts`:
  all pass, including every Step 1a/1b case. Guard cases 6 and 11 pass. If 11 still fails, STOP and report.
- `PW_PORT=4216 pnpm exec playwright test e2e/layout-id`: all pass, old and new. The exception is
  "closing then shrinks the card into thumbnail two", see the STOP conditions.

### Step 4: TesterPanel on the tabs page

Give `src/routes/tests/layout-id/tabs/+page.svelte` a `TesterPanel` (`eyebrow="Motion 14.7.1 · #1411"`). Model it
on `src/routes/tests/drag/disable-from-ondrag/+page.svelte`, with `steps` that have "Do it" actions clicking
`#select-b` / `#select-a`, and a link to `?layout=true`. The live verdict comes from a rAF sampler, skipped under
`@isPlaywright=true`: after each click, record the new highlight's left edge for 1.2 s. Show **SLID ✓** if a
sample landed between 20% and 80% of the distance, **SNAPPED ✗** if every sample is at an end, and **HIDDEN ✗**
if the tab that gave up the id reports `visibility: hidden`. Put the verdict in the `summary` snippet.

**Verify**: `PW_PORT=4216 pnpm exec playwright test e2e/layout-id/tabs.spec.ts` passes (the panel renders nothing
under Playwright).

### Step 5: Guard suites, including the layout-toggle update

Run `PW_PORT=4216 pnpm exec playwright test e2e/layout-id e2e/layout e2e/independent-transforms e2e/animate-layout`.

Expected change: in `e2e/independent-transforms/layout-toggle.spec.ts`, the `toggle-layout-id` case
("stays accelerated when it is turned off and back on mid-animation") may now fail with a count of `0`.
That is upstream behaviour. Since 14.7.1 the render that removes a `layoutId` is an update (`motion/index.tsx`
keeps `MeasureLayout`, and `getSnapshotBeforeUpdate` calls `willUpdate()`), and `willUpdate()` demotes Motion's
accelerated transforms (`create-projection-node.ts:744-750 @ v14.7.1`, `demoteTransforms`). Re-enabling is still a
mount, with no `willUpdate()`. If, and only if, the failure is that count dropping to `0` after the off render:

- split the loop so `toggle-layout` keeps its assertion unchanged;
- rewrite `toggle-layout-id` as "removing layoutId is an update (#1411): it demotes the accelerated x, and
  re-enabling doesn't snapshot again". After `toggleOffOn()`, assert the count is `0` at every sample;
- update the page's doc comment (lines 11-25) to say the same, citing the two upstream files.

Any other failure in these suites: re-run that spec alone once. If it still fails, STOP.

### Step 6: Docs, changeset, gate

1. `docs/src/routes/docs/layout-animations/+page.svx`: replace "How it works" item 1 (line 82, "Only one element
   with a given `layoutId` should be mounted at a time") with the upstream model. One element leads each
   `layoutId`. A `layoutId` can change after mount: the element leaves the old id and joins the new one. Moving
   an id between mounted elements (`layoutId={selected ? 'highlight' : undefined}`) animates the new holder from
   the old one. An element taking an id from one that's still on screen takes over instantly and the other is
   hidden. Add a short "Tabs without conditional rendering" code example using the tabs pattern. Update the
   `layoutId` API row (line 161) to match.
2. `.changeset/layout-id-change-after-mount.md` (`patch`): "A `layoutId` that changes after mount now moves the
   element to the new id's shared layout, as in Motion 14.7.1 (#1411). Tabs can give `layoutId` only to the
   selected highlight, an open card can change its `layoutId`, and an element that takes an id from one on screen
   takes over without animating."
3. Gate: `pnpm build`, `pnpm check` (0 errors), `pnpm test:only` (all pass), `pnpm --dir docs build`,
   `pnpm --dir docs check` (0 errors),
   `PW_PORT=4216 pnpm exec playwright test e2e/layout-id e2e/layout e2e/independent-transforms e2e/animate-layout e2e/animate-presence e2e/drag e2e/reorder`
   (all pass; re-run a failing spec alone once and say so), `trunk fmt` + `trunk check` on every changed file (no
   new issues), `git diff --check` (clean), `git status` (only in-scope files). The docs build may rewrite the
   tracked `docs/static/r/animated-tabs.json`. Restore it, don't commit it.

## Test plan

- Red-first anchors: Step 1a cases 1-5, 7-10; Step 1b's `updateOptions` and `switchLayoutId` cases; e2e tabs
  (both), takeover, open-change "switches instantly" and "mid-open", and the Svelte-specific "changed away just
  before the swap". All fail before Step 2/3 and pass after.
- Guards: the four upstream `measureAfterSwap` cases, move-to-sibling, unit cases 6 and 11, all existing
  `e2e/layout-id/*`, `layoutIdTeardown.svelte.spec.ts`, `layoutId.spec.ts`, and the `MeasureLayout` mount tests in
  `_MotionContainer.spec.ts`.
- Ported without upstream's `layoutCrossfade={false}` (not a svelte-motion prop): move-to-sibling and unit case 6
  guard the takeover-hide path, not the crossfade-off hide. Add the crossfade-off variants when `layoutCrossfade`
  exists.
- Not ported: the StrictMode variants (no Svelte equivalent) and "takes a layoutId back from an exiting element"
  (no exiting projection node; see Out of scope).

## Done criteria

- [ ] `grep -n "switchLayoutId" src/lib/utils/motionDomProjection.ts src/lib/html/_MotionContainer.svelte` matches in both files
- [ ] The handoff cleanup has the guard: `grep -n "!target.isConnected && rect && scopedLayoutId" src/lib/html/_MotionContainer.svelte`
      prints a line inside the handoff-rect effect's cleanup. A bare `isConnected` grep already matches 3 times at
      baseline (735, 797, 863), so it proves nothing.
- [ ] `grep -n "get isMounted" src/lib/utils/motionDomProjection.ts` → one match
- [ ] All Step 1 tests exist; the RED ones failed before the fix (recorded in your report) and pass now
- [ ] `e2e/layout-id`, `e2e/layout`, `e2e/independent-transforms`, `e2e/animate-layout`, `e2e/animate-presence`,
      `e2e/drag`, `e2e/reorder` pass (layout-toggle changed only as Step 5 allows)
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; docs build and check pass; `trunk check` clean
- [ ] Five pages linked from `src/routes/+page.svelte`; the tabs page has a TesterPanel; docs and changeset updated
- [ ] No out-of-scope files modified

## STOP conditions

- `package.json` is not on motion-dom 14.7.1, or `needsShow` is missing from motion-dom's types.
- A Step 1 case marked RED passes before the fix.
- After Step 3, "closing then shrinks the card into thumbnail two" is the only failing e2e case. Report it with the
  recorded frames (`window.frames` from `closedAt`). Don't build a fix. Upstream reaches it through `relegate()`
  on an exiting card, which svelte-motion's clone exit doesn't have. The dispatcher decides between a follow-up
  plan and `test.fixme`.
- An existing `e2e/layout-id/*` spec fails twice after Step 3, or layout-toggle fails in any way other than the
  count dropping to `0` described in Step 5.
- Making a case pass seems to need changes in `layoutId.ts` behaviour, `presence.ts`, `PresenceChild.svelte`, or
  `_MotionContainer.svelte` regions outside those listed.
- The registry fallback (Step 3.2) and the motion-dom resume both animate the same change (two animations, or
  `onProjectionUpdate` firing twice for one change).

## Maintenance notes

- Two handoff mechanisms now meet. motion-dom stacks handle id changes on mounted elements, and resumes from
  holders that are still attached. The `layoutId` registry still bridges real removal, because Svelte detaches the
  DOM before teardown and motion-dom's unmount-time `willUpdate()` measures a detached element. A reviewer should
  check that Step 3.2's "motion-dom already has a source" test keeps the two from double-animating.
- `updateOptions` no longer writes `layoutId` once mounted. Code that needs to change a mounted node's id must go
  through `switchLayoutId`.
- Follow-ups deliberately left out: the `layoutCrossfade` prop, and shared-layout crossfades and relegation for
  elements exiting through `AnimatePresence`. The clone exit has no projection node. The 1935 crossfade cases in
  plan 007 hit the same gap.
- Plan 007 (same lane) adds `layoutRoot`/`layoutAnchor`/`layoutDependency` to the `setOptions` call that Step 2
  edits.
