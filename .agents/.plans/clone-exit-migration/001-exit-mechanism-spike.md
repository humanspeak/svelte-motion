# Plan 001: Spike — choose the mechanism for real-node exits of direct AnimatePresence children

> **Executor instructions**: This is a SPIKE plan: its deliverable is a
> written recommendation with working throwaway prototypes, NOT landed
> product code. Nothing from this plan merges except the report file it
> specifies. Follow the steps, honor STOP conditions, and update the status
> row in `.agents/.plans/clone-exit-migration/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 7eba0bd..HEAD -- src/lib/utils/presence.ts src/lib/components/AnimatePresence.svelte src/lib/components/PresenceChild.svelte`
> Expect empty (the clone path has been deliberately untouched since before
> the visual-element-core batch).

## Status

- **Priority**: P3 — architectural; no user-visible defect drives it today
- **Effort**: M (spike) — the eventual implementation is L and gets its own
  plan after this spike's decision
- **Risk**: LOW for the spike itself (throwaway code); the decision it feeds
  is HIGH-consequence
- **Depends on**: visual-element-core plans 002 + 004 (merged to main via PR #454)
- **Category**: direction / tech-debt (documented deviation from upstream;
  GitHub issue #449 follow-up)
- **Planned at**: commit `843dc26`, 2026-07-26 (re-stamped post-squash-merges; the clone path is verified byte-identical to `7eba0bd`, so all excerpts and line references hold)

## Why this matters

Direct children of `<AnimatePresence>` exit via a DEEP CLONE: when Svelte
removes the child, `presence.ts` builds a placeholder, clones the node,
copies computed styles, positions the clone absolutely, and animates the
clone out. It works — 60+ e2e specs pin it — but it is the largest remaining
architectural deviation from upstream: the real node never runs its exit
(so exit variants with `custom` functions, layout projection during exit,
and event handlers on the exiting element all behave subtly differently),
and the clone machinery is ~400 lines of style-copying heuristics that break
in ways upstream cannot (stateful canvases, iframes, focus, aria-live).
Upstream keeps the REAL node rendered until `onExitComplete`. Svelte cannot
do that for free — the framework unmounts the child when the consumer's
`{#if}`/`{#each}` drops it — which is exactly why the clone exists. Any
migration therefore starts with a MECHANISM DECISION, not code.

## Current state

(All verified at `843dc26`; the clone path is byte-identical to `7eba0bd` — untouched through PRs #454, #457, and #459.)

- `src/lib/components/AnimatePresence.svelte` — 66 lines; thin shell over
  the context.
- `src/lib/utils/presence.ts` — 1,238 lines. `createAnimatePresenceContext`
  (`:356`); wait-mode coordination `startExit`/`finishExit`/
  `notifyEnterUnblocked` (`:664`, `:690`, `:522-523`) — shared by BOTH the
  clone path and the container's deferred-enter gate; `registerChild`
  (`:704`) receives element + exit definition + a `resolvePresenceExit`
  resolver from the container; `unregisterChild` builds placeholder + clone
  and runs `animate(clone, exitKeyframes, finalTransition)` (the one
  remaining legacy `animate()` call in the library).
- Container registration — `_MotionContainer.svelte:690-790`:
  `shouldRegisterPresenceExit = !!context && presenceDepth === 0 && !inPresenceChild`
  (`:690`); `context.registerChild(presenceKey, element, filteredExit, …)`
  (`:783`); `onDestroy → context.unregisterChild(presenceKey)` (`:712-715`).
- **The real-node path already exists and is VE-wired**:
  `PresenceChild.svelte` (213 lines) keeps the node rendered;
  visual-element-core plan 004 adapted its context to upstream's
  `PresenceContextProps` and exits run through
  `setActive('exit')` + `ExitAnimationFeature`
  (`src/lib/utils/visualElementCore.ts:157-226`), completion via
  `safeToRemove`. Key constraint from that work: the presence context must
  be a FRESH OBJECT per `ve.update()` (flip detection uses
  `prevPresenceContext`).
- **Upstream reference**: `~/Github/motion/packages/framer-motion/src/components/AnimatePresence/index.tsx:179-235`
  — React diffs `children`, keeps exiting children rendered inside
  `PresenceChild`, removes them on `onExitComplete`. The Svelte-blocking
  fact: React re-renders REMOVED children from its own memory of the
  element tree; Svelte snippets/`{#if}` compile to imperative
  mount/unmount — a component cannot re-render content its consumer stopped
  rendering.
- Modes: `wait` / `sync` / `popLayout` all implemented in the clone path
  (`measurePopLayoutSnapshot` etc.); any mechanism must cover all three.

## Commands you will need

| Purpose      | Command                              | Expected                                                                                                                      |
| ------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Unit         | `pnpm test:only`                     | all pass (spike must not regress the tree it touches — prototypes live under `src/routes/tests/_spike-*` or a scratch branch) |
| Presence e2e | `pnpm test:e2e e2e/animate-presence` | all pass on the branch you leave behind                                                                                       |
| Dev server   | `pnpm dev`                           | manual prototype driving                                                                                                      |

## Scope

**In scope** (spike artifacts only):

- Throwaway prototype routes under `src/routes/tests/_spike-clone-exit/`
  (deleted or clearly marked before handoff — nothing ships)
- `.agents/.plans/clone-exit-migration/spike-report.md` (the deliverable)
- `.agents/.plans/clone-exit-migration/README.md` (status row)

**Out of scope** (do NOT modify):

- `presence.ts`, `AnimatePresence.svelte`, `PresenceChild.svelte`,
  `_MotionContainer.svelte`, anything in `src/lib` — the spike READS the
  product code and prototypes beside it, never in it.

## Steps

### Step 1: Candidate A — Svelte `out:` transition bridge

Prototype: a custom Svelte transition (or `transition:`-returning helper the
motion component could apply to its root element) that, on outro, holds the
element in the DOM for the duration of the VE exit — i.e., piggyback
Svelte's own deferred-removal machinery (`out:` delays unmount until the
transition completes). Answer with working code: (a) can a motion COMPONENT
attach an outro to its own root element from the inside (Svelte 5:
transitions are element-level; investigate `$effect`-managed
`element.dispatchEvent` interplay or the `transition` directive's
compiled contract)? (b) does the outro fire when a PARENT block (`{#if}`
around the component) is removed — Svelte only runs outros for elements
inside the destroyed block when they are `|global` or local to it; verify
both nesting shapes; (c) can `onExitComplete` end the outro exactly (not a
fixed duration)?

**Verify**: a prototype route where a real node (not a clone) visibly runs
its exit after the consumer's `{#if}` flips, with the answers to a–c
demonstrated or refuted in code comments.

### Step 2: Candidate B — data-driven children (list API)

Prototype: `<AnimatePresence items={...}>` with a snippet parameter
(`{#snippet child(item)}`) — AnimatePresence owns the `{#each}` over an
INTERNAL array that lags the consumer's array, keeping exiting items
rendered inside `PresenceChild` until `safeToRemove` (this is exactly the
upstream model, made explicit because Svelte can't diff opaque children).
Answer: (a) ergonomics vs today's markup for the three modes; (b) does
`popLayout` fall out naturally (exiting item leaves layout flow via the
existing PresenceChild machinery)?; (c) migration story — can the clone
path and the list API coexist during a deprecation window?

**Verify**: a prototype route with enter/exit/wait working on real nodes
through the EXISTING PresenceChild + VE exit machinery (no new animation
code — that's the point).

### Step 3: Candidate C — status-quo-plus (keep clones, shrink the blast radius)

No prototype needed; a written assessment: if A and B both fail their bar,
what is the smallest set of clone-path improvements that closes the worst
fidelity gaps found in Step 4's matrix (e.g., exit `custom` resolution
timing, `aria-live`/focus handling), and what stays permanently different
from upstream?

### Step 4: The comparison matrix + recommendation

Write `.agents/.plans/clone-exit-migration/spike-report.md`:

- Matrix: candidates × (all three modes, nested AnimatePresence, exit
  `custom`, layout/projection during exit, stateful content (canvas/iframe/
  input focus), SSR/hydration, a11y, consumer-facing API change, estimated
  implementation effort, deletion payoff in `presence.ts` lines).
- A single recommendation with the evidence, plus the implementation plan
  outline (steps + gates) the follow-up build plan should use.
- Every claim keyed to a prototype file or upstream citation.

**Verify**: the report exists, the matrix has no empty cells for A and B,
and `pnpm test:only` + `pnpm test:e2e e2e/animate-presence` still pass on
the branch (prototypes are additive routes only).

## Test plan

- No red-first test: spike (no product behavior changes). The follow-up
  build plan inherits the presence suite as its characterization pin plus
  new specs from the chosen mechanism.

## Done criteria

- [ ] `spike-report.md` exists with the full matrix and one recommendation
- [ ] Candidates A and B each have a runnable prototype route (or an
      in-code refutation of feasibility)
- [ ] `git diff --stat -- src/lib` is EMPTY (nothing in the library touched)
- [ ] `pnpm test:only` and `pnpm test:e2e e2e/animate-presence` exit 0
- [ ] README status row updated

## STOP conditions

- Any prototype requires modifying `src/lib` to answer its question — stop
  and report which question needs a product-code probe and why.
- Candidate A turns out to require patching Svelte internals or relying on
  undocumented compiler output — record the refutation and move on (that IS
  an answer, not a blocker).

## Maintenance notes

- The follow-up build plan (002 in this batch, written after the spike)
  owns: deleting the clone machinery, the wait-mode coordination handoff
  (`startExit`/`finishExit` must keep gating the container's deferred
  enter), and the deprecation path if the API changes.
- Whoever reviews the spike should read visual-element-core plan 004's
  guard report first — the fresh-presence-context constraint and the
  key-change exit semantics both bound the design space.
