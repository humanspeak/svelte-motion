# Plan 017 (STUB): Inside `<AnimatePresence present>` / `PresenceChild`, a wrapper that nothing registers with leaves at once, so a featureless `m` there exits immediately (upstream parity)

> **This is a stub.** It records the design and the open questions so far. It is **not executable yet**: it will be
> written out fully (exact excerpts, steps, verify commands) after plan 012 has merged into `feat/motion-14.7.1`,
> against the merged code. An executor handed this file now must STOP and report "017 is a stub".
>
> **Never use `git stash`**. Lane `lazy`, PW_PORT **4220**; never use or kill 4198; never set `PW_REUSE_SERVER`.

## Status

- **Priority**: P1 (operator ruling: ships in 2.7.0)
- **Effort**: M (estimate; refine when written)
- **Risk**: MED. Changes `usePresence` semantics (public API) and the empty-wrapper rule.
- **Depends on**: 016 (same lane; featureless `m` has no node). 012 must have merged into `feat/motion-14.7.1`
  (see Precondition).
- **Wave**: after 012 merges (lane `lazy`, after 016)
- **Category**: direction (upstream parity)
- **Planned at**: stub written against `lane/1471-lazy` `3547bb8c` (016 committed), 2026-10-28. Re-stamp when
  written out.

## Precondition (check by git ancestry, not README rows)

`git log --oneline feat/motion-14.7.1 --grep "plan 012"` must print the commit(s) that merged 012's build into
`feat/motion-14.7.1`. The spike-only commit (`test(presence): shared layout crossfades with exiting elements (spike
012)`) does not count. Then `git merge --no-ff feat/motion-14.7.1` into `lane/1471-lazy`. If no such commit exists,
STOP.

## Why this matters

After 016, a featureless `m` has no VisualElement, so it registers nothing with presence, which is what upstream
does. In the clone path (`{#if}` children of `AnimatePresence`), 016 Step 6 already makes it leave at once.
In the owned path (`<AnimatePresence present>` snippet / `PresenceChild`), svelte-motion holds an empty wrapper
until `safeToRemove`, so the featureless `m` never leaves. Upstream removes it at once.

## Upstream (`~/Github/motion`, `git show v14.7.1:<path>`)

- `packages/framer-motion/src/components/AnimatePresence/PresenceChild.tsx:104-113`: after the commit that flips
  `isPresent` to false, `!isPresent && !presenceChildren.size && onExitComplete && onExitComplete()`. An empty
  wrapper completes immediately.
- `:76-87`: `register(childId, node)` adds a participant; its cleanup deletes it and completes when empty and not
  present.
- `motion/features/animation/exit.ts:73-83`: the exit feature registers (needs a VisualElement, so a featureless
  `m` never does).
- `components/AnimatePresence/use-presence.ts:52-57`: `usePresence` registers in a `useEffect`. `:59-62`:
  its `safeToRemove` calls `onExitComplete(id)`, which completes only that participant; the wrapper leaves once
  every participant is done. `useIsPresent` (same file) only reads the context and never registers.

## svelte-motion today (at `3547bb8c`)

- `src/lib/utils/presenceExitRegistry.ts:8-9`: "Empty manual wrappers intentionally keep their hold until
  explicitly released." `checkComplete` returns early when `!participated` (`:27-28`), and `begin()` sets
  `participated = participants.size > 0` (`:81`). Spec: `presenceExitRegistry.spec.ts:20` `holds an empty manual
  wrapper, including unknown mount completions`.
- `src/lib/components/PresenceChild.svelte:318-326`, exit start: `phase = 'holding'` →
  `currentSafeToRemove = mintSafeToRemove()` → `completeDescendant = exitRegistry.begin(currentSafeToRemove)` →
  `animatePresence?.notifyExitStart()`. Completing synchronously inside `begin()` would run `notifyExitComplete`
  before `notifyExitStart`.
