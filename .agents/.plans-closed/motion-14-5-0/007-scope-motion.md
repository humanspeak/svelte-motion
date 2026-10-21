# Plan 007: Add `scopeMotion` and a Svelte `useScopeMotion` attachment (Motion 14.5.0)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> When done, update this plan's row in `.agents/.plans/motion-14-5-0/README.md`, unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Never use `git stash`.**
>
> **Drift check (run first)**: `git diff --stat f2b5d766..HEAD -- src/lib/index.ts src/lib/index.spec.ts src/lib/utils/animate.svelte.ts src/routes/+page.svelte docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts`
> Earlier plans in this batch add links to `src/routes/+page.svelte`. Anything else: compare against "Current
> state", and on a mismatch, STOP.

## Status

- **Priority**: P2 (headline feature of Motion 14.5.0)
- **Effort**: M
- **Risk**: LOW (additive; no existing behavior changes)
- **Depends on**: 001 (motion-dom 14.5.0 provides `scopeMotion`)
- **Category**: direction (new feature, upstream parity)
- **Planned at**: commit `f2b5d766`, 2026-10-21

## Why this matters

Motion 14.5.0's headline feature is `scopeMotion` / `useScopeMotion`. A scope collects every animation, `scroll`/
`inView` listener, `hover`/`press` gesture, `resize` observer, `delay`, `animateLayout`/`animateView` builder and
`drag()` started inside it. Selectors resolve inside a root element, every `animate()` gets a default transition,
setup runs only while media conditions match, and everything stops (`stop()`) or is reverted (`cancel()`,
which also restores inline styles) at once. All the collection plumbing lives in motion-dom and `motion`, so it
works in svelte-motion as soon as plan 001 lands. Users just can't reach it: `src/lib/index.ts` re-exports by
explicit name lists, and there is no Svelte lifecycle binding. This plan adds both, following the
`useAnimate` attachment convention, and the docs/examples/tests required for a new feature.

## Current state

- `src/lib/index.ts` re-exports `motion` vanilla APIs by name (lines 22-40) and types from `motion-dom` by name
  (lines 56-63, 97-103). There is no `export *`.
- The convention to follow is `useAnimate` in `src/lib/utils/animate.svelte.ts:9-25` and `:77-95`. It returns a
  function that is a Svelte 5 **attachment** (`{@attach scope}`) and carries a `.current` property:
  ```ts
  export type AnimationScope<T extends Element = HTMLElement> = ((node: T) => () => void) & {
      current: T | undefined
      animations: AnimationPlaybackControlsWithThen[]
  }
  ...
  const scope = ((node: T) => {
      scope.current = node
      return () => { /* stop animations */ scope.current = undefined }
  }) as AnimationScope<T>
  ```
  Its JSDoc (lines 27-76) is the house style for public hooks: summary, behavior bullets, `@template`, `@returns`,
  `@see` the motion.dev page, and an `@example` Svelte block.
