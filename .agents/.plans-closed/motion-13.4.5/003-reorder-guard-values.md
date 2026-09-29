# Plan 003: Clear Reorder.Group's swap guard only when `values` changes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.4.5/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67815169..HEAD -- src/lib/components/Reorder src/routes/tests/reorder e2e/reorder src/routes/+page.svelte`
> On any change to `Group.svelte` or the rejection test excerpt below → STOP and compare.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW-MED (intentional behavior change: a rejected reorder no longer re-proposes until `values` changes)
- **Depends on**: none
- **Category**: bug (upstream parity)
- **Planned at**: commit `67815169`, 2026-09-28
- **Upstream reference**: Motion 13.4.5 — `~/Github/motion` commits `1059015e5` (failing test page `dev/react/src/tests/reorder-transition.tsx` + Cypress `reorder-transition.ts`) and `03bdeab6c` (fix); file `packages/framer-motion/src/components/Reorder/Group.tsx`

## Why this matters

When `onReorder` fires, `Reorder.Group` sets a guard so the same drag doesn't
propose the same swap again before the new order has rendered. Ours releases
that guard on the **next animation frame**, regardless of whether `values`
changed. If a consumer applies the new order later than one frame (async save
then assign, debounced/deferred state, a slow render), the next pointermove
sees the *old* order, re-detects the same swap, and calls `onReorder` again
with an identical order — duplicate callbacks, duplicate saves.

Upstream Motion 13.4.5 changed the guard to clear **only when `values`
changes** (`useEffect(() => { isReordering.current = false }, [values])`).
The maintainer's policy for this batch: follow upstream semantics exactly. A
consequence (accepted): if a consumer *rejects* a proposal (never updates
`values`), `onReorder` is not called again until `values` changes. Our current
test asserts the opposite and must be updated to upstream's semantics.

## Current state

`src/lib/components/Reorder/Group.svelte:66-113`:

```ts
    /**
     * Swap-in-flight guard: set when `onReorder` fires and released on
     * the next frame, after an accepted synchronous values update has
     * patched the keyed children. Releasing independently of `values`
     * also lets controlled consumers reject a proposed reorder without
     * permanently disabling the gesture.
     */
    let isReordering = false
    let reorderingFrame: number | null = null
    ...
        updateOrder: (value, offset, velocity) => {
            if (isReordering) return
            ...
            if (order !== newOrder) {
                isReordering = true
                onReorder(applyOrderSwap(values, order, newOrder))
                reorderingFrame = requestAnimationFrame(() => {
                    isReordering = false
                    reorderingFrame = null
                })
            }
        },
    ...
    $effect(() => {
        const valuesSet = new Set(values)
        itemLayouts.forEach((_, value) => {
            if (!valuesSet.has(value)) itemLayouts.delete(value)
        })
        updateDetectedAxis()
    })

    $effect(() => () => {
        if (reorderingFrame !== null) cancelAnimationFrame(reorderingFrame)
    })
```

Test pinning the old semantics — `src/lib/components/Reorder/reorder.component.spec.ts:186`:

```ts
    it('continues proposing swaps when a controlled consumer rejects one', async () => {
        const onReorder = vi.fn()
        ... render(ReorderHarness, { props: { axis: 'x', values: [0, 1, 2], onReorder } })
        ... pointerdown (10,10) id 23; pointermove (70,10); await flushFrame()
        expect(onReorder).toHaveBeenCalledOnce()
        expect(onReorder).toHaveBeenLastCalledWith([1, 0, 2])
        ... pointermove (71,10); await flushFrame(16)
        expect(onReorder).toHaveBeenCalledTimes(2)
        ... pointercancel
    })
```

The harness `src/lib/components/Reorder/__tests__/ReorderHarness.svelte`
renders `<Reorder.Group {axis} {values} {onReorder}>` with a keyed
`{#each values as item (item)}`; `values` is a prop, so tests change it with
`result.rerender({ values: [...] })` (see the test at ~line 165 that does
`await result.rerender({ axis: 'xy', values: [0, 1, 2] })`).

