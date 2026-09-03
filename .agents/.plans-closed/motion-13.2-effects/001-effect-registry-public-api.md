# Plan 001: Expose Motion 13.2's effect registry (`animate.addEffect`, `createEffect`) through the public API

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in the `README.md` that sits alongside this plan file
> (`.agents/.plans/motion-13.2-effects/README.md`) — unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Revision 2026-09-03** (guard, after the first Codex run stopped at Step 6):
> (1) Step 2 no longer uses `AnimateEffect<any>` — the repo's eslint config
> (via `trunk check`) enforces `@typescript-eslint/no-explicit-any` as an
> error and has no disable precedent, so the members are now **generic**
> (`addEffect<Subject extends object>(effect: AnimateEffect<Subject>): void`).
> (2) The done-criteria grep for the barrel export is now
> `MotionValueState, createEffect` — trunk's import/export sorting puts the
> capitalised name first. (3) `Planned at` re-stamped to `82c6971`.
>
> **Drift check (run first)**:
> `git diff --stat 82c6971..HEAD -- src/lib/utils/animateValue.ts src/lib/utils/animateValue.spec.ts src/lib/utils/effects.ts src/lib/index.ts src/lib/index.spec.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Precondition**: `grep '"version"' node_modules/motion-dom/package.json`
> must print `13.2.0` (or newer). This plan was written on the branch that
> bumps `motion`/`motion-dom` from 13.1.1 to 13.2.0; if the installed version
> is 13.1.1, STOP — the APIs below do not exist there.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but see Precondition)
- **Category**: migration
- **Planned at**: commit `82c6971`, 2026-09-03 (revised; originally `47b7149`)

## Why this matters

Motion 13.2.0's headline feature is an **effect registry**: `animate.addEffect(effect)`
teaches `animate()` to drive non-DOM subjects (Three.js meshes, shader uniforms,
audio nodes, canvas state, any object) by delegating to an effect created with
`createEffect(addValue, { test, read, step })`. The runtime is already in our
dependency tree, but our public surface hides it three ways:

1. `animate` is re-typed through the `SvelteMotionAnimate` interface, which has
   call signatures only. The `addEffect`/`removeEffect` statics exist at runtime
   (verified: `typeof animate.addEffect === 'function'`) but are erased from the
   type, so `animate.addEffect(x)` is a TypeScript error for every consumer.
2. `createEffect`, `MotionValueState`, and the effect types (`Effect`,
   `AnimateEffect`, `EffectOptions`, …) are not re-exported from
   `src/lib/index.ts`. Consumers cannot import them from `motion`/`motion-dom`
   either: those are *our* dependencies, not theirs, and pnpm's strict
   `node_modules` does not expose transitive packages. Our own docs promise the
   opposite ("Re-exports motion's imperative API — no second dependency needed",
   `docs/src/lib/compare-data.ts:164`).
3. Upstream's `propEffect` is now a full `Effect<…>` with a `.get(subject, key)`
   accessor. Our cast in `src/lib/utils/effects.ts` narrows it back to a bare
   function, hiding `.get`.

After this plan, a Svelte consumer can write the same code as upstream's
example (`animate.addEffect(threeEffect); animate(mesh, { x: 100 })`) without
casts or a second dependency. Plans 002–004 build the demo, docs, and Three.js
subpath on top of this.

## Current state

Files and their roles:

- `src/lib/utils/animateValue.ts` — defines `SvelteMotionAnimate` (the re-typed
  `animate`) and exports `animate = animateCore as SvelteMotionAnimate`.
- `src/lib/utils/animateValue.spec.ts` — runtime identity test + compile-only
  `typeAssertions()` block validated by `pnpm check`.
- `src/lib/utils/effects.ts` — re-types `styleEffect`, `attrEffect`,
  `propEffect`, `svgEffect` to accept `EffectValues` (augmented values).
- `src/lib/index.ts` — public barrel. Lines 21–47 are the vanilla-layer block.
- `src/lib/index.spec.ts` — smoke tests that public exports exist.

Excerpt — `src/lib/utils/animateValue.ts:31-64` (the interface is call
signatures only; no statics):

```ts
export interface SvelteMotionAnimate {
    /** Animate a sequence of segments on a shared timeline. */
    (sequence: AnimationSequence, options?: SequenceOptions): AnimationPlaybackControlsWithThen
    /** Animate a string motion value (raw or augmented). */
    (
        value: string | AnyMotionValue<string>,
        keyframes: string | UnresolvedValueKeyframe<string>[],
        options?: ValueAnimationTransition<string>
    ): AnimationPlaybackControlsWithThen
    // … more call signatures …
    /** Animate the properties of a plain object (or array of objects). */
    <O extends object>(
        object: O | O[],
        keyframes: ObjectTarget<O>,
        options?: AnimationOptions
    ): AnimationPlaybackControlsWithThen
}
```

and `src/lib/utils/animateValue.ts:91`:

```ts
export const animate = animateCore as SvelteMotionAnimate
```

Excerpt — `src/lib/utils/effects.ts:18-20` and `:64`:

```ts
export type EffectValues = Record<string, AnyMotionValue<string> | AnyMotionValue<number>>

