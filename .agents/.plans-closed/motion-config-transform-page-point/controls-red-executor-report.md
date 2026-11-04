Red test is ready in [e2e/drag/controls.spec.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/e2e/drag/controls.spec.ts:143).

It expects:

- Boot tile: `(700,477)`, size `80×80`, initial transform `{x:100,y:40}`.
- Handle center and pointerdown: exactly `(640,417)`.
- Three identical real-pointer drags ending at `(790,467)`.
- Each pointerdown snaps the tile to `(600,377)` within ≤2px.
- Every release ends at `(750,427)` within ≤2px, with no cross-session creep.
- Three complete active/end lifecycles.
- All actual before/snap/active/end positions are captured in failure output.

The first and tiny-nudge tests are unchanged. Prettier, focused ESLint, and `git diff --check` pass. Browser/e2e tests were not run, and no runtime code was changed.
