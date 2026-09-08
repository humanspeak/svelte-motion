# Draft: repeated snapToCursor starts accumulate displacement with initial coordinates

Not submitted. Prepared from public React browser evidence on2026-09-08.

## Upstream context

- Current main package version is13.2.0, read through GitHub API on2026-09-08.
- Current main VisualElementDragControls.ts:558-580 still contains the same snap calculation as the pinned fixture.
- Related merged fix: https://github.com/motiondivision/motion/pull/3445 (Jan6,2026), closing https://github.com/motiondivision/motion/issues/1607. It addresses first-start positioning with initial coordinates. This report covers cumulative displacement on subsequent starts; no historical bisect has been performed, so introduction by that PR is not proven.
- CONTRIBUTING.md welcomes bug fixes, asks for an issue first, tests and changelog: https://github.com/motiondivision/motion/blob/main/CONTRIBUTING.md
- GitHub currently displays restrictions on new issues and PRs. Account-specific eligibility and an alternate submission channel have not been tested.

## Reproduction

Public React19.1.1, motion/react13.2.0, real Chromium mouse events. A motion.div uses drag, dragListener=false, dragMomentum=false, initial={{x:100,y:40}}, and a useDragControls instance. A stationary external button calls controls.start(event,{snapToCursor:true}) onPointerDown.

At viewport1280x720, the initial80x80 tile is at(700,477). The button center is(640,417). Repeat three sessions: pointerdown atbutton center, flush frames, move(+50,+20) in5steps, wait50ms, release, wait100ms. Before every start, hit-test proves the pointer reaches the button rather than an overlapping tile.

Expected on every session: snapped rectangle(600,377,80,80), active/released(650,397,80,80). The center should align with the requested cursor point and identical gestures should produce identical final positions.

Actual:

| Session | Snapped x,y | Active/released x,y |
|---|---|---|
|1|600,377|650,397|
|2|550,297|600,317|
|3|500,217|550,237|

The same outcome occurs in our Svelte adapter. The attached isolated React fixture establishes this independently through public React components; no private class invocation or patched dependency is used.

## Diagnosis to verify with a patch

snapToCursor adds the current axis value to pointer minus the stored projection layout center. In this fixture the stored center remains based on the original geometry while the axis value changes after each drag, so the same positional correction is applied repeatedly. A correction needs to account for the position represented by the layout measurement without regressing the first snap, transformed parents, scrolling or constraints.

## Evidence to attach

- controls-reference-fixture/src/controls.js and controls.css: standalone public React fixture.
- repeated-initial-probe.cjs and repeated-initial-probe.json: three-session real-browser comparison and exact rectangles.
- Executor-authored Svelte red regression and guard failure log: pending.
- Upstream-native browser regression and verified patch: not yet authored; do not claim ready-to-merge.
