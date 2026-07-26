# Guard batch close-out — drag-single-writer (#449 follow-up)

**Recommendation: PASS (batch)** — all five plans landed; the deferred-005
monolith's re-scope proved itself: what took the original attempt to a
sanctioned BLOCKED completed in five gated runs with one plan-defect ruling
and zero behavioral regressions.
**Closed at** the batch-final gate, 2026-07-26 · **Batch planned at** `04418be`
**Integrated** — not pushed; operator tour drive precedes the PR
(`/tests/drag-signoff`).

## Plan-by-plan (each has its own guard report beside it)

| Plan                 | Verdict | One-line                                                                                             |
| -------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| 001 axis writer      | PASS    | VE values + sync render; coalescing spec hardened pre-swap; authored raw strings ruled parity (#458) |
| 002 whileDrag + lock | PASS    | operator's hover-during-glide criterion red-first → green; four-route lock-leak audit                |
| 003 inertia          | PASS    | releases drive the values; `canAnimate` flattening trap found + tripwired; physics bit-for-bit       |
| 004 whilePan         | PASS    | `animateTarget` extension semantics; hover.ts → one export; pre-existing flake proven + ledgered     |
| 005 FLIP fallback    | PASS    | evidence-gated deletion; layoutId-only via projection; size-correction kept BY MEASUREMENT           |

## Batch-final verification (guard-run)

Full unit suite **777 passed**; ENTIRE `e2e/` directory **384 passed /
0 failed / 2 pre-existing skips** (14.3m). Every plan's gate was also
independently re-run at its own checkpoint, including the glide acceptance
spec 3× on the retargeted physics.

## What changed, net

Drag's pointer writes, momentum/settle physics, `whileDrag`, `whilePan`, and
the layoutId FLIP all flow through the per-component VisualElement. Deleted:
the dataset transform attribute + triple-write + rAF composer loop, the
whileDrag per-channel animation stack, the container's drag-channel mirror +
`liveGestureTransform` splice, the detached-inertia piping, the whilePan
legacy writer (hover.ts down to one export), and the unreachable FLIP paths.
Gained: **hover during the momentum glide** (the operator's #449 acceptance
criterion), bound values tracking the glide live, whileDrag in upstream's
priority order, and the global drag lock with upstream release semantics.
**No transform-animating writer exists outside the VisualElement.**

## Conduct summary

Five runs, one BLOCKED (correct, evidence-based, ruled as plan defect under
the operator's parity doctrine → #458), one approved scope deviation (plan
self-contradiction), zero improvised boundary crossings, two behavior
contracts preserved through re-expression with zero deleted assertions
(#401 channel-form base; spread-probe strengthening precedent from the SVG
batch carried forward in spirit). Measurement discipline throughout:
pre-swap spec hardening, both-direction probe self-validation, re-established
RED evidence, spike-measured survivorship.

## Open items leaving this batch (the ledger)

1. Size-correction → projection adapter (retires `runLayoutSizeAnimation`).
2. Dataset marker → internal drag state (`isDragging()` getter).
3. Sampling-gap-aware smoothness assertions (pre-existing flake).
4. `animateWithLifecycle` retirement; `transformComposer.ts` re-evaluation
   rides whichever of the above lands first.
5. #458 (raw transform strings), #456 (root-svg attrX) — the post-1.x
   better-than-upstream ledger.
6. `clone-exit-migration` spike batch — the last architectural deviation.

## Operator sign-off

**COMPLETE (2026-07-26)** — operator drove the tour at `/tests/drag-signoff`
and approved ("working wonderfully"). Guard additionally smoke-verified the
headline live: mid-glide `translateX(180px)` composing with hover
`scale(1.25)` on the same frame.
