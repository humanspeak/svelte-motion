# Plan 005: Type, document and test the Motion 14.10 drag additions (`drag()` x/y, `immediate`, `getProps`)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Drift check (run first)**: `git diff --stat f93a1d92..HEAD -- src/lib/index.ts src/lib/types.ts src/lib/utils/dragControls.ts src/lib/utils/dragControls.spec.ts src/routes/tests/drag e2e/drag docs/src/routes/docs/drag docs/src/lib/examples/vanilla-drag docs/src/routes/examples/vanilla-drag src/routes/+page.svelte`
> Expected changes are plan 001's (the press type block in `src/lib/index.ts`) and possibly plan 002's (`MotionProps` tap props in `src/lib/types.ts`). If anything else changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: 001 (the 14.10.1 motion-dom runtime and types for `DragOptions.x/y`, `DragControlOptions.immediate`, `DragConstraintsContext.getProps`)
- **Wave**: 2
- **Category**: dx / docs / tests
- **Planned at**: commit `f93a1d92`, 2026-11-06

## Why this matters

Motion 14.10 added three drag capabilities:
- **`x`/`y` motion values on vanilla `drag()`**: headless drag that drives a value, like a dial, without moving the element.
- **`immediate` on `dragControls.start()`**: start a drag without waiting for the pointer to move. Reorder.Board uses this to continue a drag on a new element.
- **`getProps()` on the `dragConstraints` function context.**

All three reach our users at runtime through the pin bump, because we re-export motion's `drag` and use motion-dom's `VisualElementDragControls`. But:
- Upstream's headline example probably doesn't type-check with *our* `motionValue()`.
- None of the three is documented.
- Nothing tests that function constraints work through our `motion.div` at all.

## Current state

- **Upstream** (local clone `~/Github/motion`, tag `v14.10.1`):
  - `packages/motion-dom/src/gestures/drag/index.ts` adds `x?: MotionValue<number>` and `y?: MotionValue<number>` to `DragOptions`. Its doc example: `const x = motionValue(0); x.on("change", (v) => (dial.style.rotate = v + "deg")); drag(dial, { axis: "x", x })`. Internally they map to `_dragX`/`_dragY`, and the element itself doesn't move.
  - `packages/motion-dom/src/gestures/drag/types.ts` adds `getProps: VisualElementDragControls["getProps"]` to `DragConstraintsContext`, documented as "The drag's options, e.g. `drag` for the axes it moves". Test: `packages/motion-dom/src/gestures/drag/__tests__/point-constraint.test.ts:99`, `expect(calls.contexts[0].getProps().drag).toBe("x")`.
  - `immediate` (commit `2798c57d3`): `VisualElementDragControls.start(event, options)` now forwards all options to `PanSession`. With `immediate: true`, the pan starts synchronously, so a release before any pointer move still ends the drag and fires `onDragEnd`. Test: `packages/motion-dom/src/gestures/pan/__tests__/PanSession.test.ts`, `describe("PanSession immediate")`.
  - Upstream drag tests for `x`/`y`: `packages/motion-dom/src/gestures/drag/__tests__/drag.test.ts`, for example "writes to the motion values instead of moving the element".
