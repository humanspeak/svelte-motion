# Plan 009: Exit placeholders keep the item's margins; pin same-update handoffs; link the presence demo

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Report results in your final message; the
> reviewer maintains the batch README.
>
> **Drift check (run first)**: `git diff --stat 4b58380b..HEAD -- src/lib/utils/presence.ts src/lib/utils/presence.spec.ts src/routes/tests/layout/layout-group-presence src/routes/+page.svelte e2e/layout e2e/layout-id e2e/animate-presence`
> Any change → compare against the excerpts below; on mismatch STOP.

## Status

- **Priority**: P1 (before the Motion 13.4.5 PR)
- **Effort**: S–M
- **Risk**: MED (exit placeholders are used by every non-popLayout AnimatePresence exit)
- **Depends on**: batch `motion-13.4.5` (closed; all on `chore/motion-13.4.5`)
- **Category**: bug + tests + dx
- **Planned at**: commit `4b58380b`, 2026-09-29
- **Numbering**: continues the conversation's numbering (the closed batch ended at 008).

## Why this matters

Three follow-ups the maintainer ruled not acceptable to ship:

1. **Mid-exit sibling jump (bug).** On `/tests/layout/layout-group-presence`, removing
   the red box `#a` (inside `AnimatePresence`, default `sync` mode) makes the blue
   sibling `#b` jump up 40px (160 → 120) *while `#a` is still fading*. Sync/wait exits
   are supposed to hold the exiting item's layout slot until the exit completes
   (upstream keeps the exiting element in the flow). Root-cause lead (verify, don't
   assume): the exit placeholder copies `margin`, `display`, `flex`, grid lines etc.
   from `computed`, which for an already-detached element is `child.lastComputedStyle`
   — a **live** `CSSStyleDeclaration` that reads `''` for every property once Svelte
   detaches the node. The demo's boxes have `margin: 20px`, so the placeholder is
   missing 20 + 20 = 40px. `position` already has a string-snapshot workaround
   (`lastPosition`); the other placeholder fields don't. `e2e/animate-presence/grid-exit.spec.ts`
   doesn't catch it because its cards have no margins.
2. **Same-update shift + swap (characterization).** Claim to verify: when ONE state
   change both shifts a `layoutId` element (e.g. a banner appears above it) and swaps it
   to its counterpart, the handoff starts from the **painted, pre-shift** position —
   what React's `getSnapshotBeforeUpdate` would snapshot. If true, pin it with a test;
   if false, it's a bug → STOP and report (see STOP conditions).
3. **Unlinked demo.** `src/routes/tests/layout/layout-group-presence/+page.svelte` isn't
   linked from `src/routes/+page.svelte` (repo rule in CLAUDE.md: link test/demo pages
   from the index). It already has a TesterPanel; its steps/expected text must describe
   the fixed behavior.

## Current state

`src/lib/utils/presence.ts:30-44` — child record; note the precedent:

```ts
    lastComputedStyle: CSSStyleDeclaration
    /**
     * `position` captured as a STRING while the element was still connected.
     * `lastComputedStyle` is a live CSSStyleDeclaration, and once Svelte
     * detaches the node (keyed swaps detach before unregister) every property
     * on it reads back as '' — so out-of-flow detection must not rely on it.
     */
    lastPosition: string
```

Registration `:773-774` sets `lastComputedStyle: initialStyle, lastPosition: initialStyle.position`;
`updateChildState` `:789-795` refreshes `lastComputedStyle` and `lastPosition`.

Placeholder creation `:857-915`:

```ts
        const elementIsLive = child.element.isConnected
        ...
        const computed = elementIsLive ? getComputedStyle(child.element) : child.lastComputedStyle
        ...
        const exitPosition = elementIsLive ? computed.position : child.lastPosition
        ...
            placeholder.style.display = computed.display === 'contents' ? 'block' : computed.display
            placeholder.style.width = `${rect.width}px`
            placeholder.style.height = `${rect.height}px`
            placeholder.style.margin = computed.margin
            placeholder.style.boxSizing = computed.boxSizing
            ...
            if (computed.flex) placeholder.style.flex = computed.flex
            if (computed.alignSelf) placeholder.style.alignSelf = computed.alignSelf
            if (computed.gridColumnStart) ... gridColumnEnd ... gridRowStart ... gridRowEnd
```

Also check whether any other consumer of `lastComputedStyle` (e.g. `measurePopLayoutSnapshot`,
clone creation) reads it after detach — list them in your report; fix only the placeholder
path here unless the same bug is trivially shared (then STOP and ask, see below).

