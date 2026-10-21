# Plan 008: Expose Motion 14.4's vanilla `drag()` with a guard against double drag

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> When done, update this plan's row in `.agents/.plans/motion-14-5-0/README.md`, unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Never use `git stash`.**
>
> **Drift check (run first)**: `git diff --stat f2b5d766..HEAD -- src/lib/index.ts src/lib/index.spec.ts src/lib/utils/drag.ts docs/src/routes/docs/drag docs/src/lib/examplesIndex.ts`
> Plan 007 adds exports to `src/lib/index.ts`/`index.spec.ts` and an `examplesIndex.ts` entry. If plan 006's
> migration has landed (`src/lib/utils/drag.ts` deleted), STOP: the guard in Step 2 must be re-specified against
> the new drag feature.

## Status

- **Priority**: P3
- **Effort**: S-M
- **Risk**: MED. `drag()` on a svelte-motion `motion.*` element that already drags would attach a second
  controller to the same VisualElement.
- **Depends on**: 001 (motion-dom 14.5.0). Run after 007 so `drag()` collection by scopes can be shown.
- **Category**: direction (new API, upstream parity)
- **Planned at**: commit `f2b5d766`, 2026-10-21

## Why this matters

Motion 14.4.0 added `drag(elementOrSelector, options)`, component-free dragging for plain elements that shares
`x`/`y` motion values with `animate()` and `animateLayout()`, and is collected by `scopeMotion` (14.5.0).
svelte-motion re-exports the other vanilla gestures (`hover`, `press`, `inView`, `scroll`) from `motion` by name
(`src/lib/index.ts:22-40`), so `drag` is the only one missing. One hazard is specific to svelte-motion: upstream's
`drag()` reuses an element's existing VisualElement (`acquireProjectionNode`, motion-dom
`layout/LayoutAnimationBuilder.ts` around lines 186-204). Every svelte-motion `motion.*` element has one. If that
element also has `drag` set, svelte-motion's own drag (`attachDrag`) and upstream's controller would both write
`x`/`y` and both apply drag styles.

## Current state

- `src/lib/index.ts:22-40`:
  ```ts
  export {
      MotionGlobalConfig, cancelFrame, delay, frame, frameData, hover, inView, isMotionValue,
      press, resize, scroll, scrollInfo, spring, stagger, transform
  } from 'motion'
  ```
- `src/lib/utils/drag.ts:387` `export const attachDrag = (el: HTMLElement, opts: AttachDragOptions): AttachDragCleanup => {`
  and its teardown at around lines 1705-1721 (`const teardown = () => { … el.removeEventListener('pointerdown', onPointerDown) }`,
  then `return Object.assign(teardown, { adjustOrigin, updateOptions })`).
- Upstream (`~/Github/motion` @ `v14.5.0`) `packages/motion-dom/src/gestures/drag/index.ts`: `DragOptions` (`axis`,
  `constraints` (box or Element), `elastic`, `momentum`, `transition`, `snapToOrigin`, `directionLock`,
  `propagation`, `onStart`, `onMove`, `onEnd`, `onDirectionLock`, `onTransitionEnd`, `onMeasureConstraints`) and
  `drag(elementOrSelector, options = {}): VoidFunction`. It applies `user-select`/`touch-action` styles and
  `draggable="false"`, restores them on cleanup, and binds callbacks to the active scope. motion-dom exports
  `resolveElements` (`export * from "./utils/resolve-elements"`). The `animate()`-then-`drag()` handoff fix is
  upstream commit `74578076e`.
- Docs: `docs/src/routes/docs/drag/+page.svx` (sections Usage … Callbacks, Props, Related). Example components:
  `docs/src/lib/examples/DragExample.svelte`, `docs/src/lib/examples/drag-constraints/`.

## Design (decided)

