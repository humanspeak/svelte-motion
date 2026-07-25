# Plan 001: Drag's axis writer goes through VE values (and the coalescing spec re-measures)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> any STOP condition occurs, stop and report — do not improvise. Update the
> status row in `.agents/.plans/drag-single-writer/README.md` when done.
> Required prior reading:
> `.agents/.plans-closed/visual-element-core/005-drag-layout-single-writer.md`
> (the deferred original + its revision notes) and
> `.agents/.plans-closed/visual-element-core/003-gestures-setactive.guard-report.md`
> (the mirror bridge this batch later deletes).
>
> **Drift check (run first)**: `git diff --stat 7eba0bd..HEAD -- src/lib/utils/drag.ts src/lib/utils/dragInertia.ts`
> Expect EMPTY (verified empty at planning, `bb99032`) — drag survived the
> whole visual-element-core batch untouched. Container/gestures changes
> since `7eba0bd` are expected and irrelevant to this drift check.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: HIGH — 80 signed-off drag/reorder e2e specs are the bar
- **Depends on**: none (first plan of the re-scope batch)
- **Category**: tech-debt (re-scope of visual-element-core 005 Step 2; #449 follow-up)
- **Planned at**: `04418be` (re-stamped: `bb99032` was squashed away by PRs #454/#457; drag-surface files verified byte-identical to `7eba0bd`; container line references may have shifted with #457's svgEffect removal — locate by grep), 2026-07-25

## Why this matters

Drag is the last writer outside the VisualElement: `setXYImmediate` composes
a transform string and writes `el.style.transform` up to three times per
change (sync, microtask, rAF) purely to win races against writers that no
longer exist — post-#449, the VE is the only other style writer, and it
composes transform from `latestValues`. Upstream drag writes axis
MotionValues from `visualElement.getValue('x'|'y')` and calls
`visualElement.render()` synchronously; the VE composes drag and gesture
channels TOGETHER, which is what later makes hover-during-drag/glide safe
(plan 002) and the container's mirror bridge deletable. This plan swaps the
write mechanism INSIDE `setXYImmediate` while keeping its signature and all
18 call sites (inertia, settle, origin adjustment, keyboard drag,
constraint rescale) — those simplify in later plans.

## Current state

(Verified at `bb99032`; `drag.ts` is byte-identical to `7eba0bd`.)

- **The writer** — `src/lib/utils/drag.ts:596-652` `setXYImmediate(x, y)`:

```ts
// drag.ts:603-604 — bound MotionValues stay the public source of truth (#421)
if (boundX && boundX.get() !== x) boundX.set(x)
if (boundY && boundY.get() !== y) boundY.set(y)
// drag.ts:633-649 — composed string written 3× to win writer races
composedTransform = buildDragTransform(latestValues, opts.getBaseTransform?.() ?? '', opts.transformTemplate) || 'none'
el.dataset.svelteMotionDragTransform = composedTransform
const writeComposedTransform = () => { ... el.style.transform = composedTransform }
writeComposedTransform(); queueMicrotask(writeComposedTransform); requestAnimationFrame(writeComposedTransform)
```

plus the rAF composer loop `startTransformComposer` (`:654-690`) that
re-runs `setXYImmediate` every frame while dragging.

- **The VE side (post-#449)**: every motion component owns a VisualElement;
  a page-bound style MotionValue IS the node's axis value (verified:
  `ve.values.get('y') === ve.props.style.y`), so `ve.getValue('x', 0)` /
  `ve.getValue('y', 0)` returns the correct writer handle whether or not
  the consumer bound one. `visualElementStore.get(element)` resolves the
  node (motion-dom export).
- **Upstream contract** —
  `~/Github/motion/packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`:
  `getAxisMotionValue` (`:544-556`) returns `_dragX/_dragY` or
  `visualElement.getValue(axis, latestValues[axis] ?? 0)`; writes via
  `axisValue.set(next)` (`:319-337`); synchronous `visualElement.render()`
  mid-drag (`:216`, `:658`, `:756`).
- **The container's mirror bridge** (plan-003 scaffolding this batch
  deletes in 002) — `_MotionContainer.svelte:1550-1570`: drag's
  `onVisualUpdate` mirrors composed channels into the node via
  `setStaticValue`, only for channels the node does not own. After this
  plan, drag WRITES the owned values directly, so the mirror becomes
  redundant — but it is deleted in plan 002, not here (keep the change
  surface minimal; verify it is a no-op rather than a fighter in Step 4).
- **The blocker this plan resolves** (from the archived 005 revision note):
  `e2e/drag/while-drag-write-coalescing.spec.ts` measures recompositions
  via a MutationObserver on `data-svelte-motion-drag-transform`. Deleting
  that attribute makes the `composesPerFrame <= 1.25` budget pass
  VACUOUSLY. This plan brings that spec into scope with a replacement
  measurement and an anti-vacuity guard.
- `crossAxisOffset` / unbound-axis pixel-offset logic (`:606-631`) and
  `adjustOrigin` (`:767-810`, ports upstream `:742-758`) must keep their
  semantics — they operate on the same x/y channels.
- Reorder (`src/lib/components/Reorder/Item.svelte:55-59,101-108`) passes
  bound x/y MotionValues via style — the `boundX.set()` path already IS the
  VE path for those; this plan unifies the unbound case with it.

## Commands you will need

| Purpose     | Command                                                                   | Expected      |
| ----------- | ------------------------------------------------------------------------- | ------------- |
| Typecheck   | `pnpm check`                                                              | 0 errors      |
| Unit        | `pnpm test:only`                                                          | all pass      |
| Drag e2e    | `pnpm test:e2e e2e/drag e2e/reorder`                                      | all pass      |
| Wider gate  | `pnpm test:e2e e2e/drag e2e/reorder e2e/motion e2e/layout e2e/projection` | all pass      |
| Format/lint | `trunk fmt` / `trunk check`                                               | no new issues |

## Scope

**In scope**:

- `src/lib/utils/drag.ts` (the write mechanism inside `setXYImmediate` +
  `startTransformComposer`; nothing else in the file)
- `e2e/drag/while-drag-write-coalescing.spec.ts` (re-measurement ONLY — the
  budget value and the spec's intent are untouchable)
- `src/lib/utils/drag.spec.ts` (assertions pinning the triple-write/dataset
  mechanics — update to pin the new mechanism, justify each in NOTES)
- `.agents/.plans/drag-single-writer/README.md`

**Out of scope**:

- The container (`_MotionContainer.svelte`) — including the mirror bridge
  (plan 002's deletion) and the `liveGestureTransform` channel.
- `gestures.ts` dataset guard (plan 002), `dragInertia.ts` (plan 003),
  `pan.ts` (plan 004), `layout.ts` (plan 005).
- `whileDrag` animation paths inside `drag.ts` (`startWhileDrag`/
  `endWhileDrag`) — plan 002.
- Any public type or the `dragControls` API.

## Git workflow

- Branch off the current integration branch (operator names it at
  dispatch); conventional commits (`feat(drag): …`); never push; never
  reset past commits you did not author; WIP commit before any large
  surgery (the 002-batch lesson).

## Steps

### Step 1: Characterization baseline (mandatory)

`pnpm test:only` + `pnpm test:e2e e2e/drag e2e/reorder` — record counts.
Read `while-drag-write-coalescing.spec.ts` and `drag.spec.ts` fully first.

**Verify**: all green; counts recorded.

### Step 2: Re-measure the coalescing spec FIRST (behavior-preserving)

Before touching `drag.ts`: change the spec's measurement from the dataset
attribute to a `MutationObserver` on the element's `style` ATTRIBUTE
(`attributeFilter: ['style']`, `attributeOldValue: true`, counting only
mutations where the transform substring changed). Add an ANTI-VACUITY
assertion: the observer must record at least N mutations during the scripted
drag (derive N from the baseline run; a zero-sample run must FAIL). Keep the
`composesPerFrame <= 1.25` budget identical.

**Verify**: the spec passes against the UNCHANGED legacy writer (the style
attribute is still written per compose) — proving the new measurement
observes the same behavior the old one did. If the legacy writer's triple
write makes the new measurement exceed budget, STOP and report the numbers
(the budget may have been implicitly measuring dataset writes, not style
writes — that is a finding, not something to tune away silently).

### Step 3: Swap the write mechanism inside `setXYImmediate`

Resolve the node once per attach: `const node = visualElementStore.get(el)`.
Rewrite the write path: axis values via `node.getValue('x', 0)` /
`node.getValue('y', 0)` — for bound axes these ARE `boundX`/`boundY`
(assert identity in dev, see Step 5) — written with `.set()`, offsets and
`crossAxisOffset` applied to the same channels; then a synchronous
`node.render()` (upstream `:216`). Delete: the composed-string build, the
`data-svelte-motion-drag-transform` dataset write, the triple
write-microtask-rAF dance, and the `startTransformComposer` rAF loop (the
VE renders on value changes; the per-frame loop is redundant). KEEP the
`data-svelte-motion-drag-active` flag writes — plan 002 owns that guard.
`transformTemplate` composition is the VE's job (`props.transformTemplate`,
already carried since #449).

**Verify**: `pnpm test:e2e e2e/drag` → all pass, including the re-measured
coalescing spec (now counting VE style writes) and
`drag/brutalist-stage` + `drag/mobile-drawer` (the mirror-bridge pages).

### Step 4: Prove the mirror bridge is now a no-op

With drag writing owned values, the container's `onVisualUpdate` →
`setStaticValue` mirror (`_MotionContainer.svelte:1550-1570`) should
receive values identical to what the node already holds. Add a TEMPORARY
probe (console.assert or pwLog) confirming zero mismatched mirror writes
across the drag suites, then REMOVE the probe. Record the result in NOTES —
it is plan 002's license to delete the bridge.

**Verify**: probe output clean over `e2e/drag e2e/reorder`; probe removed.

### Step 5: Unit updates + full gate

Update `drag.spec.ts` assertions that pinned the deleted mechanics to pin
the new ones (axis-value writes + render scheduling), keeping every
BEHAVIORAL assertion (positions over time, velocity continuity) intact.
Then `trunk fmt` → `trunk check` → `pnpm check` → `pnpm test:only` →
`pnpm test:e2e e2e/drag e2e/reorder e2e/motion e2e/layout e2e/projection`.

**Verify**: all green, matching Step 1 baseline.

## Test plan

- No red-first test: behavior-preserving migration; Step 1's baseline is
  the pin and Step 2 hardens the coalescing spec BEFORE the swap so it
  cannot pass vacuously.
- Updated unit specs keep behavioral assertions; mechanism assertions are
  re-pointed, each justified in NOTES.

## Done criteria

- [ ] `pnpm check` exits 0; `trunk check` no new issues
- [ ] `pnpm test:only` exits 0
- [ ] Five-suite gate exits 0, matching baseline
- [ ] `grep -n "svelteMotionDragTransform\|queueMicrotask(writeComposedTransform)\|startTransformComposer" src/lib/utils/drag.ts` → no matches
- [ ] `grep -n "svelteMotionDragActive" src/lib/utils/drag.ts` → STILL present (plan 002's target)
- [ ] The coalescing spec measures style-attribute mutations with an
      anti-vacuity minimum-sample assertion, budget unchanged
- [ ] Step 4's mirror no-op result recorded in NOTES
- [ ] README status row updated

## STOP conditions

- Drift in `drag.ts`/`dragInertia.ts` since `7eba0bd`.
- Step 2's re-measured spec fails against the LEGACY writer (measurement
  mismatch finding — report numbers, do not tune the budget).
- Any drag/reorder e2e regression surviving two focused fix attempts —
  BLOCKED with a clean report beats a regression in signed-off drag.
- `node.render()` synchronous calls interact badly with the projection
  node during layout animations (watch `e2e/layout e2e/projection`) — if
  blocking, report; do not add render-suppression heuristics.
- You need `_dragX`/`_dragY`-style private props — public-API design,
  report instead.

## Maintenance notes

- Plans 002–005 build directly on the new write path; keep
  `setXYImmediate`'s signature stable in this plan.
- Reviewer: scrutinize velocity continuity on release (the #413 contract),
  constraint rescale on resize, reorder item coupling, and the re-measured
  spec's anti-vacuity guard.
