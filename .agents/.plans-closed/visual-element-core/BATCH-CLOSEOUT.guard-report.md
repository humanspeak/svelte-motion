# Guard batch close-out — visual-element-core (#449)

**Recommendation: PASS (batch)** — five of six plans landed and verified,
the sixth deferred by sanctioned ruling with a complete re-scope record;
operator live-demo sign-off COMPLETE on every section.
**Closed at** the batch-final gate on `issue-449-visual-element-core`
(2026-07-25; final gate results recorded below) · **Batch planned at** `7eba0bd`
**Integrated** — branch not pushed; PR is the operator's next decision now
that sign-off is complete.

## Plan-by-plan verdicts (each has its own guard report beside it)

| Plan                  | Verdict                       | One-line                                                                               |
| --------------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| 001 foundation        | PASS                          | one inert VisualElement per component; single-VE invariant proven                      |
| 002 animate core      | PASS                          | declarative + imperative writers through animationState; container 3,612 → 2,981 lines |
| 003 gestures          | PASS                          | coordinator + per-gesture stacks deleted; velocity handoff structural                  |
| 004 presence/exit     | PASS                          | `setActive('exit')` with real presence context; last legacy `animate()` gone           |
| 006 inherited initial | PASS                          | operator-found; red-first; upstream's missing context half                             |
| 005 drag/layout       | BLOCKED (sanctioned deferral) | re-scope blockers + operator acceptance criterion recorded in the plan                 |

## Batch-final verification (guard-run)

- Full unit suite: **813 passed**. ENTIRE `e2e/` directory: **378 passed,
  0 failed, 2 skipped** (10.9m) — includes plan 006's new spec.
- Operator sign-off: all seven tour sections passed (§7 with the accepted
  known defect, now plan 005's acceptance criterion).

## What changed, net

Six independent animation-writer systems replaced by one motion-dom
`VisualElement` + `createAnimationState` per component. Deleted:
`gestureCoordinator.ts`, `interaction.ts`, `focus.ts`, `attachWhileHover`,
`attachWhileInView`, `executeAnimation`, `applyAnimateRestingStyle`, the
`renderedInlineStyle` phase machine, all duration-0 snap paths, and every
legacy `animate()` call in the container. Gained: upstream variant priority

- protected keys, `prevResolvedValues` dedup, velocity-continuous
  interrupts, real presence-context exits, inherited-initial first paint.

## Conduct summary (full detail in per-plan logs)

12 executor runs, 8 evidence-based STOPs, zero improvised boundary
crossings, two self-caught-and-disclosed process incidents (a reset past a
guard commit — restored by cherry-pick; a `git add -A` sweep — amended
within the executor's own boundary), nine guard plan revisions (all
constraint-tightening or re-sequencing; no done criterion weakened).

## Open items leaving this batch

1. **Plan 005** (drag/layout single-writer) — deferred; re-scope blockers
   and the operator's hover-during-glide acceptance criterion are in the
   plan's revision notes. Re-plan before any attempt.
2. **`.agents/.plans/svg-through-ve/`** — ready-to-run migration batch.
3. **`.agents/.plans/clone-exit-migration/`** — spike-first batch; build
   plan deliberately unwritten until the spike's mechanism decision.
4. `modes.spec.ts:46` — pre-existing sub-pixel flake; tolerance review
   candidate.
5. (Observation, low priority) an app that ships an SSR/client
   `reducedMotion` mismatch runs the enter under the stale server policy —
   app-state divergence, not a library defect; file only if it recurs.

## Constraint ledger (binding on all future work in this area)

See plan 002 revisions #4–#9 and the guard reports; headline items: never
memoize the animated-style slot; never skip the first `animateChanges()`
pass; per-commit flushes are `scheduleRenderMicrotask()`; the projection
adapter's `updateOptions` stays `untrack`ed inside the mount effect;
presence context is a fresh object per `ve.update()`; accelerated WAAPI
channels bypass value sync — freeze via per-channel `value.stop()`; TDZ:
anything the VE-creation block calls must be declared above it.
