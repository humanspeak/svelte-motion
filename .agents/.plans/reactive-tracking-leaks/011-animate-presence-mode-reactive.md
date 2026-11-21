# Plan 011: `AnimatePresence` follows a runtime `mode` change

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- src/lib/utils/presence.ts src/lib/utils/presence.spec.ts src/lib/components/AnimatePresence.svelte src/lib/components/__tests__ src/routes/tests/animate-presence e2e/animate-presence src/routes/+page.svelte docs/src/routes/docs/animate-presence/+page.svx`
> This plan runs after plans 005 and 010, which edit `presence.ts` and
> `presence.spec.ts`, and after plan 003, which adds a link to
> `src/routes/+page.svelte`. Those changes are expected. For anything else,
> compare the "Current state" excerpts against the live code; on a mismatch,
> treat it as a STOP condition. Line numbers below are at `a33531a2`; after
> 005 and 010 they are shifted, so find each site by the quoted code.

> **Revision (2026-11-21, guard, round 3):** Step 3b alone turned case 5 from
> "never shown" (6/12) into "shown too early" (7/12), because `isEnterBlocked`
> returned `false` once the mode was `sync`. Step 3c keeps a held child
> blocked while an exit that started under `wait` is in flight, matching
> upstream, where a mode change doesn't re-diff the rendered children.
>
> **Revision (2026-11-21, guard):** the first executor stopped in Step 4.
> e2e case 5 raced: if the mode left `wait` before `runAnimation()` ran,
> the card held before mount was never released. Step 3b lets that child
> take the wait-release path, which is the one `_MotionContainer.svelte`
> edit this plan now allows.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (wait-mode enter release is shared by every exit)
- **Depends on**: 010-clone-exit-restore-position.md and 005-presence-child-reversed-exit.md (same file, `src/lib/utils/presence.ts`; merge order only, no code from either is needed)
- **Wave**: 2
- **Category**: bug (upstream divergence)
- **Planned at**: commit `a33531a2`, 2026-11-20

## Why this matters

`<AnimatePresence {mode}>` reads `mode` once, when it mounts. Changing it at
runtime (a settings toggle, a breakpoint, a demo with a mode picker) is
silently ignored: exits keep using the first mode for the life of the
boundary. The only workaround is to remount the boundary with
`{#key mode}`, which also remounts every child and replays their enter
animations; the repo's own `boundary-teardown` test page does exactly that.
Upstream Motion reads `mode` on every render. After this plan the context
reports the current mode, each new exit and each enter decision uses it,
exits already in flight keep the mode they started with (as upstream), and
the test page drops its remount.

## Current state

- `src/lib/components/AnimatePresence.svelte`: the boundary. `mode` is a
  prop (line 88: `mode = 'sync',`) passed by value into the context factory,
  lines 160–181:

  ```ts
  pwLog('[AnimatePresence] mounting', {
      initial,
      mode,
      hasOnExitComplete: !!onExitComplete
  })
  const context = createAnimatePresenceContext({
      initial,
      mode,
      onExitComplete: () => { … },
      forceRender: getLayoutGroupContext()?.forceRender,
      custom,
      // A getter, so the latest props are read at pop time (upstream passes
      // them to every PopChild on each render).
      getPopLayoutOptions: () => ({ anchorX, anchorY, root })
  })
  setAnimatePresenceContext(context)
  onDestroy(context.dispose)
  ```

  `getPopLayoutOptions` is the existing precedent for reading a prop late
  through a getter. The same file already imports `untrack` from `svelte`
  (line 3) and uses `$effect.pre(() => { context.setCustom(custom) })`
  (lines 188–190) to push a prop change into the context.

- `src/lib/utils/presence.ts`, `createAnimatePresenceContext` (starts at
  line 1477). The options parameter (lines 1477–1499) has `mode?:
  AnimatePresenceMode`. The value is frozen at line 1504:

  ```ts
  // Default mode to 'sync' if not specified
  const mode: AnimatePresenceMode = context.mode ?? 'sync'
  ```

  Every internal read uses that constant (line numbers at `a33531a2`):
  - `isEnterBlocked`, line 1614: `if (mode !== 'wait') { … return false }`
    (plus `mode` in two `pwLog` calls, 1615 and 1624);
  - the `createContext` `pwLog`, line 1686;
  - `refreshConnectedSnapshots`, line 1848: `if (mode === 'popLayout') { child.lastPopLayoutSnapshot = … }`;
  - `startExit`, line 1909: `if (mode === 'wait') { enterBlocked = true }`;
  - `finishExit`, line 1944: `if (mode === 'wait' && enterBlocked) { enterBlocked = false; notifyEnterUnblocked() }`;
  - `cancelExit`, line 2013: `if (inFlightExits === 0 && mode === 'wait' && enterBlocked) { … }`;
  - `registerChild`, lines 2059 (`pwLog`), 2077 (`lastPopLayoutSnapshot: mode === 'popLayout' ? measurePopLayoutSnapshot(element, initialStyle) : undefined`)
    and 2087 (`if (mode === 'popLayout') { record.popPointCache = createPopLayoutPointCache(); record.popPointCache.track(element) }`);
  - `updateChildState`, line 2123 (`if (mode === 'popLayout') { child.lastPopLayoutSnapshot = … }`);
  - `unregisterChild` (starts line 2151) and the closures inside it
    (`completeExit`, `startExitAnimation`): lines 2156, 2268
    (`const shouldPreserveLayout = mode !== 'popLayout'`), 2388
    (`mode === 'popLayout' ? … measurePopLayoutSnapshot … : undefined`),
    2537 (`clone.setAttribute('data-mode', mode)`), 2552, 2606, 2619, 2713
    (`pwLog`s);
  - the returned object, line 2869: `mode,`.

- Consumers read `context.mode` at decision time, never caching it:
  `src/lib/html/_MotionContainer.svelte:1776` (inside a `$derived`), `:2173`,
  `:2185` (`if (context?.mode === 'wait')` in `runAnimation`), `:3062`;
  `src/lib/components/PresenceChild.svelte:104`, `:350`, `:389`, `:396`
  (the last three inside its phase `$effect`). Making the property a getter
  is enough for all of them, and neither file needs an edit.

- **Tracking hazard** (the theme of this batch). If the getter read the
  `mode` prop in a tracked way, every `$effect`/`$derived` above that reads
  `context.mode` would subscribe to it. `PresenceChild`'s phase effect would
  re-run on a mode change and its last branch
  (`else if (currentPhase === 'enter-blocked' && animatePresence?.mode !== 'wait') { phase = 'idle' }`)
  would release an enter that upstream keeps held. So the getter must read
  the prop inside `untrack`. Today's plain property is untracked too, so no
  consumer changes behavior except by seeing the new value at its next
  decision.

- **Upstream (`~/Github/motion`, tag `v14.14.0`)**, file
  `packages/framer-motion/src/components/AnimatePresence/index.tsx`:
  - `mode = "sync"` is a render-time prop (line 52) and is passed to every
    `PresenceChild` on each render: `mode={mode}` (line 263).
  - `wait` is applied when the children are re-diffed (lines 140–189):
    `else if (mode === "wait") { nextChildren = exitingChildren }` (lines
    177–179). A mode change alone does not re-diff
    (`presentChildren !== diffedChildren` is false), so entering children
    already held back by `wait` stay held until every exit completes
    (`setDiffedChildren([])` in `onExit`, line 244), whatever the mode is
    by then. Under `wait`, a children change while an exit runs renders
    only the exiting children, so new enters wait for in-flight exits even
    when those exits started under `sync`.
  - `popLayout` is decided per exit. `PresenceChild.tsx:116` renders
    `<PopChild pop={mode === "popLayout"} …>` every render, but `PopChild`
    measures only on the `isPresent` true → false update
    (`PopChild.tsx:89`) and inserts its pop rule in an insertion effect keyed
    on `[isPresent]` only (`PopChild.tsx:181-184`, `:244`). So an exit
    popped under `popLayout` stays popped if the mode changes, and an exit
    that started un-popped is never popped later.

  The behavior to match, then: **mode is sampled when an exit starts and
  when an enter is gated. Exits already in flight keep their mode. Enters
  already held by `wait` are released when the in-flight exits finish, and
  an enter gated under `wait` waits for every in-flight exit, including ones
  that started under another mode.** Not matched, deliberately: under `wait`,
  upstream's re-diff also stops rendering children that were already present
  (`nextChildren = exitingChildren`), which remounts them; upstream itself
  warns that multiple children in `wait` lead to "odd visual behaviour"
  (lines 191–198). Leave that alone.

- **Why the clone path also needs a hook.** svelte-motion's clone exit runs
  after Svelte has detached the element, so a `popLayout` exit relies on
  data cached while the child was connected: `lastPopLayoutSnapshot` and the
  `popPointCache` that `unregisterChild` reads at lines 2176–2178
  (`const restingPoint = child.popPointCache?.peek(child.element)`). Both are
  only kept up to date while the mode is `popLayout`. A child registered
  under `sync` and removed after a switch to `popLayout` would have neither,
  and its clone would fall back to the non-pop placement (absolute against
  the parent from its last rect). So when the mode becomes `popLayout`, the
  factory must seed both for every connected child, and dispose the caches
  when it leaves `popLayout`.

- **The remount workaround**:
  `src/routes/tests/animate-presence/boundary-teardown/+page.svelte`,
  lines 61–83:

  ```svelte
  {#if mounted}
      {#key mode}
          <AnimatePresence
              {mode}
              initial={false}
              onExitComplete={() => completed++}
          >
              …
          </AnimatePresence>
      {/key}
  {/if}
  ```

  and line 115: `<select bind:value={mode} onchange={resetDemo}>`, where
  `resetDemo` (lines 22–28) unmounts and remounts the boundary. Its e2e,
  `e2e/animate-presence/boundary-teardown.spec.ts`, opens a fresh page per
  test, then `selectOption(mode)` and expects the card visible (lines 7–11).

- **Test conventions**:
  - Factory specs: `src/lib/utils/presence.spec.ts`, `describe('AnimatePresence modes', …)`
    at line 397 (mode property cases at 452–471, `isEnterBlocked` at 474,
    `onEnterUnblocked` at 524). `animate` from `motion` is mocked (line 52);
    control an exit's end with
    `vi.mocked(animate).mockReturnValueOnce({ finished: d.promise, stop: vi.fn() } as never)`.
    `svelte` is mocked with `...original` (lines 29–40), so `untrack` is the
    real one.
  - Component specs: `@testing-library/svelte` `render`/`rerender` with a
    harness under `src/lib/components/__tests__/`. Pattern:
    `AnimatePresenceDataHarness.svelte` with `PresenceDataProbe.svelte`, used
    by `src/lib/utils/usePresence.spec.ts:51-64`
    (`await rerender({ custom: -1 }); await tick()`). Module-level probe
    exports: `MountFlipPresenceHarness.svelte` exports
    `getMountFlipMounts` / `resetMountFlipMounts` from a
    `<script lang="ts" module>` block. Do not add cases to
    `usePresence.spec.ts` (plan 005 owns it); use a new spec file.
  - Test pages use `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`),
    which renders nothing under `?@isPlaywright=true`. Example:
    `src/routes/tests/animate-presence/clone-parent-styles/+page.svelte:24`
    (import) and `:234-277` (usage with `eyebrow`, `title`, `status`,
    `{steps}`, a `checks` snippet and a live readout). Test pages are linked
    from `src/routes/+page.svelte`; the animate-presence links are around
    line 1151 (`href={resolve('/tests/animate-presence/boundary-teardown') + searchParams}`).
  - Public functions, types and components need Google-style JSDoc.