Svelte note: React's `[values]` dependency is identity. In Svelte, consumers
may pass a `$state` array proxy and mutate it in place; to honor "values
changed" for both styles, the effect should read the array's identity **and
its contents** (e.g. `void values.length; for (const _ of values) {}` or
`$state.snapshot`-free iteration). Keep it a **separate** `$effect` from the
pruning effect, because the pruning effect also depends on `axisOverride`
via `updateDetectedAxis()` and must not clear the guard on an axis change.

## Commands you will need

| Purpose       | Command | Expected |
| ------------- | ------- | -------- |
| Focused unit  | `pnpm exec vitest run src/lib/components/Reorder` | all pass |
| Full unit     | `pnpm test` | all pass |
| Typecheck     | `pnpm check` | 0 errors |
| Build         | `pnpm build` | exit 0 |
| Focused e2e   | `pnpm exec playwright test e2e/reorder --project=chromium` | all pass |
| Lint / format | `trunk check` / `trunk fmt` | no new issues / exit 0 |

E2E server: port **4198**; never kill an existing server there — prefix `PW_REUSE_SERVER=1`.

## Scope

**In scope**:

- `src/lib/components/Reorder/Group.svelte`
- `src/lib/components/Reorder/reorder.component.spec.ts`
- `src/routes/tests/reorder/deferred/+page.svelte` (create)
- `e2e/reorder/deferred.spec.ts` (create)
- `src/routes/+page.svelte` (one link, next to the other `/tests/reorder/*` links)
- `.changeset/reorder-guard-values.md` (create)

**Out of scope**:

- `checkReorder.ts`, `order.ts`, `Item.svelte`, `autoScroll.ts` — swap detection is unchanged.
- Docs pages — no public API change. (Optional note in the Reorder docs is NOT required.)

## Git workflow

- Branch `chore/motion-13.4.5`. No new branch.
- Commits: `test(reorder): expect no duplicate onReorder before values update`,
  `fix(reorder): clear the swap guard only when values change (Motion 13.4.5)`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red — rewrite the rejection test to upstream semantics

Replace the test at `reorder.component.spec.ts:186` with
`it('does not re-propose a swap until values change', ...)`, same setup, then:

1. pointermove (70,10) → `flushFrame()` → `onReorder` called once with `[1, 0, 2]`.
2. pointermove (71,10) → `flushFrame(16)` → **still called once** (values unchanged: pending or rejected).
3. pointermove (72,10) → `flushFrame(32)` → still once.
4. `await result.rerender({ values: [1, 0, 2] })` (keep the `render` result as
   `const result = render(...)`); `await vi.advanceTimersByTimeAsync(0)`.
5. pointermove far enough to cross the next sibling (e.g. (170,10), with the
   existing `getBoundingClientRect` mock that lays items at `index * 100`);
   `flushFrame()` → `onReorder` called a **second** time, with an order
   different from `[1, 0, 2]`.
6. pointercancel as in the original.

