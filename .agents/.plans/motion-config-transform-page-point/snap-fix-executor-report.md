Implemented the approved repeated snap correction.

Mechanical fix:

- Records the shared axis values at each projection measurement.
- On controlled start, stops/freezes current axis writers as before.
- Resolves the effective center as:
  `cached center + current axis − axis at measurement`.
- Keeps raw page-point handling, transformed coordinate space, scrolling behavior, constraints, enabled-axis filtering, and the single VisualElement writer unchanged.
- Cleans up the projection measurement listener on teardown.

Changed files:

- [drag.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/utils/drag.ts:763)
- [drag.spec.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/utils/drag.spec.ts:531)
- [motion-config-transform-page-point.md](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/.changeset/motion-config-transform-page-point.md:7)

Coverage added:

- Three repeated starts with nonzero initial `x/y`.
- Repeated starts from zero axis values.
- Projection remeasurement followed by an independent axis update.
- Immediate snap values and completed drag values.
- Measurement-listener lifecycle cleanup.

Verification:

- Focused contract suite: 79/79 passed across five files.
- Drag suite: 30/30 passed.
- ESLint passed for both changed TypeScript files.
- Prettier passed.
- Svelte check: 0 errors, 39 existing warnings.
- `git diff --check` passed.
- `e2e/drag/controls.spec.ts` remains byte-identical to `6c6781b`.

The 29 recorded contracts remain mathematically unchanged: only `drag-controls-snap-scrolled` enters this snap path, and its current axis equals its measured axis, making the correction delta zero.

Per sandbox restrictions, I did not run browsers/e2e, builds, package validation, full units, docs builds, Trunk, or commits. Guard still needs to perform the fresh RED-to-GREEN controls run, 29-case comparison, and remaining full gates.
