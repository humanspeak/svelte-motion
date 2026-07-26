# Plan 001: Safe axis handoff at drag start and release (Codex findings, pre-#459-merge)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm expected results before moving on. STOP
> conditions are live. Update the status row in
> `.agents/.plans/drag-axis-handoff/README.md` when done. This work lands on
> the OPEN PR #459 branch (`drag-single-writer`) before merge.
>
> **Drift check (run first)**: `git diff --stat 41b2b20..HEAD -- src/lib/utils/drag.ts`
> Expect empty.

## Status

- **Priority**: P1 — blocks merging PR #459 (Codex adversarial review: two
  HIGH findings, guard-verified as real port defects, NOT upstream-shared)
- **Effort**: M
- **Risk**: MED — touches the drag start/release paths the batch just landed;
  the full drag/reorder surface is the bar
- **Depends on**: drag-single-writer batch (CLOSED, 5/5 PASS, archived)
- **Category**: bug (port gaps vs upstream; #449 follow-up)
- **Planned at**: commit `41b2b20`, 2026-07-26

## Why this matters

Two upstream behaviors were not ported, and both are user-visible under
plausible conditions the batch's 384-spec gate never exercised:

1. **Drag start does not take ownership of the axis values.** Upstream stops
   both axes' animations the moment a session starts; we stop only our own
   inertia. Grabbing an element while ANY other animation drives x/y
   (declarative enter, `controls.start`, a gesture retarget) leaves that
   animation writing against the pointer — resistance, position jumps, or a
   snap when it finishes.
2. **Release ordering is inverted.** Upstream deactivates `whileDrag` BEFORE
   starting momentum, so the restore retarget happens first and momentum owns
   the values. We deactivate AFTER — so a `whileDrag` containing `x`/`y` has
   its restore CANCEL the just-started glide. Worse, our release cleanup
   lives only in `onComplete` + our own `stopInertia`, so ANY foreign
   retarget of x/y mid-glide silently cancels the release with
   `postReleaseAnimationActive` stuck, tracking subscriptions leaked, and
   `onDragTransitionEnd` never fired.

Guard provenance: the ordering deviation was flagged by the executor in
batch plan 002 as "no observable difference for transform channels" and
accepted at checkpoint — Codex falsified that claim for axis keys. Finding 1
was never specified by plan 001. Both are plan defects being repaid here.

## Current state

(All verified at `41b2b20`.)

- **Our drag start** — `drag.ts:960`: `beginDrag` calls `stopInertia()` (our
  own release) only. No per-axis `value.stop()`.
- **Our release ordering** — `finishDrag`: releases start (momentum/settle),
  then `setWhileDragActive(false)` at `:1575`. Release-time value
  normalization at `:1329`/`:1507` (`release.value.jump(applied + base)`);
  our stop path `:1362-1365` (`release.value.stop()` per channel).
- **Our cleanup** — completion bookkeeping (tracking subscriptions,
  `postReleaseAnimationActive`, `onDragTransitionEnd`) runs from
  `onComplete` and from `stopInertia` only. A foreign animation starting on
  the same MotionValue stops the release WITHOUT either path running
  (Codex reproduced the whileDrag-axis case; `drag.ts:1331-1374` region).
- **Upstream contract** (`~/Github/motion/packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`):
    - `onSessionStart` → `this.stopAnimation()` (`:114`) →
      `eachAxis(axis => this.getAxisMotionValue(axis).stop())` (`:534-536`);
      their comment at `:598-601`: "Stop current animations as there can be
      visual glitching if we try to do this mid-animation".
    - `stop()` → `this.cancel()` FIRST (which does
      `animationState.setActive("whileDrag", false)`, `:305`) THEN
      `this.startAnimation(velocity)` (`:270-276`). Deactivation precedes
      momentum; momentum owns the values.
    - Upstream's `startAxisValueAnimation(...).then(...)` settles on
      interruption too (motion animation promises resolve on stop), so their
      completion bookkeeping runs on every exit route. Verify this claim in
      the installed sources before mirroring the mechanism; if it does not
      hold, note what upstream actually does with interrupted releases and
      match THAT.
- **MotionValue event surface** (installed motion-dom, `index.d.ts:2404-2406`):
  `animationStart` / `animationComplete` / `animationCancel` events exist on
  values — a sanctioned hook for detecting foreign takeover, if the
  promise-settling route proves wrong.
- **Constraint ledger applies** (archived batches): per-channel
  `value.stop()` for freezes (accelerated channels route through
  `NativeAnimationExtended.updateMotionValue`); the `isSync` requirement on
  release animations (drag batch 003 — do NOT disturb it); never reset past
  foreign commits; WIP commit before drag.ts surgery.
- Existing specs that must not regress: the full `e2e/drag` + `e2e/reorder`
  surface incl. `hover-during-glide` (3×), `settle-cancel` (#401 channel
  form), `stale-velocity`, `controls-cancel-inertia`, `snap-to-origin`,
  `while-drag-*`, and the coalescing budget.

## Commands you will need

| Purpose     | Command                                             | Expected                        |
| ----------- | --------------------------------------------------- | ------------------------------- |
| Typecheck   | `pnpm check`                                        | 0 errors                        |
| Unit        | `pnpm test:only`                                    | all pass                        |
| Drag gate   | `pnpm test:e2e e2e/drag e2e/reorder`                | all pass                        |
| Full sweep  | `pnpm test:e2e` (entire directory, once at the end) | all pass (2 pre-existing skips) |
| Format/lint | `trunk fmt` / `trunk check`                         | no new issues                   |

## Scope

**In scope**:

- `src/lib/utils/drag.ts` (start-ownership, release ordering, idempotent
  cleanup)
- `src/lib/utils/drag.spec.ts` (unit pins for the cleanup routes)
- New fixture page(s) under `src/routes/tests/drag/` + new
  `e2e/drag/axis-handoff.spec.ts` (or split files if clearer)
- `.agents/.plans/drag-axis-handoff/README.md`

**Out of scope**:

- The container, `gestures.ts`, `visualElementCore.ts`, `dragInertia.ts`'s
  physics/options (the `isSync` contract stays byte-identical), the archived
  plan batches, PR #459's already-landed commits (no rebasing/rewriting).

## Git workflow

- Work on `drag-single-writer` (the open PR branch); conventional commits;
  push is allowed ONLY at the very end after the reviewer's gate (the PR
  updates automatically); never reset past commits you did not author.