- New module `src/lib/utils/vanillaDrag.ts` exporting `drag(elementOrSelector, options?)` and re-exporting the
  `DragOptions` type. It resolves elements with motion-dom's `resolveElements` (so a selector inside a
  `scopeMotion` root still resolves within the root). It filters out elements svelte-motion already drags, then calls
  upstream `drag` from `motion` with the remaining array. If nothing remains, it returns a no-op cleanup.
- Detection: add `export const svelteMotionDragElements = new WeakSet<Element>()` to `drag.ts` (`@internal`).
  `attachDrag` adds `el` on attach and deletes it in `teardown`.
- On a filtered element: in dev (`DEV` from `esm-env`, as `src/lib/utils/arc.ts` does), `console.warn` once per
  element: `[svelte-motion] drag(): element already has a motion.* drag gesture; use its drag props instead.`

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Unit | `pnpm exec vitest run src/lib/utils/vanillaDrag.spec.ts src/lib/index.spec.ts` | pass |
| Unit suite | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint | `trunk fmt <files>` then `trunk check <files>` | clean |
| e2e | `pnpm exec playwright test e2e/drag/vanilla.spec.ts e2e/drag` | all pass (port 4198 rule: if occupied, STOP and ask; never kill) |
| Docs | `pnpm build`, then `pnpm --dir docs build`, `pnpm --dir docs check`, `pnpm --dir docs test` | exit 0 |

## Scope

**In scope**: `src/lib/utils/vanillaDrag.ts` (create), `src/lib/utils/vanillaDrag.spec.ts` (create),
`src/lib/utils/drag.ts` (the WeakSet add/delete only), `src/lib/index.ts`, `src/lib/index.spec.ts`,
`src/routes/tests/drag/vanilla/+page.svelte` (create), `e2e/drag/vanilla.spec.ts` (create),
`src/routes/+page.svelte` (link), `docs/src/routes/docs/drag/+page.svx` (new section),
`docs/src/routes/examples/vanilla-drag/+page.svelte` + `+page.ts` (create),
`docs/src/lib/examples/vanilla-drag/demos/*.svelte` (create), `docs/src/lib/examplesIndex.ts`,
`.changeset/vanilla-drag.md` (create, `minor`).

**Out of scope**: any other change to svelte-motion's drag behavior (the plan 006 spike owns that).

## Git workflow

Branch `feat/motion-14.5.0`. Commits like `feat(drag): expose Motion's vanilla drag()` and
`docs(drag): vanilla drag() section and example`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
Do not push.

## Steps

### Step 1: Wrapper + unit tests

This is a net-new API, so there is no red-first step. In `vanillaDrag.spec.ts` (jsdom):

- `drag(plainDiv)` returns a function, and while attached the element has `draggable="false"` and inline
  `touch-action: none`. After cleanup both are restored.
- `drag(plainDiv, { axis: 'x' })` sets `touch-action: pan-y`.
- An element in `svelteMotionDragElements` is skipped (no `draggable` attribute added) and triggers exactly one
  dev warning across two calls.
- A selector resolves within a `scopeMotion` root (`scopeMotion(root, () => drag('.handle'))` only affects the
  `.handle` inside `root`).

Implement `vanillaDrag.ts` per "Design", with Google-style JSDoc (`@param`, `@returns`, `@see https://motion.dev/docs/drag`
if it exists, otherwise cite the upstream file, and an `@example`). Add the WeakSet to `drag.ts`.

**Verify**: `pnpm exec vitest run src/lib/utils/vanillaDrag.spec.ts` → pass; `pnpm check` → 0 errors.

### Step 2: Export

Add `export { drag } from '$lib/utils/vanillaDrag'` and `export type { DragOptions } from 'motion-dom'` to
`src/lib/index.ts`, next to the vanilla gesture re-exports, with a one-line comment. Assert
`typeof drag === 'function'` in `index.spec.ts`. Check that nothing named `drag` or `DragOptions` is already
exported (`grep -nw "drag\|DragOptions" src/lib/index.ts` before editing → no matches at plan time).

