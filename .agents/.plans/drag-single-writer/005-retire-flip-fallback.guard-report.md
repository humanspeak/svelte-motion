# Guard report — drag-single-writer 005

**Recommendation: PASS** — evidence-gated exactly as designed: the dead FLIP
paths are deleted with reachability proof, the `layoutId`-only case routes
through the projection, and the one survivor (`runLayoutSizeAnimation`) is
measured load-bearing, not spared by timidity.
**Reviewed at** `6b429bc` · 2026-07-26 · **Plan planned at** `04418be`
**Integrated** — not pushed; batch close-out + operator tour next.

## Done criteria

| Criterion                                                         | Result | Evidence (guard-reproduced)                                                                                                                                                                                                              |
| ----------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate + unit + typecheck green                                     | met    | Guard batch-final: **777 unit; ENTIRE e2e directory 384/2/0** (executor's five-suite gate 105/0 ran twice)                                                                                                                               |
| `grep runFlipAnimation src/` → no matches                         | met    | plain-FLIP branch deleted; `runBoxSizeAnimation` renamed `runLayoutSizeAnimation` (all it is now)                                                                                                                                        |
| Step-1 reachability list with evidence; every deletion tied to it | met    | 16 routes driven, instrumented at all entry points + call sites: `!projectionAdapter` never fires (deleted); `layoutId`-without-`layout` fires (rerouted, `8ca2559`); size-corrected fires on 4 layout-button controls (kept, evidenced) |
| README row updated                                                | met    | 005 → DONE (partial-by-evidence noted)                                                                                                                                                                                                   |

## Spirit

The plan's whole design was "no deletion without a reachability verdict," and
that is what happened — including the honest half: the width/height
size-correction model is NOT dead code. The spike proved it load-bearing
(forcing projection regressed exactly 2 named specs on measured geometry;
~20 specs pin the model incl. its own DOM marker), and the reason is
substantive: scaling text-bearing buttons distorts glyphs, so the library
animates width/height with descendants at identity — a deliberate model
difference, now documented in `layout.ts`'s header with its follow-up named.
Case A's reroute carries a documented behavior delta (the ARRIVING element's
transition drives shared-layout animations — upstream's model).

**Batch end state, verified**: no transform-animating writer exists outside
the VisualElement anywhere in the library. The one surviving element writer
is the size-correction width/height animation; presence clones remain the
known exception pending the clone-exit spike batch.

## Scope & conduct

- One deviation, ruled a PLAN DEFECT and approved: `motionDomProjection.ts`
  was listed out-of-scope while Step 2 simultaneously instructed "set the
  projection up for that case." The executor resolved the contradiction
  minimally (two guard conditions accept `layout || layoutId`, with
  comments), flagged it unprompted, and changed no semantics for nodes that
  already animated. Guard-audited: the diff is exactly those guards.
- The Case-B STOP was respected precisely: one spike, two measured
  regressions, revert, no second attempt — "a model difference, not a bug."
- Both batch follow-ups evaluated as asked: the dataset marker could become
  internal drag state via an `isDragging()` getter on the existing drag
  handle (ledgered — drag.ts out of scope here); `transformComposer.ts`
  stays (two live drag.ts callers).
- Minor: repo svelte-check warning count drifted 33 → 34 during the batch
  (non-gating; `state_referenced_locally` class). Note for the PR.

## Residual risk / follow-ups (batch ledger)

1. Size-correction into the projection adapter (would retire
   `runLayoutSizeAnimation`) — the named follow-up in `layout.ts`'s header.
2. Dataset marker → internal drag state (`isDragging()` on the drag handle).
3. Sampling-gap-aware smoothness assertions (pre-existing flake, proven).
4. `animateWithLifecycle` retirement (production-dead).
5. #458: authored raw transform strings (post-1.x).
