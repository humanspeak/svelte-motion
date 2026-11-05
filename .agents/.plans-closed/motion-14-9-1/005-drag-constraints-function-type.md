# Plan 005: `DragConstraints` matches motion-dom 14.9.1 (function hook, `false`, any `Element`, ref object)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do not edit the batch `README.md`.
>
> **Before starting**: this plan depends on plan 001 (Motion 14.9.1 pins). Merge `feat/motion-14.9.1` into this lane (`git merge --no-ff feat/motion-14.9.1`), run `pnpm install --frozen-lockfile`, and confirm `node -p "require('motion-dom/package.json').version"` prints `14.9.1`. If it doesn't, STOP.
>
> **Drift check**: `git diff --stat fb9ed218..HEAD -- src/lib/types.ts src/lib/index.ts tests/consumer-vite6`. Changes from plan 001's merge are expected only outside these paths. On any other change, compare the excerpts and STOP on a mismatch.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (types only; the runtime already passes the prop through)
- **Depends on**: 001-bump-motion-14-9-1.md
- **Wave**: 2
- **Category**: bug (upstream parity, types)
- **Planned at**: commit `fb9ed218`, 2026-11-04

## Why this matters

`dragConstraints` limits where a draggable element can go. In Motion 14.9.1 its type (motion-dom `node/types.ts:657-662`) is:
```ts
dragConstraints?: false | Partial<BoundingBox> | Element | { current: Element | null } | DragConstraintsFunction
```
The new `DragConstraintsFunction` is called when each drag starts and returns a point the drag moves itself. Upstream added it in 14.9.0 (commit a6a03eada) as the hook behind constrained-path dragging.

Our exported `DragConstraints` type only allows a box or an `HTMLElement`. That rejects three things:
- `false`
- SVG and other `Element`s
- `{ current }` ref objects, even though our runtime handles them at `_MotionContainer.svelte:1728-1734`

It also rejects the new function. The runtime already forwards the prop to motion-dom's `VisualElementDragControls` (`_MotionContainer.svelte:706`), so with the 14.9.1 pin only the type is wrong. TypeScript users get false errors for values Motion accepts.

## Current state

- `src/lib/types.ts:530-538`:
  ```ts
  export type DragAxis = boolean | 'x' | 'y'
  export type DragConstraints =
      | {
            top?: number
            left?: number
            right?: number
            bottom?: number
        }
      | HTMLElement
  ```
  It is used at `src/lib/types.ts:914` (`dragConstraints?: DragConstraints`) and exported from `src/lib/index.ts:155-170` in the `export type { … DragConstraints, … }` block.
- motion-dom 14.9.1 (`node_modules/motion-dom/dist/index.d.ts` after plan 001 merges; source in `~/Github/motion` at `v14.9.1:packages/motion-dom/src/gestures/drag/types.ts:25-66`):
  - `DragPointConstraint extends Point { move(): void; release(velocity: Point, transition: InertiaOptions): Promise<unknown> }`
  - `DragConstraintsContext { visualElement; originPoint: Point; elastic; getAxisMotionValue }`
  - `type DragConstraintsFunction = (controls: DragConstraintsContext) => DragPointConstraint`
- Runtime handling (`src/lib/html/_MotionContainer.svelte:1728-1734`): the `alwaysMeasureLayout` check treats `{ current }` as a ref. A function is passed through unchanged.
- Type-test convention: the compiled-only fixtures in `tests/consumer-vite6/src/reorder-types.ts`, which use `Assert`/`Equal` helpers and `// @ts-expect-error` lines. They are wired in by `tests/consumer-vite6/verify-types.mjs:12` (`const fixtures = ['src/reorder-types.ts', 'src/reorder-m-types.ts']`) and run by `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` against the built package, after `pnpm build`.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Build the package | `pnpm build` | exit 0 |
| Consumer type fixtures | `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` | as per step |
| Types | `pnpm check` | `0 ERRORS` |
| Unit suite | `pnpm test:only` | all pass |
| Drag e2e | `PW_PORT=4232 pnpm exec playwright test --project=chromium e2e/drag` | all pass (1 known fixme) |
| Format / lint | `trunk fmt <files>`; `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, never `git stash`.

## Scope

**In scope:**
- `src/lib/types.ts`: `DragConstraints` only
- `src/lib/index.ts`: add the type re-exports below
- `tests/consumer-vite6/src/drag-constraints-types.ts` (create)
- `tests/consumer-vite6/verify-types.mjs` (add the fixture to the list)
- `.changeset/drag-constraints-types.md` (create)

**Out of scope:**
- Runtime drag code (`visualElementCore.ts`, `_MotionContainer.svelte`).
- Docs: upstream marks the function form "for internal use". Don't document it beyond the type's JSDoc.

## Git workflow

- Lane branch `lane/1491-transform` (it continues after plan 002). Use conventional commits, e.g. `test(types): dragConstraints accepts Motion 14.9.1's forms (red)` and `fix(types): widen DragConstraints to motion-dom 14.9.1`.
- End each commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

