# Plan 005: An interrupted layout animation restarts from the box that was painted, not one frame further on

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. This plan has an investigation gate (Step 2): if the cause is not the one described, you stop with a report, and that report is a successful outcome. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Never use `git stash`.**
>
> **Port rule**: this lane's Playwright port is **4275**. Prefix every Playwright command with `PW_PORT=4275`. Never use or kill port 4198. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat 4665b907..HEAD -- src/lib/utils/motionDomProjection.ts src/lib/html/_MotionContainer.svelte e2e/layout/velocity.spec.ts`
> Expected changes: plan 003 added `readSnapshotVelocity` / `recordSnapshotVelocity` and four calls in `motionDomProjection.ts` and created the spec; plan 002 added one line to `derivedAttrs` in `_MotionContainer.svelte` (near `:1932`); plan 004 may have changed `takeOverLiveLeadOnMount` / `seedDepartingLeadSnapshot`. Find the functions named below by name, not by line. If `onScreenSnapshot`, `commitObservedLayoutChange`, `flushFrameSteps` or `scheduledReactiveCommit` changed, compare against the excerpts; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED–HIGH. The snapshot timing in the reactive commit path was tuned by several earlier plans (the comments cite plans 007, 012 and 015), and the full layout e2e suite is the only safety net.
- **Depends on**: 003-layout-velocity.md (it creates the fixtures and the four tests this plan turns green, and both plans edit `motionDomProjection.ts`)
- **Wave**: 3
- **Category**: bug (upstream divergence, older than this release)
- **Planned at**: commit `4665b907`, 2026-11-14

## Why this matters

When a layout animation is interrupted, Motion starts the new one from the box the user last saw. svelte-motion starts it from where the old animation *would be now*: it advances the old animation by up to one frame first and snapshots that. Nothing jumps, so with a spring that carries velocity the difference is hard to see. But a tween, a duration spring, or a spring with a `delay` should stop on the spot, and here they travel on for a frame's worth of the old speed first (8 to 12 px in the fixtures below, where upstream's tests allow 1 to 2). Four of upstream's layout-velocity tests fail for this reason alone. The house rule is to match upstream wherever we differ.

## Current state

- **The four tests** (created by plan 003 in `e2e/layout/velocity.spec.ts`, each marked `test.fixme()` with a comment naming this plan, (plan 003 marks all four with `test.fixme()`, revision 2026-11-14)):
  - "An interrupted layout tween starts from rest": `Math.max(...samples) < atInterrupt + 1`
  - "An interrupted layout spring with a duration starts from rest": same assertion
  - "An interrupted spring with a delay holds still during the delay": every sampled width within 2 px of the width at the interrupt
  - "An interrupted mirror spring goes back to where it was interrupted": `|back − atInterrupt| < 5`
- **Measured at planning time** (scratch copy of the fixtures, vite dev server, Chromium), on both motion-dom 14.12.0 and 14.14.0. The position is read and the box clicked in one `evaluate`, between frames:
  - tween: the left edge peaks 7.9 to 12.6 px past `atInterrupt`
  - duration spring: 12.2 px past (14.12.0)
  - delay: the width jumps from 373.9 to 376 and then holds (14.12.0); from 389.3 to 398 with plan 003's change applied
  - mirror: comes back to 14 to 20 px past `atInterrupt`
- **A timeline of one interrupt** (tween fixture, 14.14.0, instrumented at planning time; times in ms, left edge in px):
  ```
  click            1189.7   280      ← painted position
  afterClickSync   1189.9   280
  willUpdate       1190.2            ← adapter.willUpdate(): motion-dom snapshots the painted box
  microtask        1190.8   100      ← DOM patched, transform cleared
  commitObserved   1191.1            ← from runReactiveCommit ← scheduledReactiveCommit
  timeout0         1191.9   289.8    ← the new animation's start: 9.8 px past the painted box
  raf              1194.6   288.6
  ```
