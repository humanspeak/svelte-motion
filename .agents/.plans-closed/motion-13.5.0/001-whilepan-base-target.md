# Plan 001: `whilePan` restore no longer depends on `VisualElement.getBaseTarget`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.5.0/README.md` — unless a reviewer dispatched
> you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 9eba7a61..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/baseTarget.ts src/lib/utils/baseTarget.spec.ts e2e/motion/pan-authored-transforms.spec.ts`
> If `_MotionContainer.svelte` changed, re-check the "Current state" excerpt
> (search for `getBaseTarget`) before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1 (blocks the next Motion bump)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (forward-compatibility)
- **Planned at**: commit `9eba7a61`, 2026-10-01

## Why this matters

Upstream Motion deletes `VisualElement.getBaseTarget` on its `main` branch
(motion commit `5114f0074` "Move the removed-value fallback into the animation
state", part of the unreleased 13.5.1 work). The same precedence logic now
lives inline in `animateChanges`. Our `whilePan` extension calls
`visualElement.getBaseTarget(key)` at pan-start. So the first Motion release
that contains this change turns every pan on an element with `whilePan` into
`TypeError: visualElement.getBaseTarget is not a function`. This plan moves
that precedence into a small local helper that works on today's Motion 13.5.0
and keeps working after the method disappears. It must land before the bump.

## Current state

`src/lib/html/_MotionContainer.svelte` (around line 1770–1800), inside
`buildPanHandlers().onStart`:

```ts
                const restore: Record<string, unknown> = {}
                for (const key of Object.keys(definition)) {
                    if (key === 'transition') continue
                    const base = visualElement.getBaseTarget(key)
                    restore[key] =
                        base ?? visualElement.readValue(key, definition[key] as AnyResolvedKeyframe)
                }
                whilePanRestore = restore
```

The comments above it (lines ~1728 and ~1775) explain why: `getBaseTarget` is
what the animation state uses when a key drops out of a target
(initial → style → value as first read), and `readValue` is the fallback for
keys that `whilePan` introduces. Keep `readValue` as the fallback.

### Upstream's replacement precedence (Motion `main`, `packages/motion-dom/src/render/utils/animation-state.ts` ~260–300)

Read it with `git -C ~/Github/motion show origin/main:packages/motion-dom/src/render/utils/animation-state.ts`
(run `git -C ~/Github/motion fetch origin` first if the commit is missing):

```ts
            const { initial } = props
            const resolvedInitial =
                typeof initial !== "boolean" &&
                resolveVariant(
                    visualElement,
                    Array.isArray(initial) ? initial[0] : initial,
                    visualElement.presenceContext?.custom
                )
            ...
                const fromInitial =
                    resolvedInitial && !Array.isArray(initial)
                        ? (resolvedInitial as any)[key]
                        : undefined
                const fromProps = visualElement.getBaseTargetFromProps(props, key)

                fallbackAnimation[key] =
                    (fromInitial !== undefined
                        ? fromInitial
                        : fromProps !== undefined && !isMotionValue(fromProps)
                        ? fromProps
                        : visualElement.initialValues[key] === undefined
                        ? visualElement.baseTarget[key]
                        : undefined) ?? null
