# Repeated initial snap findings — 2026-09-08

Production snapshot:0da2303. Browser preview4198 built from this snapshot. React reference: public motion/react13.2.0, React19.1.1, existing unchanged controls fixture on4299. Both viewport1280x720.

The guard inspected the Svelte controls page in T3, then ran `node /tmp/controls-repeat-probe.cjs` with real Chromium pointer events against both implementations. The preserved runner records handle hit-testing before every start; all three inputs reached initial-handle. It checks three identical (+50,+20) drags after initial x100/y40, with animation frames flushed after pointerdown and50ms active /100ms terminal waits. This is a diagnostic comparison; the executor-authored regression RED is separate.

Both implementations have exactly the same initial rectangle(700,477,80,80), handle center(640,417), and outcomes:

| Session | Snapped x,y | Active/released x,y |
| --- | --- | --- |
| 1 |600,377|650,397|
| 2 |550,297|600,317|
| 3 |500,217|550,237|

Thus both drift left50/up80 between identical completed drags. The desired regression is snap(600,377) and released(650,397) on every session, with real start/movement/end assertions.

Mechanism: installed framer-motion/dist/es/gestures/drag/VisualElementDragControls.mjs:356-374 adds current axis value to raw pointer minus stored projection layout center. The stored initial measurement does not refresh with each drag in this fixture. Svelte src/lib/utils/drag.ts:997-1031 intentionally matches this formula. This comparison supports an upstream behavior conflict; it is not evidence for secretly relaxing exact React parity.

User asked for RED first. Guard requested clarification whether to fix this as a narrow deliberate exception to earlier exact-React-parity direction. Red-test work continues while that answer is pending; no runtime change yet.
