# Plan 017: An owned presence wrapper that nothing registers with leaves at once, and `usePresence()` registers its own participant (upstream parity)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report. Do not
> improvise. When done, report back to the dispatcher. Do not edit the batch README yourself (lanes never edit it).
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4220**. Prefix every Playwright command with `PW_PORT=4220`.
> Port 4198 belongs to the maintainer: never use it and never kill it. Never set `PW_REUSE_SERVER`.
>
> **Where**: worktree `/Users/jasonkummerl/Github/svelte-motion-1471-lazy`, branch `lane/1471-lazy`. At plan time
> the lane (`3d9ba7cd`) is fully merged into `feat/motion-14.7.1`. **First, in the lane:**
>
> 1. `git merge --no-ff feat/motion-14.7.1` (message: `Merge branch 'feat/motion-14.7.1' into lane/1471-lazy (for
>    plan 017)`, ending with the `Co-Authored-By` line below).
> 2. `pnpm install --frozen-lockfile` → exit 0.
>
> **Precondition (git ancestry, not README rows)**. Each must print what is stated, otherwise STOP:
>
> - `git merge-base --is-ancestor 6ef9b56a HEAD && echo 012-in` → `012-in` (plan 012's merge into feat).
> - `git merge-base --is-ancestor cbe8de4c HEAD && echo base-in` → `base-in` (this plan's planned-at SHA).
> - `grep -n "if (!presence || !measureLayoutMounted || !visualElement || !motionDomProjection) return" src/lib/html/_MotionContainer.svelte`
>   → one line (012 P2's node gate, see "Current state").
>
> **Drift check (run after the merge)**:
> `git diff --stat cbe8de4c..HEAD -- src/lib/utils/presenceExitRegistry.ts src/lib/utils/presenceExitRegistry.spec.ts src/lib/utils/usePresence.ts src/lib/utils/usePresence.spec.ts src/lib/components/PresenceChild.svelte src/lib/components/AnimatePresence.svelte src/lib/components/__tests__ src/lib/components/featurelessM.spec.ts src/lib/html/_MotionContainer.spec.ts src/lib/index.ts src/routes/tests/use-presence src/routes/tests/lazy-motion/featureless-m-presence e2e/utilities/use-presence.spec.ts e2e/lazy-motion/featureless-m-presence.spec.ts docs/src/routes/docs/use-presence docs/src/routes/docs/animate-presence docs/src/routes/examples/use-presence docs/src/lib/examples/use-presence`
> Expected: empty. `src/lib/utils/presence.ts` is expected to drift (plan 015c edits it on another lane); this plan
> only touches its `PresenceChildContext` type, so re-locate that type by its anchor and carry on. For any other
> listed file, compare the "Current state" excerpts with the live code: line numbers may move, the code must match.
> On a content mismatch, STOP.
>
> **Red tests first.** Step 1 writes every test and page change and is committed RED before any `src/lib` source
> change. Tester UI stays hidden under `?@isPlaywright=true`. Visual claims are verified on every painted frame
> (in-page `requestAnimationFrame` loops), never by sampling rects.

> **Revision 2026-11-04 (guard, operator-approved, after the first Step 1 run).** The executor stopped in Step 1:
> O2b and M1 passed at baseline. Cause: at baseline a `const presence = usePresence()` made at init returns a
> `[true, null]` snapshot that never updates, so the consumer never gets a `safeToRemove`, the motion exits hold
> the wrapper, and both tests pass vacuously ("whole-wrapper release today" only happens with the legacy
> `$derived` probe). Amendments:
> 1. **O2b** first asserts the probe received a callback once the exit starts
>    (`expect(probe.dataset.tupleHasCallback).toBe('true')`, or the probe's equivalent attribute) before clicking
>    `probe`. That precondition is what fails at baseline.
> 2. **M1** adds (d): `MixedExit.svelte`'s CSS consumer sets `data-released="true"` on `mixed-css` when it calls
>    its `safeToRemove`, and the frame log records it. Assert some frame shows `mixed-css` with
>    `data-released="true"` (the consumer got and used its callback) before the removal frame. (d) is what fails at
>    baseline. (a)-(c) stay.
> 3. **`pnpm check` in Steps 1 and 2** may report exactly the 7 errors in `presenceExitRegistry.spec.ts` from R1/R2
>    calling `completeIfEmpty`, which Step 3 adds. They are red tests too: no cast to hide them. Any other error is
>    a failure. From Step 3 on, 0 errors.
> 4. **Accepted executor choices:** the `shape` prop on `PresenceHarness.svelte` (P3-P5), arrow-wrapped
>    `register`/`markLegacyManual` props in `FakePresenceContextHarness.svelte`, E3's two un-awaited `rerender`
>    calls, and L2's `console.warn` spy. The lane merge `10a6d91f` was amended (message only) with
>    `--no-verify`; accepted.

## Status

- **Priority**: P1 (operator ruling: ships in 2.7.0 together with 016)
- **Effort**: M (about 60 lines of library change, about 20 new or rewritten unit cases, two e2e cards, docs)
- **Risk**: MED. It changes a public API's usage pattern (`usePresence`) and when an owned wrapper leaves. The
  legacy `$derived(usePresence())` pattern keeps today's behaviour, with a dev warning.
- **Depends on**: 016 (same lane, merged) and 012 (merged into `feat/motion-14.7.1` as `6ef9b56a`). 012 P2's node
  gate is in place (see "Current state").
- **Wave**: after 012 (lane `lazy`, after 016)
- **Category**: direction (upstream parity, behaviour change)
- **Planned at**: commit `cbe8de4c` on `feat/motion-14.7.1`, 2026-11-04. `git log --oneline -3` at plan time:
  `cbe8de4c docs(plans): 015c pre-flight after 012 merged (expected presence.ts drift)`, `8516cf20 docs(plans):
  015b's no-exit clone note and the scroll-siblings header after 012`, `e08cb6a1 fix(layout): keep an app's own
  overflow-anchor written during the hand-off hold`. Stub first written against `lane/1471-lazy` `3547bb8c`
  (2026-10-28).

## Operator rulings (decided; do not re-open)

1. **API, upstream-faithful.** `usePresence()` is called once at component init (`const presence =
   usePresence()`). It registers one participant with the nearest `PresenceChild`'s registry, with `onDestroy`
   cleanup, and returns a reactive tuple-like value: `const [isPresent, safeToRemove] = presence` inside
   `$effect` or the template stays reactive. Its `safeToRemove` completes only its own participant (upstream
   `use-presence.ts:59-62`). `useIsPresent()` stays read-only and never registers.
2. **Backward compatibility.** A call made inside a reactive context (detected with `$effect.tracking()`), i.e. the
   old `$derived(usePresence())` pattern, cannot register once. It sets an idempotent per-`PresenceChild` "legacy
   manual" flag that keeps today's behaviour for that wrapper, and in dev it warns once per wrapper, pointing to
   `const presence = usePresence()`. See Design 4 for exactly what "today's behaviour" means.
3. **Registry.** An exit cycle with no participants (and no legacy flag) completes after Svelte's synchronous flush:
   `queueMicrotask` after `notifyExitStart()`, so start is always notified before complete, with re-entry guards
   making it a no-op. Drop the `!participated` rule and its JSDoc sentence. **Rejected alternative**: a node-less
   `m` registering a participant that completes on exit start. It is not upstream's mechanism, and it is wrong in
   the mixed case: a wrapper with a featureless `m` plus a `usePresence` consumer would leave at once, where
   upstream waits for the consumer.
4. **Migrate every in-repo call site** to `const presence = usePresence()`, docs included. The docs explain the new
   pattern and the legacy deprecation. The changeset describes the behaviour change and the API usage change. The
   changeset uses `patch` like its siblings; never change `package.json` `"version"`.

## Why this matters

Upstream, a `PresenceChild` that nothing registered with completes as soon as its exit starts. Only the exit
feature (which needs a VisualElement), `MeasureLayout`, nested propagating boundaries and `usePresence()` register.
After plan 016 a featureless `m` has no VisualElement, so it registers nothing. In the clone path (`{#if}` children)
016 already makes it leave at once. In the owned path (`<AnimatePresence present>` + `child` snippet, or
`<PresenceChild>`) svelte-motion still holds an empty wrapper until a manual `safeToRemove` that nothing will call,
so the `m` never leaves and `onExitComplete` never fires. The hold exists only because `usePresence()` doesn't
register: if empty wrappers left at once today, every manual `usePresence` wrapper would vanish. So both halves have
to land together. Upstream's `usePresence` consumer holds the wrapper until its own `safeToRemove`, and the wrapper
leaves when every participant is done. svelte-motion's `safeToRemove` releases the whole wrapper, cutting motion
exits short. The maintainer's rule is to adopt upstream wherever we diverge.

## Current state

### Upstream (`~/Github/motion`, read with `git show v14.7.1:<path>`)

- `packages/framer-motion/src/components/AnimatePresence/PresenceChild.tsx`:
  - `:67-75`: `onExitComplete(childId)` marks the child complete and calls the wrapper's `onExitComplete` once
    every child is complete.
  - `:76-87`: `register(childId, node)` adds an incomplete child. Its cleanup deletes it and completes the wrapper
    when `!isPresentRef.current && !presenceChildren.size`.
  - `:100-102`: every child is reset to incomplete when `isPresent` changes.
  - `:104-113`: "If there's no `motion` components to fire exit animations, we want to remove this component
    immediately." `React.useEffect(() => { !isPresent && !presenceChildren.size && onExitComplete &&
    onExitComplete() }, [isPresent])`. This runs after the commit, so every child that registers in that commit is
    counted.
- `packages/framer-motion/src/motion/features/animation/exit.ts:73-83`: `ExitAnimationFeature.mount()` calls
  `register(this.id, this.node)`. It needs a VisualElement, so a featureless `m` never registers.
- `packages/framer-motion/src/components/AnimatePresence/use-presence.ts`:
  - `:40-47`: `usePresence(subscribe = true)` returns `[true, null]` outside a `PresenceContext`.
  - `:52-57`: `const id = useId(); useEffect(() => { if (subscribe) return register(id) }, [subscribe])`. It
    registers once per component instance.
  - `:59-62`: `safeToRemove = useCallback(() => subscribe && onExitComplete && onExitComplete(id), [id,
    onExitComplete, subscribe])`. It completes only this participant.
  - `:64`: `return !isPresent && onExitComplete ? [false, safeToRemove] : [true]`.
  - `:67-90`: `useIsPresent()` only reads the context and never registers.

### svelte-motion at `cbe8de4c`

**`src/lib/utils/presenceExitRegistry.ts`** (the per-wrapper participant registry, 95 lines):

- `:5-10` JSDoc: "Like upstream PresenceChild, registered IDs track completion. Empty manual wrappers intentionally
  keep their hold until explicitly released."
- `:19-34`:
  ```ts
      const participants = new Map<ParticipantId, { complete: boolean }>()
      let cycle = 0
      let active = false
      let participated = false
      let finish: (() => void) | undefined
      let popNode: VisualElement | undefined

      function checkComplete() {
          if (!active || !participated) return
          for (const participant of participants.values()) {
              if (!participant.complete) return
          }
          const callback = finish
          cancel()
          callback?.()
      }
  ```
- `:52` `if (active) participated = true` (in `register`); `:59-64` the disposer deletes and calls
  `checkComplete()`; `:78-92` `begin(onComplete)` cancels, sets `active = true`, `participated = participants.size
  > 0` (`:81`), resets every participant to incomplete and returns a version-checked `(id) => …` completer.
- **Finding (contradicts the stub's framing):** the `!participated` guard is dead code. `checkComplete()` is only
  reached from a completer or a disposer that found its participant in the map. Such a participant was either in
  the map when `begin()` ran (so `participated` was set true at `:81`) or registered while active (`:52`). The hold
  on an empty wrapper comes from the fact that **nothing calls `checkComplete()` when the cycle has no
  participants**, not from that guard. Dropping the guard alone changes nothing. The behaviour change is the new
  `completeIfEmpty()` call (Design 1).
- Spec `src/lib/utils/presenceExitRegistry.spec.ts:20-31` `holds an empty manual wrapper, including unknown mount
  completions`: `begin`, `complete(1)` (unknown) → not done; `register(1)` + `dispose()` twice → done once.

**`src/lib/components/PresenceChild.svelte`** (395 lines):

- `:21-36` component JSDoc: "Holds its `children` snippet rendered until the consumer signals the exit is complete
  via `safeToRemove()`, or all registered motion exits finish. Manual removal releases the entire wrapper."
- `:76-82`: `const exitRegistry = createPresenceExitRegistry()`, `completeDescendant`, `currentSafeToRemove`, and
  `noopSafeToRemove`.
- `:93` `let destroyed = false` (set in `onDestroy`, `:374`).
- `:262-276` `mintSafeToRemove()`: the minted `self` returns unless `currentSafeToRemove === self && phase ===
  'holding'`, then `exitRegistry.cancel()`, `removePop()`, `phase = 'completed'`, `currentSafeToRemove =
  noopSafeToRemove`, `animatePresence?.notifyExitComplete()`. This is the **whole-wrapper** release.
- `:280-291`:
  ```ts
      setPresenceChildContext({
          get isPresent() {
              return isPresent
          },
          get safeToRemove() {
              return currentSafeToRemove
          },
          register: exitRegistry.register,
          get onExitComplete() {
              return completeDescendant
          }
      })
  ```
- `:333-340`, exit start:
  ```ts
          } else if (prevPresent && !current && currentPhase === 'idle') {
              cancelWaitEnterBlock()
              // Before the DOM update, so the element is measured in flow.
              if (animatePresence?.mode === 'popLayout') applyPop()
              phase = 'holding'
              currentSafeToRemove = mintSafeToRemove()
              completeDescendant = exitRegistry.begin(currentSafeToRemove)
              animatePresence?.notifyExitStart()
  ```
  Completing synchronously inside `begin()` would call `notifyExitComplete` before `notifyExitStart`. In `mode="wait"`
  that leaves the counter stuck (`presence.ts` `startExit` sets `enterBlocked = true` and `finishExit` only unblocks
  at `inFlightExits === 0`), so the completion must come later.
- `:341-350` re-entry mid-hold: `exitRegistry.cancel()`, `phase = 'idle'`, `currentSafeToRemove = noopSafeToRemove`,
  `notifyExitComplete()`. `:385-389` destroy mid-hold settles once.

**Who registers with a `PresenceChild` today** ("empty" = none of these):

- The exit feature of every motion node that has a VisualElement and a presence context:
  `src/lib/utils/visualElementCore.ts:264-268` (`register(this.id, this.node)` in `mount()`), fed by
  `buildPresenceContext()` in `src/lib/html/_MotionContainer.svelte:449-462`. It runs inside the node's mount
  `$effect` (`node.updateFeatures()`, `_MotionContainer.svelte:2283-2291`), so it lands in the mount flush.
- 012 P2's measure participant, `src/lib/html/_MotionContainer.svelte:2877-2886`:
  ```ts
      const measureParticipantId = `measure-${componentHydrationId}`

      // P2: one participant while `MeasureLayout` would be rendered. A
      // featureless `m` has no node, so it registers nothing (plan 016).
      $effect(() => {
          const presence = presenceChildContext
          if (!presence || !measureLayoutMounted || !visualElement || !motionDomProjection) return
          if (!motionDomProjection.isMounted) return
          return untrack(() => presence.register(measureParticipantId))
      })
  ```
  **016's "Merge hazards" node gate is in place** (`!visualElement`). A featureless `m` registers nothing, as
  upstream.
- A nested propagating `AnimatePresence` (`src/lib/components/AnimatePresence.svelte:113-117`,
  `parentPresence!.register(presenceId)`).
- `usePresence()` registers nothing (below). Plain DOM elements register nothing.

**`src/lib/utils/usePresence.ts`** (114 lines, plain `.ts`, so it cannot use runes):

- `:8` `export type UsePresenceState = [true, null] | [false, () => void]` (public, `src/lib/index.ts:209`).
- `:40-56` JSDoc: "This explicitly releases the whole wrapper … Reading this hook does not add a separate hold …
  For independent custom exit work, use a separate manual `<PresenceChild>` boundary."
- `:61-80` JSDoc example uses `const presence = $derived(usePresence())` (`:67`).
- `:82-86`:
  ```ts
  export const usePresence = (): UsePresenceState => {
      const context = getPresenceChildContext()
      if (!context) return [true, null]
      return context.isPresent ? [true, null] : [false, context.safeToRemove]
  }
  ```
  It returns a fresh snapshot each call, so callers must re-call it in `$derived`. Called once at init today it
  would never update.

**`src/lib/utils/presence.ts:2966-2988`** `PresenceChildContext` type: `isPresent` (getter), `safeToRemove`,
`register`, `onExitComplete` (getter), optional `propagated`. **Three** places construct one:
`PresenceChild.svelte:280`, `AnimatePresence.svelte:140-150` (propagating legacy boundary), and the spike page
`src/routes/tests/_spike-clone-exit/SpikeExitProbe.svelte:87-96`. So a new member must be **optional**.

**`src/lib/components/AnimatePresence.svelte:125-163`** (propagating legacy boundary): it counts
`liveParticipants` beside its own `innerRegistry` and, on the parent's exit, `if (liveParticipants === 0)
releaseParent() else completeInner = innerRegistry.begin(releaseParent)`. Its comment at `:155-156` says "the
registry keeps empty holds open by design, so it can't be relied on here". That comment is false once
`completeIfEmpty()` exists (Step 3 removes the duplicate counter).

**Every `usePresence` call site** (`git grep -n "usePresence(" -- src docs/src e2e tests`, excluding
`usePresenceData`, at `cbe8de4c`):

| File | Line | Today |
| --- | --- | --- |
| `src/lib/utils/usePresence.ts` | `:67` | JSDoc example, `$derived(usePresence())` |
| `src/lib/components/__tests__/PresenceProbe.svelte` | `:5-6` | `const presence = $derived(usePresence())`, `const [tupleIsPresent, safeToRemove] = $derived(presence)` |
| `src/lib/components/__tests__/StalePresenceProbe.svelte` | `:15` | `$derived(usePresence())` |
| `src/routes/tests/use-presence/CustomExit.svelte` | `:4-5` | `$derived(usePresence())`, `$derived(presence[0])` |
| `src/routes/tests/use-presence/WaitChild.svelte` | `:7-8` | same |
| `docs/src/lib/examples/use-presence/demos/UsePresenceCard.svelte` | `:4-5` | same |
| `docs/src/routes/docs/use-presence/+page.svx` | `:56-57` | same, in the `<Card>` snippet |

Prose that describes the old semantics: `docs/src/routes/docs/use-presence/+page.svx:121-122` (outside),
`:124-133` ("Manual holds … Reading `usePresence()` does not add an independent hold"), `:135-154` ("`safeToRemove()`
remains an explicit release of the **whole wrapper** … does not register a second completion barrier"),
`:156-160` (a **stale** limitation: "`mode='popLayout'` … not implemented for `<PresenceChild>`"; `PresenceChild`
implements it, `PresenceChild.svelte:120-209`), `:174`, `:182-186`; `docs/src/routes/examples/use-presence/+page.svelte:96-100`;
`src/lib/components/PresenceChild.svelte:21-36`; `src/lib/utils/usePresence.ts:18-21, 40-56`.

**Tests that pin the old semantics** (they must change, as Step 1 lays out):

- `src/lib/html/_MotionContainer.spec.ts:862-873` `manual wrapper release may finish owned descendant exits early
  without double notification` (whole-wrapper release) and `:875-884` `reading usePresence does not add a barrier to
  owned descendant exits`. Both use `OwnedPresenceGroupHarness.svelte` with `manual: true`, which renders
  `PresenceProbe`.
- `src/lib/utils/usePresence.spec.ts:177-197` `settles exit accounting when the wrapper unmounts mid-hold`:
  `MidHoldDestroyHarness.svelte` holds a plain `<div>` with nothing registered and relies on the empty hold.
- `src/lib/utils/presenceExitRegistry.spec.ts:20-31` (above).

**Repo conventions to match**

- Runes only in `.svelte` / `*.svelte.ts` files (for example `src/lib/utils/booleanSnapshot.svelte.ts`,
  `toMotionValue.svelte.ts`, exported from `src/lib/index.ts:88` as `'$lib/utils/toMotionValue.svelte'`).
- Dev-only guards: `import { DEV } from 'esm-env'` (`src/lib/utils/log.ts:7`, `src/lib/utils/arc.ts:32`,
  `_MotionContainer.svelte:17`). `warnOnce` (`src/lib/utils/motionKind.ts:107`) dedupes by message across the page,
  which is not "once per wrapper", so don't use it here.
- Client-only node work is gated with `typeof window !== 'undefined'` (`_MotionContainer.svelte`'s VisualElement
  creation).
- Upstream citations in comments name the file, lines and tag: `(PresenceChild.tsx:104-113 @ v14.7.1)`.
- Google-style JSDoc on public functions and types (`@param`, `@returns`, `@example`).
- Unit tests: vitest + `@testing-library/svelte`. Fake timers and an rAF mock are global (`vitest.setup.ts:13, 30`).
  Use `flushTimers()` (`src/lib/__tests__/flushTimers.ts`), `tick()` and `vi.advanceTimersByTimeAsync(ms)`. Model
  probes on `src/lib/components/__tests__/StalePresenceProbe.svelte` (module-scoped sinks) and harnesses on
  `PresenceHarness.svelte`. Dev-warning tests spy on `console.warn` as `src/lib/components/LazyMotion.spec.ts:172`
  does.
- E2E pages: tester UI uses `TesterPanel` from `src/routes/tests/layout/_parity/TesterPanel.svelte` (it renders
  nothing under `?@isPlaywright=true`). Live verdict chips are gated by an `isTester` flag computed in `onMount`, as
  in `src/routes/tests/lazy-motion/featureless-m-presence/+page.svelte:40-47`. Painted-frame probes follow
  `e2e/lazy-motion/featureless-m-presence.spec.ts:19-45` (click inside `page.evaluate`, then record on each rAF).
- Changesets: `.changeset/<slug>.md` with `'@humanspeak/svelte-motion': patch` (see `.changeset/featureless-m.md`).

## Design

1. **Registry** (`presenceExitRegistry.ts`): delete `participated` (`:22`, `:27`'s `|| !participated`, `:52`,
   `:81`) and the JSDoc sentence at `:8-9`. Add:
   ```ts
           /**
            * Complete the active cycle if nothing is registered with it, as
            * upstream's post-commit effect does (PresenceChild.tsx:104-113 @
            * v14.7.1). A no-op outside a cycle or while any participant is
            * registered.
            */
           completeIfEmpty() {
               if (active && participants.size === 0) checkComplete()
           },
   ```
   `checkComplete()` with no participants finishes the cycle. Keep everything else, including the disposer's
   re-check (upstream `:81-86`).

2. **`PresenceChild.svelte`**: right after `animatePresence?.notifyExitStart()` (`:340`):
   ```ts
               // Nothing registered → leave now, as upstream's post-commit effect
               // does (PresenceChild.tsx:104-113 @ v14.7.1). A microtask runs after
               // Svelte's synchronous flush, so every descendant that registers in
               // this flush counts, and the start is always notified first.
               const cycle = currentSafeToRemove
               queueMicrotask(() => {
                   if (destroyed || legacyManual || currentSafeToRemove !== cycle || phase !== 'holding')
                       return
                   exitRegistry.completeIfEmpty()
               })
   ```
   `cycle` is the minted closure of this exit. A re-entry, a completion or a later exit replaces
   `currentSafeToRemove`, so a stale microtask does nothing. Add `let legacyManual = false` and the context member
   `markLegacyManual()` (Design 4). Update the component JSDoc (`:21-36`).

3. **`usePresence()`** moves to `src/lib/utils/usePresence.svelte.ts` (`git mv`, so `$effect.tracking()` is
   available; the repo puts rune-using utils in `*.svelte.ts`). Import paths become `'$lib/utils/usePresence.svelte'`.
   At component init (`$effect.tracking()` is `false` there: Svelte sets `active_reaction` to `null` while a
   branch effect runs, `svelte/src/internal/client/runtime.js:241`):
   - Outside a `PresenceChild`: return `[true, null]` (a plain array, as today).
   - Mint `const id = \`use-presence-${nextPresenceId++}\`` (module counter; the ids are never rendered, so SSR
     can't mismatch). On the client only (`typeof window !== 'undefined'`, since upstream registers in a client-only
     `useEffect`): `onDestroy(context.register(id))`.
   - Return **a frozen real `Array` whose indices `0` and `1` are getters**:
     ```ts
         const state = [] as unknown as UsePresenceState
         Object.defineProperties(state, {
             0: { enumerable: true, get: () => context.isPresent },
             1: { enumerable: true, get: () => (context.isPresent ? null : cycleSafeToRemove()) }
         })
         Object.freeze(state)
         return state
     ```
     `cycleSafeToRemove()` reads `context.onExitComplete` (the current cycle's versioned completer). It returns a
     cached `() => complete(id)` while that completer is unchanged and makes a new one when it changes. So identity
     is stable within an exit cycle and new across cycles, and a stale callback is a no-op (the registry's version
     check). Its call completes **only this participant**; the wrapper leaves when every participant is done
     (upstream `use-presence.ts:59-62`, `PresenceChild.tsx:67-75`).
   - **Why this shape.** Destructuring (`const [a, b] = presence`) uses `Array.prototype[Symbol.iterator]`, which
     reads each index through `[[Get]]`, so the getters run on every destructure. Inside `$effect`, `$derived` or
     the template that read is tracked (`context.isPresent` is backed by `PresenceChild`'s `$derived`). The return
     type stays the public `UsePresenceState` union, so existing TypeScript code compiles unchanged. A real array
     keeps `Array.isArray`, `length === 2`, spread and `JSON.stringify` working, which a plain object with getters
     plus a hand-written iterator would not. Freezing stops consumers from replacing the accessors. Reads at the
     top level of `<script>` (`const [isPresent] = usePresence()`) take a one-time snapshot. The JSDoc and docs
     must say so.

4. **Legacy path** (ruling 2). If `$effect.tracking()` is `true`:
   - `const first = context.markLegacyManual?.() ?? false`. `PresenceChild`'s implementation sets `legacyManual =
     true` and returns `true` only on the first call. `AnimatePresence`'s propagating context and the spike page
     don't implement it (optional member), so nothing changes there.
   - `if (first && DEV) console.warn(LEGACY_USE_PRESENCE_WARNING)`. The message (module constant, not exported from
     `src/lib/index.ts`) is: ``usePresence() was called inside a reactive context (for example `$derived(usePresence())`),
     so it can't register with its PresenceChild. The wrapper keeps the old behaviour: it doesn't leave on its own
     and safeToRemove() releases the whole wrapper. Call it once at component init instead: `const presence =
     usePresence()`, then read `presence` in $effect or the template. See
     https://motion.svelte.page/docs/use-presence``.
   - Return today's snapshot: `context.isPresent ? [true, null] : [false, context.safeToRemove]` (the
     whole-wrapper release). Never call `register` or `onDestroy` on this path.
   - **What "today's behaviour" means here.** A legacy wrapper skips only the new empty-cycle completion (the
     `legacyManual` check in Design 2). Everything else is today's code. So a legacy wrapper with no motion
     participants holds until the legacy `safeToRemove`, which releases the whole wrapper. A legacy wrapper with
     motion participants still leaves when they finish, or earlier on the legacy `safeToRemove`, exactly as today.
     Ruling 2's wording ("holds until a `safeToRemove` from that call") describes the first case. The second case
     keeps today's behaviour rather than adding a new barrier, so no legacy app changes behaviour (the dispatcher's
     report flags this reading).
   - The flag is sticky for the wrapper's lifetime, even if the legacy consumer unmounts.

5. **`AnimatePresence.svelte` propagating boundary** (`:125-163`): delete `liveParticipants` and its counting
   wrapper (pass `innerRegistry.register` straight into the context, keeping the `VisualElement` cast). On the
   parent's exit: `completeInner = innerRegistry.begin(releaseParent); innerRegistry.completeIfEmpty()`. This stays
   synchronous: the parent's own start was already notified (this effect reacts to the parent's `isPresent` flip),
   and today's `releaseParent()` there is synchronous too. Replace the false comment with a citation of
   `PresenceChild.tsx:104-113`.

6. **Not changed**: the clone path (`presence.ts` exits), `_MotionContainer.svelte` (012 P2's gate is already
   right), `useIsPresent`, `usePresenceData`, `UsePresenceState`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| One unit file | `pnpm exec vitest run <path>` | as stated per step |
| All unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Library build + package validation | `pnpm build` (`vite build` + `svelte-package` + `publint`) | exit 0, publint clean |
| Consumer SSR | `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` | prints `Vite 6 consumer SSR regression checks passed.` |
| E2E | `PW_PORT=4220 pnpm exec playwright test <paths>` | as stated per step |
| Docs typecheck | `pnpm --filter docs check` | 0 errors |
| Docs build (regenerates `docs/src/lib/demo-loaders.ts` / `demo-manifest.json`) | `pnpm build && rm -rf docs/node_modules/.vite && pnpm --filter docs exec vite build` | exit 0 |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

(`.trunk/trunk.yaml` is the lint/format authority; do not use `pnpm lint` or `prettier` directly. pnpm does not
forward `-- --flags` to vite. The docs consume the built `dist`, so rebuild the library before any docs step.)

## Scope

**In scope** (the only files you should modify or create):

- Library:
  - `src/lib/utils/presenceExitRegistry.ts`;
  - `src/lib/components/PresenceChild.svelte`;
  - `src/lib/components/AnimatePresence.svelte` (only `:125-163`, Design 5);
  - `src/lib/utils/presence.ts` (only the `PresenceChildContext` type: the optional `markLegacyManual` member and
    the `safeToRemove` doc line);
  - `src/lib/utils/usePresence.ts` → `src/lib/utils/usePresence.svelte.ts` (`git mv`, then edit);
  - `src/lib/index.ts` (`:208-209`, import path only).
- Unit tests and probes:
  - `src/lib/utils/presenceExitRegistry.spec.ts`;
  - `src/lib/utils/usePresence.spec.ts`;
  - `src/lib/html/_MotionContainer.spec.ts` (only `:862-884` and new cases next to them);
  - `src/lib/components/featurelessM.spec.ts` (new cases after U12);
  - `src/lib/components/__tests__/`: `PresenceProbe.svelte`, `StalePresenceProbe.svelte`, `PresenceDataProbe.svelte`
    (import path only), `PresenceHarness.svelte`, `MidHoldDestroyHarness.svelte`, `OwnedPresenceGroupHarness.svelte`,
    plus new `LegacyPresenceProbe.svelte`, `IsPresentOnlyProbe.svelte`, `PresenceShapeProbe.svelte`,
    `FakePresenceContextHarness.svelte`, `EmptyWaitSwapHarness.svelte`, `LegacyWarnHarness.svelte`,
    `FeaturelessOwnedPresenceProbe.svelte`.
- Pages and e2e:
  - `src/routes/tests/lazy-motion/featureless-m-presence/+page.svelte` (new "Owned exit" card, header comment,
    tester step);
  - `src/routes/tests/use-presence/+page.svelte` (new "Each participant holds its own" section, a `TesterPanel`);
  - `src/routes/tests/use-presence/MixedExit.svelte` (create);
  - `src/routes/tests/use-presence/CustomExit.svelte`, `WaitChild.svelte` (migration);
  - `e2e/lazy-motion/featureless-m-presence.spec.ts`, `e2e/utilities/use-presence.spec.ts` (new tests only).
- Docs:
  - `docs/src/routes/docs/use-presence/+page.svx`;
  - `docs/src/routes/docs/animate-presence/+page.svx` (one sentence after `:123`);
  - `docs/src/routes/examples/use-presence/+page.svelte` (`:96-100`);
  - `docs/src/lib/examples/use-presence/demos/UsePresenceCard.svelte`;
  - the generated `docs/src/lib/demo-loaders.ts` and `docs/src/lib/demo-manifest.json` (regenerated by the docs
    build, never hand-edited).
- `.changeset/use-presence-participant.md` (create).

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/html/_MotionContainer.svelte`: 012 P2's gate is already correct. If a step seems to need it, STOP.
- `src/lib/utils/presence.ts` beyond the type (015c edits this file on another lane; keep the diff to the type).
- `src/lib/utils/visualElementCore.ts` (the exit feature's registration is upstream-shaped already).
- `src/routes/tests/_spike-clone-exit/**` (throwaway spike pages; the optional member keeps them compiling).
- `useIsPresent` / `usePresenceData` behaviour; `UsePresenceState`'s definition.
- `package.json` `"version"`, PR labels, `.agents/.plans/motion-14-7-1/README.md`, other plans.

## Git workflow

- Work on `lane/1471-lazy` in `/Users/jasonkummerl/Github/svelte-motion-1471-lazy`, after the merge in the header.
- Conventional commits, one per step, for example:
  - `test(presence): red, empty owned wrappers leave and usePresence registers (plan 017)`;
  - `feat(presence): usePresence registers its own participant; legacy reactive calls keep the old hold (plan 017)`;
  - `fix(presence): an owned wrapper with nothing registered leaves at once (plan 017)`;
  - `refactor(presence): migrate usePresence call sites to the init-time pattern (plan 017)`;
  - `docs(presence): usePresence registers once at init; legacy pattern deprecated (plan 017)`.

  End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR (the maintainer signs off on the live demo first). Never change `"version"`; never add
  labels.

## Steps

### Step 1: Red tests, guards and pages (commit RED)

Write everything below before touching any non-test `src/lib` file. Each case is labelled **RED** (fails at
`cbe8de4c`) or **GUARD** (passes there and must stay green). Probes and harnesses import from
`'$lib/utils/usePresence'` for now; Step 2 changes the path.

**1.1 Probes and harnesses** (`src/lib/components/__tests__/`):

- `PresenceProbe.svelte`: migrate. Keep the same attributes, test id and click/Enter handlers:
  ```svelte
      const isPresent = $derived(useIsPresent())
      const presence = usePresence()
      const tupleIsPresent = $derived(presence[0])
      const safeToRemove = $derived(presence[1])
  ```
- `StalePresenceProbe.svelte`: `const presence = usePresence()`. The `$effect` destructuring and
  `data-is-present={presence[0]}` stay as they are.
- `LegacyPresenceProbe.svelte` (new): a copy of today's `PresenceProbe.svelte` (with `$derived(usePresence())` and
  `const [tupleIsPresent, safeToRemove] = $derived(presence)`), `data-testid="legacy-probe"`. Header comment: "The
  deprecated reactive-call pattern; plan 017 keeps its behaviour."
- `PresenceHarness.svelte`: add `legacy = false` and `count = 1` props. Render `count` probes (`{#each}`), each
  `LegacyPresenceProbe` when `legacy`, otherwise `PresenceProbe`.
- `MidHoldDestroyHarness.svelte`: add a `probe = true` prop. When true, render a `<PresenceProbe />` next to
  `held-child` inside the `PresenceChild`. Update its comment: the hold is now the probe's registered participant,
  which never calls `safeToRemove`.
- `OwnedPresenceGroupHarness.svelte`: add `legacy = false` and `featureless = false` props.
  `{#if manual}{#if legacy}<LegacyPresenceProbe />{:else}<PresenceProbe />{/if}{/if}`. With `featureless`, also
  render `<m.div data-testid="owned-featureless" exit={{ opacity: 0 }} transition={{ duration: 1 }} />` (import `m`
  from `'$lib'`, no `LazyMotion`).
- `PresenceShapeProbe.svelte` (new): calls `const presence = usePresence()` at init and stores it in a module sink
  (`getShapeState()`). An `$effect` does `const [isPresent, safeToRemove] = presence` and pushes `{ isPresent,
  hasCallback: typeof safeToRemove === 'function', callback: safeToRemove }` to a module log (`getShapeLog()`,
  `resetShape()`).
- `FakePresenceContextHarness.svelte` (new): props `present: boolean`, `register: (id) => () => void`,
  `markLegacyManual?: () => boolean`, `probe: 'init' | 'legacy' | 'is-present' = 'init'`, `show = true`. It calls
  `setPresenceChildContext({ get isPresent() { return present }, safeToRemove: () => {}, register, get
  onExitComplete() { return () => {} }, markLegacyManual })` (cast to `PresenceChildContext`: the member doesn't
  exist yet). Under `{#if show}` it renders `PresenceProbe`, `LegacyPresenceProbe` or `IsPresentOnlyProbe` for
  `probe`. (In the tables below, "Fake `legacy: true`" means `probe: 'legacy'`.)
- `IsPresentOnlyProbe.svelte` (new): `const isPresent = $derived(useIsPresent())`, rendered as
  `data-testid="is-present-probe" data-is-present={isPresent}`.
- `EmptyWaitSwapHarness.svelte` (new): `<AnimatePresence mode="wait" {onExitComplete}>` with two plain-content
  `PresenceChild`s, `present={slot === 'a'}` (`<div data-testid="slot-a">A</div>`) and `present={slot === 'b'}`
  (`data-testid="slot-b"`). Prop `slot: 'a' | 'b'`.
- `LegacyWarnHarness.svelte` (new): two `PresenceChild present={present}` wrappers, each with two
  `LegacyPresenceProbe`s.
- `FeaturelessOwnedPresenceProbe.svelte` (new): `<AnimatePresence present={show} {onExitComplete}>{#snippet
  child()}<m.div data-testid="owned-leaver" exit={{ opacity: 0 }} transition={{ duration: 1 }} />{/snippet}
  </AnimatePresence>`. A `lazy = false` prop wraps the same markup in `<LazyMotion features={domAnimation}>` (the
  control).

**1.2 `src/lib/utils/presenceExitRegistry.spec.ts`**: replace `:20-31` with R1-R3.

| # | Case | Label | Why, at `cbe8de4c` |
| --- | --- | --- | --- |
| R1 | `completes an empty cycle once completeIfEmpty is called, ignoring unknown completions`: `begin(done)`, `complete(1)` → not called; `completeIfEmpty()` twice → called once | RED | `completeIfEmpty` doesn't exist (TypeError) |
| R2 | `completeIfEmpty does nothing with a pending participant, after cancel, or outside a cycle` (three sub-asserts, `done` never called) | RED | same |
| R3 | `a participant that registers and leaves during an empty cycle completes it` (the old `:26-30` half) | GUARD | disposer re-check `:59-64` |

**1.3 `src/lib/utils/usePresence.spec.ts`**. The existing cases go RED once the probes are migrated, because at init
today `usePresence()` returns a snapshot that never updates:

| # | Case | Label | Why |
| --- | --- | --- | --- |
| — | `:29` outside `[true, null]`; `:60` reports present; `:91` creates once; `:160` re-entry stale no-op | GUARD | values are `true`/`null` either way |
| — | `:67` flips and exposes safeToRemove; `:76` MountFlip (`data-tuple-has-callback`); `:100` safeToRemove unmounts; `:110` idempotent; `:122` stale callback | RED | static `[true, null]` snapshot (`usePresence.ts:82-86`) |
| — | `:177` mid-hold destroy (harness default `probe: true`) | GUARD | the hold doesn't depend on registration today |
| P1 | `registers one participant at init and unregisters on destroy` (Fake harness, `register` spy returning a disposer spy; `rerender({ show: false })` → disposer called once) | RED | never registers |
| P2 | `never registers again across presence flips` (flip `present` 3 times; `register` called exactly once) | RED | 0 calls |
| P3 | `returns a frozen two-item array whose items follow the wrapper` (real `PresenceChild` + `PresenceShapeProbe`; `Array.isArray`, `length === 2`, `Object.isFrozen`; after `present: false` → `state[0] === false`, `typeof state[1] === 'function'`) | RED | plain array, not frozen, never updates |
| P4 | `destructuring inside $effect re-runs on every flip` (log: `true/false` → `false/true` → `true/false`) | RED | effect never re-runs |
| P5 | `safeToRemove keeps its identity within a cycle and changes across cycles` (read `state[1]` twice in cycle A → same; re-enter, exit again → different) | RED | `state[1]` is `null` |
| P6 | `its safeToRemove completes only its own participant` (`PresenceHarness count: 2`; click first probe → both still mounted; click second → both removed) | RED | static snapshot, click is a no-op |
| P7 | `useIsPresent never registers` (Fake harness with `probe: 'is-present'`, which renders `IsPresentOnlyProbe`; flip `present` twice; `register` 0 calls) | GUARD | read-only |
| L1 | `legacy $derived(usePresence()) never registers and marks the wrapper` (Fake `legacy: true`; flip `present` 3 times; `register` 0 calls; `markLegacyManual` called at least once) | RED | `markLegacyManual` never called |
| L2 | `legacy consumer holds an otherwise empty wrapper, then releases it whole` (`PresenceHarness legacy: true`; `present: false`; `vi.advanceTimersByTimeAsync(2000)` → `legacy-probe` still mounted with `data-is-present="false"`; click → gone) | GUARD | the empty hold; must stay green after Step 3 |
| L3 | `warns once per legacy wrapper in dev` (`vi.spyOn(console, 'warn')`; render `LegacyWarnHarness`, flip `present` twice; warnings containing `const presence = usePresence()` → exactly 2) | RED | no warning |
| E1 | `a wrapper with nothing registered leaves at once` (`MidHoldDestroyHarness probe: false`; `inner: false`, `await tick()` twice → `held-child` gone, `onExitComplete` once; `advanceTimersByTimeAsync(1000)` → still once) | RED | empty hold |
| E2 | `wait mode: an empty leaver lets the next child in, notified once` (`EmptyWaitSwapHarness`: `slot: 'b'`, `advanceTimersByTimeAsync(100)` → `slot-a` gone, `slot-b` present, `onExitComplete` once) | RED | A holds forever and B stays enter-blocked. This also trips if a completion is ever notified before its start (the counter would stay raised) |
| E3 | `a re-entry before the microtask keeps the wrapper` (`MidHoldDestroyHarness probe: false`; in one test, call `rerender({ inner: false })` and `rerender({ inner: true })` without awaiting between them, then await `tick()` and `advanceTimersByTimeAsync(1000)` → `held-child` mounted; `onExitComplete` count equals the count for the same sequence with `probe: true`, run in the same test on a fresh render) | GUARD | stale-microtask guard (Design 2). If `rerender` can't be issued twice before a flush, use `flushSync` from `svelte` between two prop writes of a small wrapper; record which one you used |

**1.4 `src/lib/html/_MotionContainer.spec.ts`** (`controlledOwnedGroup`, `:809`):

| # | Case | Label | Why |
| --- | --- | --- | --- |
| G1 | `:862` renamed `legacy manual release may finish owned descendant exits early without double notification`, with `{ manual: true, legacy: true }` (probe test id `legacy-probe`) | GUARD | whole-wrapper release; legacy keeps it |
| G2 | `:875` renamed `a legacy usePresence read does not add a barrier to owned descendant exits`, with `{ manual: true, legacy: true }` | GUARD | today's no-barrier rule; legacy keeps it |
| O2 | `a usePresence consumer holds owned descendant exits until its own safeToRemove` (`{ manual: true }`: complete fast + slow → `owned-group` still mounted, `onExitComplete` not called; click `probe` → removed, once) | RED | the probe has no participant, so the motion exits complete the wrapper |
| O2b | `a usePresence safeToRemove does not cut owned descendant exits short` (`{ manual: true }`: `present: false`, click `probe` → `owned-fast`/`owned-slow` still mounted; complete both → removed, once) | RED | whole-wrapper release today |
| O2c | `a featureless m beside a usePresence consumer waits for the consumer` (`{ manual: true, featureless: true, fastPresent: false, slowPresent: false }`: `present: false`, `flushTimers()` twice → `owned-group` mounted; click `probe` → removed, once) | RED | the probe's click does nothing (static snapshot) |
| O3 | the existing `:846` `retains owned descendant exits until both …` (unchanged) | GUARD | featured exits still wait |

**1.5 `src/lib/components/featurelessM.spec.ts`** (after U12, same `getAnimations` stub):

| # | Case | Label | Why |
| --- | --- | --- | --- |
| U13 (O1) | `a featureless m in an owned presence leaves at once and onExitComplete fires once` (`FeaturelessOwnedPresenceProbe`; `show: false`, `tick()` twice → `owned-leaver` gone, `onExitComplete` once; `advanceTimersByTimeAsync(2000)` → still once) | RED | the empty wrapper holds |
| U14 | `an m with LazyMotion features in an owned presence still runs its exit` (`lazy: true`; after `show: false` + `flushTimers()` the element is still mounted; `onExitComplete` not yet called) | GUARD | the node registers via the exit feature |

**1.6 Pages.**

- `src/routes/tests/lazy-motion/featureless-m-presence/+page.svelte`: add a fourth card, "Owned exit", after the
  wait-leave card. Button `data-testid="toggle-owned"`, state `showOwned`. Left slot:
  `<AnimatePresence present={showOwned} onExitComplete={() => ownedBareCompletions++}>{#snippet child()}<m.div
  data-testid="owned-bare" class="box" initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} exit={{ opacity: 0,
  scale: 0.5 }} {transition}>bare</m.div>{/snippet}</AnimatePresence>`. Right slot: the same inside `<LazyMotion
  features={domAnimation}>`, `data-testid="owned-control"`, `class="box control"`. Show `<span
  data-testid="owned-bare-completions">{ownedBareCompletions}</span>`. Add a header bullet ("owned exit: the same
  pair in the owned `present` + `child` form; nothing registers for the bare `m`, so its wrapper leaves at once,
  `PresenceChild.tsx:104-113`"). Add a 4th `TesterPanel` step and a chip (`ownedVerdict`) computed like `runExit`:
  bare painted on 0 frames, control painted on at least 3. Update the `status` line to "all four chips".
- `src/routes/tests/use-presence/MixedExit.svelte` (create): calls `const presence = usePresence()` at init. It
  renders a CSS card (`data-testid="mixed-css"`, 300 ms opacity transition, calls `safeToRemove` on
  `transitionend` with a 360 ms fallback, as `CustomExit.svelte` does) and, beside it, `<motion.div
  data-testid="mixed-motion" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{
  duration: 1.2, ease: 'linear' }}>`. A comment cites `use-presence.ts:59-62`.
- `src/routes/tests/use-presence/+page.svelte`: new section "Each participant holds its own" before the
  `mode='wait'` section. Button `data-testid="toggle-mixed"`, `<span data-testid="mixed-completions">`,
  `<AnimatePresence present={mixedPresent} onExitComplete={() => { if (!mixedPresent) mixedCompletions += 1 }}>{#snippet
  child()}<MixedExit />{/snippet}</AnimatePresence>`, wrapped in `{#if mounted}` like the group demo. Add a
  `TesterPanel` (import `../layout/_parity/TesterPanel.svelte`) with one step for this section. Expected: "The CSS
  card fades in 0.3 s but both cards stay until the motion card has faded out (1.2 s); then both leave together and
  completions reads 1." Add a verdict chip under an `isTester` flag (`onMount`, not under `@isPlaywright=true`):
  it records every frame after the click; OK when the last painted motion opacity is at most 0.1, both cards leave
  on the same frame, and some frame at 400 ms or later still shows both.

**1.7 E2E** (new tests only; never weaken existing ones):

- `e2e/lazy-motion/featureless-m-presence.spec.ts`, **O4 (RED)** `an owned featureless m leaves at once`: a
  painted-frame helper modelled on `exitFrames` (`:20-45`) clicks `toggle-owned` and records, for 30 frames, the
  count of `[data-testid="owned-bare"]` and whether `owned-control` is painted (in the DOM, `visibility` not
  hidden, opacity > 0). Assert: bare is 0 on every frame (today: 30 of 30), control is painted on at least 3 frames
  (GUARD half), and then `owned-bare-completions` has text `1`.
- `e2e/utilities/use-presence.spec.ts`, **M1 (RED)** `a usePresence consumer and a motion exit each hold the owned
  wrapper`: inside `page.evaluate`, click `toggle-mixed` and record on every frame `{ t, css: !!mixed-css,
  motion: !!mixed-motion, opacity }` until both are gone (2.5 s cap). Assert: (a) the last frame with
  `mixed-motion` has `opacity <= 0.1` (today about 0.75, because `safeToRemove` at about 0.3 s releases the whole
  wrapper); (b) the first frame without `mixed-css` is also the first frame without `mixed-motion`; (c) some frame
  with `t >= 400` still has both; then `mixed-completions` reads `1`. Navigate with `?@isPlaywright=true`.

**Verify**:

- `pnpm exec vitest run src/lib/utils/presenceExitRegistry.spec.ts src/lib/utils/usePresence.spec.ts src/lib/html/_MotionContainer.spec.ts src/lib/components/featurelessM.spec.ts`
  → exactly the RED cases above fail (R1, R2; the five listed existing usePresence cases, P1-P6, L1, L3, E1, E2;
  O2, O2b, O2c; U13). Every GUARD passes. `PW_PORT=4220 pnpm exec playwright test e2e/lazy-motion/featureless-m-presence.spec.ts e2e/utilities/use-presence.spec.ts`
  → only O4 and M1 fail.
- `pnpm check` → 0 errors apart from the 7 `completeIfEmpty` errors in `presenceExitRegistry.spec.ts` (Revision 3).
- Commit `test(presence): red, empty owned wrappers leave and usePresence registers (plan 017)`.

### Step 2: `usePresence()` registers once; the legacy path

1. `git mv src/lib/utils/usePresence.ts src/lib/utils/usePresence.svelte.ts`. Update the imports in
   `src/lib/index.ts:208-209` and in every probe under `src/lib/components/__tests__/` to
   `'$lib/utils/usePresence.svelte'`. Confirm with `git grep -n "utils/usePresence'" -- src` → no output.
2. `src/lib/utils/presence.ts`, `PresenceChildContext`: add the optional `markLegacyManual?: () => boolean` with
   JSDoc ("Set by a `usePresence()` call made inside a reactive context. The wrapper then keeps the pre-registration
   rule: an exit with nothing registered holds until the whole-wrapper `safeToRemove`. @returns `true` on the first
   call only, for a once-per-wrapper dev warning."). Reword `safeToRemove`'s doc to say it releases the whole
   wrapper and is what the legacy `usePresence` path returns.
3. `PresenceChild.svelte`: `let legacyManual = false`, and in the context object `markLegacyManual() { if
   (legacyManual) return false; legacyManual = true; return true }`.
4. `usePresence.svelte.ts`: implement Design 3 and Design 4 (`import { onDestroy } from 'svelte'`, `import { DEV }
   from 'esm-env'`). Rewrite the JSDoc:
   - The `useIsPresent` "Reactivity note" (`:18-21`): `usePresence()` is now called once at init and read
     reactively.
   - `usePresence` (`:40-80`): registers one participant at init; its `safeToRemove` completes only that
     participant; the wrapper leaves once every participant (motion exits, layout measurement, other consumers) is
     done; it must be called at init; top-level destructuring takes a snapshot; the legacy reactive-call pattern is
     deprecated (behaviour and dev warning). Keep `@see https://motion.dev/docs/react-use-presence` and cite
     `use-presence.ts:52-62 @ v14.7.1`.
   - The `@example` becomes:
     ```svelte
     <script lang="ts">
       import { usePresence } from '@humanspeak/svelte-motion'

       let node: HTMLElement | undefined = $state()
       const presence = usePresence()

       $effect(() => {
         const [isPresent, safeToRemove] = presence
         if (isPresent || !node) return
         const onEnd = () => safeToRemove()
         node.addEventListener('transitionend', onEnd, { once: true })
         node.classList.add('exiting')
         return () => node?.removeEventListener('transitionend', onEnd)
       })
     </script>
     ```

**Verify**: `pnpm exec vitest run src/lib/utils/usePresence.spec.ts src/lib/html/_MotionContainer.spec.ts`
→ P1-P6, L1, L3, the five existing usePresence REDs, O2, O2b and O2c pass. E1 and E2 still fail (Step 3). Every
GUARD passes. `pnpm check` → only the 7 `completeIfEmpty` errors (Revision 3). Commit `feat(presence): usePresence registers its own participant; legacy
reactive calls keep the old hold (plan 017)`.

### Step 3: An empty owned wrapper leaves at once

1. `presenceExitRegistry.ts`: Design 1 (remove `participated` and the JSDoc sentence at `:8-9`; add
   `completeIfEmpty()`; the JSDoc now says a cycle with nothing registered completes when its owner calls
   `completeIfEmpty()`, citing `PresenceChild.tsx:104-113`).
2. `PresenceChild.svelte`: Design 2 (the microtask after `notifyExitStart()`). Update the component JSDoc
   (`:21-36`): the wrapper leaves once every registered participant is done; with nothing registered it leaves at
   once; a legacy reactive `usePresence()` keeps the manual hold.
3. `AnimatePresence.svelte`: Design 5.

**Verify**:

- `pnpm exec vitest run src/lib/utils/presenceExitRegistry.spec.ts src/lib/utils/usePresence.spec.ts src/lib/html/_MotionContainer.spec.ts src/lib/components/featurelessM.spec.ts src/lib/components/animatePresencePropagate.spec.ts src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts`
  → all pass (R1, R2, E1, E2, U13 now green; L2, G1, G2, E3 and the propagate suite still green).
- `grep -n "participated" src/lib/utils/presenceExitRegistry.ts` → no output.
- `grep -n "liveParticipants" src/lib/components/AnimatePresence.svelte` → no output.
- `PW_PORT=4220 pnpm exec playwright test e2e/lazy-motion/featureless-m-presence.spec.ts e2e/utilities/use-presence.spec.ts e2e/animate-presence/owned-child.spec.ts e2e/animate-presence/owned-pop-layout.spec.ts e2e/animate-presence/modes.spec.ts`
  → all pass. O4 and M1 are now green. The existing use-presence tests still pass: `CustomExit` / `WaitChild` are
  still legacy here, which exercises the legacy path end-to-end.
- Commit `fix(presence): an owned wrapper with nothing registered leaves at once (plan 017)`.

### Step 4: Migrate the remaining call sites

- `src/routes/tests/use-presence/CustomExit.svelte:4` and `WaitChild.svelte:7`: `const presence = usePresence()`.
  Keep `const isPresent = $derived(presence[0])` and the `$effect` bodies as they are.
- `docs/src/lib/examples/use-presence/demos/UsePresenceCard.svelte:4`: the same.
- `git grep -n "\$derived(usePresence())" -- src docs/src e2e` → only `src/lib/components/__tests__/LegacyPresenceProbe.svelte`.

- In `e2e/utilities/use-presence.spec.ts`, add one test, `the page logs no legacy usePresence warning`: collect
  `page.on('console')` messages, load `/tests/use-presence?@isPlaywright=true`, click `toggle-basic` and
  `toggle-mixed`, wait 1.5 s, and assert that no message contains `inside a reactive context`. This test is RED
  before this step (on a dev-mode build `CustomExit` warns) or GUARD (if the e2e server runs a production build,
  where `DEV` is false). Record which one you saw.

**Verify**: `PW_PORT=4220 pnpm exec playwright test e2e/utilities/use-presence.spec.ts` → all pass (the
`basic toggle`, `swap: wait mode` and owned cases now run through registered participants). Commit
`refactor(presence): migrate usePresence call sites to the init-time pattern (plan 017)`.

### Step 5: Docs and changeset

1. `docs/src/routes/docs/use-presence/+page.svx`:
   - `:52-79` snippet: `const presence = usePresence()` (drop the `$derived` around it; keep `const isPresent =
     $derived(presence[0])`). Add one sentence before it: call `usePresence()` once in the component's `<script>`,
     then read `presence` in `$effect` or the template; destructuring at the top level of `<script>` reads it only
     once.
   - `:121-122`: unchanged facts, plus `useIsPresent()` never registers.
   - Replace "Manual holds" (`:131-133`) and the second and third paragraphs of "Mixing with `motion.*` `exit`"
     (`:143-151`) with the new rules, as Motion has them: each `usePresence()` consumer is one participant;
     `safeToRemove` completes only that participant; the wrapper (or owned `child` snippet) leaves when every
     participant (motion exits, layout measurement, other `usePresence` consumers) is done; a wrapper with nothing
     registered (plain elements, or an `m` without `LazyMotion` features) leaves at once; re-entry and stale
     callbacks behave as before.
   - New `## Migrating from \`$derived(usePresence())\`` section: the old pattern still works but is deprecated. Such
     a wrapper keeps the old rules (no automatic leave when empty; `safeToRemove` releases the whole wrapper), and
     development builds warn once per wrapper. Show the before/after snippet.
   - Delete the stale `mode='popLayout'` limitation bullet (`:158-162`); `PresenceChild` pops in `popLayout`
     (`PresenceChild.svelte:120-209`).
   - `:174` `present` row: "until every registered participant is done (with nothing registered, at once)".
   - `:182-186`: the signature stays; the text says it registers at init, returns a reactive two-item array, and
     its callback completes only this consumer.
2. `docs/src/routes/docs/animate-presence/+page.svx`, after `:123`: "An owned child with nothing that exits (plain
   elements, or an `m` without `LazyMotion` features) leaves at once, as in Motion."
3. `docs/src/routes/examples/use-presence/+page.svelte:96-100`: "Inside the card, `const presence = usePresence()`
   (called once) registers the card with its wrapper and returns `[isPresent, safeToRemove]` reactively …".
4. `.changeset/use-presence-participant.md`, `'@humanspeak/svelte-motion': patch`:
   - **Behaviour change (Motion parity):** an owned presence wrapper (`<AnimatePresence present>` + `child`, or
     `<PresenceChild>`) with nothing registered now leaves as soon as its exit starts and fires `onExitComplete`
     once. This includes plain elements and `m` components without `LazyMotion` features. Previously it stayed
     mounted until a manual `safeToRemove` that nothing called.
   - **API usage change:** call `usePresence()` once at component init (`const presence = usePresence()`) and read
     `presence` in `$effect` or the template. It registers the component with its wrapper; its `safeToRemove` now
     completes only this component, and the wrapper leaves when every participant (including motion exits) is
     done. `$derived(usePresence())` still works with the old rules (`safeToRemove` releases the whole wrapper),
     but is deprecated and warns once per wrapper in development.
5. Rebuild the docs (table command). `git diff --stat docs/src/lib/demo-loaders.ts docs/src/lib/demo-manifest.json`
   shows the `UsePresenceCard.svelte` source change (or nothing, if the manifest only lists paths; both are fine).

**Verify**: `pnpm --filter docs check` → 0 errors; the docs build exits 0. Commit `docs(presence): usePresence
registers once at init; legacy pattern deprecated (plan 017)`.

### Step 6: Full gate

Run in order. All must pass:

1. `pnpm check` → 0 errors.
2. `pnpm test:only` → all pass.
3. `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` → passes.
4. `PW_PORT=4220 pnpm exec playwright test e2e/animate-presence e2e/utilities e2e/lazy-motion e2e/layout-id e2e/layout`
   → all pass.
5. `PW_PORT=4220 pnpm exec playwright test` (full suite) → all pass. If a spec fails, follow the CLAUDE.md "Failed
   e2e review workflow": re-run it alone; if it passes alone, record it as flaky. Any spec that fails because an
   owned wrapper now leaves earlier is a STOP (report the page and the assertion; don't adapt it yourself).
6. `trunk fmt` then `trunk check` on every file you changed → no new issues.

## Test plan

- **Anchors (RED at `cbe8de4c`, green after Step 3):** R1, R2, P1-P6, L1, L3, E1, E2, O2, O2b, O2c, U13, O4, M1, and
  the five existing `usePresence.spec.ts` cases that go red when their probe is migrated.
- **Guards:** R3 (disposer re-check), L2, G1, G2 (legacy keeps today's behaviour, including its no-barrier rule
  with motion participants), E3 (stale microtask after a re-entry), P7 (`useIsPresent` never registers), O3 and U14
  (featured exits still wait), the existing mid-hold destroy, re-entry and timing suites
  (`onExitCompleteTiming.svelte.spec.ts`), `animatePresencePropagate.spec.ts` (Design 5), and every existing e2e
  presence spec.
- E2 is the trip-wire for ordering: if the empty completion ever lands before `notifyExitStart()`, `mode="wait"`
  stays blocked and B never enters.
- Patterns: `StalePresenceProbe.svelte` (module sinks), `PresenceHarness.svelte`, `controlledOwnedGroup`
  (`_MotionContainer.spec.ts:809`), `LazyMotion.spec.ts:172` (`console.warn` spy),
  `e2e/lazy-motion/featureless-m-presence.spec.ts:19-45` (painted frames).

## Done criteria

- [ ] `pnpm check` exits 0; `pnpm test:only` exits 0
- [ ] `pnpm build` exits 0 (publint clean); consumer SSR prints its success line
- [ ] `PW_PORT=4220 pnpm exec playwright test` passes, except flakes recorded in your report, each re-run alone and
      passing
- [ ] `grep -n "participated" src/lib/utils/presenceExitRegistry.ts` → no output
- [ ] `grep -n "completeIfEmpty" src/lib/components/PresenceChild.svelte src/lib/components/AnimatePresence.svelte` → one line in each
- [ ] `test -f src/lib/utils/usePresence.ts` fails, `test -f src/lib/utils/usePresence.svelte.ts` succeeds
- [ ] `git grep -n "\$derived(usePresence())" -- src docs/src e2e` → only `src/lib/components/__tests__/LegacyPresenceProbe.svelte`
- [ ] `git diff cbe8de4c..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/visualElementCore.ts` → no output
- [ ] `git diff cbe8de4c..HEAD -- src/lib/utils/presence.ts` touches only the `PresenceChildContext` type
- [ ] `git diff cbe8de4c..HEAD -- package.json` shows no `"version"` change
- [ ] `.changeset/use-presence-participant.md` exists; `git status` is clean apart from the in-scope list
- [ ] The Step 1 RED commit exists before the first `src/lib` source change (`git log --oneline` order)

## STOP conditions

- The precondition or the drift check fails (other than the expected `presence.ts` drift).
- A GUARD in Step 1 fails, or a RED passes before its fix step.
- After Step 3, any test outside the RED list changes result, in particular a wrapper that should hold (a motion
  exit, a layout measure participant, a nested propagating boundary, a `usePresence` consumer) now leaves early.
  That would mean something registers later than the microtask. Report which participant and where it registers;
  don't move the completion to a later frame.
- `$effect.tracking()` does not tell init-time calls from `$derived` calls in some component shape you meet (for
  example a probe created by `mount()` inside an effect). Report the shape.
- Any step seems to need `_MotionContainer.svelte`, `visualElementCore.ts`, or `presence.ts` beyond the type.
- The docs build fails for a reason this plan didn't cause (for example the github-stats fetch). Report it; don't
  work around it.

## Merge hazards (other lanes)

- `src/lib/utils/presence.ts`: 015c (lane `siblings`) edits it. This plan touches only the `PresenceChildContext`
  type (about `:2955-2988` at `cbe8de4c`). Whoever lands second keeps both.
- `src/lib/components/PresenceChild.svelte`, `presenceExitRegistry.ts`, `usePresence.svelte.ts`: no other plan in
  the batch edits them.

## Maintenance notes

- "Empty" now means: no exit-feature node, no `measure-*` participant (012 P2, gated on a VisualElement), no nested
  propagating boundary, no `usePresence()` consumer. Anything new that should hold an owned wrapper must
  `register()` **in the mount flush** (before the exit-start microtask), or the wrapper leaves without it.
  Registering later (rAF, a later effect) is a bug, not a timing tweak.
- The legacy flag is sticky per wrapper and survives the legacy consumer's unmount. Remove the legacy path (and
  `markLegacyManual`) in a future major once the deprecation has shipped; the dev warning names the migration.
- `usePresence()` must be called during component init. A call inside `untrack(...)` in a reactive context reads as
  init-time to `$effect.tracking()` and would try to register (and call `onDestroy`) outside init. That pattern is
  unsupported; the docs say "call it once in `<script>`".
- `safeToRemove` identity is per exit cycle, which keeps `$effect` dependencies stable during one exit.
- Reviewers: check that the microtask's guard compares the minted `currentSafeToRemove` (not just `phase`), and that
  no test was weakened. G1 and G2 must keep their original assertions under `legacy: true`.
- The clone path (`{#if}` children) is unchanged; 016 Step 6 already makes a featureless `m` leave there.
