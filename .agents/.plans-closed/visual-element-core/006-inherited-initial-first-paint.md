# Plan 006: Seed inherited `initial` variant labels on children's first paint

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/visual-element-core/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9cdc0ee..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/visualElementCore.ts src/lib/components/variantContext.context.ts`
> Expect empty. The untracked `src/routes/tests/ve-signoff/` page is the
> operator's sign-off tour — it is NOT in scope; do not touch, commit, or
> delete it.

## Status

- **Priority**: P1 — found by the operator during live sign-off; blocks sign-off
- **Effort**: S
- **Risk**: MED (touches variant-context seeding; stagger/inheritance specs are the collateral surface)
- **Depends on**: 002 (DONE), 003 (DONE)
- **Category**: bug (migration gap, GitHub issue #449)
- **Planned at**: commit `9cdc0ee`, 2026-07-25

## Why this matters

The canonical upstream variants pattern — parent `initial="closed"
animate={open ? 'open' : 'closed'}`, children carrying only `variants` — is
broken on first paint: children ignore the inherited `initial` label, render
fully visible, and the first expand click "does nothing" (it animates to a
pose the children already occupy visually). The operator hit this live on the
sign-off tour. Upstream renders children at the inherited initial pose from
the first frame; this is a fidelity gap in the very API shape motion.dev
documents first.

## Current state

- **The resolver is already correct.** `makeLatestValues`
  (`src/lib/utils/visualElementCore.ts:375-376`) faithfully ports upstream:

```ts
if (initial === undefined) initial = context.initial
if (animate === undefined) animate = context.animate
```

(upstream: `framer-motion/src/motion/utils/use-visual-state.ts:73-85`).

- **The container never supplies `context.initial`.**
  `_MotionContainer.svelte:1015`:

```ts
context: { animate: effectiveAnimate },
```

- **The parent→child channel carries only the animate label.** The parent
  publishes `localVariantStore` (`:899`, `setVariantContext(localVariantStore)`
  at `:942`, module `src/lib/components/variantContext.context.ts`); children
  subscribe via `parentVariantStore` (`:908`) into `inheritedVariant`/
  `effectiveAnimate` (`:915`). `initial === false` propagates separately via
  `getInitialFalseContext()` (`:920`, `parentInitialFalse`). There is no
  channel for a parent's initial VARIANT LABEL.
- **Upstream contract to mirror**
  (`framer-motion/src/context/MotionContext/create.ts:8-20`): a parent
  provides `context.initial` only when it is controlling variants and its
  `initial` is a variant label (string/array); `initial={false}` is the
  separate boolean channel we already have.
- **Why no test caught it**: the whole `e2e/variants` surface pins
  `notifications-stack`, whose parent uses `initial={false}` — inherited
  initial labels are never exercised.
- **animateChanges side is likely already correct** on the client:
  `getVariantContext(parent)` reads the parent VE's props (which include
  `initial`), so the animation state's own fallbacks work. The gap is the
  FIRST-PAINT seed (`makeLatestValues` context) and possibly SSR inline
  style.
- Binding constraints from the batch still apply (plan 002 revisions #4–#9):
  never skip the first `animateChanges()` pass; never memoize style-slot
  reads; `scheduleRenderMicrotask()` for flushes; adapter `updateOptions`
  stays untracked.

## Commands you will need

| Purpose     | Command                                                      | Expected                                                     |
| ----------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Typecheck   | `pnpm check`                                                 | 0 errors                                                     |
| Unit        | `pnpm test:only`                                             | all pass                                                     |
| Red/green   | `pnpm test:e2e e2e/variants/inherited-initial.spec.ts`       | Step 1: FAILS as specified; after fix: passes 3× consecutive |
| Gate        | `pnpm test:e2e e2e/variants e2e/motion e2e/animate-presence` | all pass                                                     |
| Format/lint | `trunk fmt` / `trunk check`                                  | no new issues                                                |

## Scope

**In scope** (the only files you may modify/create):

- `src/routes/tests/variants/inherited-initial/+page.svelte` (create — fixture)
- `e2e/variants/inherited-initial.spec.ts` (create — the red test)
- `src/lib/html/_MotionContainer.svelte`
- `src/lib/components/variantContext.context.ts`
- `src/lib/html/_MotionContainer.ssr.spec.ts` (only if Step 4 shows the SSR
  gap — add a pin, never weaken existing ones)
- `.agents/.plans/visual-element-core/README.md` (status row)

**Out of scope**:

- `src/routes/tests/ve-signoff/` (operator's uncommitted tour page)
- `src/lib/utils/visualElementCore.ts` — the resolver is correct; if you
  think it needs changing, STOP and report why
- `notifications-stack` page/specs and all other existing specs' assertions

## Git workflow

- Branch `issue-449-visual-element-core`; conventional commits
  (`test(variants): …` then `fix(variants): …`); never push; never reset past
  commits you did not author.

## Steps

### Step 1: Red test — reproduce on first paint

Create the fixture page: a parent `motion.div` with
`initial="closed" animate={open ? 'open' : 'closed'}` and a spring-free
transition, containing 3 children `motion.div`s that carry ONLY `variants`
(`closed: { opacity: 0, y: 24 }`, `open: { opacity: 1, y: 0 }`) and
`data-testid="child-N"`. A `data-testid="toggle"` button flips `open`.
Model markup/style conventions on
`src/routes/tests/variants/notifications-stack/+page.svelte`.

Create `e2e/variants/inherited-initial.spec.ts` (model on an existing
`e2e/variants` spec) asserting:

1. **First paint**: immediately after load (before any interaction), every
   child's computed `opacity` is `< 0.05` — children render at the inherited
   `closed` pose.
2. **First click animates**: click toggle once; within 1s every child reaches
   `opacity > 0.95`, and mid-flight at least one sampled frame shows
   `0.1 < opacity < 0.9` (proves it ANIMATED rather than snapped).
3. **Collapse works**: second click returns children to `opacity < 0.05`.

Run it and confirm it FAILS on assertion 1 with children at opacity ≈ 1 —
if it fails any other way, or passes, the reproduction is wrong: STOP.

**Verify**: `pnpm test:e2e e2e/variants/inherited-initial.spec.ts` → FAILS
with `expected < 0.05, received ~1` on first paint.

### Step 2: Publish the parent's initial label; consume it in the child context

Extend `variantContext.context.ts` (or add a sibling channel in the same
module, matching its conventions) so a variant-controlling parent publishes
its initial VARIANT LABEL (string; arrays: follow upstream `create.ts` —
pass through as-is) alongside the animate store. In the container:

- Parent side: publish the label only when the component is controlling
  variants and `initialProp` is a variant label (mirror
  `create.ts:8-20`; `initial={false}` stays on the existing boolean channel).
- Child side: derive `inheritedInitial` and pass
  `context: { initial: inheritedInitial, animate: effectiveAnimate }` at
  `:1015`. Own `initialProp` must still win (the `??`/undefined-fallback
  order in `makeLatestValues` already guarantees this — do not duplicate the
  logic in the container).

**Verify**: `pnpm check` → 0 errors; the Step 1 spec's assertion 1 and 2 now
pass locally: `pnpm test:e2e e2e/variants/inherited-initial.spec.ts` → all 3
assertions pass, then run it 3× consecutive (animation timing) → 3/3.

### Step 3: Collateral gate

**Verify**: `pnpm test:only` → all pass;
`pnpm test:e2e e2e/variants e2e/motion e2e/animate-presence` → all pass
(notifications-stack, stagger-interrupt, and the wait-mode suites are the
collateral surface for context changes).

### Step 4: SSR first-paint check

Inspect the fixture's server-rendered HTML (`curl` the route from
`pnpm preview` or check the SSR spec harness): do the children carry the
`closed` pose inline (opacity 0) in the SERVER output? If yes, done. If no
(children flash visible pre-hydration), pin the current client behavior with
a note and report the SSR gap in NOTES with the exact serializer location —
do NOT attempt SSR serializer surgery in this plan; that is a follow-up
ruling for the reviewer.

**Verify**: `pnpm test:only src/lib/html/_MotionContainer.ssr.spec.ts` →
passes unchanged (plus your added pin if Step 4 found the server output
already correct).

### Step 5: Full wrap

`trunk fmt` → `trunk check` → `pnpm check` → `pnpm test:only` → gate suites.
Update the README row.

**Verify**: all green; the new spec passes 3× consecutive.

## Test plan

- Red-first anchor: `inherited-initial.spec.ts` assertion 1 fails against
  current code (`expected < 0.05, received ~1`), passes after Step 2.
- New coverage: first-paint pose, animated (not snapped) first expand,
  collapse round-trip.
- Pattern exemplar: existing `e2e/variants` specs.

## Done criteria

- [ ] `pnpm check` exits 0; `trunk check` no new issues
- [ ] `pnpm test:only` exits 0
- [ ] `e2e/variants/inherited-initial.spec.ts` exists, failed at Step 1 for
      the specified reason, and passes 3× consecutive after the fix
- [ ] `pnpm test:e2e e2e/variants e2e/motion e2e/animate-presence` exits 0
- [ ] `grep -n "context: {" src/lib/html/_MotionContainer.svelte` shows
      `initial` alongside `animate`
- [ ] `src/routes/tests/ve-signoff/` untouched (`git status` shows it still
      untracked, unmodified)
- [ ] README status row updated

## STOP conditions

- The Step 1 red test fails for any reason other than children visible at
  first paint.
- Wiring `context.initial` regresses ANY existing spec — particularly
  `notifications-stack` (`initial={false}` interplay with the label channel)
  or stagger specs — after two fix attempts.
- The fix appears to require changing `makeLatestValues` /
  `visualElementCore.ts` or the SSR serializer.
- `initial` variant ARRAYS behave differently from upstream `create.ts` and
  handling them needs new resolver logic.

## Maintenance notes

- This closes the operator-found sign-off blocker; the sign-off tour's
  section 2 (uncommitted page) is the human-visible check.
- Reviewer should scrutinize: label-vs-`false` channel separation, own-prop
  precedence over inherited, and that the animate channel's behavior is
  byte-identical (no change to `effectiveAnimate` derivation).
- Possible follow-up if Step 4 finds it: SSR serializer support for
  inherited initial labels (children flash before hydration).