## Steps

### Step 1: Red tests — all three scenarios, failing for the specified reasons

Fixture + specs. Each must FAIL against current code with the described
signature before any fix lands; if one passes, that reproduction is wrong —
STOP and report (do not tune it into failing).

a. **Grab during a foreign axis animation**: a card whose `x` is being driven
by a declarative animation (e.g. a long `animate={{ x: [0, 300] }}` loop
or a button-triggered controls run); mid-animation, pointer-grab and drag
the OTHER direction; assert the element tracks the pointer within
tolerance for the whole hold (sample frames; the current code shows the
animation fighting/overwriting — travel reverses or jumps).
b. **whileDrag with an axis key + momentum**: `drag="x"` card with
`whileDrag={{ y: -12, scale: 1.05 }}` and momentum; throw it; assert
(i) x CONTINUES gliding after release (travel increases across samples —
currently the restore cancels it), (ii) y and scale restore, (iii)
`onDragTransitionEnd` fires exactly once (expose a counter on the page).
c. **Foreign retarget mid-glide**: throw the card, then mid-glide trigger an
external x retarget (button calling `controls.start` or flipping a
declarative `animate` x); assert the retarget wins cleanly AND
`onDragTransitionEnd` still fires exactly once AND a SUBSEQUENT drag
behaves normally (origin not corrupted — pin with a position assertion).

