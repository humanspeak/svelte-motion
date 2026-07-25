# Plan 004: Wire presence context and exit animations through the VisualElement

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/visual-element-core/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7eba0bd..HEAD -- src/lib/components/PresenceChild.svelte src/lib/utils/presence.ts src/lib/components/AnimatePresence.svelte`
> Plans 001–003 changed `_MotionContainer.svelte` (expected). The three
> presence files above should be UNCHANGED since `7eba0bd` except by this plan.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 002-animate-through-animation-state.md (DONE); runs BEFORE 003 (guard re-order 2026-07-24 — see revision note)
- **Category**: tech-debt (architecture migration, GitHub issue #449)
- **Planned at**: commit `7eba0bd`, 2026-07-24

> Revision 2026-07-24 (guard, after 002's Step 3 landed): this plan now runs
> immediately after 002 and OWNS two documented known-failing specs that
> 002's writer swap exposed — `e2e/animate-presence/layout-button.spec.ts`
> "runs the interactive rolling copy control" and "keeps rolling copy labels
> out of scaled ancestors during the swap". Root cause (measured by the 002
> executor): under `AnimatePresence mode="wait" initial={false}` with a
> `key={stage}` child, the key-change exit half lands AFTER the enter and the
> deferred re-enter never fires — the wait gate blocks enters on the node
> that is simultaneously the exiting one. This is precisely the exit
> coordination this plan wires (`setActive('exit')` + presence
> register/onExitComplete). Making these two specs pass is added to the Done
> criteria below; they are the acceptance test for Step 4's key-change work.

## Why this matters

Upstream exit animations are just `setActive('exit', !isPresent)` — the highest
priority in `variantPriorityOrder`, with `custom` sourced from
`presenceContext.custom` and completion reported via
`presenceContext.onExitComplete(id)`. Our container currently runs a bespoke
same-element `exit → initial → animate` sequence on key changes and passes
`presenceContext: null` to the VE (plan 001). Wiring the real presence context
gives exit the same protected-keys/priority semantics as everything else and
removes the key-change special case.

**Explicit architectural deviation, kept on purpose**: the clone-based exit in
`src/lib/utils/presence.ts` (AnimatePresence deep-clones the removed node and
animates the clone) stays. The clone is a detached element with no
VisualElement; it cannot fight the original's VE. Replacing the clone
architecture is NOT part of #449 — do not attempt it.

## Current state

- **Upstream reference** (read before coding): - `PresenceContextProps { id, isPresent, register(id) => unregister,
onExitComplete?(id), initial?: false | VariantLabels, custom? }`
  (`node_modules/motion-dom/dist/index.d.ts:1061-1068`). - `ExitAnimationFeature` —
  `~/Github/motion/packages/framer-motion/src/motion/features/animation/exit.ts`:
  `mount()` registers with the context; `update()` acts only when
  `isPresent` flipped: leaving → `setActive("exit", true)` then
  `onExitComplete(id)` when the returned promise resolves; re-entering after
  a completed exit → jump values to resolved `initial`,
  `animationState.reset()`, `animateChanges()`. - The VE receives presenceContext at construction and on every
  `update(props, presenceContext)`; `blockInitialAnimation =