```

### What motion-dom 13.5.0 (installed) exposes

From `node_modules/motion-dom/dist/index.d.ts`:

- `resolveVariant` and `isMotionValue` are exported.
- `getBaseTargetFromProps(props, key)` is public on `VisualElement`.
- `baseTarget` and `initialValues` are declared `private` in 13.5.0 but exist at
  runtime. They become public in 13.5.1. Read them through a narrow cast:
  `visualElement as unknown as { baseTarget: Record<string, unknown>; initialValues: Record<string, unknown> }`.

### Conventions

- Utilities live in `src/lib/utils/*.ts` with a sibling `*.spec.ts`. Exported
  helpers are `export const name = (...) => {}` arrow functions with Google-style
  JSDoc (`@param`, `@returns`, `@example`), citing the upstream file they mirror.
  Exemplar: `src/lib/utils/transformComposer.ts`.
- VisualElement unit tests build a real element with `createMotionVisualElement`
  from `src/lib/utils/visualElementCore.ts`. Exemplar:
  `src/lib/utils/visualElementCore.spec.ts` (around line 197):
  ```ts
  const ve = createMotionVisualElement({ props: { initial: { opacity: 0 }, animate: { opacity: 1 } } })
  ve.mount(element)
  ```
  If the spec needs `document`, start the file with
  `/**\n * @vitest-environment jsdom\n */`, as `src/lib/utils/svg.spec.ts` does.

## Commands you will need

| Purpose         | Command                                                                 | Expected                    |
| --------------- | ----------------------------------------------------------------------- | --------------------------- |
| New unit tests  | `pnpm exec vitest run src/lib/utils/baseTarget.spec.ts`                 | all pass                    |
| Unit (full)     | `pnpm test:only`                                                        | all pass                    |
| Typecheck       | `pnpm check`                                                            | 0 errors                    |
| Package         | `pnpm package`                                                          | exit 0, publint "All good!" |
| e2e (pan)       | `pnpm exec playwright test e2e/motion/pan-authored-transforms.spec.ts`  | all pass                    |
| Lint / format   | `trunk fmt <files>` then `trunk check --no-fix <files>`                 | no issues                   |

Use Trunk, not prettier/eslint directly. If vitest can't parse `tsconfig.json`,
run `pnpm exec svelte-kit sync` once. e2e: Playwright builds and previews on
port **4198**. Never kill a process on 4198. If it is busy, report e2e as
blocked.

## Scope

**In scope:** `src/lib/utils/baseTarget.ts` (create),
`src/lib/utils/baseTarget.spec.ts` (create), `src/lib/html/_MotionContainer.svelte`
(the one call site plus its import and adjacent comments), and the README status row.

**Out of scope:** `package.json` (the bump is batch `motion-13.5.1`), any other use
of the VisualElement API, the `whilePan` animation itself, `restoreWhilePan`, and
docs. This helper is internal: do NOT export it from `src/lib/index.ts`.

## Steps

### Step 1: Red — parity tests against today's `getBaseTarget`

Create `src/lib/utils/baseTarget.spec.ts`, importing
`{ resolveBaseTarget } from './baseTarget.js'` (which doesn't exist yet). For each
case, build a VE with `createMotionVisualElement`, mount it on a fresh `div`, and
assert `resolveBaseTarget(ve, key)` equals `ve.getBaseTarget(key)`. Wrap the
parity block in `describe.skipIf(typeof VisualElement.prototype.getBaseTarget !== 'function')`
(import `VisualElement` from `motion-dom`), so it skips cleanly after the 13.5.1
bump. Cases (key `opacity` unless noted):

1. `initial: { opacity: 0 }`, so it comes from `initial`.
2. `initial: 'hidden', variants: { hidden: { opacity: 0.1 } }`, a variant label.
3. no `initial`, `style: { opacity: 0.5 }`, so it comes from style.
4. `style: { opacity: motionValue(0.4) }`, where a MotionValue in style falls through.
5. no `initial`/`style`: call `ve.readValue('opacity')` first so it is in `baseTarget`.
6. `initial: false, style: { opacity: 0.3 }`.
7. `initial: ['hidden', 'other']` with variants, an array (upstream ignores array values).

Then add a version-independent describe asserting the expected **values**
directly for cases 1, 2, 3, 6 (`0`, `0.1`, `0.5`, `0.3`), so behavior stays
pinned after the parity block starts skipping.

**Verify**: `pnpm exec vitest run src/lib/utils/baseTarget.spec.ts` → FAILS with a
module-resolution error for `./baseTarget.js`.

### Step 2: Implement `resolveBaseTarget`

Create `src/lib/utils/baseTarget.ts` exporting
`resolveBaseTarget(visualElement: VisualElement, key: string): unknown`, which
mirrors upstream's precedence above exactly:

- `initial` comes from `visualElement.props`. Skip it when it is boolean or `undefined`.
- `resolveVariant(visualElement, Array.isArray(initial) ? initial[0] : initial, visualElement.presenceContext?.custom)`.
- Use `fromInitial` only when `initial` is not an array.
- Then use `getBaseTargetFromProps(props, key)` unless it is `undefined` or a MotionValue.
- Then `initialValues[key] === undefined ? baseTarget[key] : undefined`.
- Return `undefined` (not `null`) when nothing applies, so the caller's `?? readValue(...)` still fires.

Include JSDoc citing motion commit `5114f0074` and
`animation-state.ts`, with a one-line note that it replaces the removed
`VisualElement.getBaseTarget`.

**Verify**: `pnpm exec vitest run src/lib/utils/baseTarget.spec.ts` → all pass.
If any parity case differs from `getBaseTarget`, STOP and report the case.
Upstream's change was described as "precedence unchanged", so a difference is a
finding, not something to paper over.

### Step 3: Switch the call site

In `_MotionContainer.svelte`, replace `visualElement.getBaseTarget(key)` with
`resolveBaseTarget(visualElement, key)`, import it, and update the two comments
that mention `getBaseTarget` so they name the helper.

**Verify**: `grep -rn "getBaseTarget(" src/lib` returns only `baseTarget.spec.ts`
(the parity test). Then run
`pnpm exec playwright test e2e/motion/pan-authored-transforms.spec.ts` → all pass,
including "pan-end restores the authored rotate smoothly" and "restores
whilePan keys the element never authored".

### Step 4: Full gate

`pnpm test:only`, `pnpm check`, `pnpm package`, and trunk on the 3 touched files → all green.

## Test plan

- Red (Step 1): the module is missing, so the spec fails. The parity block then
  proves the helper equals the method it replaces on today's Motion. The value
  block keeps the behavior pinned after 13.5.1 removes the method.
- e2e: the existing `whilePan` restore specs are the behavioral regression gate.

## Done criteria

- [ ] `baseTarget.ts` + spec exist; spec passes (parity + value blocks)
- [ ] `grep -rn "getBaseTarget(" src/lib` → only the spec
- [ ] pan-authored-transforms e2e all pass
- [ ] `pnpm test:only`, `pnpm check`, `pnpm package`, trunk → green
- [ ] Only in-scope files changed; README row updated

## STOP conditions

- A parity case differs from `getBaseTarget`.
- `resolveVariant` or `getBaseTargetFromProps` is not exported or public in the installed motion-dom.
- A pan e2e fails after Step 3.

## Maintenance notes

- After the 13.5.1 bump (batch `motion-13.5.1`, plan 001), drop the cast to
  `baseTarget`/`initialValues`, since they're public there. The parity block will
  self-skip.
- If upstream changes this precedence again, re-sync from `animation-state.ts`.
- If upstream ever adds a pan variant type, `whilePan` becomes a `setActive`
  call and this helper can go.