- **Where the extra travel comes from.** `src/lib/html/_MotionContainer.svelte:2705-2726`:
  ```ts
  const flushFrameSteps = () => {
      if (frameData.isProcessing) return
      const now = time.now()
      frameData.delta = Math.min(Math.max(now - frameData.timestamp, 0), 1000 / 60)
      frameData.timestamp = now
      frameData.isProcessing = true
      try {
          frameSteps.update.process(frameData)
          frameSteps.preRender.process(frameData)
          frameSteps.render.process(frameData)
      } finally {
          frameData.isProcessing = false
      }
  }

  let reactiveCommitQueued = false
  const scheduledReactiveCommit = () => {
      reactiveCommitQueued = false
      if (!reactiveCommitPrevious) return
      flushFrameSteps()
      runReactiveCommit()
  }
  ```
  `flushFrameSteps()` runs the frameloop's `update` step, which ticks the running layout animation to `now`. Then `runReactiveCommit()` (`:2728`) calls `commitObservedLayoutChange(prev, { ownSubtreeChanged: true })` (`:2771`), and in `src/lib/utils/motionDomProjection.ts`:
  ```ts
  // commitObservedLayoutChange (:2031)
  const projection = this.projection
  const onScreen = projection.currentAnimation && projection.target
  const snapshot = onScreen
      ? this.onScreenSnapshot()
      : …

  // onScreenSnapshot (:2589)
  const target = this.projection.currentAnimation ? this.projection.target : undefined
  if (target) {
      return measurementsFromRect(
          rectFromBox(this.rebasedBox(target, this.layoutBasis)),
          this.lastLayout ?? this.projection.layout
      )
  }
  ```
  The snapshot is the projection `target` **after** that tick. The committer's snapshot always replaces whatever the node held (`seedCachedSnapshotsForSubtree`, `:2655-2670`), including the one motion-dom took of the painted box at `willUpdate` time.
- **Upstream** does the same flush, but after its snapshot: `willUpdate()` → `updateSnapshot()` measures the element as painted (`packages/motion-dom/src/projection/node/create-projection-node.ts:1046` at v14.14.0); `didUpdate()` later schedules `update()`, which processes the frame steps and then measures the new layout. The comment above `flushFrameSteps` (`_MotionContainer.svelte:2672-2692`) cites this (`829-845` at v14.2.0) and explains why our flush exists: a parent's batched style write has to land before the new layout is measured. That reason concerns the **new** layout, not the snapshot.
- **Working hypothesis** (confirm in Step 2): capturing the node's on-screen box before `flushFrameSteps()` runs, and using that as the committer's snapshot, makes the four tests pass without changing what the flush is for.
- **Conventions**: no `as any`; exported functions carry Google-style JSDoc; comments in this file cite upstream file and line with the tag. `recordSnapshotVelocity` (plan 003) must still run on whatever snapshot the committer ends up with, and it must read the node **before** the flush too if the box does (velocity and box should describe the same instant). If velocity cannot be read before the flush without a wider change, read it after, and say so in your report.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0; `motion-dom` is 14.14.0 |
| Types | `pnpm check` | `0 ERRORS` |
| All unit tests | `pnpm test:only` | all pass |
| The velocity spec | `PW_PORT=4275 pnpm exec playwright test --project=chromium e2e/layout/velocity.spec.ts` | as stated per step |
| Layout e2e | `PW_PORT=4275 pnpm exec playwright test --project=chromium e2e/layout e2e/layout-id e2e/animate-presence e2e/reorder e2e/projection e2e/animate-layout e2e/drag` | all pass (known skips only) |
| Full e2e | `PW_PORT=4275 pnpm exec playwright test --project=chromium` | all pass (known skips only) |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

## Scope

