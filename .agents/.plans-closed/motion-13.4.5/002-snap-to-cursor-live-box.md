# Plan 002: Snap to cursor using the live element box and the transformed cursor point

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.4.5/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67815169..HEAD -- src/lib/utils/drag.ts src/lib/utils/drag.spec.ts e2e/drag/transform-page-point.spec.ts e2e/drag/controls.spec.ts docs/src/routes/docs/transform-page-point/+page.svx docs/src/routes/docs/drag/+page.svx`
> Plan 001 (same batch) touches `drag.spec.ts` by adding one test; that is
> expected drift. Any other change to the excerpts below → STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (behavior change under `transformPagePoint`; deletes ~120 lines of measurement bookkeeping)
- **Depends on**: none (can run in parallel with 001; if 001 landed first, rebase trivially)
- **Category**: bug (upstream parity) + tech-debt
- **Planned at**: commit `67815169`, 2026-09-28
- **Upstream reference**: Motion 13.4.5 — `~/Github/motion` commits `727d9e119` (failing test), `0a77319f5`, `4281b03fb` (fix, #3805); file `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`, method `snapToCursor`

## Why this matters

`dragControls.start(event, { snapToCursor: true })` centers the dragged element
under the pointer. Upstream Motion 13.4.5 rewrote how it's computed: it now
measures the element's **live** viewport box (`getBoundingClientRect` mapped
through `transformPagePoint`) and maps the **cursor's client point** through
`transformPagePoint` too. Before, it used the cached projection layout box and
the *raw* page point, which drifted on repeated drags with initial coordinates
(#3805) and ignored `transformPagePoint` for the cursor.

Our `drag.ts` carries ~120 lines of machinery that exists solely to reproduce
the *old* upstream formula (cached layout + measured-axis pairing + raw page
point), and a unit test that explicitly asserts the old result. svelte-motion's
policy is to match upstream exactly, so: port the new formula, delete the
machinery, and update tests/docs that pinned the old numbers. Net result: less
code and React-identical output under scaled parents (`MotionConfig transformPagePoint`).

## Current state

Files:

- `src/lib/utils/drag.ts` — drag gesture implementation (`attachDrag`).
- `src/lib/utils/drag.spec.ts` — unit tests; snap tests at ~lines 901–1248.
- `e2e/drag/transform-page-point.spec.ts` — e2e with hard-coded snap numbers (~line 651–665).
- `docs/src/routes/docs/transform-page-point/+page.svx` — line 90 documents the old behavior with numbers.

Existing helper already equal to upstream's `measureViewportBox(instance, transformPagePoint)` (`drag.ts:127-150`):

```ts
const getRect = (
    el: HTMLElement | null,
    transformPagePoint?: MotionTransformPoint
): Rect | null => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (transformPagePoint) {
        const topLeft = transformPagePoint({ x: r.left, y: r.top })
        const bottomRight = transformPagePoint({ x: r.right, y: r.bottom })
        return { top: topLeft.y, left: topLeft.x, right: bottomRight.x, bottom: bottomRight.y,
                 width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y }
    }
    ...
```

Snap machinery to delete (`drag.ts` ~779–897): types `SnapProjectionLayout`,
`SnapProjection`, `SnapVisualElement`; functions `readCurrentAxisValue`,
`captureProjectionAxisValues`, `observeProjectionMeasurements`,
`resolveCurrentProjectionCenter`; state `measuredProjection`,
`measuredProjectionLayout`, `measuredAxisValues`,
`stopProjectionMeasureListener`; plus the comment block starting
"A projection layout box is a cached measurement." KEEP `readNumericAxisValue`
(used by the release code at ~line 1128) and `authoredAxisChannel` if still
referenced elsewhere (check with grep).

Other call sites to remove:
- `drag.ts:~480` — `observeProjectionMeasurements()` inside `updateOptions`.
- `drag.ts:~1291` — `observeProjectionMeasurements()` before `attachPan(...)`.
- `drag.ts:~1848-1849` — `stopProjectionMeasureListener?.()` / `= null` in `teardown`.
- `untrackSvelte` import (`drag.ts:49`) — remove only if it becomes unused.

The snap site today (`drag.ts:1135-1162`):

```ts
        if (pendingSnapToCursor) {
            const projection = observeProjectionMeasurements()
            const projectionLayout = projection?.layout
            const rect = projectionLayout ? null : getRect(el, opts.transformPagePoint)
            const centerX = projectionLayout
                ? resolveCurrentProjectionCenter('x', projectionLayout, currentAxisValues.x)
                : (rect?.left ?? 0) + (rect?.width ?? 0) / 2
            const centerY = ...
            // (long comment claiming upstream uses the raw PAGE point)
            const rawPagePoint = { x: e.pageX, y: e.pageY }
            if (applyXAxis) applied.x += rawPagePoint.x - centerX
            if (applyYAxis) applied.y += rawPagePoint.y - centerY
            setXYImmediate(applied.x, applied.y)
            pwLog('[drag] snapToCursor', { el: EL_ID, applied: { ...applied } })
        }