Demo page: `src/routes/tests/layout/layout-group-presence/+page.svelte` — `#stack` flex column,
`#a` (`layout`, `exit={{ opacity: 0 }}`, `duration: 0.3`) inside `<AnimatePresence>`, `#b`
(`layout`, 1s linear tween), both `margin: 20px`, 100×100. Existing spec:
`e2e/layout/layout-group-parity/layout-group-unmount.spec.ts` ("a layout sibling animates into
the freed space exactly once") — it currently does NOT assert that `#b` stays put during the exit.

Index: `src/routes/+page.svelte` ~lines 782–790 link `/tests/layout/layout-group-unmount` and
`-unmount-list`; add the presence page next to them, copying their markup.

Tester-panel conventions: `src/routes/tests/layout/_parity/TesterPanel.svelte` (renders only
without `@isPlaywright=true`, `position: fixed`, read-only).

## Commands you will need

| Purpose       | Command | Expected |
| ------------- | ------- | -------- |
| Unit          | `npx vitest run src/lib/utils/presence.spec.ts` then `npx vitest run` | pass |
| Typecheck     | `pnpm check` (via shim) | 0 errors |
| Focused e2e   | `npx playwright test -c <private config> e2e/layout/layout-group-parity e2e/animate-presence e2e/layout-id --project=chromium` | pass |
| Full e2e      | `npx playwright test -c <private config> --project=chromium` | pass (known load flake: animate-presence/modes.spec.ts:114 — verify in isolation) |
| Lint/format   | `trunk check` / `trunk fmt` | no new issues |

## Scope

**In scope**: `src/lib/utils/presence.ts`, `src/lib/utils/presence.spec.ts`,
`e2e/layout/layout-group-parity/layout-group-unmount.spec.ts`,
`e2e/animate-presence/*.spec.ts` (new cases only), `e2e/layout-id/*.spec.ts` (new case only),
`src/routes/tests/layout/layout-group-presence/+page.svelte` (tester text),
`src/routes/tests/layout-id/**` (a new fixture page for Step 3 if needed, with a TesterPanel),
`src/routes/+page.svelte` (links), `.changeset/presence-placeholder-margins.md`.

**Out of scope**: `_MotionContainer.svelte`, `motionDomProjection.ts`, `observeMove.ts`,
LayoutGroup code, popLayout behavior.

## Steps

### Step 1: Red — sibling must hold still during the exit

1. e2e: in `layout-group-unmount.spec.ts`, add "a layout sibling holds its slot while the
   exit is still running": record `#b`'s top every rAF from the click on `#a` until 250ms
   (the exit is 300ms); every sample must equal the pre-click top (±0.5px).
2. unit (`presence.spec.ts`, following its existing placeholder tests): an element with
   `margin: 20px` registered, then detached, then exiting → the inserted
   `[data-presence-placeholder]` has `style.margin` `'20px'` (and `display`, `boxSizing`
   preserved).

**Verify**: both FAIL on current code (e2e: `#b` at 120 during the exit; unit: margin `''`).
If the e2e passes, STOP — the lead is wrong.

### Step 2: Fix — snapshot placeholder layout fields as strings

Replace the live-declaration reads for a detached element with a string snapshot captured while
connected, generalizing `lastPosition` (e.g. a `lastLayoutStyle: { position, display, margin,
boxSizing, flex, alignSelf, gridColumnStart, gridColumnEnd, gridRowStart, gridRowEnd }` object
filled at registration and in `updateChildState`). Keep `lastPosition` behavior identical (or
fold it into the snapshot and update its doc comment). Use the snapshot whenever
`!elementIsLive`. Match the existing doc-comment style (explain the live-declaration pitfall).

**Verify**: Step 1 tests PASS; `npx vitest run src/lib/utils/presence.spec.ts` all pass;
`e2e/animate-presence` all pass (placeholders are everywhere — this is the regression net).

### Step 3: Characterize same-update shift + swap

Add a fixture (e.g. `src/routes/tests/layout-id/shift-swap/+page.svelte`, with a TesterPanel) where
one button's handler flips a single `$state` that both shows a 120px banner above a tab strip AND
moves the selected-tab `layoutId` underline to another tab. e2e (`e2e/layout-id/shift-swap.spec.ts`):
record the underline's viewport rect on the frame before the click and on the first frame after;
assert the first post-click frame starts within 1px of the **painted pre-click** position (then
animates to its new slot). Run ×3.

**Verify**: passes 3/3 → it's parity; keep it as a tripwire. If it fails → STOP (see below).

### Step 4: Link + tester text + gate

1. Link `/tests/layout/layout-group-presence` (and the Step 3 page) from `src/routes/+page.svelte`,
   names saying what each checks.
2. Update the presence page's TesterPanel: steps + expected ("blue stays put while red fades;
   after red is gone, blue glides up once").
3. Changeset (patch): "AnimatePresence exit placeholders keep the exiting element's margins and
   flex/grid placement even after the element has been detached, so siblings no longer shift
   while an exit is still running."
4. Gate: `trunk fmt`, `trunk check`, `pnpm check`, `npx vitest run`, `pnpm build`, full e2e.

## Done criteria

- [ ] Step 1 tests failed before Step 2 and pass after
- [ ] `grep -n "computed.margin" src/lib/utils/presence.ts` shows the value comes from a string snapshot when detached
- [ ] shift-swap spec passes 3/3
- [ ] both pages linked; tester text updated
- [ ] unit, check, build, full e2e pass; changeset exists

## STOP conditions

- Step 1's e2e passes on current code (lead wrong) — report the measured tops.
- The same detached-live-style bug also affects exit clones or popLayout snapshots — report the
  sites; don't widen the fix without approval.
- Step 3 fails (handoff doesn't start from the painted position) — report numbers; it becomes a
  separate decision.
- Any existing `e2e/animate-presence` spec regresses.

## Maintenance notes

- Never read layout from a stored live `CSSStyleDeclaration` after detach — snapshot strings.