**In scope:**
- `src/lib/html/_MotionContainer.svelte`: `scheduledReactiveCommit` and `runReactiveCommit` only (around `:2721-2775`)
- `src/lib/utils/motionDomProjection.ts`: `commitObservedLayoutChange()` and `onScreenSnapshot()`, plus at most one new small method
- `e2e/layout/velocity.spec.ts`: removing `test.fixme()` lines
- `src/lib/utils/motionDomProjection.spec.ts`: unit tests for any new method
- `.changeset/interrupt-from-painted-box.md` (create)

**Out of scope:**
- `flushFrameSteps` itself: it must keep flushing before the new layout is measured.
- The observer path (`_MotionContainer.svelte:3255-3312`), the presence release path (`:3315-3375`), `takeOverLiveLeadOnMount`, `seedDepartingLeadSnapshot`, and the four `recordSnapshotVelocity` call sites, unless Step 2 shows the reactive path is not the one involved (then STOP).
- Changing any threshold in `e2e/layout/velocity.spec.ts`.
- Any other spec. A regression elsewhere is a STOP, not something to adjust.

## Git workflow

- Lane branch `lane/14140-painted-box`, cut from `feat/motion-14.14.0` after plan 003 is merged (and after plan 004, if it has landed).
- Conventional commits, for example `fix(layout): an interrupt restarts from the painted box`.
- Do not push.

## Steps

### Step 1: Confirm the red tests

Remove the `test.fixme()` line from each of the four tests locally (do not commit yet) and run the spec three times.

**Verify**: `PW_PORT=4275 pnpm exec playwright test --project=chromium e2e/layout/velocity.spec.ts --repeat-each=3` → record, for each of the four tests, how many of three runs fail and by how much (`Math.max(...samples) − atInterrupt`, the worst width difference, `back − atInterrupt`). At least the tween and duration tests must fail in all three runs. If all four pass in all three runs, the divergence does not reproduce on a built package: commit the removal of the `test.fixme()` lines, skip to Step 5, and say so in your report.

### Step 2: Investigation gate

Add temporary `console.debug` lines (remove before committing) that print `performance.now()` and `projection.target?.x.min`:
- in `scheduledReactiveCommit`, before and after `flushFrameSteps()`;
- at the top of `commitObservedLayoutChange`.

Run the tween fixture once with the console captured.

**Verify**: your report states whether
- (a) `projection.target.x.min` changes across `flushFrameSteps()` by about the size of the test's failure, and `commitObservedLayoutChange` is reached from `runReactiveCommit` (the hypothesis); or
- (b) the target does not move across the flush, or the commit comes from another path (the observer at `:3308`, or `:3154`).

For (b), restore the `test.fixme()` lines, STOP, and report the numbers. Do not try another fix.

### Step 3: Snapshot before the flush

For (a): in `scheduledReactiveCommit`, before `flushFrameSteps()`, ask the adapter for the node's on-screen snapshot and keep it for the commit that follows. Add one small public method on the adapter for this (for example `captureOnScreenSnapshot()`, returning the same value `onScreenSnapshot()` builds, or `undefined` when the node is not mid layout animation), with a Google-style JSDoc that cites `updateSnapshot()` (`create-projection-node.ts:1046` at v14.14.0) and says why it must run before the frame steps are flushed. Pass the captured value into `commitObservedLayoutChange` through its existing `options` argument (a new optional field), and use it there in place of the `onScreen ? this.onScreenSnapshot()` branch when present.

Keep these properties:
- With no captured snapshot (every other caller), `commitObservedLayoutChange` behaves exactly as before.
- The snapshot is still rebased for scroll (`rebasedBox(target, this.layoutBasis)`), as `onScreenSnapshot()` does.
- `recordSnapshotVelocity` still runs for the committer. If the velocity is to describe the same instant as the box, read it at capture time and carry it on the captured snapshot; otherwise leave plan 003's call where it is.
- A node that is not mid animation is unaffected (no captured snapshot).

**Verify**: `PW_PORT=4275 pnpm exec playwright test --project=chromium e2e/layout/velocity.spec.ts --repeat-each=3` → all tests PASS in all three runs, including the four from Step 1 and plan 003's tests 1 and 6 ("keeps its velocity" must still exceed `atInterrupt + 5`).

