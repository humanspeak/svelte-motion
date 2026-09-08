# Proposed coordinate-contract amendment — 2026-09-08

**SUPERSEDED / NOT APPROVED.** The user selected exact React behavior and reuse only through APIs intended for reuse. The custom correction proposed below is historical and must not be implemented as an approved contract. See the [governing plan revision](001-transform-page-point.md#governing-revision--2026-09-08-paused-for-review).

Evidence correction: the direct `PanSession` probe passed `element`, enabling scroll tracking that React's ordinary `PanGesture` wrapper does not enable. It does not prove a React `onPan` defect. Snap remains a source-level concern until matched public React/Svelte fixtures establish observable behavior. Implementation remains paused for review.

## Decision

Permit explicit, documented differences from Motion 13.2.0 where its transformed scroll or snap calculations mix coordinate domains. Preserve the plan's visible goal: under a positive parent scale, the element follows the pointer and pan/drag payloads remain in consistent local units. Keep all existing runtime scope boundaries, especially the prohibition on projection-runtime changes and changed no-config semantics.

## Evidence requiring the decision

Guard directly executed installed `framer-motion@13.2.0` `PanSession` in jsdom. With callback `point * 2`, pointerdown `(10,10)` and move `(30,30)`, it reports point `(60,60)`, offset `(40,40)`. A held-pointer window scroll of 20 on y leaves the offset at `(40,40)` after the next frame. A subsequent ancestor scroll of 20 changes it only to `(40,60)`. These are observed upstream class results, not Svelte browser results.

The installed `PanSession.mjs` re-transforms retained raw pointer info during `updatePoint`, while `handleScroll` mutates transformed info/history by uncorrected deltas. The draft Svelte implementation instead updates raw positions and remaps them, which is a deliberate behavior difference. Plan Step 6 currently requires a STOP for such divergence.

The draft drag snap calculation also combines mapped page pointer coordinates with a mapped viewport center plus unscaled root scroll. For an affine scale correction `k`, this leaves a scroll-dependent error `(k - 1) * scroll` in local units. The initial browser test scrolled y but checked x only. The executor strengthened it to check y before its final STOP, but that test has not run and does not yet assert the actual nonzero scroll position. The snap defect remains source/arithmetic analysis until the browser regression is executed.

## Proposed contract

1. For transformed pan sessions, apply page/ancestor scroll displacement in the raw source domain, then map the affected samples exactly once. Under a 2x correction, an additional 20 raw scroll units must contribute 40 corrected offset units on that axis. Retained samples, terminal payloads and velocity must use a consistent domain.
2. Explicitly document that this fixes an upstream 13.2.0 transformed-scroll inconsistency. Do not claim identical upstream behavior for those cases.
3. Controlled snapping must compare the pointer and rendered center in the same mapped viewport domain, or use an equivalent documented conversion proven by tests. Preserve upstream viewport-corner measurement and page-box scroll ordering; do not change projection runtime to hide a snap error. Report page-coordinate callback points separately from the snap comparison domain.
4. A stable callback reading changed scale needs an explicit tested history policy. Verify numerical offset and velocity during the change, plus physical follower movement. Do not infer full live-zoom support from checking only one offset after another pointer event.
5. No-config behavior and callback-reference capture remain as already required. Do not weaken any original scale, layout, bounds, lifecycle, docs, unit, browser or lint gate. A necessary projection-runtime change remains a separate STOP.

## Work required after approval

- Amend the original plan with a dated revision, re-stamp its baseline to preserved source snapshot `13ec152`, and record approval in the guard log. Resume completed steps from their recorded evidence; do not expect the already-fixed original regression to fail again. Add fix-specific red proof for remaining defects.
- Fix the browser snap regression to assert actual nonzero page scroll and alignment on the scrolled axis (both x and y where applicable). Preserve assertions that fail before the correction.
- Validate/fix the draft pan raw-scroll implementation under this contract, including deterministic corrected velocity and retained-history behavior.
- Complete the pending integration matrix, including ref resize during a gesture, both constraint edges, numeric bounds, re-grab, layout compensation, callback replacement, and live closure behavior.
- Finish catalog/mirror generation and compare docs diagnostics with the recorded baseline.
- Run the complete original verification gates through executor/guard separation. The current draft is not approved for publication.

No dependencies, package-manager pins, projection algorithms, other MotionConfig fields, or unrelated docs repairs are included in this proposal.

## Guard browser checkpoint

At `13ec152`, 9/14 new browser tests pass. The five failures and suspected fixture preconditions are recorded in the guard report. Corrected semantic policy approval does not approve the current implementation or waive those failures.
