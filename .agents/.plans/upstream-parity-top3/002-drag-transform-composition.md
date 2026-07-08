# Plan 002: Compose the full transform during drag via upstream buildTransform semantics

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-parity-top3/README.md`.
>
> **Drift check (run first)**: `git diff --stat 634983b..HEAD -- src/lib/utils/drag.ts src/lib/utils/interaction.ts src/lib/html/_MotionContainer.svelte`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (Plan 003 builds on the writer introduced here)
- **Category**: bug (upstream parity / correctness)
- **Planned at**: commit `634983b`, 2026-07-08
- **Issue**: <https://github.com/humanspeak/svelte-motion/issues/436>

## Why this matters

While a drag is active, svelte-motion rebuilds `element.style.transform` every
animation frame from **only** `translateX/translateY + scale + a static base
transform`. Upstream Motion routes whileDrag/whileHover through the visual
element's animation state and one shared `buildTransform()` that composes every
transform channel (rotate, rotateX/Y/Z, skew, perspective, transformTemplate)
with live values. Result today: `whileDrag={{ rotate: 8 }}`, `rotateX`, `skew`,
or `perspective` values are clobbered mid-drag (flicker or vanish entirely), and
`transformTemplate` is only evaluated against static style values. Additionally,
cross-axis pinning compensation (a `drag="x"` element whose layout slot shifts
vertically) is bookkept in `origin` but never painted — the element visibly
drifts until release. This closes GitHub issue #403 and the cross-axis paint gap
from #396.

## Current state

Relevant files:

- `src/lib/utils/drag.ts` — the drag gesture. Key sections (verified at
  commit 634983b):
    - `setXYImmediate` (~line 550) builds the transform from translate+scale only:
        ```ts
        // src/lib/utils/drag.ts:~550
        const parts: string[] = []
        if (dragX && !boundX) parts.push(`translateX(${x}px)`)
        if (dragY && !boundY) parts.push(`translateY(${y}px)`)
        const scalePart =
            managedScaleActive && Math.abs(managedScale - 1) > 0.0001
                ? `scale(${managedScale})`
                : ''
        const liveTransform = [...parts, scalePart].filter(Boolean).join(' ')
        ...
        const baseTransform = opts.getBaseTransform?.() ?? ''
        el.style.transform = [liveTransform, baseTransform].filter(Boolean).join(' ')
        ```
        The write runs synchronously + via microtask + rAF (the "no-lag" path, #379),
        and dual-writes bound MotionValues (#421). **Preserve both behaviors.**
    - `startTransformComposer` (~line 591) re-runs `setXYImmediate` every rAF while
      dragging — this is what clobbers externally animated transform channels.
    - `startWhileDrag` (~line 735) splits `scale` into `managedScale` and animates
      remaining whileDrag keyframes (rotate, skew, …) via motion-dom
      `animate(el, nativeKeyframes)` — those writes land on `el.style.transform`
      and are overwritten by the composer each frame. This is the bug.
    - `adjustOrigin` (~line 707) updates `origin.x/origin.y` on both axes but the
      visual write only paints dragged axes (`setXYImmediate` emits translate only
      for `dragX`/`dragY` axes) — cross-axis compensation is unrendered. The
      in-code comment explicitly defers this ("finalized when this hook is wired
      in #310").
- `src/lib/html/_MotionContainer.svelte` — supplies `getBaseTransform` (static
  serialized style transform incl. transformTemplate output, ~line 1592) and the
  drag/projection bridge (~lines 2287-2333) that calls `adjustOrigin` on layout
  slot changes under an active drag.
- `src/lib/utils/interaction.ts` — hover/tap gesture composition; check for the
  same partial-rebuild pattern for hover scale (issue #403 claims hover composes
  from translate/scale/rotate only) and align it with the same writer if found.

Upstream reference (read before implementing):

- `~/Github/motion/packages/motion-dom/src/render/html/utils/build-transform.ts:20-90`
  — `buildTransform` iterates the full `transformPropOrder`
  (x/y/z, scale/scaleX/Y, rotate/rotateX/Y/Z, skew/skewX/Y, perspective) and runs
  `transformTemplate` against the **live** transform map every render.
- `~/Github/motion/packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts:742-758`
  — on projection `didUpdate`, applies `delta[axis].translate` to both
  `originPoint` and the axis motion value for **both axes** unconditionally,
  then renders.

Repo conventions:

- Extensive "why" comments with issue references (#379/#421/#310) — the existing
  comments in `drag.ts:534-589,700-725` assert the current behavior is
  intentional/deferred. **Update these comments in lockstep with the fix** —
  after this plan they would be stale ADRs.
- `motion-dom` is a direct dependency (v12.42.2) — prefer importing its
  `buildTransform`/`transformPropOrder` over reimplementing.

## Commands you will need

| Purpose     | Command                                          | Expected on success |
| ----------- | ------------------------------------------------ | ------------------- |
| Typecheck   | `pnpm check`                                     | exit 0              |
| Unit tests  | `pnpm test`                                      | all pass            |
| Drag e2e    | `pnpm exec playwright test e2e/drag e2e/reorder` | all pass            |
| Format/lint | `trunk fmt && trunk check`                       | clean               |

e2e preview server is pinned to port 4198 — do not change.

## Scope

**In scope**:

- `src/lib/utils/drag.ts`
- `src/lib/utils/interaction.ts` (only the hover transform-composition path, if
  the partial-rebuild pattern is confirmed there)
- `src/lib/html/_MotionContainer.svelte` (only `getBaseTransform` plumbing and
  the `adjustOrigin` call site, if signatures change)
- `src/lib/utils/drag.spec.ts` / `src/lib/utils/interaction.spec.ts` (extend)
- `src/routes/tests/drag/while-drag-transforms/+page.svelte` (create demo)
- `src/routes/+page.svelte` (link demo)
- `e2e/drag/while-drag-transforms.spec.ts` (create)

**Out of scope**:

- The projection/FLIP measurement system (`projection.ts`,
  `motionDomProjection.ts`, the observer bridge) — that is Plan 003.
- Drag physics/inertia (`motion-dom` handles it; landed in #399).
- The MotionValue dual-write behavior (#421) and the synchronous no-lag write
  (#379) — these must be **preserved**, not redesigned.
- Public API/type changes — none needed.

## Git workflow

- Branch: `fix/drag-transform-composition`
- Conventional commits, e.g. `fix(drag): compose full transform during drag via buildTransform`
- Do NOT push or open a PR; maintainer signs off on live demos first.

## Steps

### Step 1: Characterization tests (write first, watch them fail)

Create `e2e/drag/while-drag-transforms.spec.ts` + demo route
`src/routes/tests/drag/while-drag-transforms/+page.svelte` with three cases:

1. `drag whileDrag={{ rotate: 8 }}` — start a drag, hold pointer down, sample
   `getComputedStyle(el).transform` across ≥5 frames; assert the decomposed
   rotation stays ~8deg (it currently drops to 0 — test fails).
2. `drag="x"` element with a button that inserts content **above** it mid-drag —
   assert the element's viewport Y stays pinned (±2px) after insertion (currently
   drifts — test fails).
3. `whileDrag={{ rotateX: 30 }}` with a `perspective` in style — assert the
   matrix3d persists during drag frames.

Model multi-frame sampling after `e2e/reorder/siblings-flip.spec.ts:28-42`
(the samples-array pattern).

**Verify**: `pnpm exec playwright test e2e/drag/while-drag-transforms.spec.ts`
→ new tests FAIL for the documented reasons (rotation dropped, Y drift). If any
unexpectedly PASS, STOP — the premise has drifted.

### Step 2: Introduce a full-composition transform writer in `drag.ts`

Replace the string-splicing inside `setXYImmediate` with a writer that:

1. Maintains a live transform-values map for the element: drag translate for
   dragged axes, managed scale, **plus** the current values of any whileDrag
   animated transform channels (read them from the motion-dom animation's
   values or from a `latestValues` record updated by the whileDrag `animate`
   call in `startWhileDrag` — prefer subscribing to the animation's values so
   the composer never reads the DOM).
2. Adds cross-axis compensation offsets (from `adjustOrigin`) as translate on
   the **non-dragged** axis so they actually paint.
3. Builds the final string via `buildTransform`-compatible ordering
   (import `buildTransform`/`transformPropOrder` from `motion-dom` if exported;
   otherwise mirror the order and cite the upstream file in a comment), and
   runs the user's `transformTemplate` against the live map (thread the
   template through `opts` from `_MotionContainer` — today only its static
   output arrives via `getBaseTransform`).
4. Keeps: synchronous + microtask + rAF write scheduling, the
   `data-svelte-motion-drag-transform` guard, bound-MotionValue dual-writes,
   and the "empty transform → don't clobber styleEffect" branch (#421).

Update the now-stale comments (#379/#421/#310 blocks) to describe the new
composition.

**Verify**: `pnpm test` → drag unit tests pass; e2e case 1 and 3 from Step 1 now
PASS.

### Step 3: Paint cross-axis `adjustOrigin` compensation

In `adjustOrigin` (~drag.ts:707): route the cross-axis delta into the writer's
values map (from Step 2) instead of only bookkeeping `origin`. Delete the
comment that defers this to #310.

**Verify**: e2e case 2 (insertion above active `drag="x"`) → PASSES.
`pnpm exec playwright test e2e/drag e2e/reorder` → **all existing drag/reorder
specs still pass** (this is the regression gate — the no-lag pin behavior of
#379 is covered by `e2e/reorder/siblings-flip.spec.ts` drift sampling).

### Step 4: Align hover composition (conditional)

Inspect `src/lib/utils/interaction.ts` for the hover-scale composer described in
issue #403 ("rebuilds transforms from only translate/scale/rotate"). If present,
route it through the same writer/ordering. If hover already flows through
motion-dom animations without a rebuild path, record "hover already conformant"
in the batch README and skip.

**Verify**: `pnpm test src/lib/utils/interaction.spec.ts` → pass; add one unit
case: hover scale + preexisting `rotateX` style survives hover enter/leave.

### Step 5: Full gates

**Verify**: `pnpm check && pnpm test` → exit 0;
`pnpm exec playwright test e2e/drag e2e/reorder` → pass;
`trunk fmt && trunk check` → clean.

## Test plan

- e2e (new, Step 1): whileDrag rotate persistence, cross-axis pin under
  insertion, rotateX/perspective persistence — multi-frame sampled while pointer
  is down.
- Unit (extend `drag.spec.ts`): writer composes rotate+skew+translate in
  upstream order; transformTemplate receives live values; empty-map guard
  preserved.
- Regression: entire `e2e/drag/` + `e2e/reorder/` suites must stay green —
  they encode #379/#401/#421 behavior.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test` exits 0 with new unit cases
