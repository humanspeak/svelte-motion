# Plan 001: Re-type `animate` to accept AugmentedMotionValue and delete every `as unknown as RawMotionValue` cast

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row in
> `.agents/.plans/upstream-parity-top3/README.md`.
>
> **Drift check (run first)**: `git diff --stat 634983b..HEAD -- src/lib/index.ts src/lib/utils/augmentMotionValue.svelte.ts src/lib/utils/effects.ts src/lib/utils/animate.svelte.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 — **execute FIRST** (maintainer-reported: "burning me all
  over the place"; also the cheapest item in the batch)
- **Effort**: S–M
- **Risk**: LOW (type-level wrapper + mechanical cast removal; zero runtime change)
- **Depends on**: none
- **Category**: dx (upstream parity / ergonomics)
- **Planned at**: commit `634983b`, 2026-07-08
- **Issue**: <https://github.com/humanspeak/svelte-motion/issues/438>

## Why this matters

Every time a user passes a value from `useMotionValue`/`useSpring`/etc. to
`animate()`, TypeScript rejects it with a misleading error ("Type 'number[]'
has no properties in common with type 'ObjectTarget<…>'"), and the only escape
is `animate(x as unknown as RawMotionValue<number>, …)`. That cast appears at
**10 call sites** in this repo's own shipped examples and test routes — every
downstream user hits the same wall. The values ARE real MotionValue instances
at runtime; only the type is wrong. Fixing the type kills the worst first-run
DX papercut in the library.

## Root cause (verified at `634983b` — do not re-derive, but do confirm)

1. `animate` is re-exported **raw** from `motion`:
    ```ts
    // src/lib/index.ts:23-40
    export {
        MotionGlobalConfig,
        animate,
        ...
    } from 'motion'
    ```
    so its motion-value overload is typed against motion-dom's `MotionValue`
    **class**.
2. That class is nominally typed — it has private fields
   (`node_modules/motion-dom/dist/index.d.ts:2439+`: `private current`,
   `private prev`, `private prevFrameValue`, `private dependents`,
   `private events`). A value is assignable to `MotionValue<T>` only if it is
   a genuine class instance _in the type system_.
3. Our hooks return the augmented type:
    ```ts
    // src/lib/utils/augmentMotionValue.svelte.ts:21-26
    export type AugmentedMotionValue<T> = Omit<MotionValue<T>, 'current'> & {
        /** Reactive read in Svelte 5 templates / `$derived` / `$effect`. */
        readonly current: T
        /** Svelte readable store compatibility. */
        subscribe: (run: (value: T) => void) => () => void
    }
    ```
    `Omit<…>` reconstructs a **structural** type from public members only and
    drops the private-field brand — so `AugmentedMotionValue<T>` is not
    assignable to `MotionValue<T>`, and `animate`'s overload resolution falls
    through to the object-target overload, producing the misleading error.
4. Runtime is safe: `augmentMotionValue` mutates the actual `motionValue()`
   instance in place via `Object.defineProperty` (`augmentMotionValue.svelte.ts:150,172`),
   so augmented values pass `isMotionValue` and animate correctly.
5. Why not "fix the type" directly: intersecting the nominal class
   (`MotionValue<T> & {…}`) collides the private `current` with the public
   reactive `current` — which is exactly why the `Omit` exists. The clean fix
   is a re-typed wrapper, NOT a change to `AugmentedMotionValue`.

## Current state

- `src/lib/index.ts:23-40` — raw re-export block (excerpt above). `animate` at
  line 25.
- `src/lib/utils/effects.ts` — **the established exemplar for this exact fix.**
  The element effects were already re-typed for the same reason; its header
  comment names the same root cause:
    ```ts
    // src/lib/utils/effects.ts:10-20 (abridged)
    /**
     * ... upstream's `Record<string, MotionValue>` signature rejects the
     * augmented TYPE (TypeScript's private-field nominal typing), even
     * though the values are the same instances.
     */
    export type EffectValues = Record<string, AnyMotionValue<string> | AnyMotionValue<number>>
    type Effect = (subject: ElementOrSelector, values: EffectValues) => VoidFunction
    export const styleEffect: Effect = styleEffectCore as Effect
    ```
    **Match this pattern exactly** (runtime passthrough via a single typed
    `as`, JSDoc stating "identical at runtime, re-typed").
- `src/lib/utils/transform.svelte.ts` — defines `AnyMotionValue<T>` (the
  raw-or-augmented union). Reuse it; do not invent a new union.
- `src/lib/utils/animate.svelte.ts` — `useAnimate` builds a scoped animate via
  `createScopedAnimate` from `motion` (line 1) — the scoped function has the
  same typing gap.
- `src/lib/utils/motionValue.svelte.ts:21` —
  `export type RawMotionValue<T = number> = MotionDomMotionValue<T>`.
- The 10 cast sites (`grep -rn "as unknown as RawMotionValue" src/ docs/src`):
    - `src/routes/tests/transform-template/+page.svelte:78`
    - `src/routes/tests/object-style-motion-values/+page.svelte:22`
    - `src/routes/tests/ai-gradient-card/+page.svelte:18`
    - `src/routes/tests/motion-value-children/+page.svelte:19`
    - `docs/src/lib/examples/mobile-drawer/demos/Default.svelte:33`
    - `docs/src/lib/examples/path-morphing/demos/Default.svelte:68`
    - `docs/src/lib/examples/object-style-motion-values/demos/Default.svelte:38,52` (2 sites)
    - `docs/src/lib/examples/ai-gradient-card/demos/Default.svelte` (~line 18)
    - `docs/src/lib/examples/motion-value-children/demos/Default.svelte`

## Commands you will need

| Purpose                | Command                                                                 | Expected on success |
| ---------------------- | ----------------------------------------------------------------------- | ------------------- |
| Typecheck              | `pnpm check`                                                            | exit 0, 0 errors    |
| Unit tests             | `pnpm test`                                                             | all pass            |
| Docs check             | `pnpm --filter docs check`                                              | exit 0              |
| e2e (touched examples) | `pnpm exec playwright test e2e/utilities e2e/vanilla-values e2e/motion` | all pass            |
| Format/lint            | `trunk fmt && trunk check`                                              | clean               |

e2e preview server pinned to port 4198 — do not change.

## Scope

**In scope**:

- `src/lib/utils/animateValue.ts` (create — the re-typed `animate`; name it to
  avoid colliding with `animate.svelte.ts`)
- `src/lib/index.ts` (swap the `animate` re-export to the wrapper; remove
  `animate` from the raw `from 'motion'` block)
- `src/lib/utils/animate.svelte.ts` (re-type `useAnimate`'s scoped animate the
  same way)
- `src/lib/utils/animateValue.spec.ts` (create — type + runtime tests)
- The 10 cast sites listed above (delete the casts; remove now-unused
  `RawMotionValue` imports)

**Out of scope**:

- `src/lib/utils/augmentMotionValue.svelte.ts` — do NOT touch the
  `AugmentedMotionValue` type; the Omit/private-current catch-22 is settled
  (see Root cause §5).
- `src/lib/utils/effects.ts` — already fixed; it is the exemplar, not a target.
- Removing the `RawMotionValue` type export from `src/lib/index.ts` — public
  API; users may reference it.
- Any runtime behavior change whatsoever.

## Git workflow

- Branch: `fix/animate-augmented-motion-value-typing`
- Conventional commits, e.g.
  `fix(types): animate() accepts AugmentedMotionValue without casts`
- Do NOT push or open a PR; maintainer signs off first.

## Steps

### Step 1: Reproduce the error (baseline)

In any of the cast sites (e.g. `src/routes/tests/object-style-motion-values/+page.svelte:22`),
temporarily remove `as unknown as RawMotionValue<number>` and run `pnpm check`.

**Verify**: `pnpm check` → fails with the "No overload matches / has no
properties in common with type 'ObjectTarget<…>'" error at that site. Restore
the cast. (If it does NOT fail, STOP — the premise has drifted.)

### Step 2: Create the re-typed `animate` wrapper

Create `src/lib/utils/animateValue.ts`:

- Import `animate as animateCore` from `'motion'` and `AnyMotionValue` from
  `'./transform.svelte.js'`.
- Define a type that widens ONLY the motion-value overload's first parameter to
  `AnyMotionValue<T>` while preserving every other overload (element/selector
  targets, object targets, sequences) — the pragmatic shape, mirroring
  `effects.ts`, is an interface with an overload set whose non-value overloads
  are `typeof animateCore`'s parameters passed through. Inspect
  `node_modules/motion-dom/dist/index.d.ts` for the real overload list of the
  installed version rather than guessing.
- `export const animate = animateCore as SvelteMotionAnimate` — single
  type-level cast, zero runtime wrapping (match `effects.ts:38`).
- Google-style JSDoc: "Identical to motion's `animate` at runtime; re-typed so
  values from `useMotionValue`/`useSpring`/etc. (AugmentedMotionValue) are
  accepted without casts. See `effects.ts` for the pattern and
  `augmentMotionValue.svelte.ts` for why the augmented type loses the class's
  private-field brand."

In `src/lib/index.ts`: remove `animate` from the `from 'motion'` block and add
`export { animate } from '$lib/utils/animateValue'` adjacent to the effects
re-export block (which carries the same "re-typed to accept augmented values"
comment — extend that comment to mention `animate`).

**Verify**: `pnpm check` → exit 0 (nothing consumes the new overload yet, but
the export swap must not break existing callers).

### Step 3: Re-type `useAnimate`'s scoped animate

In `src/lib/utils/animate.svelte.ts`, apply the same widened type to the scoped
animate returned by `createScopedAnimate` (the tuple's first element), so
`const [scope, animate] = useAnimate()` gets the same ergonomics.

**Verify**: `pnpm check` → exit 0.

### Step 4: Delete all 10 casts

At each site listed in Current state: remove `as unknown as RawMotionValue<T>`
and the now-unused `type RawMotionValue` import. Nothing else in those files.

**Verify**: `grep -rn "as unknown as RawMotionValue" src/ docs/src` → **0
matches**. `pnpm check` → exit 0. `pnpm --filter docs check` → exit 0.

### Step 5: Tests + full gates

Write `src/lib/utils/animateValue.spec.ts`:

- Runtime: `animate(useMotionValue-produced value, target)` animates and
  resolves (model after existing motion-value specs, e.g.
  `src/lib/utils/motionValue.svelte.spec.ts`).
- Type-level: a `@ts-expect-error`-based case asserting a plain `number` is
  still rejected as subject, and a positive case that an
  `AugmentedMotionValue<number>` compiles with an array keyframe target
  (`animate(mv, [0, 1], …)` — the exact shape from the misleading error).
- Passthrough: element/selector overload still typechecks (compile-only case).

**Verify**: `pnpm test` → all pass. `pnpm exec playwright test e2e/utilities
e2e/vanilla-values e2e/motion` → all pass (the touched demo routes render).
`trunk fmt && trunk check` → clean.

## Test plan

Covered in Step 5. The e2e suites for the touched demo pages
(transform-template, object-style-motion-values, motion-value-children,
ai-gradient-card) are the regression gate that the cast removal changed nothing
at runtime.

## Done criteria

- [ ] `pnpm check` and `pnpm --filter docs check` exit 0
- [ ] `pnpm test` exits 0 incl. new `animateValue.spec.ts`
- [ ] `grep -rn "as unknown as RawMotionValue" src/ docs/src` → 0 matches
- [ ] `pnpm exec playwright test e2e/utilities e2e/vanilla-values e2e/motion` exits 0
- [ ] `git status` clean outside in-scope list
- [ ] Batch README status row updated

## STOP conditions

Stop and report back if:

- Step 1's baseline error does not reproduce (premise drifted — someone may
  have already fixed the typing).
- Widening the motion-value overload cannot be expressed without breaking any
  OTHER `animate` overload (element/selector/sequence callers in the repo fail
  `pnpm check` after Step 2) — report the exact overload conflict; do not ship
  a partial overload set.
- The installed motion/motion-dom version's `animate` type shape differs
  materially from `634983b`'s (check `package.json`: `motion ^12.42.2`) — a
  dep bump may have changed the overloads this plan widens.
- Any fix attempt requires editing `augmentMotionValue.svelte.ts` (out of
  scope; settled catch-22).

## Maintenance notes

- When bumping `motion`/`motion-dom`, the wrapper's passthrough overloads must
  be re-checked against upstream's — add a one-line note to the wrapper JSDoc
  saying so.
- Reviewer should scrutinize: that the wrapper is a pure type cast (no runtime
  wrapper function — keeps stack traces and identity `animate === motion's`),
  and that no cast site was "fixed" by weakening to `any`.
- Docs impact: **small but real** — the docs examples themselves get cleaner
  (casts deleted), and if any docs page prose explains the cast (check
  `docs/src/routes/docs/vanilla-values/` and `object-style-motion-values/`),
  update it to show the cast-free call. No new page needed.
- Follow-up (explicitly deferred): audit remaining raw `from 'motion'`
  re-exports (`scroll`, `transform`, `spring`, …) for MotionValue-typed
  parameters with the same nominal rejection; extend the wrapper pattern only
  where a repo call site actually hits it.
