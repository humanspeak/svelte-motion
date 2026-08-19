---
'@humanspeak/svelte-motion': minor
---

Export `arc()` (and the `ArcOptions` / `MotionPathDefinition` types) so `transition={{ path: arc() }}` curves `x`/`y` keyframe animations, `layout`/`layoutId` transitions, and `animate()` calls along a quadratic arc with optional tangent-following rotation — Motion 13 parity.

`arc()` is exported through a thin guard: when an `x`/`y` endpoint carries units (`'100px'`, `'50%'`, CSS variables) — which upstream's arc would turn into `NaN` — the values animate along a straight line instead and a one-time `console.warn` fires in dev. Layout paths are unaffected. Post-1.x follow-up: revisit these numerics once upstream Motion settles how `arc()` should treat unit-bearing endpoints.
