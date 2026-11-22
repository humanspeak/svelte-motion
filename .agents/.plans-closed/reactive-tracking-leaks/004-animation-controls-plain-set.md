# Plan 004: `controls.start()` in an `$effect` does not re-run when components subscribe or unsubscribe

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 4665b907..HEAD -- src/lib/utils/animationControls.svelte.ts src/lib/utils/animationControls.spec.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Wave**: 1
- **Category**: bug
- **Planned at**: commit `4665b907`, 2026-11-13

## Why this matters

`useAnimationControls()` returns an object whose `start()` fans an animation
out to every `motion.*` element that received `animate={controls}`. The set of
subscribed elements is stored in a `SvelteSet`, Svelte's reactive `Set`.
`start()`, `set()` and `stop()` iterate it with `forEach`, which is a tracked
read. The library's own error message tells users to call `controls.start()`
"within a $effect", and an effect that does so becomes dependent on the
subscriber set. Each later mount or unmount of any component sharing those
controls re-runs the effect and fires `start()` again on every subscriber:
keyframe animations replay, and `onAnimationStart` / `onAnimationComplete`
fire a second time. Upstream uses a plain `Set`, and so does this repo's
`createDragControls`. After this plan the subscriber set is not reactive.

## Current state

- `src/lib/utils/animationControls.svelte.ts`: the controls implementation.
  Lines 1–2 and 52–93:

  ```ts
  import type { AnimationControls, AnimationControlsDefinition } from '$lib/types.js'
  import { SvelteSet } from 'svelte/reactivity'
  ...
  export const animationControls = (): AnimationControls => {
      let hasMounted = false
      const subscribers = new SvelteSet<Parameters<AnimationControls['subscribe']>[0]>()

      const controls: AnimationControls = {
          subscribe(subscriber) {
              subscribers.add(subscriber)
              return () => {
                  subscribers.delete(subscriber)
              }
          },
          start(definition: AnimationControlsDefinition, transitionOverride) {
              if (!hasMounted) {
                  throw new Error(mountedError)
              }

              const animations: Promise<unknown>[] = []
              subscribers.forEach((subscriber) => {
                  animations.push(subscriber.start(definition, transitionOverride))
              })
              return Promise.all(animations)
          },
          set(definition: AnimationControlsDefinition) {
              ...
              subscribers.forEach((subscriber) => subscriber.set(definition))
          },
          stop() {
              subscribers.forEach((subscriber) => subscriber.stop())
          },
  ```

- Svelte's `SvelteSet` (installed 5.57.2, `svelte/src/reactivity/set.js`)
  lists `forEach` among its read methods (`get(this.#version)`), and `add` /
  `delete` call `increment(this.#version)`. So `forEach` inside an effect
  subscribes that effect to every later `add` and `delete`.

- Upstream (`~/Github/motion`, tag `v14.12.0`,
  `packages/framer-motion/src/animation/hooks/animation-controls.ts:54-60`):

  ```ts
  const subscribers = new Set<VisualElement>()

  const controls: LegacyAnimationControls = {
      subscribe(visualElement) {
          subscribers.add(visualElement)
          return () => void subscribers.delete(visualElement)
      },
  ```

- In-repo precedent for a plain `Set`, `src/lib/utils/dragControls.ts:41-42`:

  ```ts
  export const createDragControls = (): DragControls => {
      const componentControls = new Set<VisualElementDragControls>()
  ```

- Lint: the Svelte ESLint rule `svelte/prefer-svelte-reactivity` flags plain
  `Set` / `Map` in `.svelte.ts` files. The repo silences a deliberate
  exception with a one-line reason. Two existing forms:
  - `src/lib/components/Reorder/Group.svelte:56`:
    `// eslint-disable-next-line svelte/prefer-svelte-reactivity -- measurement registry has explicit invalidation`
  - `src/lib/html/_MotionContainer.svelte:1025`:
    `// trunk-ignore(eslint/svelte/prefer-svelte-reactivity): a read-only snapshot for the exit clone, never mutated or tracked`

