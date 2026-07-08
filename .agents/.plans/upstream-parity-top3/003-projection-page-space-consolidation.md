# Plan 003: Make the motion-dom projection node authoritative (page-space measurement, retire the legacy FLIP path)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row in
> `.agents/.plans/upstream-parity-top3/README.md`.
>
> **Drift check (run first)**: `git diff --stat 634983b..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/projection.ts src/lib/utils/motionDomProjection.ts src/lib/utils/layout.ts src/lib/utils/layoutId.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **This is the highest-risk plan in the batch. It is deliberately structured
> as a spike (Steps 1-2) followed by a gated migration (Steps 3-6). Do not skip
> the spike.**

## Status

- **Priority**: P1 (execute LAST — after 001 and 002)
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 002-drag-transform-composition.md (the drag writer is the seam
  the projection deltas paint through)
- **Category**: tech-debt / migration (upstream parity)
- **Planned at**: commit `634983b`, 2026-07-08
- **Issue**: <https://github.com/humanspeak/svelte-motion/issues/437>

## Why this matters

svelte-motion currently runs **two projection systems side-by-side** for every
layout-capable element: a home-grown `ProjectionNode` (viewport-relative
measurement, simple FLIP) that is authoritative, and an adapter around upstream
motion-dom's real `HTMLProjectionNode` that only commits already-measured
changes. Because the legacy path measures viewport-relative and reads scroll
live, scrolling during a layout change can straddle the two reads — so a
scroll-suppression heuristic (`wasViewportScrolledSinceLastLayout`) silently
_skips_ layout animations after any viewport scroll, and offscreen elements snap
instead of animating. Upstream measures in scroll-invariant **page space**
(scroll cached per animation-id phase, subtracted in `measurePageBox`), so a
scroll can never produce a spurious delta and nothing needs suppressing. The
legacy path also lacks border-radius/box-shadow scale correction and true
shared-element crossfade — its own header says so. Consolidating on the
motion-dom node removes a whole class of heuristics, halves per-element
projection cost, and unlocks `layoutRoot`, `layout="x"/"y"`, and `layoutAnchor`
for free (upstream already implements them). This supersedes GitHub issues
#394, #396, #397, #415 and unblocks #315.

## Current state

Relevant files (all verified at commit `634983b`):

- `src/lib/html/_MotionContainer.svelte` (~2400 lines) — the container.
    - Lines ~352-369: both systems constructed per element:
        ```ts
        const projection = new ProjectionNode({
            parent: projectionParent,
            getScrollContainers: resolveLayoutScrollAncestors,
            getBaseTransform: () => userBaseTransform
        })
        setProjectionParent(projection)
        const motionDomProjection =
            typeof window !== 'undefined'
                ? new MotionDomProjectionAdapter({ parent: motionDomProjectionParent })
                : null
        ```
    - `measureLayoutRect()` (~line 402) calls `projection.measure()` — the
      **legacy** node seeds every FLIP delta (used at ~2197, 2247, 2281, 2302, 2369).
    - Lines ~2240-2310: the observer-driven commit path with the scroll heuristic:
        ```ts
        const rememberOffscreenScroll = () => {
            wasViewportScrolledSinceLastLayout = true
            ...
        }
        // in commitObservedLayout():
        if (!isDragActiveElement &&
            (wasViewportScrolledSinceLastLayout ||
             wasViewportOffscreenSinceLastLayout ||
             isViewportOffscreen(element!.getBoundingClientRect()))) {
            lastRect = measureLayoutRect()
            motionDomProjection?.finishAnimation()
            ...
            return   // <-- layout animation silently skipped
        }
        ```
        plus presence-hold/placeholder early-outs (`presenceLayoutHoldAttribute`,
        `data-presence-placeholder`, `data-presence-wait-hidden`) and a drag bypass
        that routes to `teardownDrag.adjustOrigin(...)` (~2287-2333).
    - Lines ~2170-2185: fallback branch runs `computeFlipTransforms` +
      `runFlipAnimation` (the legacy FLIP), then fires BOTH
      `projection.didUpdate()` and `motionDomProjection?.didUpdate()`.
- `src/lib/utils/projection.ts` — legacy node. Header comment
  (`KNOWN_LIMITATIONS`, ~line 30) admits: no FlatTree/path walk, no 4-phase
  propagate/resolve/calc/clean, **no scale-correction (border-radius/box-shadow)**,
  no relativeTarget/projectionDelta inheritance, layoutId not routed through
  projection nodes.
- `src/lib/utils/motionDomProjection.ts` (393 lines) — `MotionDomProjectionAdapter`
  wrapping upstream `HTMLProjectionNode`; parented into a tree; reads
  `node.options.layoutRoot` (line 357) but only ever _commits_ observed changes
  (`commitObservedLayoutChange`) — never the measurement source of truth.
- `src/lib/utils/layout.ts` — `measureRect()` (~242-275): `getBoundingClientRect()`
    - live `window.scrollX/Y` + ancestor `scrollLeft/Top` sums. No phase caching.
- `src/lib/utils/layoutId.ts` — one-shot snapshot/consume registry for shared
  elements (single-element FLIP from outgoing rect; no crossfade of two live
  elements).

Upstream reference (read all three before the spike):

- `~/Github/motion/packages/motion-dom/src/projection/node/create-projection-node.ts`
    - `updateScroll(phase)` (~941-964): caches scroll per `root.animationId` +
      phase ("measure"/"snapshot").
    - `measure()`/`measurePageBox()` (~998-1042): viewport box minus root scroll
      offset → page space; `removeElementScroll` (~1044-1075) removes ancestor
      `layoutScroll` offsets. Snapshot and measure share the cached offset, so
      scroll cancels exactly.
    - `willUpdate`/`update`/`notifyLayoutUpdate` (~682-788): snapshot + delta
      cascade across the node tree (this is what keeps dragged nodes and children
      coupled under mutations).
- The Svelte bridge constraint: Svelte runes have no React-style
  pre-render/post-render pair, which is why the DOM-observer bridge exists
  (comment at `_MotionContainer.svelte:~2235`). The migration keeps the observer
  bridge but changes WHAT it measures, not WHEN.

Repo conventions: heavy why-comments with issue refs; characterization-first for
risky changes; e2e suites under `e2e/layout`, `e2e/layout-id`, `e2e/reorder`,
`e2e/animate-presence`, `e2e/projection` are the safety net.

## Commands you will need

| Purpose     | Command                                                             | Expected |
| ----------- | ------------------------------------------------------------------- | -------- |
| Typecheck   | `pnpm check`                                                        | exit 0   |
| Unit tests  | `pnpm test`                                                         | all pass |
| Layout e2e  | `pnpm exec playwright test e2e/layout e2e/layout-id e2e/projection` | all pass |
| Full e2e    | `pnpm exec playwright test`                                         | all pass |
| Format/lint | `trunk fmt && trunk check`                                          | clean    |

e2e preview server pinned to port 4198. Full e2e is the gate for Steps 4-6.

## Scope

**In scope**:

- `src/lib/html/_MotionContainer.svelte` (measurement seeding, commit path,
  heuristic removal)
- `src/lib/utils/motionDomProjection.ts` (promote to authoritative)
- `src/lib/utils/projection.ts` + `src/lib/components/projection.context.ts`
  (retire at the end — deletion is the LAST step, gated on green e2e)
- `src/lib/utils/layout.ts` (only `measureRect`'s `includeViewportScroll` seam)
- `src/lib/utils/layoutId.ts` (only if the spike shows shared-element routing
  is required for green tests; otherwise defer)
- New test/demo routes under `src/routes/tests/projection/` and specs under
  `e2e/projection/`
- Docs: `docs/src/routes/docs/layout-animations/` (behavior notes; see Docs impact)

**Out of scope**:

- `src/lib/utils/drag.ts` internals beyond consuming Plan 002's writer API.
- AnimatePresence exit/enter sequencing (`presence.ts`) — the presence-hold
  attributes are consumed here but their semantics must not change.
- Adding new public props (`layoutRoot`, `layout="x"`, `layoutAnchor`) — those
  become trivial follow-ups AFTER this lands; do not bundle them in.
- Upstream `~/Github/motion` — read-only reference.

## Git workflow

- Branch: `feat/projection-page-space`
- Conventional commits per step, e.g.
  `test(projection): characterize scroll-during-layout behavior`,
  `feat(projection): page-space measurement via motion-dom node`,
  `refactor(projection): retire legacy ProjectionNode`.
- Do NOT push or open a PR; maintainer signs off on live demos first.

## Steps

### Step 1: Characterization tests for today's heuristic behavior

Create `src/routes/tests/projection/scroll-during-layout/+page.svelte`: a tall
page with a layout-animated element (toggle button swaps its slot) below the
fold. e2e spec `e2e/projection/scroll-during-layout.spec.ts` with cases:

1. Trigger layout change with NO scroll → element animates (samples over ≥4
   frames show intermediate positions). Should PASS today.
2. Scroll the viewport, then trigger layout change → **document today's
   behavior** (the suppression heuristic snaps it). Write the assertion for the
   DESIRED upstream behavior (it animates) and mark it `test.fail()` so the
   suite encodes "known divergence" — flipping to pass is the Step 4 gate.
3. Element scrolled fully offscreen, trigger layout change, scroll back →
   desired: no spurious animation, correct final rect. Also `test.fail()` if
   today's behavior differs.

**Verify**: `pnpm exec playwright test e2e/projection/scroll-during-layout.spec.ts`
→ case 1 passes; cases 2-3 are expected-fail entries.

### Step 2: Spike — instrument which path fires (report before migrating)

Add temporary instrumentation (console.debug behind a `data-` flag or a counter
on the adapter) to determine, for each existing demo suite
(`/tests/layout`, `/tests/layout-id`, `/tests/reorder`,
`/tests/animate-presence/layout-button`), whether the commit ran through
`motionDomProjection.commitObservedLayoutChange` or the legacy
`computeFlipTransforms` fallback.

Write the result into the batch README under "Spike findings" — a table:
demo → path taken. **If the motion-dom path is already authoritative for >50%
of flows, the migration is cheaper than planned; if it is nearly never taken,
flag effort as larger.** Remove instrumentation before proceeding.

**Verify**: spike table recorded in README; `git diff` shows no leftover
instrumentation.

### Step 3: Page-space measurement through the adapter

In `motionDomProjection.ts`, expose the upstream node's measured page-space box
(`projection.measure()` / `measurePageBox` equivalents on `HTMLProjectionNode`)
and scroll-phase caching (`updateScroll`). In `_MotionContainer.svelte`, change
`measureLayoutRect()` (~line 402) to source from the adapter when it exists
(keep the legacy call as SSR/no-window fallback for now). Route the observer
bridge's snapshot ("before") and measure ("after") through the same
animation-id/phase so scroll between them cancels — mirror upstream
`updateScroll(phase)` semantics; the observer callback marks the phase boundary.

**Verify**: `pnpm exec playwright test e2e/layout e2e/layout-id e2e/projection`
→ all pre-existing specs still pass (case-2/3 expected-fails may already flip —
if so, update them to plain tests).

### Step 4: Remove the scroll-suppression heuristic

Delete `wasViewportScrolledSinceLastLayout`, `wasViewportOffscreenSinceLastLayout`,
`rememberOffscreenScroll`'s early-outs, and the `isViewportOffscreen` skip in
`commitObservedLayout` (~2240-2310). Keep the presence-hold/placeholder
early-outs and the drag `adjustOrigin` branch (drag deltas now paint via Plan
002's writer). Update the stale bridge comments (~2235-2238, ~2287-2292).

**Verify**: Step 1 cases 2-3 flip to PASS (remove `test.fail()`).
`pnpm exec playwright test` (FULL suite) → green.

### Step 5: Route dragged-node pinning through didUpdate deltas

Replace the slot-change `adjustOrigin(previous-next)` computation
(~2302-2333) with the motion-dom node's `didUpdate` delta for the dragged
element (upstream: `VisualElementDragControls.ts:742-758` applies
`delta[axis].translate` to origin + axis value on both axes). The paint goes
through Plan 002's writer. Keep the Reorder double-fire guard semantics
(comment ~2287-2292) — the reorder e2e suite is the gate.

**Verify**: `pnpm exec playwright test e2e/reorder e2e/drag` → green, including
`siblings-flip.spec.ts` drift sampling.

### Step 6: Retire the legacy node (gated)

Only when Steps 3-5 are fully green: remove `ProjectionNode` construction from
`_MotionContainer.svelte`, delete `src/lib/utils/projection.ts` and
`projection.context.ts`, and remove `computeFlipTransforms`/`runFlipAnimation`
call sites that became dead. If ANY consumer outside `_MotionContainer.svelte`
still imports them (`grep -rn "from '\$lib/utils/projection'" src/`), STOP and
report instead of deleting.

**Verify**: `pnpm check` → 0 errors; `pnpm test` → pass;
`pnpm exec playwright test` (FULL) → green; `trunk fmt && trunk check` → clean;
`grep -rn "wasViewportScrolledSinceLastLayout" src/` → no matches.

## Test plan

- New e2e: `e2e/projection/scroll-during-layout.spec.ts` (3 cases, Step 1).
- Existing suites as regression gates per step: `e2e/layout`, `e2e/layout-id`,
  `e2e/projection`, `e2e/reorder`, `e2e/drag`, `e2e/animate-presence` — the
  presence-hold and Reorder edge cases live here; they encode the behavior the
  heuristics currently protect.
- Unit: extend `src/lib/utils/motionDomProjection.spec.ts` (create if absent)
  for page-space math: element at scrollY=500 measures the same page box before
  and after a 200px scroll between snapshot and measure phases.

## Done criteria

- [ ] `pnpm check` exits 0; `pnpm test` exits 0
- [ ] FULL `pnpm exec playwright test` exits 0
- [ ] `grep -rn "wasViewportScrolledSinceLastLayout\|wasViewportOffscreenSinceLastLayout" src/` → no matches
- [ ] `src/lib/utils/projection.ts` deleted (or a STOP report explains why not)
- [ ] Scroll-during-layout e2e cases pass as plain tests (no `test.fail()`)
- [ ] Spike findings table recorded in batch README
- [ ] `git status` clean outside in-scope list; README status row updated

## STOP conditions

Stop and report back if:

- Plan 002 is not DONE in the batch README — this plan depends on its writer.
- The spike (Step 2) shows the motion-dom adapter cannot express the presence
  hold/placeholder flows (AnimatePresence early-outs at ~2266-2285) — the
  presence interaction needs a maintainer decision, not improvisation.
- After Step 3, more than 3 existing e2e specs fail and two fix attempts don't
  recover them — the legacy heuristics are more load-bearing than mapped.
- `HTMLProjectionNode`'s API (motion-dom 12.42.2) lacks a public seam for
  phase-cached measurement from outside React's lifecycle — report the exact
  missing hook.
- Deleting `projection.ts` breaks imports outside `_MotionContainer.svelte`.

## Maintenance notes

- Follow-ups unlocked (file separately, do not bundle): `layoutRoot` prop
  (upstream option already read at `motionDomProjection.ts:357`), `layout="x"/"y"`,
  `layoutAnchor`, layoutId crossfade + border-radius/box-shadow scale correction
  via the upstream node's built-ins, and issue #326's Shadow DOM verification.
- Reviewer should scrutinize: AnimatePresence layout-button and reorder suites
  (the two consumers of the removed heuristics), and bundle size (the legacy
  node's deletion should offset adapter growth).
- Docs impact: **update `docs/src/routes/docs/layout-animations/`** — the
  current page documents (implicitly, via behavior) that layout animations skip
  after scroll; after this plan they don't. Add a "shared layout / layoutId"
  docs page as a follow-up once crossfade lands (tracked in the follow-ups
  above, not this plan).