- **Ours**:
  - `src/lib/index.ts:25-40` re-exports `drag` unchanged from `'motion'`. `:46-51` re-exports `DragConstraintsContext`, `DragConstraintsFunction`, `DragOptions` and `DragPointConstraint` types from `'motion-dom'`.
  - Our `motionValue`/`useMotionValue` return `AugmentedMotionValue<T>`, defined in `src/lib/utils/augmentMotionValue.svelte.ts:21` as `Omit<MotionValue<T>, 'current'> & { readonly current: T; subscribe… }`. `src/lib/utils/transform.svelte.ts:126-137` explains that it "isn't structurally assignable" to motion-dom's `MotionValue` in public signatures, and defines `export type AnyMotionValue<T> = MotionValue<T> | AugmentedMotionValue<T>`.
  - The precedent for re-typing a motion export without wrapping it at runtime is `src/lib/utils/effects.ts:98`, `export const createEffect = createEffectCore as { … } & typeof createEffectCore`. `animate` is handled the same way in `src/lib/utils/animateValue.ts`, which `index.ts:55-58` re-exports with the comment "re-typed to accept both raw and Svelte-augmented motion values (runtime passthrough …)".
  - `src/lib/types.ts:585-602` is the `DragControls` type. Its `start` JSDoc lists only `snapToCursor` and `distanceThreshold`:
    ```ts
    /**
     * Start a drag gesture on every subscribed element.
     *
     * @param event The pointer event that starts the drag.
     * @param options `snapToCursor` centres the element on the pointer;
     *     `distanceThreshold` sets how far the pointer must travel before the drag starts.
     */
    start: (event: PointerEvent, options?: DragControlOptions) => void
    ```
  - `src/lib/utils/dragControls.ts:36-60`: `createDragControls().start(event, options)` forwards `options` unchanged to each `VisualElementDragControls.start`. So `immediate` works at runtime, and its type comes from motion-dom's `DragControlOptions`.
  - Function `dragConstraints` reaches motion-dom unchanged: `src/lib/types.ts:536-547` (the `DragConstraints` union includes `DragConstraintsFunction`), and `_MotionContainer.svelte:706` passes `dragConstraintsProp` into the props given to `VisualElementDragControls`. Nothing in `src/routes/tests`, `e2e` or `docs` uses a function constraint (`grep -rn "DragConstraintsFunction\|originPoint\|getAxisMotionValue" src/routes e2e docs/src` → nothing).
  - Tests and pages to copy:
    - `src/routes/tests/drag/vanilla/+page.svelte`. Note its `data-testid`s and `readX` helper; its doc comment lists modes `axis`, `handoff`, `container` and `motion-plus-drag`.
    - `e2e/drag/vanilla.spec.ts`, with the `readTranslate` and `dragBy` helpers at `:1-27`.
    - `e2e/drag/controls.spec.ts` with `src/routes/tests/drag/controls/+page.svelte`.
    - `src/lib/utils/dragControls.spec.ts`, for example the test at `:65` that checks `distanceThreshold` is passed through.
  - Docs, `docs/src/routes/docs/drag/+page.svx`:
    - `## Constraints` (`:49`) has `### Pixel constraints` and `### Element constraints`.
    - `## Drag controls` (`:150`, with `snapToCursor` at `:171`).
    - `## Vanilla drag()` (`:230`) with an `### Options` table (`:254-269`).
    - The vanilla example is `docs/src/routes/examples/vanilla-drag/+page.svelte`, with the demo `docs/src/lib/examples/vanilla-drag/demos/SliderKnob.svelte`.
  - Docs import with `#lib/....js` specifiers, never `$lib`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Types | `pnpm check` | `0 ERRORS` |
| One unit file | `pnpm exec vitest run <path>` | as stated |
| All unit tests | `pnpm test:only` | all pass |
| e2e | `PW_PORT=4245 pnpm exec playwright test --project=chromium <path>` | as stated |
| Docs | `pnpm build && pnpm --dir docs build && pnpm --dir docs check` | exit 0, 0 errors |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, and never use `git stash`.

## Scope

**In scope:**
- `src/lib/utils/vanillaDrag.ts` (create; only if Step 1 is red)
- `src/lib/utils/vanillaDrag.types.spec.ts` (create)
- `src/lib/index.ts`: move `drag` out of the `from 'motion'` block into its own re-typed export (only if Step 1 is red)
- `src/lib/types.ts`: the `DragControls.start` JSDoc only (`:585-602`)
- `src/lib/utils/dragControls.ts` (JSDoc only) and `src/lib/utils/dragControls.spec.ts`
- `src/routes/tests/drag/vanilla/+page.svelte` (a new `headless` mode) and `e2e/drag/vanilla.spec.ts`
- `src/routes/tests/drag/point-constraint/+page.svelte` and `e2e/drag/point-constraint.spec.ts` (create)
- `src/routes/tests/drag/controls/+page.svelte` (an `immediate` mode) and `e2e/drag/controls.spec.ts`
- `src/routes/+page.svelte` (one link, for point-constraint)
- `docs/src/routes/docs/drag/+page.svx`
- `docs/src/lib/examples/vanilla-drag/demos/Dial.svelte` (create) and `docs/src/routes/examples/vanilla-drag/+page.svelte` (one new section)
- `.changeset/drag-14-10.md` (create)

**Out of scope:**
- Any change to drag runtime behaviour, `_MotionContainer.svelte` or `visualElementCore.ts`.
- `MotionProps` in `src/lib/types.ts` (plan 002 edits it next to `onTapCancel`). Touch only the `DragControls` JSDoc.
- The press type block in `src/lib/index.ts` (plan 001).

## Git workflow

- Lane branch `lane/14101-drag`, cut from `feat/motion-14.10.1` after plan 001 is merged.
- Use conventional commits, for example `test(drag): drag() x/y accepts our motion values (red)` and `docs(drag): x/y, immediate and function constraints`.
- End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

### Step 1: Type test for `drag()` x/y with our motion values (red, or a recorded no-op)