- Where elements subscribe: `src/lib/html/_MotionContainer.svelte:3783`
  (`return animateControls.subscribe(subscriber)`, inside an `$effect`). Do not
  edit it.

- Existing spec: `src/lib/utils/animationControls.spec.ts`. Its fan-out test
  shows how to build fake subscribers:

  ```ts
  const controls = animationControls()
  const first = {
      start: vi.fn(() => Promise.resolve('first')),
      set: vi.fn(),
      stop: vi.fn()
  }
  const cleanup = controls.mount()
  const unsubscribeFirst = controls.subscribe(first)
  ```

  The spec file is a plain `.spec.ts`, so runes such as `$effect.root` are not
  available in it. Rune-enabled specs are named `*.svelte.spec.ts` (for example
  `src/lib/utils/toMotionValue.svelte.spec.ts`, which uses `$state` and
  `flushSync` from `'svelte'`).

## Commands you will need

| Purpose             | Command                                                                   | Expected on success |
| ------------------- | ------------------------------------------------------------------------- | ------------------- |
| Install             | `pnpm install --frozen-lockfile --config.engine-strict=false`             | exit 0              |
| Build (needed once) | `pnpm build`                                                              | exit 0              |
| Typecheck           | `pnpm check`                                                              | 0 errors            |
| One unit file       | `pnpm exec vitest run src/lib/utils/animationControls.svelte.spec.ts`     | see steps           |
| All unit tests      | `pnpm test:only`                                                          | all pass            |
| e2e (own port)      | `PW_PORT=4214 pnpm exec playwright test <paths> --project=chromium`       | all pass            |
| Format / lint       | `trunk fmt <files>` then `trunk check <files>`                            | no issues           |

Notes:

- Run `pnpm build` once before the first `vitest` run on a fresh checkout.
- Port 4198 belongs to the maintainer's live dev server. Never bind, reuse or
  kill it. Always pass `PW_PORT=4214` (or another free port).
- Trunk is the lint and format authority; do not use `pnpm lint` or `prettier`.
- Never use `git stash`.

## Scope

**In scope** (the only files you should modify):

- `src/lib/utils/animationControls.svelte.ts`
- `src/lib/utils/animationControls.svelte.spec.ts` (create)
- `.changeset/animation-controls-plain-set.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/utils/booleanSnapshot.svelte.ts`. It also holds subscribers in a
  `SvelteSet`, but it was not audited; leave it.
- `src/lib/html/_MotionContainer.svelte` and the controls subscriber it builds.
- `src/lib/utils/animationControls.spec.ts` (existing cases stay as they are).
- Variant propagation through `animate={controls}` (a separate, larger finding
  in the batch README).

## Git workflow

- Branch: `advisor/004-animation-controls-plain-set` from `origin/main`.
- Conventional commits, for example
  `fix(controls): keep the subscriber set out of the caller's reactive scope`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write a failing rune spec

Create `src/lib/utils/animationControls.svelte.spec.ts` (the `.svelte.spec.ts`
suffix enables runes). Import `flushSync` from `'svelte'`, `describe`,
`expect`, `it`, `vi` from `'vitest'`, and `animationControls` from
`'./animationControls.svelte'`. Build fake subscribers the same way the
existing spec does. Cases:

1. **`start` in an effect does not re-run on subscribe**: mount the controls
   (`const cleanup = controls.mount()`), subscribe `first`, then

   ```ts
   let runs = 0
   const stop = $effect.root(() => {
       $effect(() => {
           runs += 1
           void controls.start({ opacity: 1 })
       })
   })
   flushSync()
   ```

   Expect `runs` to be `1` and `first.start` called once. Then
   `controls.subscribe(second)` and `flushSync()`. Expect `runs` still `1`,
   `first.start` still called once, and `second.start` not called.
2. **does not re-run on unsubscribe**: same setup with two subscribers, then
   call the first one's unsubscribe function and `flushSync()`. Expect `runs`
   still `1` and the second subscriber's `start` still called once.
3. **`set` in an effect**: same as case 1 with `controls.set({ opacity: 1 })`
   and assertions on `set`.