## Commands you will need

| Purpose             | Command                                                              | Expected on success |
| ------------------- | -------------------------------------------------------------------- | ------------------- |
| Install             | `pnpm install --frozen-lockfile --config.engine-strict=false`        | exit 0              |
| Build (needed once) | `pnpm build`                                                         | exit 0              |
| Typecheck           | `pnpm check`                                                         | 0 errors            |
| One unit file       | `pnpm exec vitest run <file>`                                        | see steps           |
| All unit tests      | `pnpm test:only`                                                     | all pass            |
| e2e (own port)      | `PW_PORT=4221 pnpm exec playwright test <paths> --project=chromium`  | all pass            |
| Format / lint       | `trunk fmt <files>` then `trunk check <files>`                       | no issues           |

Notes:

- Node 24, pnpm 12.6.0. Run `pnpm build` once before the first `vitest` run
  on a fresh checkout.
- Port 4198 belongs to the maintainer's live dev server. Never bind, reuse or
  kill it, and never set `PW_REUSE_SERVER`. Always pass `PW_PORT=4221`.
- Trunk is the lint and format authority; do not use `pnpm lint` or
  `prettier`.
- Never use `git stash` (the stash is shared across worktrees).

## Scope

**In scope** (the only files you should modify):

- `src/lib/utils/presence.ts`, only:
  - the `untrack` import from `svelte` (line 26);
  - the options parameter of `createAnimatePresenceContext` (two new
    optional fields);
  - the `const mode` declaration at line 1504 (replaced) and every internal
    `mode` read listed in "Current state";
  - `finishExit` and `cancelExit` (the wait release condition only);
  - `dispose` (one added line);
  - in the returned object, the single line `mode,` (see the exception
    below).