Create `src/lib/utils/vanillaDrag.types.spec.ts`. It only needs to compile under `pnpm check`. Vitest also runs it, so add one trivial `it`.
```ts
import { drag, motionValue } from '$lib'
import { it, expect } from 'vitest'
it('drag() accepts this library’s motion values for x/y', () => {
    const el = document.createElement('div')
    const x = motionValue(0)
    const stop = drag(el, { axis: 'x', x })
    stop()
    expect(typeof stop).toBe('function')
})
```
Check which module `motionValue` comes from in `src/lib/index.ts` (it returns `AugmentedMotionValue`; see `src/lib/utils/vanillaValues.svelte.ts`).

**Verify**: `pnpm check`. Then:
- If it reports a type error on `x` (not assignable to `MotionValue<number>`), that is the expected red. Continue to Step 2.
- If it reports **0 errors**, record "x/y already type-checks; no wrapper needed" in the commit message, skip Step 2, and keep the test as a guard.

### Step 2: Re-type `drag` (only if Step 1 was red)

1. Create `src/lib/utils/vanillaDrag.ts`. Model it on `src/lib/utils/effects.ts:55-110`:
   ```ts
   import { drag as dragCore } from 'motion'
   import type { DragOptions } from 'motion-dom'
   import type { AnyMotionValue } from './transform.svelte.js'
   /** Options for {@link drag}: motion-dom's `DragOptions`, with `x`/`y` accepting this library's motion values. */
   export type SvelteDragOptions = Omit<DragOptions, 'x' | 'y'> & {
       x?: AnyMotionValue<number>
       y?: AnyMotionValue<number>
   }
   /** … full Google-style JSDoc with the dial example … */
   export const drag = dragCore as (
       elementOrSelector: Parameters<typeof dragCore>[0],
       options?: SvelteDragOptions
   ) => ReturnType<typeof dragCore>
   ```
   It is a type-level cast, so `drag === motion's drag` at runtime. Say so in the JSDoc, as `effects.ts:60-61` does.
2. In `src/lib/index.ts`, remove `drag` from the `export { … } from 'motion'` block. Add `export { drag } from '$lib/utils/vanillaDrag'` and `export type { SvelteDragOptions } from '$lib/utils/vanillaDrag'` next to the `animate`/effects re-typed exports (`:55-58`).
3. Run `pnpm exec vitest run src/lib/index.spec.ts`. The export tripwire must still count `drag` as re-exported. If it fails because `drag` is now a different binding, check how `animate` is handled in that spec or in `src/lib/__tests__/motionExportAllowlist.ts`, and mirror that handling. Don't allowlist `drag`.

**Verify**: `pnpm check` → 0 errors, and `pnpm exec vitest run src/lib/utils/vanillaDrag.types.spec.ts src/lib/index.spec.ts src/lib/utils/motionReexports.spec.ts` → PASS.

### Step 3: Runtime tests

1. **Headless vanilla drag.** In `src/routes/tests/drag/vanilla/+page.svelte`, add a `headless` mode (testid `vanilla-headless`):
   - a dial element plus a `motionValue(0)` bound with `drag(el, { axis: 'x', x })`;
   - an `x.on('change', …)` that writes `rotate` onto a child needle;
   - a readout `data-testid="headless-x"`.
   Document the mode in the page's top comment. In `e2e/drag/vanilla.spec.ts`, add "x option: drives the motion value without moving the element". Run `dragBy(page, el, 100, 0)`, then expect `headless-x` to read more than 60, and the element's own `readTranslate(el).x` to stay below 1.
2. **Function constraints with `getProps`.** Create `src/routes/tests/drag/point-constraint/+page.svelte` with a `motion.div drag="x"` (testid `point`) whose `dragConstraints` is a function:
   - It records `ctx.getProps().drag` into `data-testid="props-drag"`.
   - It returns a `DragPointConstraint` that follows the pointer: `move()` sets `ctx.getAxisMotionValue('x').set(point.x)`, and `release()` returns `Promise.resolve()`.
   - Port the shape from upstream `point-constraint.test.ts`, and read its first 120 lines before writing.
   - Add a `TesterPanel` (copy `src/routes/tests/drag/disable-from-ondrag/+page.svelte`) with the step "Drag the box right. Expected: it follows; the readout says x".
   - Create `e2e/drag/point-constraint.spec.ts`: drag 120 px and expect `props-drag` to read `x` and the translateX to be more than 80. Link the page from `src/routes/+page.svelte` next to the other `/tests/drag/*` links.