**Verify**: each spec fails with its named signature. Commit the red specs
first (`test(drag): …`).

### Step 2: Axis ownership at drag start

In `beginDrag`, before origin capture: for each enabled axis, stop the
value's current animation (per-channel `value.stop()` — the ledger's freeze
mechanism, correct for accelerated channels too), THEN derive
`applied`/origin from the frozen current value relative to its authored
base. Mirror upstream `:114`/`:534-536`; cite them in a comment.

**Verify**: Step 1a passes; `pnpm test:e2e e2e/drag` → no regressions
(watch `stale-velocity` and re-grab continuity — stopping at grab must not
break the velocity-continuous re-grab, which upstream's identical ordering
preserves).

### Step 3: Upstream release ordering

Move `setWhileDragActive(false)` to BEFORE the releases start in
`finishDrag`, mirroring upstream's cancel-then-startAnimation (`:270-276`,
`:305`). The whileDrag restore retarget then lands first and momentum
retargets the axis values after it — upstream's ownership order. Non-axis
whileDrag keys (scale etc.) must still restore correctly (the
`while-drag-restore` suite pins this).

**Verify**: Step 1b passes; `while-drag-restore` + `while-drag-transforms`
suites green; `hover-during-glide` 3× green.

### Step 4: Idempotent, interruption-aware release cleanup

Extract the release bookkeeping (tracking subscriptions,
`postReleaseAnimationActive`, `onDragTransitionEnd` semantics) into ONE
idempotent cleanup invoked from every exit route: natural completion, our
`stopInertia`, teardown, AND foreign interruption. Mechanism: prefer the
animation handle's settled promise IF the Step-"Current state" verification
shows motion-dom settles on stop; otherwise the value's `animationCancel`/
`animationStart` events. Match upstream's `onDragTransitionEnd` semantics on
interruption (verify what upstream actually does — fire or skip — and pin
the same in the unit spec).

**Verify**: Step 1c passes; new unit pins cover all four routes; the b/c
specs pass 3× consecutive (they are timing-sensitive).

### Step 5: Full wrap

`trunk fmt` → `trunk check` → `pnpm check` → `pnpm test:only` →
`pnpm test:e2e e2e/drag e2e/reorder` → ONE full-directory
`pnpm test:e2e` run. Update the README row. Do NOT push — the reviewer
gates, then pushing updates PR #459.

## Test plan

- Red-first anchors: the three Step-1 specs with named failure signatures.
- Unit pins: the four cleanup routes; upstream-matched
  `onDragTransitionEnd` interruption semantics.
- Regression bar: the entire signed-off drag/reorder surface + one
  full-directory sweep.

## Done criteria

- [ ] `pnpm check` 0 errors; `trunk check` clean; `pnpm test:only` green
- [ ] All three Step-1 specs: failed red with named signatures, now pass
      (b and c 3× consecutive)
- [ ] `e2e/drag e2e/reorder` green; ONE full-directory run green
      (2 pre-existing skips only)
- [ ] `grep -n "value.stop()" src/lib/utils/drag.ts` shows the drag-start
      ownership stop with the upstream citation
- [ ] `setWhileDragActive(false)` provably precedes release starts
- [ ] One idempotent cleanup, four routes pinned by unit tests
- [ ] README status row updated; NOTHING pushed (reviewer gates)

## STOP conditions

- Any Step-1 spec fails to reproduce as specified.
- Any signed-off drag/reorder spec regresses after two focused attempts —
  especially re-grab velocity continuity under the new start-stop.
- The upstream promise-settling claim proves false AND the event-based
  fallback cannot cover a route — report the gap, do not half-cover.
- The ordering fix breaks non-axis whileDrag restore.

## Maintenance notes

- This closes the Codex adversarial findings on PR #459; the PR description
  should gain a line for it after landing (reviewer's job).
- The interruption-cleanup mechanism becomes the pattern for any future
  value-driving writer (e.g. the size-correction→projection follow-up).
