---
'@humanspeak/svelte-motion': patch
---

Bump `motion` and `motion-dom` to 13.2.0. Upstream reduced the filesize and per-frame cost of the `spring` generator, replaced the numerical velocity estimate in `inertia` boundary bounces with the exact analytical derivative, and added `animate.addEffect()` / `createEffect` options for driving non-DOM subjects (Three.js and vgpu adapters). No public API changes in this package.