- `src/lib/utils/usePresence.ts:83-87`: `usePresence()` doesn't register. While not present it returns
  `[false, context.safeToRemove]`, which releases the **whole** wrapper (JSDoc `:41-48`).

## Design so far

1. Registry: an exit cycle with no participants completes (for example `completeIfEmpty()`, which calls `finish`
   when `active && participants.size === 0`). Drop the `!participated` rule and its JSDoc sentence.
2. `PresenceChild.svelte`: after `notifyExitStart()`, call `completeIfEmpty()` from a `queueMicrotask`, which runs
   after Svelte's synchronous flush, like upstream's post-commit `useEffect`. The existing `currentSafeToRemove !==
   self` / `phase !== 'holding'` checks make it a no-op after a re-entry.
3. `usePresence` must register, or every manual `usePresence` wrapper would vanish once (1) lands. Its
   `safeToRemove` completes only its own participant.
4. Rejected: a node-less `m` registering a participant that completes on exit start. It is container-only but not
   upstream's mechanism, and it is wrong in the mixed case: a wrapper with a featureless `m` plus a `usePresence`
   consumer would leave at once, where upstream waits for the consumer.

## Finding M6 (cold review of 016): "register once at init" doesn't work as written

Every call site reads `usePresence()` inside `$derived`:

- `src/lib/utils/usePresence.ts:67` (JSDoc example);
- `src/lib/components/__tests__/PresenceProbe.svelte:5`;
- `src/lib/components/__tests__/StalePresenceProbe.svelte:15`;
- `src/routes/tests/use-presence/WaitChild.svelte:7`;
- `src/routes/tests/use-presence/CustomExit.svelte:4`;
- `docs/src/lib/examples/use-presence/demos/UsePresenceCard.svelte:4`;
- `docs/src/routes/docs/use-presence/+page.svx:56`.

The `$derived` re-evaluates every time `isPresent` changes. A registration made inside `usePresence()` would run
on every re-evaluation, outside component init (so no `onDestroy`), and could not be cleaned up. The documented
`$derived(usePresence())` pattern and "register once" are incompatible.

## Open API question (decide before writing out)

How does a `usePresence` consumer register exactly once?

- **Recommended (upstream-faithful):** split registration from reading. `usePresence()` must be called once at
  component init, the way upstream's hook is called once per render tree. It registers there (with `onDestroy`
  cleanup) and returns a reactive object, for example getters `isPresent` / `safeToRemove`, or a tuple-like with
  getters. Callers read it reactively without `$derived(usePresence())`. Every call site above and the docs move to
  `const presence = usePresence()`. The `safeToRemove` returned completes only this participant
  (`use-presence.ts:59-62`). `useIsPresent()` stays read-only.
- Alternative: keep `$derived(usePresence())` working by making the registration idempotent per component (a
  context-scoped id created at the first init-time call, with later calls inside `$derived` reusing it). That is
  less upstream-shaped, and it depends on the first call happening during init.

This changes a public API's usage pattern, so the changeset must say so.

## To do when writing out (after 012 merges)

- Re-read `PresenceChild.svelte` and `presenceExitRegistry.ts` as merged. 012 P2 adds an owned-path measure
  participant, which changes what "empty" means. Confirm that 016's node gate on that participant is in place (see
  016 "Merge hazards").
- Red tests:
  - O1 (RED): featureless `m` in `<AnimatePresence present>` leaves at once and `onExitComplete` fires once.
  - O2 (GUARD): a `usePresence` consumer holds the wrapper until its own `safeToRemove`.
  - O3 (GUARD): a featured `motion` exit still waits.
  - O4 (RED): a painted-frame e2e owned card on `featureless-m-presence`.
  - Rewrite `presenceExitRegistry.spec.ts:20` (RED).
- Docs: `docs/src/routes/docs/use-presence/+page.svx` (`:56`, `:122-150`, `:182`), example
  `docs/src/routes/examples/use-presence/+page.svelte:96`, and a changeset (behaviour + API usage change).