presenceContext?.initial === false`
  (`framer-motion/src/motion/utils/use-visual-element.ts:64-76`). - `exit` custom: `animation-state.mjs` reads
  `visualElement.presenceContext?.custom` for the exit variant's dynamic
  resolution.
- **Our presence architecture**:
    - `src/lib/components/AnimatePresence.svelte` +
      `src/lib/utils/presence.ts` (`createAnimatePresenceContext`, line ~356) —
      key-diffing, wait/sync/popLayout modes, and the CLONE exit path
      (`unregisterChild` builds placeholder + clone and `animate(clone, ...)`s
      it — presence.ts:851-1100 region).
    - `src/lib/components/PresenceChild.svelte` — the non-clone path: keeps the
      real node alive while exiting (used by `usePresence`/`useIsPresent`; the
      container detects it via `getPresenceChildContext()`,
      `_MotionContainer.svelte:268-276`).
    - Container exit registration (clone path), `_MotionContainer.svelte:541-564`:

```ts
// _MotionContainer.svelte:541-563
$effect(() => {
    if (element && shouldRegisterPresenceExit && exitProp !== undefined) {
        const resolvePresenceExit = (custom: unknown) => {
            /* resolveExit + reduced-motion filter */
        }
        const filteredExit = resolvePresenceExit(resolvePresenceCustom())
        context.registerChild(
            presenceKey,
            element,
            filteredExit,
            mergedTransition,
            resolvePresenceExit
        )
    }
})
```

- **Key-change transition** (same element, no clone):
  `_MotionContainer.svelte:3051-3160` — runs exit payload via
  `animateWithLifecycle`, then `animate(element, transformedInitial,
{duration:0})`, then the enter animation. (Plan 002 may have already
  reshaped parts of this — reconcile with the live code; the goal here is
  that the sequence becomes `setActive('exit', true)` → await → reset →
  `animateChanges()`.)
- Wait-mode enter deferral: plan 002 moved it to gate the first
  `animateChanges()`; the CLAUDE.md rule applies (mark enter handled before
  flipping ready).
- **PresenceChild context shape**: read
  `src/lib/components/presenceChild.context.ts` (or wherever
  `getPresenceChildContext` is defined — grep) for the fields available:
  it must supply at least `isPresent` reactivity and an exit-complete callback
  to adapt into `PresenceContextProps`.

## Commands you will need

| Purpose      | Command                                 | Expected      |
| ------------ | --------------------------------------- | ------------- |
| Typecheck    | `pnpm check`                            | 0 errors      |
| Unit         | `pnpm test:only`                        | all pass      |
| Presence e2e | `pnpm test:e2e e2e/animate-presence`    | all pass      |
| Related e2e  | `pnpm test:e2e e2e/motion e2e/variants` | all pass      |
| Format/lint  | `trunk fmt` / `trunk check`             | no new issues |

## Scope

**In scope**:

- `src/lib/html/_MotionContainer.svelte` (presence adaptation, key-change path)
- `src/lib/components/PresenceChild.svelte` + its context module (expose the
  fields needed for `PresenceContextProps` adaptation)
- `src/lib/utils/visualElementCore.ts` (ExitAnimationFeature port +
  registration beside the animation feature)
- `src/lib/utils/visualElementCore.spec.ts`
- `src/lib/utils/usePresence.ts` — only if the adapter needs a shared id/registry

**Out of scope** (do NOT touch):

- The clone exit path in `src/lib/utils/presence.ts` (`registerChild`,
  `unregisterChild`, placeholder/clone construction) — keep the container's
  registration effect (`:541-564`) exactly as is.
- `AnimatePresence.svelte` mode logic (wait/sync/popLayout diffing).
- Drag/layout/projection files.

## Git workflow

- Branch `issue-449-visual-element-core`; conventional commits,
  e.g. `feat(presence): route exit through animationState (#449)`.
- Do NOT push.

## Steps

### Step 1: Characterization baseline

`pnpm test:e2e e2e/animate-presence` — record results.

**Verify**: passes; counts recorded.

### Step 2: Port ExitAnimationFeature

In `visualElementCore.ts`, add `ExitAnimationFeature` (port of upstream
`exit.ts`, cite lines) and register it under the `exit` key in
`registerMotionFeatures()` (`isEnabled: (props) => !!props.exit`).

Unit tests: with a mounted VE whose props include `exit`, flipping a fake
presence context to `isPresent: false` and calling
`ve.update(props, ctx)` drives `setActive('exit', true)` (spy on
`animationState.setActive`) and calls `onExitComplete(id)` when the returned
promise resolves; re-entry resets and re-runs `animateChanges`.

**Verify**: `pnpm test:only src/lib/utils/visualElementCore.spec.ts` → all pass.

### Step 3: Adapt PresenceChild context → PresenceContextProps

In the container: when `inPresenceChild`, build a `PresenceContextProps`
adapter `{ id: componentHydrationId, isPresent, register, onExitComplete,
initial, custom }` from the PresenceChild context (extend that context module
if fields are missing — keep its existing consumers compiling), and pass it as
the second argument of every `ve.update(props, presenceContext)` call and at
VE creation. `blockInitialAnimation` now also derives from
`presenceContext.initial === false`.

**Verify**: `pnpm check` → 0 errors; `pnpm test:e2e e2e/animate-presence` →
all pass (PresenceChild specs included).

### Step 4: Key-change transition through exit/reset

Replace the same-element key-change sequence (`:3051-3160` region, as it
exists post-002) with: `setActive('exit', true)` → await → set values to
resolved initial + `animationState.reset()` → `animateChanges()` (upstream
re-enter semantics from `exit.ts:19-56`). Preserve the existing user-facing
callbacks' timing (`onAnimationStart`/`onAnimationComplete` order).

**Verify**: `pnpm test:e2e e2e/animate-presence e2e/motion` → all pass.

### Step 5: Full gate

`trunk fmt` → `trunk check` → `pnpm check` → `pnpm test:only` →
`pnpm test:e2e e2e/animate-presence e2e/motion e2e/variants`.

**Verify**: matches Step 1 baseline.

## Test plan

- No red-first test: behavior-preserving migration; baseline = existing
  `e2e/animate-presence` suite (covers wait/sync/popLayout, deferred enter,
  multi-child exits).
- New unit tests: Step 2 list (exit feature contract).
- Verification: full unit suite + three e2e suites.

## Done criteria

- [ ] `pnpm check` exits 0; `trunk check` no new issues
- [ ] `pnpm test:only` exits 0
- [ ] `pnpm test:e2e e2e/animate-presence e2e/motion e2e/variants` exits 0 —
      INCLUDING the two `layout-button.spec.ts` specs inherited as known
      failures from 002 (see revision note); they must pass with NO exclusions
- [ ] `grep -n "setActive('exit'\|setActive(\"exit\"" src/lib` → present in
      `visualElementCore.ts` (feature) and/or container key-change path
- [ ] Clone path untouched: `git diff 7eba0bd..HEAD -- src/lib/utils/presence.ts`
      → empty (or only changes explicitly justified in NOTES)
- [ ] No files outside the in-scope list modified
- [ ] README status row updated

## STOP conditions

- Drift in presence files beyond plans 001–003's expected container changes.
- The PresenceChild context cannot supply a stable `register`/`onExitComplete`
  contract without changing `AnimatePresence.svelte` mode logic — report the
  missing piece instead of modifying the diffing.
- Key-change specs need the OLD callback ordering and the new sequence can't
  reproduce it after two attempts.
- Anything requires touching the clone path.

## Maintenance notes

- The clone-based exit remains a deliberate deviation from upstream; any future
  "exit animation wrong for direct AnimatePresence children" bug lives in
  `presence.ts`, not in this VE wiring. Consider a follow-up issue to migrate
  direct children onto PresenceChild + VE exit (out of scope here).
- Reviewer: scrutinize `blockInitialAnimation` matrix
  (`initial={false}` prop vs `presenceContext.initial === false`), exit custom
  propagation, and re-enter-after-exit value reset.