```

`applied` is the offset over the authored base (`value = applied + base`), so
`applied += cursor - center` is equivalent to upstream's
`value.set(value.get() + cursor - center)`.

Upstream 13.4.5 (target semantics):

```ts
    private snapToCursor({ clientX, clientY }: PointerEvent) {
        const { drag } = this.getProps()
        const point = { x: clientX, y: clientY }
        const cursor = this.visualElement.getTransformPagePoint()?.(point) || point
        const box = this.visualElement.measureViewportBox()   // getBoundingClientRect → transformPagePoint
        eachAxis((axis) => {
            if (!shouldDrag(axis, drag, this.currentDirection)) return
            const axisValue = this.getAxisMotionValue(axis)
            const { min, max } = box[axis]
            axisValue.set((axisValue.get() || 0) + cursor[axis] - mixNumber(min, max, 0.5))
        })
    }
```

Note both cursor and box are **viewport (client)** coordinates — page scroll
cancels out. No projection layout, no page point.

Test that pins the OLD behavior (`drag.spec.ts:901`):
`it('uses the raw page point against the transformed projection center for controlled snap', ...)`
— stubs `node.projection.layout.layoutBox` x 200–240 / y 80–120, uses
`transformPagePoint: p => ({ x: p.x * 2, y: p.y * 2 })`, pointerdown at client
(130, 50), expects `{ x: -90, y: -50 }` and its comment says `(40, 0)` would be
"incorrect". Under upstream 13.4.5, `(40, 0)` is exactly the correct answer.

## Commands you will need

| Purpose       | Command | Expected on success |
| ------------- | ------- | ------------------- |
| Install       | `pnpm install --frozen-lockfile` | exit 0 |
| Focused unit  | `pnpm exec vitest run src/lib/utils/drag.spec.ts` | all pass |
| Full unit     | `pnpm test` | all pass |
| Typecheck     | `pnpm check` | 0 errors |
| Build+package | `pnpm build` | exit 0 |
| Focused e2e   | `pnpm exec playwright test e2e/drag/transform-page-point.spec.ts e2e/drag/controls.spec.ts --project=chromium` | all pass |
| Docs build    | `pnpm --dir docs build && pnpm --dir docs check` | exit 0 / 0 errors |
| Lint / format | `trunk check` / `trunk fmt` | no new issues / exit 0 |

E2E server: port **4198**; if already in use, never kill it — prefix
`PW_REUSE_SERVER=1`.

## Scope

**In scope**:

- `src/lib/utils/drag.ts`
- `src/lib/utils/drag.spec.ts` (snap tests region only)
- `e2e/drag/transform-page-point.spec.ts` (the snap numbers only)
- `docs/src/routes/docs/transform-page-point/+page.svx` (line ~90 sentence only)
- `.changeset/snap-to-cursor-live-box.md` (create)

**Out of scope**:

- `src/lib/utils/dragControls.ts` — the public `start(event, { snapToCursor })` API is unchanged.
- `src/lib/utils/motionDomProjection.ts` — projection itself is unchanged.
- `.agents/.plans/motion-config-transform-page-point/reference-fixture/**` — historical evidence; do not edit.
- Constraint / release / momentum code in `drag.ts`.

## Git workflow

- Branch `chore/motion-13.4.5` (shared batch branch). No new branch.
- Commits: `test(drag): expect snapToCursor to map the cursor through transformPagePoint`,
  then `fix(drag): snap to cursor using the live element box (Motion 13.4.5)`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red — rewrite the old-behavior test to upstream 13.4.5 expectations

In `drag.spec.ts`, rename the test at ~901 to
`'maps the cursor client point and live box through transformPagePoint for controlled snap'`.
Replace the projection stub with a `getBoundingClientRect` mock for that
element, returning `new DOMRect(100, 40, 20, 20)` (so, mapped ×2, the box is
x 200–240, y 80–120 → center (220, 100)). Keep `transformPagePoint` ×2 and
pointerdown client (130, 50) → mapped cursor (260, 100). Expected:
`{ x: 40, y: 0 }`. Update the comment to cite upstream
`VisualElementDragControls.snapToCursor` (Motion 13.4.5).

Also add a port of upstream's repeated-snap test
(`use-drag-controls.test.tsx`, "snapToCursor centres the element under the
pointer on every drag start"): element with bound `x`, `y` motion values and
authored initial `{ x: 100, y: 40 }`; mock its `getBoundingClientRect` as
`new DOMRect(500 + x.get(), y.get(), 100, 100)` (live box follows the
transform); `controls.start(pointerdown at client (50, 50), { snapToCursor: true })`
→ expect `x = -500`, `y = 0`; end the gesture; `x.set(-350); y.set(50)`; snap
again at (50, 50) → expect `x = -500`, `y = 0` again.
(Derivation: center = (500 + x + 50, y + 50); new x = x + 50 − (550 + x) = −500.)

**Verify**: `pnpm exec vitest run src/lib/utils/drag.spec.ts -t "controlled snap|every drag start"`
→ the rewritten test FAILS with received `{ x: -90, y: -50 }` (or the
projection-based value), expected `{ x: 40, y: 0 }`. The repeated-snap test
likely fails on the first snap too. If the rewritten test passes, STOP.

### Step 2: Port the upstream formula

Replace the snap block in `drag.ts` with:

```ts
        if (pendingSnapToCursor) {
            // Motion 13.4.5 `VisualElementDragControls.snapToCursor`: measure the
            // live box (a cached projection layout may or may not include the
            // drag transform) and map the cursor's client point through the
            // same transformPagePoint. Both are viewport coordinates.
            const clientPoint = { x: e.clientX, y: e.clientY }
            const cursor = opts.transformPagePoint?.(clientPoint) ?? clientPoint
            const rect = getRect(el, opts.transformPagePoint)
            if (rect) {
                if (applyXAxis) applied.x += cursor.x - (rect.left + rect.width / 2)
                if (applyYAxis) applied.y += cursor.y - (rect.top + rect.height / 2)
                setXYImmediate(applied.x, applied.y)
            }
            pwLog('[drag] snapToCursor', { el: EL_ID, applied: { ...applied } })
        }
```

Check `applyXAxis` / `applyYAxis` still match upstream's
`shouldDrag(axis, drag, this.currentDirection)` for the axis-lock case; they
already exist — leave them.

**Verify**: `pnpm exec vitest run src/lib/utils/drag.spec.ts -t "controlled snap|every drag start"` → both PASS.

### Step 3: Delete the obsolete machinery and its tests

1. Delete the symbols listed under "Snap machinery to delete" and the three
   other call sites. Run `grep -nE "observeProjectionMeasurements|measuredProjection|resolveCurrentProjectionCenter|captureProjectionAxisValues|stopProjectionMeasureListener|SnapProjection|SnapVisualElement|readCurrentAxisValue" src/lib/utils/drag.ts` → no matches.
2. In `drag.spec.ts`, rewrite the tests
   `'does not accumulate repeated controlled snaps with authored initial axis values'`
   and `'does not accumulate repeated controlled snaps from zero axis values'`
   to the live-box model (mock `getBoundingClientRect` to follow `x.get()`/`y.get()`
   as in Step 1) and keep their intent (repeat snaps give identical results).
3. Delete the tests that exist only for the removed bookkeeping:
   `'pairs a refreshed projection measurement with its then-current axis value'`
   and the `it.each(...)('pairs a base-only projection measurement with zero represented motion axes for $name', ...)` block.

**Verify**: `pnpm exec vitest run src/lib/utils/drag.spec.ts` → all pass; `pnpm check` → 0 errors (no unused imports/vars).

### Step 4: Update e2e and docs numbers

1. Run `pnpm build`, then `pnpm exec playwright test e2e/drag/transform-page-point.spec.ts e2e/drag/controls.spec.ts --project=chromium`.
2. Expected: `'matches scrolled controls snap and real layout displacement'`
   fails on `boundValues { x: -49, y: -436 }` (and the follow-up
   `{ x: 1, y: -406 }`), because the old numbers came from the old upstream
   formula (page point vs cached page-space layout). Compute the new expected
   values from the formula (`bound += transformPagePoint(client) − center(transformPagePoint(liveRect))`)
   using the fixture's transform, and confirm they equal what the test run
   reports. Replace the numbers; add a comment: "Motion 13.4.5 snaps in
   viewport space: the transformed client point against the live transformed box."
   The follow-up move expectation must equal new snap value + (50, 30) offset.
3. The other snap assertions (`expectPointNear(second.snapped, handlePoint)`,
   the controls.spec "does not creep across repeated drags" test) must pass
   unchanged — they assert the physical "element centered under cursor"
   outcome, which the new formula guarantees.
4. Docs: in `docs/src/routes/docs/transform-page-point/+page.svx` ~line 90,
   replace the sentence starting "Imperative `snapToCursor` also follows
   Motion's projection layout calculation..." with one stating that
   `snapToCursor` maps the pointer's client position and the element's live box
   through `transformPagePoint`, centering the rendered box under the cursor
   (Motion 13.4.5), with the new numbers if the page cites any.

**Verify**: focused e2e command → all pass; `pnpm --dir docs build && pnpm --dir docs check` → exit 0 / 0 errors.

### Step 5: Changeset + full gate

`.changeset/snap-to-cursor-live-box.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

`snapToCursor` now measures the element's live box and maps the pointer through `transformPagePoint`, matching Motion 13.4.5. Repeated snaps with initial coordinates no longer drift, and scaled parents snap exactly like React.
```

**Verify**: `trunk fmt`; `trunk check` (no new issues); `pnpm check`; `pnpm test`;
`pnpm exec playwright test e2e/drag --project=chromium` → all pass except pre-existing skips.

## Test plan

- Red anchor: the rewritten transformPagePoint snap unit test
  (`{-90,-50}` → `{40,0}`) and the ported repeated-snap test (−500, 0 twice).
- E2E: updated scrolled-snap numbers; unchanged physical-centering assertions
  in `transform-page-point.spec.ts` and `controls.spec.ts` guard the user-visible result.
- React confirmation is deferred to Plan 006 (needs Motion 13.4.5 on npm): the
  `drag-controls-snap-scrolled` case of the reference fixture must match.

## Done criteria

- [ ] Symbol grep in Step 3.1 → no matches
- [ ] `grep -n "e.pageX" src/lib/utils/drag.ts` → no match in the snap block
- [ ] `pnpm test` exit 0; `pnpm check` 0 errors
- [ ] Focused e2e pass; docs build/check pass
- [ ] `git diff --stat` touches only in-scope files; `drag.ts` net line count decreased
- [ ] README status row updated

## STOP conditions

- The rewritten Step 1 test passes on the current code.
- Physical-centering e2e assertions (`expectPointNear(...snapped, handlePoint)`)
  fail after the port — the formula is wrong for our coordinate spaces; report
  with the recorded rects.
- Removing the machinery breaks a non-snap test (something else depended on
  `observeProjectionMeasurements`).
- New e2e numbers can't be derived from the formula (off by more than 1px).

## Maintenance notes

- Our `getRect(el, transformPagePoint)` is now the single source for snap
  geometry, exactly like upstream's `measureViewportBox`. Don't reintroduce
  projection-layout reads here.
- If upstream later changes `snapToCursor` again, diff
  `VisualElementDragControls.ts` and port verbatim.
