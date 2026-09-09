# Public React reference contract — guard verified 2026-09-08

Reference fixture source is snapshotted under `reference-fixture/`; runtime is public `motion/react` 13.2.0 with React/ReactDOM 19.1.1. No private API reuse. Guard read the entire fixture/runner and ran all 29 cases twice after correcting scroll-event delivery readiness. Both executions exited 0: every fixture precondition passed and the ordered gesture callback time/type/payload/bound-value traces were exactly identical across both runs. This is reference evidence, not proof of Svelte parity.

Commands (cwd `/tmp/svelte-motion-react-parity-1320`):

- `./node_modules/.bin/vite --host 127.0.0.1 --port 4299 --strictPort`
- `REACT_PARITY_OUTPUT=/tmp/svelte-motion-react-parity-1320/react-parity-verified.json node ./run-reference.mjs`
- `REACT_PARITY_OUTPUT=/tmp/svelte-motion-react-parity-1320/react-parity-verified-repeat.json node ./run-reference.mjs`

`reference-results.json` preserves all fixture inputs, callback traces, named snapshots, version metadata and the full raw-report digest. Full raw reports and command logs remain in `/tmp`; the checked-in fixture reproduces them. For reproduction, copy fixture source into an isolated directory and have guard install its exact manifest dependencies; runner resolves Playwright from FEATURE_WORKTREE. Nothing from that environment is imported by shipped Svelte code.

## Verified requirements for the Svelte executor

- Config: an omitted child transform inherits; explicit identity overrides; explicitly supplied undefined clears the parent mapping. The draft's nullish fallback conflates omission and explicit undefined and must change for this prop. Other MotionConfig fields remain outside feature scope.
- Pan/drag session input mapping is captured by function reference; replacing the function affects the next session. React's live VisualElement/config behavior must not be frozen merely because input capture persists. A stable closure reads current values; old history is retained rather than reprojected wholesale.
- The common scaled movement sequence first reports offset (4,2) and zero velocity, then delta (56,38), offset (60,40), velocity (100,50); terminal delta is (0,0), offset (60,40), velocity (750,500). Use the exported input/frame timestamps for comparison, not independently chosen test timings.
- Pan ancestor scroll: after mapped offset (60,40), actual ancestor scroll by (45,55) leaves the held and terminal offset (60,40). Drag tracks the same ancestor scroll and reports held/terminal offset (105,95), adding raw scroll units as observed. Do not substitute (150,150) or another corrected-domain policy.
- Page scroll while held: with scroll by (45,70), both pan and drag retain move offset (60,40), then the pointerup event's new page coordinates produce terminal offset (150,180). Drag's bound values stay (60,40) in this no-momentum fixture; terminal payload is not necessarily the rendered translation.
- Stable scale closure 2 to 4: pan mapped offset jumps from (40,20) to (900,700), and ends (940,720). Drag jumps to (894,710), ends (934,730), under its different starting geometry. These values are React behavior in the matched fixtures; do not remap history to make them smaller.
- Drag offset is gesture-relative, not accumulated element translation; on the second replacement-test drag, offset is (30,15) while bound translation is (100,55). Delta is relative to the previous retained frame sample, not to pointerdown. Gesture callbacks are frame scheduled and threshold gated.
- Pan unmount during a gesture produces no onPanEnd. React drag under this pinned React 19 fixture continues its active session after target removal until pointerup and emits onDragEnd. Both were observed, not inferred from a private class. Preserve internal Svelte cleanup for its extensions without inventing public callbacks; if parity needs out-of-scope changes, report the exact dependency.
- Scrolled controls snap: verified window scroll (120,160); public controls.start yields bound (-49,-436), then the move yields (1,-406). The target is not centered at the cursor. Match the public behavior instead of applying the superseded custom snap correction.
- Numeric limits: bound (110,70) then (-90,-60), while pointer offset is not clamped. Ref limits: bound (246,110) then (-174,-110). Resize/regrab ends (-174,0). Compare equivalent border/layout geometry.
- Real layout shift: 60 local pixels of flex-slot movement while held changes bound x from 60 to 0, keeping the visual x position steady. A further mapped move (20,10) gives bound (20,40). No projection double correction.

The complete case list/data in reference-results.json governs exact assertions. Add matched Svelte fixtures and focused regression coverage; do not generalize these observations to unsupported matrices or versions. Existing no-config mismatches are subject to the same scoped parity requirement and must be documented as compatibility corrections. All remaining root/package/docs/unit/browser/lint gates still apply.

## Runner correction and limits

The first run's geometric scroll preconditions did not await actual DOM scroll-event delivery; a repeat exposed different drag ancestor-scroll traces. A separate executor corrected only the runner to wait for a new target-specific event with exact expected scroll values before advancing the controlled Motion frame. No synthetic scroll event, arbitrary sleep or expected-gesture assertion was added. The corrected two runs are authoritative; earlier raw reports are superseded for event ordering.

Cancellation uses a browser PointerEvent dispatched on window with primary mouse fields; ordinary movement uses Playwright mouse events. Controlled performance.now/RAF timing is checked through Motion's public useAnimationFrame hook. Native pointer event timeStamp is recorded but not asserted as the velocity clock. No live in-app browser session was available; these are automated Chromium observations.
