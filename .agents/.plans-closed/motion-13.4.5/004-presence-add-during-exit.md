# Plan 004: Prove AnimatePresence keeps a child added while another exit completes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.4.5/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67815169..HEAD -- src/lib/components/AnimatePresence.svelte src/lib/components/PresenceChild.svelte src/lib/utils/presence.ts src/routes/tests/animate-presence e2e/animate-presence`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (tests only, unless the test finds a real bug)
- **Depends on**: none
- **Category**: tests (upstream parity characterization)
- **Planned at**: commit `67815169`, 2026-09-28
- **Upstream reference**: Motion 13.4.5 — `~/Github/motion` commit `7a6c4d87e` (#3856): `packages/framer-motion/src/components/AnimatePresence/index.tsx`, test page `dev/react/src/tests/animate-presence-transition-exit.tsx`, Cypress `packages/framer-motion/cypress/integration/animate-presence-transition-exit.ts`

## Why this matters

Upstream fixed AnimatePresence dropping a newly added child when another
child's exit animation completes at the same moment. In React the bug came
from stale diffed-children state across a concurrent transition
(`setDiffedChildren(pendingPresentChildren.current)` was missing when the
last exit completed). svelte-motion's AnimatePresence uses a different model:
Svelte removes the leaving element and we animate a **clone** (marked
`data-clone="true"`) — there is no rendered-vs-diffed children state, so the
exact React bug likely can't occur. But "likely" isn't evidence. This plan
ports upstream's scenario as a regression test so parity is proven, and
catches any analogous race in our exit registry.

This is a **characterization** plan: the tests are expected to PASS on the
current code. If any case FAILS, that is a real bug — STOP and report (see
STOP conditions); do not attempt a fix in this plan.

## Current state

- `src/lib/components/AnimatePresence.svelte` (100 lines) and
  `src/lib/components/PresenceChild.svelte`, runtime in `src/lib/utils/presence.ts`
  and `src/lib/utils/presenceExitRegistry.ts`.
- `AnimatePresence` accepts `mode` (`sync` | `wait` | `popLayout`),
  `initial`, `onExitComplete`.
- Exemplar page: `src/routes/tests/animate-presence/grid-exit/+page.svelte`
  (keyed `{#each cards as card (card.id)}` of `<MotionDiv key={card.id} exit=...>`
  inside `<AnimatePresence>`).
- Exemplar spec: `e2e/animate-presence/grid-exit.spec.ts` (uses
  `[data-clone="true"]` to find exiting clones, `?@isPlaywright=true` query).
- Index links: `src/routes/+page.svelte` ~lines 580–650 list
  `/tests/animate-presence/*` entries; copy one entry's markup.

Upstream scenario: items `['A','B','C']`, each
`<motion.div id="item-X" class="item" exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: 'linear' }}>`
in `<AnimatePresence mode={mode} initial={false}>`. Click "remove B", ~100ms
later click "add D" (in a transition that is still rendering when B's exit
completes). Assert: state text `ACD`, and after 500ms the `.item` elements are
exactly `['item-A', 'item-C', 'item-D']`, for `mode` in `sync` and `popLayout`.

## Commands you will need

| Purpose     | Command | Expected |
| ----------- | ------- | -------- |
| Build       | `pnpm build` | exit 0 |
| Focused e2e | `pnpm exec playwright test e2e/animate-presence/add-during-exit.spec.ts --project=chromium` | all pass |
| Typecheck   | `pnpm check` | 0 errors |
| Lint/format | `trunk check` / `trunk fmt` | no new issues |

E2E server: port **4198**; never kill an existing server — prefix `PW_REUSE_SERVER=1`.

## Scope

**In scope**:

- `src/routes/tests/animate-presence/add-during-exit/+page.svelte` (create)
- `e2e/animate-presence/add-during-exit.spec.ts` (create)
- `src/routes/+page.svelte` (one link)

**Out of scope**: all of `src/lib/**` — this plan does not change library code.

## Git workflow

- Branch `chore/motion-13.4.5`. Commit: `test(presence): cover a child added while an exit completes (Motion 13.4.5)`.
- Do NOT push or open a PR.

## Steps

### Step 1: Demo page

Create `src/routes/tests/animate-presence/add-during-exit/+page.svelte`:

- Read `mode` from `page.url.searchParams.get('mode') ?? 'sync'` (see how
  `src/routes/tests/transform-page-point/drag/+page.svelte` reads `case` via
  `$app/state`'s `page`), restricted to `'sync' | 'popLayout'`.
- Read `timing` from the query: `'exit-complete'` (add D inside
  `onExitComplete`), `'just-before'` (add D via `setTimeout` at 290ms after
  removing B), or `'same-tick'` (add D via `setTimeout` at 300ms, racing the
  300ms exit). Default `'just-before'`.
- `let items = $state(['A','B','C'])`; buttons `#remove` (filter out B, then
  schedule D per `timing`) and `#reset`.
- `<div id="state">{items.join('')}</div>`.
- `<AnimatePresence {mode} initial={false} onExitComplete={...}>` wrapping
  `{#each items as id (id)}<MotionDiv key={id} id={`item-${id}`} class="item" exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: 'linear' }} style="width:100px;height:100px;background:red" />{/each}`.
- Doc comment at the top explaining the upstream bug and that this page proves parity.

**Verify**: `pnpm check` → 0 errors.

### Step 2: E2E spec

`e2e/animate-presence/add-during-exit.spec.ts`: for each `mode` in
`['sync', 'popLayout']` × `timing` in `['exit-complete', 'just-before', 'same-tick']`:

1. goto `/tests/animate-presence/add-during-exit?mode=${mode}&timing=${timing}&@isPlaywright=true`; wait 200ms.
2. click `#remove`.
3. expect `#state` toHaveText `ACD` (poll).
4. wait 500ms past the add.
5. Evaluate `[...document.querySelectorAll('.item:not([data-clone])')].map(e => e.id)`
   → toEqual `['item-A','item-C','item-D']`; and
   `document.querySelectorAll('[data-clone="true"]').length` → 0.
6. `#item-D` computed opacity → `'1'`.

**Verify**: focused e2e command → 6 passed.

### Step 3: Link + gate

Add the index link in `src/routes/+page.svelte` next to the grid-exit link.
Run `trunk fmt`, `trunk check`, `pnpm check`, then
`pnpm exec playwright test e2e/animate-presence --project=chromium` → all pass.

## Test plan

- Red-first exemption: this is a characterization of upstream-fixed behavior
  that our architecture is expected to already satisfy. If any case fails, it
  becomes the red test for a follow-up bug plan (STOP and report).
- 6 e2e cases (2 modes × 3 timings).

## Done criteria

- [ ] New page + spec exist; 6/6 pass on chromium
- [ ] `e2e/animate-presence` all pass
- [ ] `git diff --name-only` shows only the three in-scope files (+ README row)

## STOP conditions

- Any case fails (D missing, D stuck at opacity 0, clone left behind, or order
  wrong): record mode/timing, the element list, and a screenshot; STOP. Do NOT
  modify `src/lib`.
- `mode="popLayout"` isn't supported for keyed `{#each}` children in our
  implementation (check `modes` test page first) — run `sync` only and report.

## Maintenance notes

- If the presence runtime moves away from the clone model, this spec is the
  tripwire for the React bug class #3856.