type Effect = (subject: ElementOrSelector, values: EffectValues) => VoidFunction
// …
export const propEffect = propEffectCore as (subject: object, values: EffectValues) => VoidFunction
```

Excerpt — `src/lib/index.ts:42-47`:

```ts
// `animate` and the element effects re-typed to accept both raw and
// Svelte-augmented motion values (runtime passthrough to motion's
// implementations — no behavior change, only widened types).
export { animate } from '$lib/utils/animateValue'
export { attrEffect, propEffect, styleEffect, svgEffect } from '$lib/utils/effects'
export type { EffectValues } from '$lib/utils/effects'
```

What upstream 13.2.0 ships (installed at `node_modules/motion-dom/dist/index.d.ts`,
around lines 3150–3220; `motion` re-exports all of it):

```ts
type EffectTest<Subject extends object> = (subject: unknown) => subject is Subject
type EffectRead<Subject extends object> = (subject: Subject, key: string, keyframes?: …) => AnyResolvedKeyframe | undefined
interface EffectOptions<Subject extends object> { test?: EffectTest<Subject>; read?: EffectRead<Subject>; step?: Schedule }
interface Effect<Subject extends object = object> extends EffectOptions<Subject> {
    (subject: Subject, values: Record<string, MotionValue>): VoidFunction
    get(subject: Subject, key: string): MotionValue | undefined
}
interface AnimateEffect<Subject extends object = object> extends Effect<Subject> { test: EffectTest<Subject>; read: EffectRead<Subject> }
type AddEffectValue<Subject extends object> = (subject: Subject, state: MotionValueState, key: string, value: MotionValue) => VoidFunction
declare function createEffect<Subject extends object>(addValue: AddEffectValue<Subject>, options: EffectOptions<Subject> & { test; read }): AnimateEffect<Subject>
declare function createEffect<Subject extends object>(addValue: AddEffectValue<Subject>, options?: EffectOptions<Subject>): Effect<Subject>
declare function addEffect(effect: AnimateEffect<any>): void
declare function removeEffect(effect: AnimateEffect<any>): void
declare const propEffect: Effect<{ … }>
declare const styleEffect: (subject: ElementOrSelector, values: Record<string, MotionValue<any>>) => () => void
// attrEffect / svgEffect have the same bare-function shape as styleEffect (no .get)
```

Upstream's `animate` is `Object.assign(createScopedAnimate(), { addEffect, removeEffect })`
(`~/Github/motion/packages/framer-motion/src/animation/animate/index.ts:163-172`
at tag v13.2.0). Upstream's registry tests, which the new unit tests below mirror,
live at `packages/framer-motion/src/animation/animate/__tests__/effects.test.ts`
(same tag). Their subject fixture:

```ts
interface Subject { isSubject: true; values: Record<string, number | string> }
const createSubject = (values = {}): Subject => ({ isSubject: true, values })
const subjectEffect = createEffect<Subject>(
    (subject, state, key, value) =>
        state.set(key, value, () => { subject.values[key] = state.latest[key] }, undefined, false),
    {
        test: (subject): subject is Subject => Boolean((subject as Subject)?.isSubject),
        read: (subject, key) => subject.values[key]
    }
)
```

Repo conventions to match:

- Public values are re-exported from `'motion'`, public *types* from
  `'motion-dom'` — see the `arc` block at `src/lib/index.ts:78-87`.
- Every exported symbol has Google-style JSDoc (see `effects.ts`).
- Unit tests use vitest; `src/**/*.spec.ts` run in the `server` (node) project,
  `src/**/*.svelte.spec.ts` in the `client` (jsdom) project. The jsdom project
  installs fake timers globally; specs that need Motion's real frame loop call
  `vi.useRealTimers()` in `beforeEach` (note at `vitest-setup-client.ts:18-24`).
- `animateValue.spec.ts` drives animations with `await vi.advanceTimersByTimeAsync(ms)`;
  read the whole file before adding to it and copy its timer setup.
- Changesets live in `.changeset/*.md`; a new public API is a `minor`
  (exemplar: `.changeset/motion-config-skip-animations.md`).

## Commands you will need

| Purpose            | Command                                                                     | Expected on success                    |
| ------------------ | --------------------------------------------------------------------------- | -------------------------------------- |
| Install            | `pnpm install`                                                              | exit 0                                 |
| Typecheck          | `pnpm check`                                                                | `0 ERRORS` in the final summary line   |
| One unit spec      | `pnpm exec vitest run src/lib/utils/animateValue.spec.ts`                   | all pass                               |
| All unit specs     | `pnpm test:only`                                                            | all pass (857 at plan time)            |
| Format             | `trunk fmt`                                                                 | exit 0                                 |
| Lint               | `trunk check`                                                               | no new findings                        |
| Package validation | `pnpm package`                                                              | publint prints `All good!`             |

`.trunk/trunk.yaml` is the lint authority (prettier + eslint run through it);
do not run `pnpm lint` / `prettier` directly.

## Scope

**In scope** (the only files you should modify):

- `src/lib/utils/animateValue.ts`
- `src/lib/utils/animateValue.spec.ts`
- `src/lib/utils/effects.ts`
- `src/lib/index.ts`
- `src/lib/index.spec.ts`
- `.changeset/effect-registry-api.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/utils/animate.svelte.ts` (`useAnimate`) — upstream's scoped animate
  from `createScopedAnimate()` has no `addEffect` either; parity means leaving it.
- `src/lib/utils/vanillaValues.svelte.ts` — value factories are unaffected.
- Docs, demo routes, e2e — Plan 002.
- `package.json` exports / new subpaths — Plan 003.
- Any change to `styleEffect`/`attrEffect`/`svgEffect` typing beyond what exists:
  upstream wraps them in `createSelectorEffect`, so they have no `.get` to expose.

## Git workflow

- Branch: `feat/effect-registry-api` off the branch carrying the 13.2.0 bump
  (`chore/upstream-motion-13.2.0`) or `main` once that bump merges.
- Conventional commits, e.g. `feat: expose animate.addEffect and createEffect (Motion 13.2)`.
  Recent exemplar: `feat: MotionConfig skipAnimations animation kill switch (#476)`.
- Do NOT push or open a PR — the operator signs off on demos first.

## Steps

### Step 1: Write failing tests that pin the three gaps

1a. In `src/lib/index.spec.ts`, add to the import list from `'./index.js'`:
`createEffect, MotionValueState, propEffect`, and add:

```ts
import { createEffect as createEffectCore, MotionValueState as MotionValueStateCore } from 'motion'
// …
it('re-exports the Motion 13.2 effect registry primitives', () => {
    expect(createEffect).toBe(createEffectCore)
    expect(MotionValueState).toBe(MotionValueStateCore)
})
it('keeps addEffect/removeEffect on the re-typed animate', () => {
    expect(typeof animate.addEffect).toBe('function')
    expect(typeof animate.removeEffect).toBe('function')
})
it('keeps .get on the re-typed propEffect', () => {
    expect(typeof propEffect.get).toBe('function')
})
```

1b. In `src/lib/utils/animateValue.spec.ts`, inside the existing
`typeAssertions()` compile-only block, add:

```ts
// Motion 13.2: effect registry statics survive the re-type.
const noopEffect = createEffect<{ isSubject: true }>(() => () => {}, {
    test: (s): s is { isSubject: true } => Boolean((s as { isSubject?: true })?.isSubject),
    read: () => 0
})
animate.addEffect(noopEffect)
animate.removeEffect(noopEffect)
// Motion 13.2: ObjectTarget accepts keys the subject doesn't declare
// (effects expose shorthands like `rotateY`).
animate({ x: 0 }, { x: 1, rotateY: 90 })
```

(import `createEffect` from `'motion'` at the top of the spec.)

**Verify**: `pnpm exec vitest run src/lib/index.spec.ts` → 3 new tests FAIL:
`createEffect` is `undefined` (import resolves to nothing), `animate.addEffect`
**passes at runtime** (it is a pure cast — that one is expected to be green
already; the red is at the type level), `propEffect.get` is `'function'` at
runtime too. Then `pnpm check` → errors including
`Property 'addEffect' does not exist on type 'SvelteMotionAnimate'`,
`Module '"./index.js"' has no exported member 'createEffect'`, and
`Property 'get' does not exist on type '(subject: object, values: EffectValues) => VoidFunction'`.
If `pnpm check` reports **no** such errors, the reproduction is wrong: STOP.

### Step 2: Add the registry statics to `SvelteMotionAnimate`

In `src/lib/utils/animateValue.ts`, import `type AnimateEffect` from `'motion-dom'`
and add two members to the interface (after the last call signature, with JSDoc):

```ts
    /**
     * Register an effect so `animate()` can drive the non-DOM subjects it
     * claims (e.g. `animate.addEffect(threeEffect)`). The most recently added
     * effect is tested first; DOM elements are always animated directly.
     */
    addEffect<Subject extends object>(effect: AnimateEffect<Subject>): void
    /** Unregister an effect previously passed to {@link addEffect}. */
    removeEffect<Subject extends object>(effect: AnimateEffect<Subject>): void