If the four pass but "keeps its velocity" now fails, the velocity is being read at the wrong instant: fix that within the in-scope functions, or STOP.

### Step 4: Unit tests

Add tests for the new adapter method in `src/lib/utils/motionDomProjection.spec.ts`, following the file's existing adapter tests: it returns `undefined` for a node with no running layout animation; for a node mid animation it returns measurements whose `layoutBox` equals the projection `target` at the time of the call, and a later change to `target` does not change the returned object.

**Verify**: `pnpm exec vitest run src/lib/utils/motionDomProjection.spec.ts` → all PASS.

### Step 5: Changeset and gate

Create `.changeset/interrupt-from-painted-box.md` (`patch`): "An interrupted layout animation now restarts from the position that was last painted. Before, a tween or a delayed spring travelled on for up to one frame before turning."

Commit the removal of the four `test.fixme()` lines with the fix. Run `pnpm check`, `pnpm test:only`, `pnpm build`, the layout e2e group, then the full chromium e2e while no other lane is running Playwright, then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; all unit tests pass; e2e passes except known skips. Re-run a failing spec alone once before reporting it. `e2e/animate-presence/pop-layout-container-move.spec.ts:282` is a known intermittent failure on `main`. Any other existing spec that fails after Step 3 and passed before it is a STOP: restore the code, keep the `test.fixme()` lines, and report the spec and the assertion.

Revert any change `pnpm build` makes to `docs/static/r/animated-tabs.json`.

## Test plan

- **Red-first anchors**: the four upstream tests listed under "Current state", failing on current code (confirmed in Step 1 with their margins) and passing after Step 3, three runs each.
- **Guards**: plan 003's tests 1 and 6 (velocity is still carried), the fixed-edge and nested tests, and the whole layout e2e group.
- **Unit**: the new adapter method (Step 4).
- These tests sample single frames, so they are timing-sensitive. Each was run three times before and after; report any run that disagrees.

## Done criteria

- [ ] `grep -c "test.fixme" e2e/layout/velocity.spec.ts` → `0`
- [ ] `e2e/layout/velocity.spec.ts --repeat-each=3` → all pass
- [ ] `pnpm check` → 0 errors; `pnpm test:only` → all pass
- [ ] Full chromium e2e → no new failures
- [ ] `grep -n "console.debug" src/lib/html/_MotionContainer.svelte src/lib/utils/motionDomProjection.ts` → no output
- [ ] `git status` shows only in-scope files

(If the plan ended at a STOP in Step 1, 2 or 5, the done criterion is the report: the measurements, which case was found, and the `test.fixme()` lines left in place.)

## STOP conditions

- The fixtures or the four tests do not exist (plan 003 is not merged into your base).
- Step 2 finds case (b).
- The fix needs a change to `flushFrameSteps`, the observer path, or a file outside the scope list.
- After Step 3, any existing layout, `layoutId`, presence, Reorder, drag or projection spec fails that passed before it.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- This is the fourth change to when the reactive path snapshots (see the "plan 007", "plan 012 A5/A6" and "plan 015" comments in `commitObservedLayoutChange`). Those comments describe failures that came from snapshotting the wrong box; re-read them before changing this again, and keep their specs green.
- The observer path (`_MotionContainer.svelte:3308`) and the presence release path (`:3373`) do not flush first, so they are not affected. If a later change adds a flush there, it needs the same capture.
- The `reactive-tracking-leaks` batch's plan 003 edits one `onLayoutMeasure` effect in the same file (around `:3046-3132`). The hunks do not overlap, but both change how layout effects behave; do not run the two lanes' full e2e gates against a half-merged tree.
- Reviewer: confirm no threshold in `velocity.spec.ts` differs from upstream's, and that `commitObservedLayoutChange` is unchanged for callers that pass no captured snapshot.