- [ ] `pnpm exec playwright test e2e/drag e2e/reorder` exits 0, including the 3
      new characterization tests
- [ ] `grep -n "only updates \`origin\`" src/lib/utils/drag.ts` returns no match
      (stale deferral comment removed)
- [ ] `git status` clean outside in-scope list
- [ ] Batch README status row updated

## STOP conditions

Stop and report back if:

- Step 1 characterization tests unexpectedly pass (premise drifted).
- Preserving the same-frame pin (#379) is impossible through the new writer —
  i.e. `siblings-flip.spec.ts` drift sampling regresses twice after fix attempts.
- The fix requires modifying the projection measurement path
  (`projection.ts`/`motionDomProjection.ts`) — that's Plan 003; report the
  coupling instead.
- `buildTransform` is not importable from `motion-dom` AND mirroring its
  ordering requires >50 lines of duplication — report for a maintainer decision.

## Maintenance notes

- Plan 003 (projection consolidation) will route dragged-node pinning through
  motion-dom `didUpdate` deltas; the writer introduced here is the seam it will
  write into. Keep the writer's values-map API small and documented.
- Reviewer should scrutinize: frame-timing (no added frame of drag lag — compare
  against `e2e/reorder/siblings-flip.spec.ts` drift numbers), and the #421
  bound-MotionValue paths.
- Docs impact: **none for public API** (no new props). The gestures/drag docs
  pages need no change; in-code decision comments ARE the doc surface here and
  must be updated (Step 2/3).