- One motion-dom copy is guaranteed by `src/lib/__tests__/motionDependencies.spec.ts`. `scopeMotion`'s active
  scope is a motion-dom module singleton, so this guarantee is what makes `animate` from `$lib` (a passthrough to
  `motion`'s `animate`) see the scope.
- New-feature exemplar commit: `9582837e` ("feat: align with Motion 14.1.0 and add animateLayout"). Read its file
  list with `git show --stat 9582837e`. It added a wrapper + unit spec + probe component, two test pages + e2e, a
  docs page (`docs/src/routes/docs/animate-layout/+page.svx`), a nav entry (`docs/src/lib/docsNav.ts:82`), an
  example route + `+page.ts`, demo components under `docs/src/lib/examples/animate-layout/demos/`, an
  `examplesIndex.ts` entry (around line 34) and a changeset.
- Visually reviewed test pages carry a guided tester panel (steps, expected result, live verdicts) hidden when
  `@isPlaywright` is in the URL. Pattern: `src/routes/tests/animate-layout/toggle/+page.svelte` (`isTester`,
  `verdicts`).

### Upstream API (`~/Github/motion` @ `v14.5.0`)

- `packages/motion-dom/src/scope/index.ts`:
  - `scopeMotion(setup?, options?)` / `scopeMotion(root, setup?, options?)`
  - `ScopeOptions { transition?: AnimationOptions; matchMedia?: string | Record<string, string> }`
  - `MotionScope { state: 'active'|'stopped'|'cancelled'; media: Record<string, boolean>; run; bind; ignore; stop; cancel; refresh }`
  - `ScopeSetup = (scope) => void | VoidFunction`
  - A scope created inside another is cancelled with it. On a media change it refreshes once per microtask.
- `packages/motion-dom/src/scope/media.ts`: `toMediaQuery` shorthands (`">=800"`, `"<1200px"`, `reducedMotion`,
  `motion`, `dark`, `light`, `hover`, `touch`, `portrait`, `landscape`, `!` negation, `and`).
- `packages/framer-motion/src/animation/hooks/use-scope-motion.ts` (the React hook, 56 lines):
  `useScopeMotion(ref, setup, { deps = [], ...options })` returns a `RefObject<MotionScope | null>`. In a layout
  effect it calls `scopeMotion(ref.current || undefined, s => latestSetup.current(s), options)` and on cleanup
  `current.cancel()`. Test: `animation/hooks/__tests__/use-scope-motion.test.tsx`; port its cases.

## Svelte API (decided; implement exactly this)

```ts
export type UseScopeMotionOptions = ScopeOptions & {
    /** Reactive dependencies: read inside the attachment, so a change cancels and re-runs the scope. */
    deps?: () => unknown
}
export type MotionScopeAttachment<T extends Element = HTMLElement> = ((node: T) => () => void) & {
    /** The live scope while attached, for `run()`/`bind()` in event handlers. */
    current: MotionScope | null
}
export const useScopeMotion: <T extends Element = HTMLElement>(
    setup: ScopeSetup,
    options?: UseScopeMotionOptions
) => MotionScopeAttachment<T>
```

Attachment body: `options.deps?.()` (read tracked, so changes re-run the attachment); then
`untrack(() => scopeMotion(node, (s) => setup(s), scopeOptions))`. The untrack keeps `$state` reads inside setup
from becoming dependencies. Then set `.current`, and return `() => { scope.cancel(); if (attachment.current === scope) attachment.current = null }`.
Import `scopeMotion` from `motion` (same source as `createScopedAnimate`).

Also re-export: `scopeMotion` and `toMediaQuery` from `motion`; types `MotionScope`, `ScopeOptions`, `ScopeSetup`,
`ScopeState`, `MediaConditions` from `motion-dom`; and the two new types above.

Name collision check: `MotionScope` must not clash with any existing export (`grep -n "MotionScope" src/lib/index.ts src/lib/types.ts`
→ no matches at plan time). If it does, STOP.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Unit file | `pnpm exec vitest run src/lib/utils/scopeMotion.svelte.spec.ts` | pass |
| Unit suite | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Package | `pnpm build` | exit 0 (publint clean) |
| Lint | `trunk fmt <files>` then `trunk check <files>` | clean |
| e2e | `pnpm exec playwright test e2e/scope-motion` | all pass (port 4198 rule: if occupied, STOP and ask; never kill) |
| Docs | `pnpm build` (root first; docs consume `dist`), then `pnpm --dir docs build`, `pnpm --dir docs check`, `pnpm --dir docs test` | exit 0 each |

## Scope

**In scope (create unless noted)**:

- `src/lib/utils/scopeMotion.svelte.ts`, `src/lib/utils/scopeMotion.svelte.spec.ts`,
  `src/lib/utils/__tests__/ScopeMotionProbe.svelte`
- `src/lib/index.ts`, `src/lib/index.spec.ts` (modify: exports + assertions)
- `src/routes/tests/scope-motion/basic/+page.svelte`, `src/routes/tests/scope-motion/media/+page.svelte`
- `e2e/scope-motion/basic.spec.ts`, `e2e/scope-motion/media.spec.ts`
- `src/routes/+page.svelte` (modify: link both pages)
- `docs/src/routes/docs/scope-motion/+page.svx`, `docs/src/lib/docsNav.ts` (modify)
- `docs/src/routes/examples/scope-motion/+page.svelte` + `+page.ts`,
  `docs/src/lib/examples/scope-motion/demos/*.svelte`, `docs/src/lib/examplesIndex.ts` (modify)
- `.changeset/scope-motion.md` (`minor`)

**Out of scope**: changing `useAnimate`, `useInView` or `useScroll`; any change to how motion components animate.

## Git workflow

Branch `feat/motion-14.5.0`. Commits like `feat(scope): add useScopeMotion attachment and scopeMotion re-export`,
`test(scope): scope-motion pages and e2e`, `docs(scope): scopeMotion docs and examples`, each ending with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## Steps

### Step 1: Unit tests and the wrapper

This is a net-new feature, so there is no red-first step. Write the spec and the implementation together.

`ScopeMotionProbe.svelte`: renders `<ul {@attach scope}><li class="item">…</li></ul>` with
`const scope = useScopeMotion(setup, options)` from props. Expose `scope` to the test through a callback prop.
Cases (mirror upstream `use-scope-motion.test.tsx` where it applies):

- setup runs once on attach, with `scope.state === 'active'` and a root of the `ul` (a string selector `'.item'`
  passed to `animate` inside setup resolves to the `li` inside the probe, not one elsewhere in the document)
- unmounting the component cancels the scope (`state === 'cancelled'`, `.current === null`) and runs setup's
  returned cleanup
- an `animate()` started in setup is stopped on unmount (mock nothing; check `animation.state` or the promise)
- changing a `deps` getter's value re-runs setup (2 calls) and cancels the old scope
- a `$state` read inside setup does NOT re-run it when that state changes (the untrack)
- `scope.current.bind(fn)` runs `fn` in the scope (an `animate` started from the bound handler is stopped on unmount)

jsdom has no WAAPI; `animate` falls back to JS animations, which is fine for these assertions. If `matchMedia` is
missing in jsdom, stub it only in a media-specific test.

**Verify**: `pnpm exec vitest run src/lib/utils/scopeMotion.svelte.spec.ts` → all pass. `pnpm check` → 0 errors.

### Step 2: Public exports

Add the exports listed in "Svelte API" to `src/lib/index.ts`, next to the related blocks (vanilla `motion`
re-exports; a new commented block "Motion 14.5 scopes"). Write Google-style JSDoc on `useScopeMotion` and both new
types, in `useAnimate`'s style. Document the caveats: (1) `cancel()` restores the `style` attribute of elements
animated in the scope, so prefer scoping plain elements rather than `motion.*` components, whose style svelte-motion
manages; (2) call vanilla APIs (`animate`, `inView`, `scroll`, `hover`, `press`) inside setup, not `use*` hooks,
which need component initialization; (3) setup runs on attach, in the browser only. Add `typeof` assertions for
`scopeMotion`, `toMediaQuery` and `useScopeMotion` to `src/lib/index.spec.ts`.

**Verify**: `pnpm exec vitest run src/lib/index.spec.ts` → pass. `pnpm build` → exit 0.

### Step 3: Test pages + e2e

1. `/tests/scope-motion/basic`: a list of plain `li`s inside `{@attach scope}`. Setup animates `'li'` to
   `{ x: 100 }` with **no** per-call transition, while `ScopeOptions.transition` is `{ duration: 0.4, ease: 'linear' }`
   (proves the default transition). It also attaches `hover('li', …)` and `press('li', …)` that set a
   `data-hovered`/`data-pressed` attribute. Buttons: `stop`, `cancel`, `refresh`. Show `scope.current?.state`
   in `data-testid="state"`. Add the guided tester panel.
2. `e2e/scope-motion/basic.spec.ts`:
   - `li` reaches `translateX(100px)` in about 400 ms (sample at 200 ms: between 30 and 70 px), which proves the
     scope transition was applied
   - `stop` mid-flight leaves the transform where it was and the state `stopped`
   - `cancel` restores the original inline style (no transform) and the state `cancelled`
   - after `cancel`, hovering an `li` no longer sets `data-hovered`
   - `refresh` re-runs setup (the animation plays again)
3. `/tests/scope-motion/media`: `matchMedia: { desktop: '>=800', mobile: '<800' }`. Setup writes
   `scope.media` into `data-testid="media"` and animates a box to `x: 200` on desktop and `x: 50` on mobile.
4. `e2e/scope-motion/media.spec.ts`: at 1000×600 the media reads desktop and the box settles at 200; after
   `page.setViewportSize({ width: 600, height: 600 })` it reads mobile and settles at 50; going back restores 200.
5. Link both pages in `src/routes/+page.svelte` under a new "scopeMotion (Motion 14.5)" heading, following the
   "animateLayout (vanilla layout)" block's markup.

**Verify**: `pnpm exec playwright test e2e/scope-motion` → all pass.

### Step 4: Docs and examples

Follow commit `9582837e`'s file pattern exactly. Page `docs/src/routes/docs/scope-motion/+page.svx` with sections
Usage (`useScopeMotion` attachment), Vanilla `scopeMotion`, Default transition, Media conditions (the shorthand
table from `media.ts`), `run`/`bind`/`ignore`, `stop` vs `cancel`, Nested scopes, Caveats (the three from Step 2),
and Related (useAnimate, animateLayout). Add a nav entry in `docsNav.ts` near `animateLayout`. Add an example route
with two demos: a staggered list that re-runs on a breakpoint, and a "reset" button using `cancel()`. Add the
`examplesIndex.ts` entry. Follow the SEO block pattern at the top of `docs/src/routes/docs/drag/+page.svx`.

**Verify**: `pnpm build`, then `pnpm --dir docs build`, `pnpm --dir docs check` and `pnpm --dir docs test` → exit 0.
If the docs build cannot fetch GitHub stats (network), record it as environment evidence (see CONTRIBUTING.md),
not as a failure.

### Step 5: Changeset and final gate

`.changeset/scope-motion.md` (`minor`): "Add `useScopeMotion` (a Svelte attachment) and re-export `scopeMotion` and
`toMediaQuery` from Motion 14.5: collect animations, gestures and listeners in a scope with a root, default
transition and media conditions, then stop or cancel them together."

**Verify**: `pnpm check` (0 errors), `pnpm test:only` (pass), `trunk check` (clean), `git status` (in-scope only).

## Test plan

- Net-new feature: no red-first test. The unit spec pins lifecycle semantics (attach, cancel on unmount, deps
  re-run, untracked setup, bind), and the e2e pins real-browser behavior (default transition, stop/cancel/refresh,
  gestures collected, media refresh).
- Pattern sources: `src/lib/utils/animate.spec.ts` (useAnimate attachment tests) and
  `e2e/animate-layout/toggle.spec.ts`.

## Done criteria

- [ ] `useScopeMotion`, `scopeMotion` and `toMediaQuery` are exported; `index.spec.ts` asserts them
- [ ] Unit spec passes; `pnpm test:only` passes; `pnpm check` 0 errors; `pnpm build` exits 0
- [ ] `e2e/scope-motion` passes; both pages linked from `src/routes/+page.svelte`
- [ ] Docs page, nav entry, example route + demos, examplesIndex entry exist; docs build/check/test pass (or
      network-blocked builds are recorded)
- [ ] `.changeset/scope-motion.md` exists; README row updated

## STOP conditions

- `scopeMotion` is not exported from `motion` at 14.5.0 (`node_modules/motion/dist/index.d.ts`).
- Animations started via `$lib`'s `animate` inside setup are NOT collected (the stop-on-unmount test fails). That
  would mean two motion-dom copies; report the `pnpm why motion-dom` output.
- A name collision with existing exports.
- `cancel()` breaks a `motion.*` element in a way the docs caveat doesn't cover. Report it; do not add workarounds.

## Maintenance notes

- Upstream may add more scope-aware APIs. Anything svelte-motion wraps with its own lifecycle (e.g. `animateLayout`'s
  `flushSync` wrapper in `src/lib/utils/animateLayout.ts`) still registers, because the wrapper calls motion-dom's
  builder. Re-check whenever a new wrapper is added.
- If plan 008 lands, `drag()` is collected by scopes too (upstream `9c2d71914`). Add a scope example with `drag()`
  then.