3. **`immediate`.**
   - In `dragControls.spec.ts`, add "passes immediate through", copying the `distanceThreshold` test at `:65`.
   - In `src/routes/tests/drag/controls/+page.svelte`, add an `immediate` mode: a handle whose `onpointerdown` calls `controls.start(e, { immediate: true })`, plus counters `immediate-start` and `immediate-end` from `onDragStart`/`onDragEnd`.
   - In `e2e/drag/controls.spec.ts`, add "immediate: a press and release without moving still starts and ends the drag": mouse down on the handle, then up with no move, then expect both counters to read `1`. Copy the existing tests in that file.

**Verify**: `PW_PORT=4245 pnpm exec playwright test --project=chromium e2e/drag/vanilla.spec.ts e2e/drag/point-constraint.spec.ts e2e/drag/controls.spec.ts` → all PASS, and `pnpm exec vitest run src/lib/utils/dragControls.spec.ts` → PASS. If any of these fail on 14.10.1, that's a STOP. These features are supposed to come free.

### Step 4: JSDoc and docs

1. In the `DragControls.start` JSDoc (`src/lib/types.ts:585-602`) and the `createDragControls` JSDoc (`src/lib/utils/dragControls.ts:3-34`), add: "`immediate` starts the drag at once, without waiting for the pointer to move (Motion 14.10), for example to carry a drag on from another element."
2. In `docs/src/routes/docs/drag/+page.svx`:
   - Add `### Function constraints` under `## Constraints`. Explain that the function is called when each drag starts and receives `{ visualElement, originPoint, elastic, getAxisMotionValue, getProps }`, and that it returns a point with `move()`/`release()`. Include a short example, mark it as an advanced hook, and don't link to any `/tests` page.
   - Add the `immediate` option to `## Drag controls`.
   - Add `x` and `y` rows (`MotionValue<number>`, "Write the drag to these motion values instead of moving the element") to the `### Options` table under `## Vanilla drag()`, plus a `### Headless drag` subsection with the dial example in Svelte.
3. Create `docs/src/lib/examples/vanilla-drag/demos/Dial.svelte`: a rotary dial driven by `drag(knob, { axis: 'x', x })`. Add a section for it in `docs/src/routes/examples/vanilla-drag/+page.svelte`, copying how `SliderKnob` is wired.

**Verify**: `pnpm build && pnpm --dir docs build && pnpm --dir docs check` → exit 0, 0 errors. Revert any change to `docs/static/r/animated-tabs.json`.

### Step 5: Changeset and gate

1. Create `.changeset/drag-14-10.md` with frontmatter `'@humanspeak/svelte-motion': patch`. Body:
   - If Step 2 ran: "`drag()` accepts this library's motion values for its new `x`/`y` options. Document `x`/`y`, `dragControls.start(e, { immediate: true })` and function `dragConstraints` with `getProps()` (Motion 14.10)."
   - Otherwise: "Document …" only.
2. Run `pnpm check`, `pnpm test:only` and `PW_PORT=4245 pnpm exec playwright test --project=chromium e2e/drag`. Then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; all pass.

## Test plan

- **Red first**: `vanillaDrag.types.spec.ts` under `pnpm check`. If it's already green, it stays as a guard and Step 2 is skipped (recorded).
- **New runtime checks**: headless vanilla drag (e2e), function constraints with `getProps` (e2e), `immediate` (unit and e2e).
- These are net-new coverage of free upstream behaviour, so there's no red-on-old-code requirement for Step 3.

## Done criteria

- [ ] `pnpm check` → 0 errors
- [ ] `pnpm test:only` → all pass
- [ ] `PW_PORT=4245 pnpm exec playwright test --project=chromium e2e/drag` → all pass
- [ ] `grep -n "immediate" src/lib/types.ts src/lib/utils/dragControls.ts docs/src/routes/docs/drag/+page.svx` → at least 3 matches
- [ ] `grep -n "getProps" docs/src/routes/docs/drag/+page.svx` → at least 1 match
- [ ] `pnpm --dir docs build && pnpm --dir docs check` → exit 0
- [ ] Only in-scope files changed

## STOP conditions

- Plan 001 is not merged (`node -p "require('motion-dom/package.json').version"` ≠ `14.10.1`).
- A Step 3 runtime test fails. Upstream's runtime should work unchanged through our wiring, so a failure is a real bug and needs its own plan.
- Step 2 would require wrapping `drag` at runtime (anything other than a type cast).

## Maintenance notes

- If `AugmentedMotionValue` ever becomes assignable to motion-dom's `MotionValue`, `vanillaDrag.ts` can go away; the guard test will keep passing.
- Reorder.Board (plan 006) is the first internal user of `immediate`. It calls `VisualElementDragControls.start` directly, not through `createDragControls`.