```

Upstream declares these as `AnimateEffect<any>`; this repo's eslint config
rejects explicit `any` (error level, no disable precedent), so the generic
form is used — it accepts every `AnimateEffect<T>` by inference and needs no
lint exception. Update the interface's leading JSDoc to mention the statics. Do not wrap
`animate` in a function — it must stay a pure cast (the existing identity test
`expect(animate).toBe(animateCore)` enforces that).

**Verify**: `pnpm check` → the two `addEffect`/`removeEffect` errors are gone.

### Step 3: Re-export the primitives and types from the barrel

In `src/lib/index.ts`, extend the vanilla-layer block (after line 47) with:

```ts
// Motion 13.2 effect registry: build effects for non-DOM subjects with
// `createEffect` and register them via `animate.addEffect`.
export { createEffect, MotionValueState } from 'motion'
export type {
    AddEffectValue,
    AnimateEffect,
    Effect,
    EffectKeyframes,
    EffectOptions,
    EffectRead,
    EffectTest,
    EffectTransition
} from 'motion-dom'
```

**Verify**: `pnpm exec vitest run src/lib/index.spec.ts` → all pass;
`pnpm check` → only the `propEffect.get` error remains.

### Step 4: Keep `.get` on `propEffect`

In `src/lib/utils/effects.ts` replace the `propEffect` line with an
intersection type so the widened call signature is added without dropping
upstream's members:

```ts
/**
 * Bind motion values to object properties. Identical to motion's
 * `propEffect` at runtime, re-typed to accept augmented values while keeping
 * upstream's `.get(subject, key)` accessor (Motion 13.2).
 * …existing @param/@returns/@example…
 */
