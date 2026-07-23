# Plan 008: One layout change produces exactly one FLIP commit (reactive + observer paths coordinated)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-fidelity/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6746859..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/layout.ts`
> Mismatch against the excerpts below = STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6746859`, 2026-07-22

## Why this matters

Upstream framer-motion guarantees exactly one measure/animate pass per commit (`MeasureLayout.tsx` `getSnapshotBeforeUpdate`→`componentDidUpdate`, plus `create-projection-node.ts`'s animationId repeat guard). Our port has TWO delivery paths for a layout change on a `layout` element: the Svelte-reactive path (pre-effect snapshot → `frame.postRender` commit) and the DOM-observer path (MutationObserver/ResizeObserver → `commitObservedLayout`). A change to the element's own `class` is watched by BOTH: `classProp` is a tracked reactive dependency AND `class` is in the self attribute observer's filter. The observer (microtask) commits first and starts the FLIP; the reactive commit then re-commits from its pre-patch snapshot, restarting the animation from origin — a visible stutter — and `onProjectionUpdate` subscribers get two events for one logical change.

## Current state

- `src/lib/html/_MotionContainer.svelte`:
    - `:2185-2191` — `trackLayoutProjectionDependencies` tracks `classProp, styleProp, scopedLayoutId, mergedTransition`.
    - `:2193-2208` — `$effect.pre` snapshots pre-patch (`explicitLayoutSnapshot = measureLayoutRect('snapshot')`, `willUpdate`).
    - `:2221-2241` — `runReactiveCommit` (verbatim core):

```ts
const runReactiveCommit = () => {
    const prev = reactiveCommitPrevious
    reactiveCommitPrevious = null
    if (!(element && prev)) return
    const next = measureLayoutRect()
    if (!next) return
    emitProjectionUpdate(prev, next)
    if (hasRectChanged(prev, next)) {
        lastRect = next
        motionDomProjection?.commitObservedLayoutChange(prev)
    }
    // No delta from THIS path's snapshot: leave `lastRect` alone. …
}
```

- `:2312-2386` — `commitObservedLayout` (observer path): measures `next`, sets `lastRect = next` (`:2347`), and on `hasRectChanged(previous, next)` emits + `commitObservedLayoutChange(previous)`.
- `src/lib/utils/layout.ts:509-513` — self attribute observer: `attributeFilter: ['class', 'data-presence-layout-hold']` (note: self `style` is NOT observed — only `class` is double-covered).
- The `lastRect`-only-on-change comment in `runReactiveCommit` records a hard-won constraint (no-delta commits must NOT touch `lastRect`) — the fix must preserve it.
- Existing e2e guarding this subsystem: `e2e/motion/layout-align-toggle.spec.ts` (parent-driven re-slot, observer path), plus `src/routes/tests/motion/layout-align-toggle/+page.svelte`.

## Commands you will need

| Purpose    | Command                                                                                         | Expected on success |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck  | `pnpm check`                                                                                    | exit 0              |
| Unit tests | `pnpm vitest run src/lib/utils/layout.spec.ts`                                                  | all pass            |
| E2e        | `PW_REUSE_SERVER=1 npx playwright test <specs> --reporter=line` if 4198 occupied, else drop env | pass                |

**NEVER kill any process listening on port 4198.**

## Scope

**In scope**:

- `src/lib/html/_MotionContainer.svelte` (`runReactiveCommit` + the small state it needs)
- `src/routes/tests/motion/layout-class-toggle/+page.svelte` (create)
- `e2e/motion/layout-class-toggle.spec.ts` (create)

**Out of scope**:

- `layout.ts` observer filters (removing `class` from the self-observer would break imperative classList changes that never touch Svelte props — that path must keep working).
- `commitObservedLayout` and the projection adapter.

## Git workflow

- Current branch; `test(motion): …` then `fix(layout): …`. Do NOT push.

## Steps

### Step 1: Failing e2e counting commits/events for a class-driven change

Page `src/routes/tests/motion/layout-class-toggle/+page.svelte` (model on `src/routes/tests/motion/layout-align-toggle/+page.svelte`): a `layout` motion.div inside a plain container whose position depends on the motion element's OWN class (e.g. the motion element toggling `margin-left: 0` ↔ `margin-left: 200px` via its `class` prop), a toggle button, and an `onProjectionUpdate` handler counting events with `changed === true` into a `data-` attribute or exposed `window.__projectionEvents` array (include timestamps).

Spec `e2e/motion/layout-class-toggle.spec.ts`:

1. Click toggle once; wait for the FLIP to settle (poll transform → identity).
2. Assert exactly ONE changed-projection event was recorded for the toggle. Current code records two (observer + reactive re-commit) — red.
3. Also sample the element's `getBoundingClientRect().left` per frame during the animation (model on `sampleRectLeftSeries` in `e2e/_helpers/transform.ts`) and assert the series is monotonic (no backwards jump — the restart signature).

**Verify**: `PW_REUSE_SERVER=1 npx playwright test e2e/motion/layout-class-toggle.spec.ts --reporter=line` → FAILS (2 events and/or non-monotonic series). If it does NOT fail, the microtask/rAF ordering differs from the audit's analysis — STOP and report the observed event count and ordering (this finding was MED confidence; the plan's premise may be wrong).

### Step 2: Suppress the duplicate reactive commit

In `runReactiveCommit`, before committing, detect that the observer path already consumed this change: compare `next` against `lastRect` — if `lastRect` is already rect-equal to `next` (use the existing `hasRectChanged(lastRect, next) === false` with a non-null `lastRect`) AND the observer updated `lastRect` after this reactive cycle's snapshot was taken, skip the `commitObservedLayoutChange` (still `emitProjectionUpdate`? NO — skip the changed emit too; the observer already emitted). Implement the ordering check with a monotonic token: `commitObservedLayout` increments a shared `observerCommitSerial` counter when it commits a changed rect; the `$effect` that schedules `runReactiveCommit` captures the current serial; `runReactiveCommit` skips its changed-commit when the serial advanced since capture AND `lastRect` equals `next`. Both conditions together preserve the existing no-delta constraint (the comment block at the end of `runReactiveCommit`) and keep genuine back-to-back distinct changes committing.

**Verify**: Step 1 spec PASSES (1 event, monotonic series).

### Step 3: Regression gate

`pnpm check` → 0. `pnpm vitest run src/lib/utils/layout.spec.ts` → pass. `PW_REUSE_SERVER=1 npx playwright test e2e/motion/layout-class-toggle.spec.ts e2e/motion/layout-align-toggle.spec.ts e2e/layout/ e2e/reorder/ --reporter=line` (run whichever of those directories exist — check `ls e2e/`) → all pass. `trunk fmt`/`trunk check` → clean.

## Test plan

- Red anchor: 2 changed-events / non-monotonic FLIP today → 1 event, monotonic after.
- Keep-working cases (same spec or layout-align-toggle): parent-driven re-slot (observer-only path) still animates; imperative `element.classList.add` (bypassing Svelte props) still animates — add this as a third test in the new spec: mutate class via `page.evaluate(el => el.classList.add('shift'))` and assert a FLIP occurs (guards against over-suppression).
- Model: `e2e/motion/layout-align-toggle.spec.ts`.

## Done criteria

- [ ] `pnpm check` exits 0; layout unit spec green
- [ ] New spec: exactly-one-event test, monotonic-series test, imperative-classList test all pass
- [ ] `layout-align-toggle` spec still green
- [ ] No out-of-scope files modified; README row updated

## STOP conditions

- Step 1 does not reproduce (see inline instruction — report, don't force it).
- The serial-token guard suppresses the imperative-classList FLIP (test 3 fails) — the ordering assumption is wrong; report the observed interleaving.
- Fix requires editing `layout.ts` observer filters.

## Maintenance notes

- Plan 009 widens observation to more ancestors — MORE observer commits will flow through `commitObservedLayout`; this guard must hold there too (009 re-runs this spec).
- Reviewer: scrutinize that `emitProjectionUpdate`'s zero-delta "idle event" contract (documented in `runReactiveCommit`) is unchanged for the no-delta path.