- `src/lib/components/AnimatePresence.svelte`
- `src/lib/utils/presence.spec.ts` (new `describe` block)
- `src/lib/components/animatePresenceMode.spec.ts` (create)
- `src/lib/components/__tests__/AnimatePresenceModeHarness.svelte` (create)
- `src/lib/components/__tests__/PresenceModeProbe.svelte` (create)
- `src/routes/tests/animate-presence/mode-switch/+page.svelte` (create)
- `e2e/animate-presence/mode-switch.spec.ts` (create)
- `src/routes/+page.svelte` (one link)
- `src/routes/tests/animate-presence/boundary-teardown/+page.svelte`
- `docs/src/routes/docs/animate-presence/+page.svx` (one table row)
- `.changeset/animate-presence-mode-reactive.md` (create)
- `src/lib/html/_MotionContainer.svelte`: **only** the condition of
  `runAnimation()`'s wait branch, as Step 3b says (2026-11-21 amendment)

**The one exception to plan 005's ownership.** Plan 005 owns the
`AnimatePresenceContext` type and the object returned by
`createAnimatePresenceContext`. This plan changes exactly one line of that
object, `mode,` → a `get mode()` accessor, because a getter on the object is
the only way to make `context.mode` current without editing
`PresenceChild.svelte` (also plan 005's) and `_MotionContainer.svelte`. The
type's `mode: AnimatePresenceMode` declaration is satisfied by a getter and
must NOT change. Make no other edit to the type or the object.

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/components/PresenceChild.svelte`, and every part of
  `src/lib/html/_MotionContainer.svelte` except Step 3b's one condition: they
  read `context.mode` at decision time and pick up the new value with no edit.
- The `AnimatePresenceContext` type, and every other line of the returned
  object (plan 005 adds `notifyExitCancel` there).
- `holdContainingBlock` and its release sites (plan 010).
- `src/lib/utils/usePresence.spec.ts` (plan 005).
- Upstream's `wait` re-diff that hides already present children (see
  "Current state"); not matched on purpose.

## Git workflow

- Branch: `advisor/011-animate-presence-mode-reactive`, in a worktree you
  create by hand from a commit that contains this plan and plans 005 and 010
  merged (not from `origin/main` unless they have landed there).
- Conventional commits, for example
  `fix(presence): AnimatePresence follows a runtime mode change`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write failing specs

**1a. Component spec (the anchor).** Create
`src/lib/components/__tests__/PresenceModeProbe.svelte`:

```svelte
<script lang="ts" module>
    import type { AnimatePresenceContext } from '$lib/utils/presence'

    let context: AnimatePresenceContext | undefined
    let mounts = 0
    let effectRuns = 0

    /** The mode the probe's AnimatePresence context reports now. */
    export const readPresenceMode = () => context?.mode
    /** How many times the probe mounted. */
    export const getPresenceModeProbeMounts = () => mounts
    /** How many times the probe's effect that reads `context.mode` ran. */
    export const getPresenceModeEffectRuns = () => effectRuns
    /** Reset the module state between tests. */
    export const resetPresenceModeProbe = () => {
        context = undefined
        mounts = 0
        effectRuns = 0
    }
</script>

<script lang="ts">
    import { getAnimatePresenceContext } from '$lib/utils/presence'
    import { onMount } from 'svelte'

    context = getAnimatePresenceContext()
    onMount(() => {
        mounts += 1
    })
    $effect(() => {
        void context?.mode
        effectRuns += 1
    })
</script>

<span data-testid="presence-mode-probe"></span>
```

and `src/lib/components/__tests__/AnimatePresenceModeHarness.svelte`:

```svelte
<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import type { AnimatePresenceMode } from '$lib/types'
    import PresenceModeProbe from './PresenceModeProbe.svelte'

    let { mode }: { mode: AnimatePresenceMode } = $props()
</script>

<AnimatePresence {mode}>
    <PresenceModeProbe />
</AnimatePresence>
```

Create `src/lib/components/animatePresenceMode.spec.ts` with
`beforeEach(resetPresenceModeProbe)` and three cases:

1. **the context reports the latest mode**: `render(AnimatePresenceModeHarness, { props: { mode: 'sync' } })`;
   expect `readPresenceMode()` `'sync'`; `await rerender({ mode: 'wait' }); await tick()`;
   expect `'wait'`; `await rerender({ mode: 'popLayout' }); await tick()`;
   expect `'popLayout'`.
2. **a mode change does not remount the children** (guard): after the same
   rerenders, `getPresenceModeProbeMounts()` is `1`.
3. **reading `context.mode` in an effect does not subscribe to it** (guard):
   after the same rerenders, `getPresenceModeEffectRuns()` is `1`.

**Verify**: `pnpm exec vitest run src/lib/components/animatePresenceMode.spec.ts`
→ case 1 FAILS with `expected 'sync' to be 'wait'`. Cases 2 and 3 PASS.

If case 1 passes on the unmodified code, the reproduction is wrong: STOP and
report.

**1b. Factory specs.** Append to the end of `src/lib/utils/presence.spec.ts`
a new top-level `describe('reactive mode (plan 011)', …)` with its own setup:
copy the `beforeEach` of `describe('clone exit containing block (plan 010)', …)`
(added by plan 010 at the end of the same file: a parent with no inline
`position`, children `el` and `el2`, a `getComputedStyle` mock whose
`position` follows the inline value, synchronous `requestAnimationFrame`, and
the `deferred` / `flush` helpers). If that block is missing, STOP: plan 010
has not landed.

Each case drives the mode through the two new factory options:

```ts
let current: AnimatePresenceMode = 'sync'
let notify: (() => void) | undefined
const ctx = createAnimatePresenceContext({
    getMode: () => current,
    subscribeMode: (listener) => {
        notify = listener
        return () => (notify = undefined)
    }
})
const setMode = (next: AnimatePresenceMode) => {
    current = next
    notify?.()
}
```

(Import `type AnimatePresenceMode` from `$lib/types`.) Cases:

1. **`ctx.mode` follows `getMode`**: `'sync'`; `setMode('wait')` → `'wait'`.
2. **an exit keeps the mode it started with**: deferred exit for `el` (key
   `a`, `el.remove()` before `unregisterChild`); `setMode('wait')`; expect
   the first `[data-clone="true"]` to have `data-mode="sync"`. Then a
   deferred exit for `el2` (key `b`): its clone has `data-mode="wait"`.
3. **switching to wait mid-exit gates new enters until the exit ends**:
   deferred exit for `a` under `sync`; `setMode('wait')`; expect
   `ctx.isEnterBlocked('new')` `true`; `const cb = vi.fn(); ctx.onEnterUnblocked(cb)`;
   resolve, flush; expect `cb` called once and `ctx.isEnterBlocked()` `false`.
4. **switching away from wait mid-exit still releases held enters** (guard):
   start with `current = 'wait'`; deferred exit for `a`;
   `ctx.onEnterUnblocked(cb)`; `setMode('sync')`; expect `cb` not called;
   resolve, flush; expect `cb` called once.
5. **a reversed exit after switching away from wait still releases**
   (guard): as case 4, but end with `ctx.takeExitHandoff('a')` instead of
   resolving; expect `cb` called once.
6. **switching to popLayout seeds pop data for resting children**:
   `ctx.registerChild('a', el, { opacity: 0 })` under `sync`;
   `setMode('popLayout')`; deferred exit for `a`. Expect the clone to have
   `data-mode="popLayout"`, no `[data-presence-placeholder="true"]`, and
   `parent.style.position` to be `''` while the exit runs (a `popLayout`
   snapshot exists, so the non-pop placement and its containing-block hold
   are not used).
7. **leaving popLayout drops the pop data** (guard): register under
   `popLayout` (`current = 'popLayout'` before creating the context),
   `setMode('sync')`, deferred exit for `a`; the clone has
   `data-mode="sync"` and a `[data-presence-placeholder="true"]` exists.
8. **a static `mode` option still works** (guard):
   `createAnimatePresenceContext({ mode: 'wait' }).mode` is `'wait'`.

**Verify**: `pnpm exec vitest run src/lib/utils/presence.spec.ts -t "plan 011"`
→ cases 1, 2, 3 and 6 FAIL (the new options are ignored, so the mode stays
`'sync'`: `expected 'sync' to be 'wait'`, `data-mode` `"sync"` instead of
`"wait"` / `"popLayout"`, `isEnterBlocked` `false`). Cases 4, 5, 7 and 8 may
fail or pass on current code; record which. `pnpm check` reports type errors
for the unknown `getMode` / `subscribeMode` options until Step 2; that is
expected.

### Step 2: Read the mode live in the context factory

In `src/lib/utils/presence.ts`:

1. Import `untrack`: `import { getContext, setContext, tick, untrack } from 'svelte'`.
2. Add to the options parameter of `createAnimatePresenceContext`, after
   `mode?: AnimatePresenceMode`:

   ```ts
   /**
    * Reads the boundary's current `mode` (upstream reads it on every
    * render). Wins over `mode`. Read untracked, so a caller's effect that
    * reads `context.mode` does not subscribe to it.
    */
   getMode?: () => AnimatePresenceMode
   /**
    * Calls `listener` after `getMode` starts returning a new value, so
    * pop data can be seeded before the next exit. Returns an unsubscribe.
    */
   subscribeMode?: (listener: () => void) => () => void
   ```

3. Replace line 1504 (`const mode: AnimatePresenceMode = context.mode ?? 'sync'`
   and its comment) with:

   ```ts
   // The current mode. Upstream reads it on every render
   // (AnimatePresence/index.tsx:52, :177, :263 @ v14.14.0); it is sampled
   // when an exit starts and when an enter is gated, and an exit in flight
   // keeps the mode it started with.
   const readMode = (): AnimatePresenceMode =>
       (context.getMode ? untrack(context.getMode) : context.mode) ?? 'sync'
   ```

4. Replace each internal read with the live value:
   - `isEnterBlocked`: `const mode = readMode()` as its first line after
     `if (disposed) return false`; the rest of the function is unchanged.
   - the `createContext` `pwLog`: `mode: readMode(),`.
   - `refreshConnectedSnapshots`, `registerChild` (both `popLayout` reads and
     the `pwLog`) and `updateChildState`: `readMode()` in place of `mode`.
     In `registerChild`, read it once into a local `const mode = readMode()`
     at the top.
   - `startExit`: `if (readMode() === 'wait') { enterBlocked = true }`.
   - `unregisterChild`: add `const mode = readMode()` directly after its
     first line, `if (disposed) return`. This one local is the exit's mode
     for the whole exit: every later read in the function and in
     `completeExit` / `startExitAnimation` uses it, so an exit in flight
     keeps its mode. Do not touch those later reads.
5. Release held enters by state, not by the current mode. In `finishExit`
   replace `if (mode === 'wait' && enterBlocked) {` with
   `if (enterBlocked || enterUnblockedCallbacks.size > 0) {`; in `cancelExit`
   replace `if (inFlightExits === 0 && mode === 'wait' && enterBlocked) {`
   with `if (inFlightExits === 0 && (enterBlocked || enterUnblockedCallbacks.size > 0)) {`.
   Keep the bodies (`enterBlocked = false; notifyEnterUnblocked()`). With a
   constant mode this is equivalent: callbacks are only registered while
   `isEnterBlocked` returns `true`, which only happens in `wait`. Add a
   one-line comment: an enter held under `wait` is released when the exits
   end, whatever the mode is by then (upstream re-diffs on exit complete,
   `AnimatePresence/index.tsx:244`).
6. Seed or drop pop data on a mode change. After `children` and the
   `ActiveExit` map are declared (before `startExit`), add:

   ```ts
   // The mode the pop caches were last set up for.
   let trackedMode = readMode()
   /**
    * Bring the children's popLayout caches in line with a new mode. A clone
    * exit runs after the element is detached, so it needs a pop snapshot
    * and resting point recorded while the child was connected.
    */
   const syncModeTracking = () => {
       if (disposed) return
       const next = readMode()
       if (next === trackedMode) return
       const wasPop = trackedMode === 'popLayout'
       trackedMode = next
       if (next === 'popLayout' && !wasPop) {
           for (const child of children.values()) {
               if (!child.element.isConnected) continue
               child.lastPopLayoutSnapshot = measurePopLayoutSnapshot(
                   child.element,
                   getComputedStyle(child.element)
               )
               child.popPointCache ??= createPopLayoutPointCache()
               child.popPointCache.track(child.element)
           }
       } else if (wasPop && next !== 'popLayout') {
           for (const child of children.values()) {
               child.popPointCache?.dispose()
               child.popPointCache = undefined
           }
       }
   }
   const stopWatchingMode = context.subscribeMode?.(syncModeTracking)
   ```

   and in `dispose`, directly after `disposed = true`, add
   `stopWatchingMode?.()`.
7. In the returned object, replace the line `mode,` with:

   ```ts
   get mode() {
       return readMode()
   },
   ```

   Change nothing else in the object or in the `AnimatePresenceContext`
   type.

**Verify**: `pnpm check` → the only errors left (if any) are in files Step 3
edits; `grep -n "const mode: AnimatePresenceMode" src/lib/utils/presence.ts`
→ no output; `pnpm exec vitest run src/lib/utils/presence.spec.ts` → all
pass, including the 8 plan-011 cases and every existing `AnimatePresence modes`
case.

### Step 3: Pass the live mode from `AnimatePresence`

In `src/lib/components/AnimatePresence.svelte`:

1. Before the `pwLog('[AnimatePresence] mounting', …)` call, add
   `const modeListeners = new Set<() => void>()`.
2. In the factory call, replace `mode,` with:

   ```ts
   // Read late, like the pop options: upstream reads `mode` on every
   // render (AnimatePresence/index.tsx:263 @ v14.14.0).
   getMode: () => mode,
   subscribeMode: (listener) => {
       modeListeners.add(listener)
       return () => modeListeners.delete(listener)
   },
   ```

   (Keep `mode` in the mounting `pwLog`; it logs the initial value.)
3. Directly after the existing `$effect.pre(() => { context.setCustom(custom) })`,
   add:

   ```ts
   // Seed pop data before the next exit when `mode` changes.
   $effect.pre(() => {
       void mode
       untrack(() => modeListeners.forEach((listener) => listener()))
   })
   ```

4. Update the component JSDoc line for `@prop mode` to:
   `@prop mode Controls enter/exit coordination: 'sync' (default), 'wait', or 'popLayout'. May change at runtime; exits already running keep the mode they started with.`

**Verify**: `pnpm check` → 0 errors;
`pnpm exec vitest run src/lib/components/animatePresenceMode.spec.ts` → all
3 pass. Then run the presence-related component specs:
`pnpm exec vitest run src/lib/components src/lib/utils/usePresence.spec.ts src/lib/utils/presence.spec.ts`
→ all pass.

### Step 3b: Release a before-mount wait hold even if the mode changed (2026-11-21 amendment)

**Why.** A child that mounts while a `wait` exit is pending is hidden by the
`waitEnterBlockedBeforeMount` derived in `_MotionContainer.svelte` (about
line 1775; it reads `context.mode` at mount). Only `runAnimation()`'s
`if (context?.mode === 'wait')` branch (about line 2185) can release that
hold, by registering the enter-unblocked callback or revealing the element.
`runAnimation()` runs after a rAF, plus a 10 ms sleep under Playwright. If
the mode switches away from `wait` inside that window, the branch is skipped
and the child stays `display:none` forever. The first executor saw e2e
case 5 fail this way in 5 of 12 runs. Adding a 300 ms wait before the
switch made it pass.

**Edit.** In `runAnimation()`, change the wait branch's condition so a child
that was held before mount still takes the release path, whatever the mode
is now:

```ts
        // For mode='wait': check immediately if enters are blocked
        if (context?.mode === 'wait') {
```

becomes

```ts
        // For mode='wait', or a child still held by a wait block from before
        // mount (the mode may have changed since; plan 011 Step 3b): check
        // whether enters are blocked and release through the same path.
        if (context?.mode === 'wait' || untrack(() => waitEnterBlockedBeforeMount)) {
```

Change nothing else in `runAnimation()` or elsewhere in the file. Inside
the branch, `context.isEnterBlocked(presenceKey)` decides what happens:
- **Still blocked:** register the callback. Step 2's state-based release in
  `finishExit`/`cancelExit` fires it when the exits end.
- **Not blocked:** the existing unblocked path reveals the element now.

**Verify**:
- `PW_PORT=4221 pnpm exec playwright test e2e/animate-presence/mode-switch.spec.ts --project=chromium --repeat-each=12`
  → all pass. Case 5 failed 5/12 without this step.
- `pnpm exec vitest run src/lib/components src/lib/utils/presence.spec.ts` → all pass.

If case 5 still fails, STOP and report the run count and the card's
`data-presence-wait-hidden` value.

### Step 3c: A held enter stays blocked by a wait exit after the switch (2026-11-21, second amendment)

**Why.** After Step 3b, case 5 still failed 7 of 12 runs, the other way
round: card B showed while A's clone was still exiting. Step 2's
`isEnterBlocked` returns `false` as soon as the mode isn't `wait`, so the
held child took the "not blocked" path. Upstream keeps it hidden. A mode
change alone doesn't re-run `AnimatePresence`'s diff (it only runs when
`presentChildren !== diffedChildren`, `AnimatePresence/index.tsx` @
v14.14.0). So `renderedChildren` stays the exiting children until their
exits complete, and only then does the new child render. A child added
*after* the switch is unaffected: it is never held before mount, so it never
reaches `isEnterBlocked` through Step 3b's branch.

**Edit.** In `src/lib/utils/presence.ts` `isEnterBlocked`, replace

```ts
        const mode = readMode()
        if (mode !== 'wait') {
            pwLog('[presence] isEnterBlocked', { blocked: false, mode, inFlightExits, key })
            return false
        }
```

with

```ts
        const mode = readMode()
        if (mode !== 'wait') {
            // An exit that started under `wait` (it raised `enterBlocked`) still
            // holds the children that were waiting on it, as upstream keeps
            // rendering only the exiting children until they finish; a mode
            // change alone does not re-diff (plan 011 Step 3c).
            const blocked = enterBlocked && inFlightExits > 0
            pwLog('[presence] isEnterBlocked', { blocked, mode, inFlightExits, key })
            return blocked
        }
```

Leave the rest of the function unchanged. `hasBlockingSibling` must stay
wait-only: in `sync` mode, other present children are normal.

**Verify**: the same commands as Step 3b. Case 5 must pass all 12 repeats.
If it doesn't, STOP and report.

### Step 4: A test page and e2e for mode switching

Create `src/routes/tests/animate-presence/mode-switch/+page.svelte`. Keep it
small:

- State: `let mode = $state<AnimatePresenceMode>('sync')`,
  `let card = $state<'a' | 'b'>('a')`, `let completed = $state(0)`.
- A `<label>Presence mode <select bind:value={mode}>` with `sync`, `wait`,
  `popLayout` options. No `onchange`, no remount.
- A `Swap card` button: `card = card === 'a' ? 'b' : 'a'`.
- `<output data-testid="completed-exits">{completed}</output>`.
- The boundary:

  ```svelte
  <div class="stage" data-testid="stage">
      <AnimatePresence {mode} onExitComplete={() => completed++}>
          {#key card}
              <motion.div
                  key={card}
                  data-testid="mode-card"
                  data-card={card}
                  class="card"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, ease: 'linear' }}
              >
                  Card {card.toUpperCase()}
              </motion.div>
          {/key}
      </AnimatePresence>
  </div>
  ```

- A `TesterPanel` (import from `'../../layout/_parity/TesterPanel.svelte'`)
  with `eyebrow="AnimatePresence · mode"`, `title="Mode changes at runtime"`,
  `status="Passes on this build."`, a `checks` snippet in one or two
  sentences (the mode picker changes the live boundary with no remount; an
  exit keeps the mode it started with), and `steps`:
  1. "Pick wait, then press Swap card." → "Card A fades out first; Card B
     appears only after it is gone."
  2. "Pick popLayout, then press Swap card." → "The two cards overlap: the
     leaving card is pinned in place while the new one fades in."
  3. "Pick sync, press Swap card, and pick wait while the card is fading." →
     "The new card keeps fading in alongside the old one: the running exit
     keeps sync."
  4. "Pick wait, press Swap card, and pick sync while the card is fading." →
     "The new card still waits until the old one is gone."
  Plus a live readout: the current mode and, while a
  `[data-clone="true"]` exists, its `data-mode` (sample it in a
  `requestAnimationFrame` loop started in `onMount`, as
  `clone-parent-styles/+page.svelte:73-110` does; read only, never write to
  the fixture).
- Link it from `src/routes/+page.svelte`, directly after the
  `boundary-teardown` link (around line 1151), with the text
  `Runtime mode switch` and the same markup as its neighbours.

Create `e2e/animate-presence/mode-switch.spec.ts`
(`const URL = '/tests/animate-presence/mode-switch?@isPlaywright=true'`;
model on `e2e/animate-presence/boundary-teardown.spec.ts`). Cases:

1. **changing mode does not remount the present card**: mark the card
   (`await page.getByTestId('mode-card').evaluate((el) => ((el as HTMLElement).dataset.marked = '1'))`),
   select `wait` then `popLayout`, expect the card to still have
   `data-marked="1"` and no `[data-clone="true"]`.
2. **an exit after switching to wait waits**: select `wait`; click
   `Swap card`; expect `[data-clone="true"]` to have `data-mode="wait"`;
   while the clone exists, expect `[data-testid="mode-card"][data-card="b"]`
   not to be visible; then expect the clone count to reach 0 (timeout
   5000) and card B to be visible.
3. **an exit after switching to popLayout pops**: select `popLayout`; swap;
   expect the clone `data-mode="popLayout"` and
   `[data-presence-placeholder="true"]` count 0.
4. **an exit in flight keeps its mode**: (sync) swap; select `wait` while
   the clone exists; expect the clone's `data-mode` still `"sync"` and card
   B visible; then `completed-exits` reaches `1`.
5. **a held enter is released when the exit ends after switching to sync**:
   select `wait`; swap; select `sync` while the clone exists; card B is not
   visible while the clone exists; after the clone is gone, card B is
   visible.
6. **the index links the page**: `/?@isPlaywright=true` has a link named
   `Runtime mode switch` whose `href` matches
   `/\/tests\/animate-presence\/mode-switch/`.

**Verify**:
`PW_PORT=4221 pnpm exec playwright test e2e/animate-presence/mode-switch.spec.ts --project=chromium`
→ 6 passed.

Then prove the e2e is a real reproduction: temporarily revert the library
changes only (`git stash` is forbidden; use
`PATCH=$(mktemp) && git diff HEAD -- src/lib/utils/presence.ts src/lib/components/AnimatePresence.svelte > "$PATCH"`,
then `git checkout -- src/lib/utils/presence.ts src/lib/components/AnimatePresence.svelte`),
re-run the spec, expect case 2 (and 3) to FAIL on `data-mode` (`"sync"`),
then restore with `git apply "$PATCH"` in the same shell and re-run: 6
passed. If
the work is already committed, use `git diff HEAD~N` against the commit
before the library change instead. If case 2 passes without the library
change, STOP and report.

### Step 5: Drop the remount from the teardown page, and document

1. In `src/routes/tests/animate-presence/boundary-teardown/+page.svelte`,
   remove the `{#key mode}` and `{/key}` lines around `<AnimatePresence>`
   (re-indent the block one level), and change the select at line 115 from
   `<select bind:value={mode} onchange={resetDemo}>` to
   `<select bind:value={mode}>`. Keep `resetDemo` itself: the `Reset demo`
   button still uses it.
2. In `docs/src/routes/docs/animate-presence/+page.svx`, change the `mode`
   row of the AnimatePresence props table (line 403) description to
   `How entering and exiting children are coordinated. Can change at runtime; an exit already running keeps the mode it started with`.

**Verify**:
`grep -c "{#key mode}" src/routes/tests/animate-presence/boundary-teardown/+page.svelte`
→ `0`;
`PW_PORT=4221 pnpm exec playwright test e2e/animate-presence/boundary-teardown.spec.ts --project=chromium`
→ all pass (18 tests). If a case fails, put back only `onchange={resetDemo}`
and re-run; if it then passes, keep that and note it in your report. If it
still fails, STOP.

### Step 6: Changeset

Create `.changeset/animate-presence-mode-reactive.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

`AnimatePresence` now follows a change to its `mode` prop at runtime instead of keeping the mode it mounted with, matching Motion. Exits already running keep the mode they started with, and enters held by `mode="wait"` are released when those exits finish.
```

### Step 7: Full gate

`pnpm build`, `pnpm check`, `pnpm test:only`, then

```bash
PW_PORT=4221 pnpm exec playwright test e2e/animate-presence --project=chromium
```

then `trunk fmt` and `trunk check` on every in-scope file, then
`git diff --check`.

**Verify**: every command exits 0. For an e2e failure, re-run that one spec
alone once. `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts` has a
known frame-capture flake under load; if only that spec fails and it passes
alone, record it and continue. Any other repeat failure: STOP and report.

## Test plan

- Red first: `animatePresenceMode.spec.ts` case 1 (the context keeps
  reporting `'sync'` after `rerender({ mode: 'wait' })`), factory cases 1, 2,
  3 and 6, and e2e cases 2 and 3 (clone `data-mode` stays `"sync"`), all on
  current code; all pass after Steps 2–3.
- Guards: no remount on a mode change; no reactive subscription through
  `context.mode`; an exit in flight keeps its mode; held enters are released
  whatever the mode is when the exits end (finish and reversed hand-off);
  leaving `popLayout` drops pop data; the static `mode` option still works.
- Regression: every existing case in `presence.spec.ts`
  (`AnimatePresence modes`, wait blocking, popLayout), `usePresence.spec.ts`,
  `src/lib/components/waitReleaseSnap.spec.ts`,
  `src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts`, and the
  whole `e2e/animate-presence` folder, including `boundary-teardown.spec.ts`
  without the remount.
- Patterns: `usePresence.spec.ts:51-64` (component rerender),
  `presence.spec.ts:474-612` (mode and wait cases),
  `e2e/animate-presence/boundary-teardown.spec.ts` (page e2e).

## Done criteria

- [ ] `pnpm exec vitest run src/lib/components/animatePresenceMode.spec.ts` exits 0 (3 cases)
- [ ] `pnpm exec vitest run src/lib/utils/presence.spec.ts` exits 0 with the 8 plan-011 cases
- [ ] `grep -n "const mode: AnimatePresenceMode" src/lib/utils/presence.ts` prints nothing
- [ ] `grep -c "get mode()" src/lib/utils/presence.ts` prints `1`
- [ ] `grep -c "{#key mode}" src/routes/tests/animate-presence/boundary-teardown/+page.svelte` prints `0`
- [ ] `PW_PORT=4221 pnpm exec playwright test e2e/animate-presence --project=chromium` exits 0 (or only the known flake, passing when run alone), including the 6 new `mode-switch` tests
- [ ] `pnpm check` and `pnpm test:only` exit 0
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git diff a33531a2 -- src/lib/utils/presence.ts` shows no change to the `AnimatePresenceContext` type made by this plan, and in the returned object only `mode,` → `get mode()` (plus plan 005's lines)
- [ ] `git status --short` lists only in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- `animatePresenceMode.spec.ts` case 1 passes on the unmodified code, or e2e
  case 2 passes with the library change reverted.
- The plan-010 `describe` block is missing from `presence.spec.ts`, or plan
  005's `notifyExitCancel` is missing from the returned object: the
  dependencies have not landed.
- Any existing `wait`-mode spec fails after Step 2 (an enter released too
  early or never). Report the spec; do not add a second release path.
- `animatePresenceMode.spec.ts` case 3 fails (an effect re-runs on a mode
  change): the getter is leaking a dependency. Do not "fix" it in
  `PresenceChild.svelte` or `_MotionContainer.svelte`.
- The change seems to need an edit to the `AnimatePresenceContext` type, to
  another line of the returned object, to `PresenceChild.svelte`, or to
  `_MotionContainer.svelte` beyond Step 3b.
- `boundary-teardown.spec.ts` fails without the remount even after putting
  back `onchange={resetDemo}`.

## Maintenance notes

- **Shared file with plan 005.** 005 owns the `AnimatePresenceContext` type
  and the returned context object, and adds `notifyExitCancel` (a wrapper
  around `cancelExit`) to that object; it does not edit `cancelExit`'s body.
  This plan edits `cancelExit`'s release condition and, as its one
  exception, the object's `mode,` line. The two edits are a few lines apart
  in the object, so this plan runs after 005 to keep the merge trivial.
  `PresenceChild.svelte` (005's) reads `animatePresence?.mode` in its phase
  effect and picks up the live value untracked, so its re-entry fix and this
  change do not interact.
- **Shared file with plan 010.** 010 adds `holdContainingBlock`, a field on
  `ActiveExit`, and a release line in `completeExit`, `startExitAnimation`,
  `takeExitHandoff` and `dispose`. This plan adds `const mode = readMode()`
  at the top of `unregisterChild` and `stopWatchingMode?.()` in `dispose`;
  keep 010's release line in the `activeExits` loop. Factory case 6 relies
  on 010's spec setup (computed `position` follows the inline value).
- **Shared file with plan 003.** Both add a link to `src/routes/+page.svelte`,
  in different sections; 003 runs in wave 1.
- Reviewer: check that `readMode` is the only reader of the `mode` prop in
  `presence.ts`, that it reads through `untrack`, that `unregisterChild`
  reads it once, and that the wait release in `finishExit` / `cancelExit` no
  longer depends on the current mode.
- `syncModeTracking` runs from an `$effect.pre`, so a mode change and a child
  removal in the same synchronous update can run the removal first; that one
  exit then uses the non-pop placement. Upstream measures at that moment
  instead. Not worth more machinery now; if a report shows it, seed in
  `unregisterChild` when `child.element` is still connected.
- The memory rule on sign-off pages asks for an upstream twin with identical
  buttons. If this page goes to a human sign-off, add a React twin with the
  same mode picker and `Swap card` button.