export const propEffect = propEffectCore as typeof propEffectCore &
    ((subject: object, values: EffectValues) => VoidFunction)
```

TypeScript resolves an intersection of callables as an overload list in order,
so augmented values fall through to the second signature; `.get`/`.test`/`.read`
stay visible from the first.

**Verify**: `pnpm check` → `0 ERRORS`. `pnpm exec vitest run src/lib/index.spec.ts` → all pass.

### Step 5: Add a runtime registry test mirroring upstream

Append to `src/lib/utils/animateValue.spec.ts` a `describe('animate.addEffect', …)`
using the upstream fixture from "Current state". Cases:

- registers an effect and `animate(subject, { x: 100 }, { duration: 0.1 })`
  writes `subject.values.x === 100` after `await vi.advanceTimersByTimeAsync(200)`;
- `removeEffect` in `afterEach` so other specs are unaffected;
- a plain object with no claiming effect still animates (`animate({ x: 0 }, { x: 100 })`).

Match the file's existing timer usage exactly. If the effect write never lands
under the server project's timers (value stays `0`), move ONLY this describe
block into a new `src/lib/utils/animateEffect.svelte.spec.ts` (jsdom project),
add `beforeEach(() => vi.useRealTimers())`, and await `controls.finished`
followed by one `frame.postRender` tick instead of advancing fake timers.

**Verify**: `pnpm exec vitest run src/lib/utils/animateValue.spec.ts` (or the
new file) → all pass, including the 2–3 new tests.

### Step 6: Changeset, format, full gate

Create `.changeset/effect-registry-api.md`:

```md
---
'@humanspeak/svelte-motion': minor
---