### Step 1: Red type fixture

Create `tests/consumer-vite6/src/drag-constraints-types.ts`, modelled on `reorder-types.ts`. Import `type DragConstraints` from `'@humanspeak/svelte-motion'`, then declare compiled-only assignments that must type-check:
```ts
const box: DragConstraints = { left: 0, right: 100 }
const off: DragConstraints = false
const svg: DragConstraints = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
const ref: DragConstraints = { current: null as Element | null }
const fn: DragConstraints = ({ originPoint }) => ({
    x: originPoint.x, y: originPoint.y, move() {}, release: () => Promise.resolve()
})
// @ts-expect-error a string is not a constraint
const bad: DragConstraints = 'parent'
```
Add `'src/drag-constraints-types.ts'` to the `fixtures` array in `verify-types.mjs`.

**Verify**: `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` → FAILS with type errors on `off`, `svg`, `ref` and `fn`.

### Step 2: Widen the type

In `src/lib/types.ts`, import the motion-dom types with `import type { DragConstraintsFunction } from 'motion-dom'`, matching how `types.ts` already imports motion-dom types. Replace `DragConstraints` with:
```ts
/**
 * Where a draggable element may go (motion-dom `dragConstraints` @ 14.9.1):
 * a box in pixels relative to the element's origin, an element (or a ref
 * to one) to stay inside, `false` for none, or a function called when each
 * drag starts that returns a point the drag moves itself.
 */
export type DragConstraints =
    | false
    | { top?: number; left?: number; right?: number; bottom?: number }
    | Element
    | { current: Element | null }
    | DragConstraintsFunction
```
Keep the existing box shape, which is upstream's `Partial<BoundingBox>`. In `src/lib/index.ts`, add `DragConstraintsContext`, `DragConstraintsFunction` and `DragPointConstraint` to the `export type { … } from 'motion-dom'` block, matching how that file re-exports motion-dom types. If no such block exists, add one next to the existing type re-exports.

**Verify**:
- `pnpm check` → 0 errors
- `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` → PASS

### Step 3: Gate and changeset

1. Create `.changeset/drag-constraints-types.md` with frontmatter `'@humanspeak/svelte-motion': patch`. Body: "`dragConstraints` now accepts every form Motion 14.9 does: `false`, any `Element` (including SVG), a `{ current }` ref, and a function called when each drag starts. Also exports `DragConstraintsFunction`, `DragConstraintsContext` and `DragPointConstraint`."
2. Run `pnpm test:only`, the drag e2e in the table and trunk on the changed files.

**Verify**: all green.

## Test plan

- Red-first: the consumer type fixture fails on the current type for the four forms upstream accepts, and passes after Step 2.
- `@ts-expect-error` on a string keeps the type from widening to `any`.
- Runtime: the `e2e/drag` suite confirms nothing changed at runtime.

## Maintenance note

Keep `DragConstraints` structurally equal to motion-dom's `dragConstraints` type. On future bumps, diff `node/types.ts` `dragConstraints` and update both together.

## STOP conditions

- `DragConstraintsFunction` (or the context/point types) isn't importable from `motion-dom` at 14.9.1.
- Widening the type causes `pnpm check` errors elsewhere, for example code that narrows with `instanceof HTMLElement`. Report the sites rather than casting.
