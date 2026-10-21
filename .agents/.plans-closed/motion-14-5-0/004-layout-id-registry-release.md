# Plan 004: Release unconsumed `layoutId` snapshots after the handoff window

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> When done, update this plan's row in `.agents/.plans/motion-14-5-0/README.md`, unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Never use `git stash`.**
>
> **Drift check (run first)**: `git diff --stat f2b5d766..HEAD -- src/lib/utils/layoutId.ts src/lib/utils/layoutId.spec.ts src/lib/utils/presence.ts src/lib/html/_MotionContainer.svelte`
> Plan 001 changes comments in `_MotionContainer.svelte` and plan 002 changes `finishExit` in `presence.ts`.
> Anything beyond that: compare against "Current state", and on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED. Shared-element (`layoutId`) handoffs rely on the entry surviving until the arriving element is
  ready; the window must not be too short.
- **Depends on**: 000, 002 (both edit `presence.ts`; runs after 002 in the same lane, in parallel with 001)
- **Category**: bug / perf (upstream parity, Motion 14.3.1 #3940)
- **Planned at**: commit `f2b5d766`, 2026-10-21

## Why this matters

svelte-motion hands `layoutId` animations from a departing element to an arriving one through its own
module-level registry. Every unmount writes an entry that holds the departing element's DOM node, rect and
transition, and an entry is deleted only when an element with the same id consumes it. With unique `layoutId`s
(per list item, or per-instance `LayoutGroup` ids) the registry grows without limit and keeps detached DOM
subtrees alive. An element that mounts much later with a reused id also animates in from a stale rect. Upstream
fixed the same leak in its projection tree in Motion 14.3.1 (#3940): the shared stack survives the commit where a
replacement can resume from it, and is released at the end of that update pass. This plan applies the same rule
to svelte-motion's registry.

## Current state

- `src/lib/utils/layoutId.ts:34`: `const entries = new Map<string, LayoutIdEntry>()` (module singleton).
- `src/lib/utils/layoutId.ts:50-60`:
  ```ts
  export const layoutIdRegistry: LayoutIdRegistry = {
      snapshot(id, rect, transition, owner) {
          entries.set(id, { rect, transition, owner })
      },
      consume(id, consumer) {
          const entry = entries.get(id)
          if (!entry) return undefined
          entries.delete(id)
          if (consumer !== undefined && entry.owner === consumer) return undefined
          return entry
      }
  }
  ```
- Writer: `src/lib/html/_MotionContainer.svelte:790-803`, the cleanup of the `layoutId` effect, calls
  `layoutIdRegistry.snapshot(scopedLayoutId, new DOMRect(...), mergedTransition ?? {}, target)`, where `target` is
  the departing `HTMLElement`.
- Reader: `src/lib/html/_MotionContainer.svelte:3046-3062`. An `$effect` gated on `isLoaded === 'ready'` calls
  `layoutIdRegistry.consume(scopedLayoutId, element)` and then `commitObservedLayoutChange(prev.rect)`.
  **Timing matters**: an arriving element reaches `isLoaded === 'ready'` after a `requestAnimationFrame` (plus a
  10 ms `sleep` under Playwright; see `runEnterAnimation` around lines 3446-3463). In `AnimatePresence mode="wait"`
  the arriving element is mounted only after the old one's exit animation finishes, which can be hundreds of ms
  after the snapshot.
- Exit accounting: `src/lib/utils/presence.ts` `startExit` (around line 1075), `finishExit` (around 1102, changed
  by plan 002), `cancelExit` (around 1124) and the context's `dispose`.
- Existing unit spec: `src/lib/utils/layoutId.spec.ts` (handoff, self-consume, ownerless entries). Keep it passing.

### Upstream reference (`~/Github/motion` @ `v14.5.0`)

- Commit `9de7d6edd` "Release empty shared layout stacks from the projection root" (#3940):
  `packages/motion-dom/src/projection/node/create-projection-node.ts` `clearAllSnapshots` (around lines 876-880)
  now deletes stacks that are still empty after the update pass, instead of only clearing their lead snapshot.
  The commit message explains why it can't happen on unmount: "a replacement with the same layoutId mounting in
  the same commit resumes from it."
- Test: `packages/framer-motion/src/projection/__tests__/shared-layout-unmount-leak.test.tsx` ("unique layoutIds
  don't accumulate", "a same-commit layoutId swap still hands off to the new element").

## Design (decided; implement exactly this)

An entry lives through a **handoff window** and is then dropped if nobody consumed it:

1. **Expiry**: when `snapshot` writes an entry, stamp it with a token and schedule a release check. Use
   `requestAnimationFrame` twice and require at least `HANDOFF_MS = 100` ms since the snapshot (`performance.now()`).
   That covers the arriving element's rAF + Playwright's 10 ms sleep with margin. If the entry with that token is
   still there when the check runs, delete it. A newer `snapshot` for the same id replaces the token, so stale checks
   no-op.
2. **Presence hold**: while any `AnimatePresence` in the document has an exit in flight, releases are deferred.
   Add `holdLayoutIdHandoffs(): () => void` to `layoutId.ts`. It increments a module counter and returns a release
   function, idempotent per call, that decrements it. When the counter drops to 0, re-run the release check for
   all entries (they still need their own 2 frames + 100 ms). In `presence.ts`, take a hold in `startExit` and
   release it in `finishExit`, `cancelExit` and `dispose` (one hold per in-flight exit). This keeps
   `mode="wait"` handoffs working.
3. **SSR / no rAF**: when `requestAnimationFrame` is undefined, fall back to `setTimeout(check, HANDOFF_MS)`.
4. Export a test-only `__layoutIdRegistrySize()` (or similar; mark it `@internal`) so tests can observe size.
   Do not export it from `src/lib/index.ts`.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Unit file | `pnpm exec vitest run src/lib/utils/layoutId.spec.ts` | see steps |
| Unit suite | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint | `trunk fmt <files>` then `trunk check <files>` | clean |
| e2e | `pnpm exec playwright test e2e/layout-id e2e/animate-presence e2e/layout` | all pass (port 4198 rule: if occupied, STOP and ask; never kill) |

## Scope

**In scope**: `src/lib/utils/layoutId.ts`, `src/lib/utils/layoutId.spec.ts`, `src/lib/utils/presence.ts` (the
hold calls only), `.changeset/layout-id-registry-release.md` (create, `patch`).

**Out of scope**: `_MotionContainer.svelte` (writer/reader stay as they are), `motionDomProjection.ts`,
`LayoutGroup.svelte`.

## Git workflow

Branch `feat/motion-14.5.0`. Commits `test(layout-id): pin registry release after the handoff window` and
`fix(layout-id): release unconsumed snapshots (Motion 14.3.1 #3940)`, ending with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## Steps

### Step 1: Failing tests

In `layoutId.spec.ts`, using `vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance', 'setTimeout'] })`
(restore in `afterEach`):

- **released when unconsumed**: snapshot `'leak-a'`, advance 2 frames + 150 ms
  (`vi.advanceTimersByTime(200)` is enough with faked rAF), then `consume('leak-a', other)` → `undefined`.
- **size stays bounded**: snapshot 50 unique ids, advance 200 ms → registry size 0.
- **same-window handoff still works**: snapshot `'swap'`, advance 50 ms, then `consume('swap', other)` → returns
  the entry.
- **hold defers release**: `const release = holdLayoutIdHandoffs()`, snapshot `'held'`, advance 1000 ms →
  `consume` would still find it (check size, not consume); call `release()`, advance 200 ms → size 0.

These tests reference symbols that don't exist yet (`holdLayoutIdHandoffs`, the size helper). Add minimal
exported stubs first: `holdLayoutIdHandoffs = () => () => {}` and a size helper returning `entries.size`. Then the
tests compile and fail on behavior, not on imports.

**Verify**: `pnpm exec vitest run src/lib/utils/layoutId.spec.ts` → "released when unconsumed", "size stays
bounded" and "hold defers release" (its final size assertion) FAIL; the existing tests and "same-window handoff"
pass.

### Step 2: Implement the design

Implement items 1-3 of "Design" in `layoutId.ts`. Update the `LayoutIdRegistry` JSDoc (lines 13-24) to describe the
window, citing `create-projection-node.ts clearAllSnapshots @ v14.5.0 (#3940)`.

**Verify**: the unit file passes.

### Step 3: Wire the presence hold

In `presence.ts`, track holds per in-flight exit: keep an array of release functions, push in `startExit`, and pop
and call one in `finishExit` and `cancelExit`; call all in `dispose`. Add a one-line comment pointing at
`layoutId.ts` explaining why.

**Verify**: `pnpm test:only` → all pass. `pnpm check` → 0 errors.

### Step 4: e2e regression net, then the changeset

**Verify**: `pnpm exec playwright test e2e/layout-id e2e/animate-presence e2e/layout` → all pass.

`.changeset/layout-id-registry-release.md` (`patch`): "`layoutId`: snapshots of unmounted elements are released when
no element takes them over, so unique `layoutId`s no longer leak detached elements and a much later arrival no
longer animates from a stale position (Motion 14.3.1 #3940)."

## Test plan

- Red anchors: the three release tests fail on current code (entries live forever) and pass after Step 2.
- "same-window handoff" pins that normal handoffs still work.
- The e2e areas cover real handoffs, including scrolled pages and AnimatePresence.

## Done criteria

- [ ] Unit file passes with 4 new tests; `pnpm test:only` passes
- [ ] `pnpm check` 0 errors; `trunk check` clean
- [ ] The three e2e areas pass
- [ ] Only in-scope files changed; README row updated

## STOP conditions

- Any `e2e/layout-id` or `e2e/animate-presence` spec fails after Step 3. Report which one; do not lengthen
  `HANDOFF_MS` past 250 ms on your own.
- The presence hold needs changes outside `startExit`/`finishExit`/`cancelExit`/`dispose`.
- Faked `requestAnimationFrame` is unavailable in this Vitest/jsdom version. Report it; don't switch to real
  timers with long sleeps.

## Maintenance notes

- `HANDOFF_MS` couples to how long an arriving element takes to reach `isLoaded === 'ready'`. If mount ever gets
  slower (another awaited frame in `runEnterAnimation`), revisit it.
- If svelte-motion ever moves `layoutId` handoffs onto motion-dom's `NodeStack` (`root.sharedNodes`), delete this
  registry; upstream already releases empty stacks.