**Verify**: `pnpm exec vitest run src/lib/index.spec.ts` → pass; `pnpm build` → exit 0.

### Step 3: Test page + e2e

`/tests/drag/vanilla` with three plain-element cases and one guard case:
(a) `drag(el, { axis: 'x', constraints: { left: 0, right: 200 } })`;
(b) an element first moved by `animate(el, { x: 120 }, { duration: 0.1 })`, then `drag(el)`, where a 50 px drag
must end near 170, not 50 (upstream `74578076e`);
(c) `drag(el, { constraints: containerEl })`;
(d) a `motion.div drag="x"` that the page also passes to `drag()`, where a 100 px drag moves it ~100 px, not 200.
The page calls `drag()` on it only after it reports `data-is-loaded="ready"`, because `attachDrag` (and so the
WeakSet entry) only runs once the element is ready. Document this timing limit in the JSDoc: calling `drag()` on a
`motion.*` drag element before it is ready is not detected.
Add the guided tester panel (pattern: `src/routes/tests/animate-layout/toggle/+page.svelte`). Spec
`e2e/drag/vanilla.spec.ts` asserts each with `page.mouse` drags, modeled on `e2e/drag/axis-x.spec.ts`.
Link the page from `src/routes/+page.svelte` in the drag section.

**Verify**: `pnpm exec playwright test e2e/drag/vanilla.spec.ts` → pass; `pnpm exec playwright test e2e/drag` → all
pass (the WeakSet must not change existing drag behavior).

### Step 4: Docs, example, changeset

- New `## Vanilla drag()` section in `docs/src/routes/docs/drag/+page.svx` before `## Props`: usage, options
  table (names from upstream `DragOptions`), interop with `animate()`/`animateLayout()`, collection by
  `useScopeMotion` (if plan 007 landed), and the guard note.
- Example route `docs/src/routes/examples/vanilla-drag/` + demo under `docs/src/lib/examples/vanilla-drag/demos/`
  (a slider knob built on `drag(el, { axis: 'x', constraints: track })`) + `examplesIndex.ts` entry, following
  commit `9582837e`'s pattern.
- `.changeset/vanilla-drag.md` (`minor`): "Re-export Motion 14.4's vanilla `drag()`. Elements that already drag
  through a `motion.*` component are skipped, with a dev warning."

**Verify**: `pnpm build`, `pnpm --dir docs build`, `pnpm --dir docs check`, `pnpm --dir docs test` → exit 0 (a
network-blocked stats fetch is recorded as environment evidence); `trunk check` → clean.

## Test plan

Net-new API, so no red-first test. Unit tests pin styles/cleanup, the guard and scope-root resolution; e2e pins
real pointer behavior, the `animate()`→`drag()` handoff and the no-double-drag guard. The existing `e2e/drag` suite
is the regression net for the WeakSet change.

## Done criteria

- [ ] `drag` and `DragOptions` exported; index spec asserts them
- [ ] Unit + e2e specs pass; `e2e/drag` still passes; `pnpm check` 0 errors; `pnpm build` exits 0
- [ ] Docs section, example route, examplesIndex entry, changeset exist; docs build/check/test pass
- [ ] Only in-scope files changed; README row updated

## STOP conditions

- `drag` is not exported from `motion` 14.5.0, or its signature differs from "Current state".
- Case (d) still moves ~200 px with the guard in place (both controllers active).
- Case (b) fails on a plain element (the `animate()`→`drag()` handoff didn't arrive with the pin). Report it; do
  not patch motion-dom.
- Plan 006's migration has replaced `drag.ts`.

## Maintenance notes

- If the plan 006 migration lands, svelte-motion's drag runs on the same `VisualElementDragControls`. Replace the
  WeakSet guard with a check of `visualElementStore.get(el)?.getProps().drag`, and keep the warning.
- Upstream's `drag()` is still marked "Prototype" in its commit history (`94f8216d3`). Re-check the API on each bump.