(If step 5's exact coordinates don't produce a swap, adjust coordinates — the
assertion that matters is "a new proposal fires after `values` changes".)

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/reorder.component.spec.ts -t "until values change"`
→ FAILS at step 2: `expected "spy" to be called 1 times, but got 2 times`.
If it passes, STOP.

### Step 2: Port the upstream guard

In `Group.svelte`:

1. Delete `reorderingFrame`, the `requestAnimationFrame(...)` block in
   `updateOrder`, and the `$effect(() => () => { cancelAnimationFrame... })` cleanup.
2. Add:
   ```ts
   /**
    * Only clear the guard once the new order has been rendered. Releasing on
    * a timer re-enables onReorder while a pending (async/deferred) order is
    * still unapplied, proposing the same swap twice
    * (Motion 13.4.5 `Reorder/Group.tsx`).
    */
   $effect(() => {
       // Track identity and contents so in-place $state mutations count too.
       for (const _ of values) void _
       isReordering = false
   })
   ```
   (Use whatever iteration form passes `trunk check` / eslint cleanly;
   `values.forEach(() => {})` is acceptable.)
3. Rewrite the guard's JSDoc: "Swap-in-flight guard: set when `onReorder`
   fires, cleared when `values` changes. A consumer that rejects a proposal
   won't be asked again until `values` changes — Motion 13.4.5 semantics."

**Verify**: `pnpm exec vitest run src/lib/components/Reorder` → all pass, including the rewritten test.

### Step 3: E2E demo page + spec (port of upstream `reorder-transition`)

Create `src/routes/tests/reorder/deferred/+page.svelte` modeled on
`src/routes/tests/reorder/basic/+page.svelte`:

- Items `['0','1','2','3','4','5']`, 60px tall rows, `axis="y"`.
- `onReorder={(next) => { calls.push(next.join('')); setTimeout(() => (items = next), 120) }}`
  — the order is applied ~7 frames later, the Svelte analogue of upstream's
  `startTransition` / `useDeferredValue` cases.
- Expose `window.reorderCalls` (array of joined orders) and a `#drag` button
  that runs upstream's synthetic drag: pointerdown on `#item-0`, 40
  pointermoves every 16ms across 3.5 rows (210px), pointerup 300ms after the
  last move, then set `window.dragDone = true` 500ms later. Copy the `drag()`
  and `dispatch()` functions from
  `~/Github/motion/dev/react/src/tests/reorder-transition.tsx` (adapting to Svelte).
- Show `<div data-testid="order">` with the joined order.

Create `e2e/reorder/deferred.spec.ts`: goto
`/tests/reorder/deferred?@isPlaywright=true`, click `#drag`, wait for
`window.dragDone === true`, then assert `window.reorderCalls` has **no two
consecutive identical entries** and every entry differs from the previous
(port the assertion from `~/Github/motion/packages/framer-motion/cypress/integration/reorder-transition.ts`
— read it and mirror its exact checks), and the final `order` is `123045`
or whatever upstream's spec asserts for 3.5 rows (use upstream's value).

Link the page from `src/routes/+page.svelte` next to `/tests/reorder/basic`.

**Verify**: `pnpm build && pnpm exec playwright test e2e/reorder/deferred.spec.ts --project=chromium` → pass.
Optional red proof: revert Step 2 via `git stash`, rebuild, rerun → duplicates appear; `git stash pop`.

### Step 4: Changeset + full gate

`.changeset/reorder-guard-values.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

`Reorder.Group` no longer calls `onReorder` twice with the same order when the new order is applied asynchronously. The swap guard now clears only when `values` changes, matching Motion 13.4.5; a rejected proposal isn't re-sent until `values` changes.
```

**Verify**: `trunk fmt`; `trunk check`; `pnpm check`; `pnpm test`;
`pnpm exec playwright test e2e/reorder --project=chromium` → all pass.

## Test plan

- Red anchor: rewritten unit test fails with 2 calls where 1 is expected.
- E2E: deferred-apply page proves no duplicate proposals during a realistic 40-move drag.
- Regression: all existing `e2e/reorder/*` (sync consumers) must still pass —
  their `values` update synchronously, so the guard clears via the effect.

## Done criteria

- [ ] `grep -n "requestAnimationFrame\|reorderingFrame" src/lib/components/Reorder/Group.svelte` → no matches
- [ ] `grep -n "continues proposing swaps when a controlled consumer rejects one" src/lib/components/Reorder/reorder.component.spec.ts` → no match
- [ ] `pnpm test` exit 0; `pnpm check` 0 errors
- [ ] `e2e/reorder` all pass on chromium
- [ ] Only in-scope files modified; README row updated

## STOP conditions

- Existing sync-consumer e2e (`basic`, `grid`, `rtl`, `siblings-flip`) start
  missing swaps after Step 2 — the effect isn't re-running on `values` change
  (e.g. harness passes the same proxy). Report with which spec failed.
- The `$effect` clears the guard in the same flush as `onReorder` sets it
  (i.e. before items re-render) such that duplicates persist — report.

## Maintenance notes

- Consumers that reject proposals get no further `onReorder` for the rest of
  that drag unless `values` changes. This is upstream behavior; if users
  report it, point them at upstream rather than reintroducing a timer.
