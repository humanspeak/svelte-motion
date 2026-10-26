# Plan 006: An element taking over a `layoutId` doesn't replay its `initial` entrance

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4206** (`PW_PORT=4206`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Revision 2026-10-26**: after the adversarial review, Step 1 also ports upstream's "inside a mounted motion
> parent" and "without `initial` keeps its default values" cases (six e2e tests, not four).
>
> **Drift check (run first)**: `git diff --stat 45a24c6e..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/layoutId.ts src/lib/utils/layoutId.spec.ts src/routes/tests/layout-id e2e/layout-id src/routes/+page.svelte`
> Expected: no output. On any change, compare the "Current state" excerpts with the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED. It changes which values an element mounts with, in the central `_MotionContainer.svelte`.
- **Depends on**: none
- **Wave**: 1
- **Category**: bug (upstream parity)
- **Planned at**: commit `45a24c6e` (`origin/main`, v2.5.0, Motion 14.5.0), 2026-10-26

## Why this matters

An element that mounts with the `layoutId` of one already on screen visually *is* that element, carried to its
new place by the shared layout animation. If it also has `initial` (say `initial={{ opacity: 0 }} animate={{ opacity: 1 }}`),
svelte-motion replays that entrance on every handoff, so a tab underline fades in again each time the tab
changes. Motion 14.6.0 fixed this (#2362, commits `ca68023ce` and `8e3e394bd`): when the shared-layout stack
already has a lead **and** the element has an `initial`, it mounts as if `initial={false}`. Without an `initial`
nothing changes, because forcing `initial={false}` would make its `animate` values its base values.

## Current state

### svelte-motion

- `src/lib/html/_MotionContainer.svelte:986-997`, computed once at component init:
  ```ts
      // Propagate initial={false} to children BEFORE setting variant context
      // AnimatePresence initial={false} only applies on first render - check shouldAnimateEnter(key)
      const parentInitialFalse = getInitialFalseContext()
      const presenceSkipEnter = context ? !context.shouldAnimateEnter(presenceKey) : false
      const effectiveInitialProp = presenceSkipEnter
          ? false
          : initialProp !== undefined
            ? initialProp
            : parentInitialFalse && variantsProp
              ? false
              : undefined
  ```
- Lines 1006-1008:
  ```ts
      if (initialProp === false) {
          setInitialFalseContext(true)
      }
  ```
  This boolean context is how `initial={false}` reaches variant children (`parentInitialFalse && variantsProp` above).
  The variant-label context (lines 1012-1041) deliberately does not carry `initial === false`.
- `effectiveInitialProp` feeds the VisualElement's `initial` (line ~543), `blockInitialAnimation` (line ~1160),
  `optimizedAppearId` (line ~1319) and the enter path (line ~3117-3124). Changing it at init is enough for this
  element; nothing else needs to change for its own values.
- `keyChangeInitialKeyframes` (lines ~1204-1222) is resolved from the RAW `initialProp` on purpose (a later key
  change is a fresh mount). Leave it alone.
- `scopedLayoutId` (lines ~275-282) is `$derived` from `layoutIdProp` and the surrounding `<LayoutGroup>`:
  ```ts
      const layoutGroupContext = getLayoutGroupContext()
      const layoutGroupId = layoutGroupContext?.id
      const scopedLayoutId = $derived(
          layoutIdProp ? scopeLayoutId(layoutGroupId, layoutIdProp) : undefined
      )
  ```
  It is the id used for both the registry and the projection (`layoutId: scopedLayoutId`, line ~1861).
- Handoff mechanics in svelte-motion:
  - An unmounting `layoutId` element writes its on-screen rect to the registry in an `$effect` cleanup
    (`layoutIdRegistry.snapshot(...)`, lines ~776-818). The entry lives through a handoff window (two animation
    frames and at least 100 ms, longer while an `AnimatePresence` exit is in flight).
  - A mounting element consumes that entry in an `$effect` once ready (lines ~2770-2787,
    `layoutIdRegistry.consume(scopedLayoutId, element)`) and animates from it.
  - Svelte's destroy/create order decides which happens first. In an `{#if}/{:else}` swap, or tabs where each tab
    has its own `{#if}`, the old element can be destroyed **before** the new one's script runs (registry entry
    present, motion-dom stack lead gone), or the new one can mount **while** the old one is still mounted (for
    example held by an `AnimatePresence` exit: stack lead present, no registry entry yet). The check below must
    cover both.
- `src/lib/utils/layoutId.ts`: `LayoutIdRegistry` type (lines ~31-34) has only `snapshot` and `consume`;
  `consume` deletes the entry. `entries` is a module-level `Map<string, LayoutIdEntry>` (line ~41).
  `src/lib/utils/layoutId.spec.ts` covers handoff, ownership and release (`describe('layoutIdRegistry')`,
  `describe('layoutIdRegistry release')`).
- `rootProjectionNode` is exported by `motion-dom` (14.5.0 and 14.6.0). Each projection root keeps
  `sharedNodes: Map<string, NodeStack>`; a stack's `lead` is the current element for that id.
- Test page conventions: `src/routes/tests/layout-id/+page.svelte` (tabs with an underline `motion.div` per tab,
  `layoutId="underline"`, inside `AnimatePresence`), spec `e2e/layout-id/basic.spec.ts`.

### Upstream (verified at `~/Github/motion` tag `v14.6.0`)

`packages/framer-motion/src/motion/index.tsx:105-121`:

```tsx
        /**
         * An element that mounts with the layoutId of one that's already
         * rendered takes over from it with a shared layout animation, so
         * visually it has already entered. Mount it as if initial={false}
         * rather than replaying its entrance.
         *
         * Only when it has an initial: without one there's no entrance to
         * skip, and initial={false} would make its animate values its base
         * values, so removing them later wouldn't return it to its defaults.
         */
        if (
            useConstant(
                () =>
                    !!rootProjectionNode.current?.sharedNodes.get(layoutId!)
                        ?.lead && props.initial
            )
        ) {
            props = { ...props, initial: false }
        }
```

Tests: `packages/framer-motion/src/projection/__tests__/shared-layout-initial.test.tsx` (first mount runs its
initial; takeover doesn't replay it; also inside a mounted motion parent; runs initial when the previous element
has already gone; variant children of a takeover start at their animate state; a takeover without `initial` keeps
its default values). E2E fixture `dev/react/src/tests/issue-2362.tsx`, spec `tests/react/issue-2362.spec.ts`. Read
them with `git -C ~/Github/motion show v14.6.0:<path>`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Typecheck | `pnpm check` | 0 errors |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| Unit tests | `pnpm test:only` | all pass |
| Lint/format | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| One e2e spec | `PW_PORT=4206 pnpm exec playwright test <path>` | all pass |

## Scope

**In scope**:

- `src/lib/utils/layoutId.ts`, `src/lib/utils/layoutId.spec.ts`
- `src/lib/html/_MotionContainer.svelte`: only the init block around lines 986-1008 and one import
- `src/routes/tests/layout-id/takeover-initial/+page.svelte` (create), `e2e/layout-id/takeover-initial.spec.ts` (create)
- `src/routes/+page.svelte` (one link next to the other layout-id links)
- `.changeset/layout-id-takeover-initial.md` (create)

**Out of scope**:

- The registry's handoff window, `consume`, and the snapshot/consume `$effect`s.
- `keyChangeInitialKeyframes`, the variant-label context (lines 1012-1041), presence logic.
- `src/lib/utils/motionDomProjection.ts`.

## Git workflow

- Lane branch `lane/1460-layoutid` in `../svelte-motion-1460-layoutid`, created by the dispatcher from the wave-0
  commit.
- Conventional commits, e.g. `test(layoutId): takeover must not replay initial`,
  `fix(layoutId): skip initial when taking over a live layoutId (Motion 14.6.0)`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red e2e test

1. Create `src/routes/tests/layout-id/takeover-initial/+page.svelte`, a port of upstream
   `dev/react/src/tests/issue-2362.tsx`: two tab buttons (`data-testid="tab-0"`, `tab-1`, 100×50 px,
   `position: relative`, 100 px gap) and `let active = $state(0)`. Inside the active tab render
   `<motion.div data-testid="underline" layoutId="underline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2, ease: 'linear', layout: { duration: 0.2 } }}>`
   absolutely positioned along the bottom (5 px high, red). Use `{#if active === index}` per tab, **no**
   `AnimatePresence`, like upstream. Add a `?variants` mode: when present, the underline instead uses
   `variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }} initial="hidden" animate="shown"` and contains a
   child `<motion.div data-testid="underline-child" variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}>`
   (a small dot). Header comment citing #2362 and both upstream commits.
2. Create `e2e/layout-id/takeover-initial.spec.ts`, a port of upstream `tests/react/issue-2362.spec.ts`:
   - "first mount still runs its entrance": load `/tests/layout-id/takeover-initial?@isPlaywright=true`; the
     underline's computed opacity read right after it attaches is < 0.9; it then reaches `1`
     (`toHaveCSS('opacity', '1', { timeout: 5000 })`).
   - "a takeover doesn't replay the entrance": wait for opacity 1, record the box, click `tab-1`, wait 400 ms, read
     opacity once (no retrying assertion: retries would wait out the fade and hide the bug). Expect the box moved
     right and opacity > 0.9.
   - "variant children of a takeover start at their animate state": same with `?variants`, reading
     `underline-child` opacity 400 ms after the click; expect > 0.9.
   - "runs the entrance when the previous element is long gone": add a third button `data-testid="none"` to the page
     that sets `active = -1` (no underline). Click `none`, wait 500 ms (past the 100 ms handoff window), click
     `tab-1`, read opacity right after it attaches: expect < 0.9.
   - "a takeover inside a mounted motion parent doesn't replay the entrance": add a `?parent` mode where each tab
     button's content is wrapped in a `motion.div` that stays mounted (upstream `parentIsMotion`); same steps and
     expectation as the takeover case.
   - "a takeover without `initial` keeps its default values": add a `?noInitial` mode (upstream's last unit case):
     one `motion.div data-testid="box" layoutId="box"` inside a `{#key}` block keyed on `step === 0 ? 'a' : 'b'`,
     `animate={step === 1 ? { scale: 2 } : {}}`, `transition={{ type: false }}`, plus a `data-testid="step"` button
     cycling `step` 0 → 1 → 2. Click it twice (waiting two frames after each) and expect the box's computed
     `transform` to be `none`. This guards the `initialProp === undefined` early return in Step 3; it is expected
     to **pass** before Step 3 as well.
3. Link the page from `src/routes/+page.svelte` with the other layout-id pages.

**Verify**: `PW_PORT=4206 pnpm exec playwright test e2e/layout-id/takeover-initial.spec.ts` → "a takeover doesn't
replay the entrance", the mounted-parent case and the variants case **FAIL** (opacity ≈ 0.2); the first-mount,
long-gone and no-`initial` cases pass. If
the takeover case passes, STOP and report.

Commit (`test(layoutId): takeover must not replay initial`).

### Step 2: A non-consuming registry check

In `src/lib/utils/layoutId.ts`:

- Add `has(id: string): boolean` to the `LayoutIdRegistry` type, with JSDoc: "Whether an unconsumed snapshot for
  `id` is in its handoff window. Does not consume it."
- Implement it in `layoutIdRegistry` as `has: (id) => entries.has(id)`.
- Mention `has` in the type's bullet list.

In `src/lib/utils/layoutId.spec.ts` add: `has` is true after `snapshot`, still true after a second `has` (not
consumed), false after `consume`, false after the release window (reuse the fake-timer/rAF setup of
`describe('layoutIdRegistry release')`).

**Verify**: `pnpm exec vitest run src/lib/utils/layoutId.spec.ts` → all pass.

### Step 3: Mount a takeover as `initial={false}`

In `_MotionContainer.svelte`, import `rootProjectionNode` from `motion-dom` (add it to the existing
`from 'motion-dom'` import, around line 44). Directly before `const effectiveInitialProp = …` add:

```ts
    /**
     * Motion 14.6.0 (`framer-motion/src/motion/index.tsx`, #2362): an element
     * that mounts with the layoutId of one that's already on screen takes over
     * from it with a shared layout animation, so visually it has already
     * entered. Mount it as if `initial={false}`. Only when it has an
     * `initial`: without one there's no entrance to skip, and `initial={false}`
     * would make its animate values its base values.
     *
     * Svelte can destroy the departing element before this one's script runs
     * (its rect is then in the layoutId registry) or after (it is still its
     * shared-layout stack's lead), so check both. Evaluated once, at init.
     */
    const layoutIdTakeover = untrack(() => {
        if (!scopedLayoutId || initialProp === undefined || initialProp === false) return false
        return (
            layoutIdRegistry.has(scopedLayoutId) ||
            !!rootProjectionNode.current?.sharedNodes.get(scopedLayoutId)?.lead
        )
    })
```

Then make `effectiveInitialProp` return `false` when `presenceSkipEnter || layoutIdTakeover`, and change the
`setInitialFalseContext` guard to `if (initialProp === false || layoutIdTakeover)`, so variant children also start
at their animate state (upstream replaces `props.initial` with `false`, which reaches children the same way).

`untrack` is already imported in this file (it is used at line ~1028). If `rootProjectionNode.current` is
undefined (no projection root yet), the stack check is simply false.

**Verify**:
- `PW_PORT=4206 pnpm exec playwright test e2e/layout-id/takeover-initial.spec.ts` → all six pass.
- `PW_PORT=4206 pnpm exec playwright test e2e/layout-id e2e/animate-presence` → all pass (re-run a failing spec
  alone once before reporting it).

### Step 4: Changeset and gate

Create `.changeset/layout-id-takeover-initial.md` (bump `patch`): "An element that takes over a `layoutId` from one
already on screen no longer replays its `initial` entrance; it carries on from the shared layout animation (Motion
14.6.0, #2362). Elements without an `initial` are unchanged."

**Verify**: `pnpm check` (0 errors), `pnpm test:only` (all pass), `trunk check` on changed files (clean),
`git diff -U0 src/lib/html/_MotionContainer.svelte | grep -c '^[+-][^+-]'` stays small (only the import, the new
block, and the two edited conditions), `git status` shows only in-scope files.

## Test plan

- Red-first: `e2e/layout-id/takeover-initial.spec.ts` "a takeover doesn't replay the entrance", the mounted-parent
  case and the variants case fail before Step 3 and pass after.
- Guards: the first-mount, long-gone and no-`initial` cases (initial still runs when nothing is taken over), the existing
  `e2e/layout-id` and `e2e/animate-presence` suites, and the registry unit tests for `has`.

## Done criteria

- [ ] All six `takeover-initial` e2e tests pass; `e2e/layout-id` and `e2e/animate-presence` pass
- [ ] `grep -n "layoutIdTakeover" src/lib/html/_MotionContainer.svelte` → the declaration plus its two uses
- [ ] `grep -n "has(id" src/lib/utils/layoutId.ts` → type and implementation
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `trunk check` clean
- [ ] Changeset exists; page linked; no out-of-scope files modified

## STOP conditions

- The takeover e2e case passes before Step 3.
- After Step 3 the "first mount", "long gone" or no-`initial` case fails (the check is too broad).
- An existing `e2e/layout-id` or `e2e/animate-presence` spec fails twice after Step 3.
- The variants case still fails after Step 3; report what the child renders instead of widening the change into
  the variant-label context.
- The fix seems to need the snapshot/consume effects or `motionDomProjection.ts`.

## Maintenance notes

- The registry's handoff window (100 ms + two frames, extended by exit holds) now also decides whether an entrance
  is skipped. If that window changes, re-run `takeover-initial.spec.ts`'s "long gone" case.
- Upstream checks only the stack lead because React keeps the old element mounted until the commit. If svelte-motion
  ever moves its handoff fully onto motion-dom's stacks (`resumeFrom`), drop the registry half of the check.
