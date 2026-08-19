---
'@humanspeak/svelte-motion': minor
---

Export `arc()` (and the `ArcOptions` / `MotionPathDefinition` types) so `transition={{ path: arc() }}` curves `x`/`y` keyframe animations, `layout`/`layoutId` transitions, and `animate()` calls along a quadratic arc with optional tangent-following rotation — Motion 13 parity.