Expose Motion 13.2's effect registry. `animate.addEffect()` / `animate.removeEffect()` are now typed on the re-exported `animate`, and `createEffect`, `MotionValueState`, and the `Effect` / `AnimateEffect` / `EffectOptions` types are re-exported so custom effects can drive non-DOM subjects without a second dependency. `propEffect` keeps upstream's `.get()` accessor.
```

Run `trunk fmt`, then the full gate.

**Verify**: `pnpm check` → `0 ERRORS`; `pnpm test:only` → all pass;
`trunk check` → no new findings; `pnpm package` → `All good!`.

## Test plan

- Step 1 is the red anchor: `pnpm check` fails on the three missing members;
  `index.spec.ts` fails at runtime on the missing `createEffect` re-export.
  After Steps 2–4 both are green.
- New unit tests (Step 5) in `animateValue.spec.ts`: effect-claimed subject
  animates; plain object fallback still works; effect removed after each test.
- Compile-only assertions (Step 1b) guard `addEffect`/`removeEffect` typing and
  the widened `ObjectTarget`.
- Pattern: `src/lib/utils/animateValue.spec.ts` (identity + type assertions),
  upstream `effects.test.ts` for the fixture.
- `pnpm test:only` → all pass, including the new tests.

## Done criteria

- [ ] `pnpm check` exits with `0 ERRORS`
- [ ] `pnpm test:only` exits 0; `index.spec.ts` and `animateValue.spec.ts` contain the new tests and they pass
- [ ] `grep -n "addEffect" src/lib/utils/animateValue.ts` shows the interface member
- [ ] `grep -n "MotionValueState, createEffect" src/lib/index.ts` returns a match
- [ ] `expect(animate).toBe(animateCore)` still passes (no wrapper introduced)
- [ ] `pnpm package` prints `All good!`
- [ ] `.changeset/effect-registry-api.md` exists with `minor`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Status row updated in `.agents/.plans/motion-13.2-effects/README.md`

## STOP conditions

Stop and report back (do not improvise) if:

- `node_modules/motion-dom/package.json` version is below 13.2.0.
- The excerpts in "Current state" don't match the live files.
- `pnpm check` in Step 1 does NOT report the expected errors (the gap may
  already be closed — check `git log` for a competing change).
- Adding `addEffect` to the interface breaks the identity test or forces a
  wrapper function around `animateCore`.
- The Step 5 runtime test still fails after the jsdom fallback described there.
- `trunk check` reports a lint error on the new interface members that the
  generic signature in Step 2 does not resolve.

## Maintenance notes

- `SvelteMotionAnimate` mirrors upstream's `animate` shape by hand. When
  bumping `motion`, diff `packages/framer-motion/src/animation/animate/index.ts`
  and `sequence/types.ts` against the interface — the file header already says
  so; this plan adds two more members to keep in sync.
- The `typeof x & (widened signature)` intersection is now the house pattern
  for re-typing upstream effects (Plan 003 reuses it for `threeEffect`). Do not
  regress `propEffect` to a bare function type.
- Deferred: free-function `addEffect`/`removeEffect`/`findEffect` re-exports —
  upstream documents the `animate.addEffect` form; the free functions are
  duplicate surface (recorded as rejected in the batch README).