4. **`stop` in an effect**: same as case 1 with `controls.stop()` and
   assertions on `stop`.

Call `stop()` (the root disposer) and `cleanup()` at the end of each case.

**Verify**:
`pnpm exec vitest run src/lib/utils/animationControls.svelte.spec.ts`
→ all four cases FAIL with `runs` equal to `2` (or the fake's call count 2).

If they pass on unmodified code, the reproduction is wrong: STOP and report.

### Step 2: Use a plain `Set`

In `src/lib/utils/animationControls.svelte.ts`:

- Remove the `SvelteSet` import.
- Replace the declaration with a plain `Set` and a lint exception that states
  the reason, using the `eslint-disable-next-line` form shown in "Current
  state":

  ```ts
  // A plain Set, as upstream (animation-controls.ts:54 @ v14.12.0): a
  // reactive set would subscribe any `$effect` that calls `start()` to every
  // later subscribe and unsubscribe, and replay the animation.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- must not be tracked by callers
  const subscribers = new Set<Parameters<AnimationControls['subscribe']>[0]>()
  ```

- Change nothing else in the file.

**Verify**:

- `pnpm exec vitest run src/lib/utils/animationControls.svelte.spec.ts src/lib/utils/animationControls.spec.ts`
  → all pass.
- `trunk check src/lib/utils/animationControls.svelte.ts` → no issues. If
  Trunk still reports `svelte/prefer-svelte-reactivity`, switch to the
  `// trunk-ignore(eslint/svelte/prefer-svelte-reactivity): <reason>` form.

### Step 3: Changeset

Create `.changeset/animation-controls-plain-set.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

An `$effect` that calls `controls.start()`, `controls.set()` or `controls.stop()` no longer re-runs when another component subscribes to or unsubscribes from the same animation controls, so animations are not replayed.
```

### Step 4: Full gate

`pnpm build`, `pnpm check`, `pnpm test:only`, then

```bash
PW_PORT=4214 pnpm exec playwright test e2e/utilities/animation-controls.spec.ts --project=chromium
```

then `trunk fmt` and `trunk check` on the three in-scope files, then
`git diff --check`.

**Verify**: every command exits 0. If the e2e spec fails, re-run it alone
once; if it fails again, STOP and report (see STOP conditions).

## Test plan

- Red first: the four cases in the new
  `src/lib/utils/animationControls.svelte.spec.ts` fail on current code with an
  extra effect run, and pass after Step 2.
- Existing `src/lib/utils/animationControls.spec.ts` stays green unchanged.
- Pattern: `src/lib/utils/toMotionValue.svelte.spec.ts` for runes in a spec;
  `src/lib/utils/animationControls.spec.ts` for fake subscribers.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/utils/animationControls.svelte.spec.ts` exits 0 with four cases
- [ ] `grep -c "SvelteSet" src/lib/utils/animationControls.svelte.ts` prints `0`
- [ ] `pnpm check` and `pnpm test:only` exit 0
- [ ] `PW_PORT=4214 pnpm exec playwright test e2e/utilities/animation-controls.spec.ts --project=chromium` exits 0
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only the three in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Step 1 cases pass on unmodified code.
- `e2e/utilities/animation-controls.spec.ts` fails after Step 2 and passes
  without it. One known way this can happen: a page calls `controls.start()`
  in an effect that runs before any element has subscribed, and today the
  accidental re-run is what delivers the animation. That is a real ordering
  question for the maintainer; do not paper over it.
- `src/lib/utils/animationControls.svelte.ts` no longer matches the excerpt.

## Maintenance notes

- Subscription order matters once the set is not reactive: a `start()` call
  only reaches elements subscribed at that moment, exactly as upstream. Child
  effects run before parent effects in Svelte, so a parent's
  `$effect(() => controls.start(...))` normally runs after its children have
  subscribed.
- Reviewer: check the lint exception carries a reason and that no other line
  changed.
- Deferred, recorded in the batch README: a node with `animate={controls}` is
  not a controlling variant node, so `controls.start('label')` does not reach
  children that only carry `variants`, and `controls.set('label')` does not
  recurse. That one is larger and riskier.
