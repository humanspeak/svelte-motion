---
'@humanspeak/svelte-motion': minor
---

`useScroll` now also returns `scrollXLength` and `scrollYLength`, the maximum scroll offset of each axis, so the distance from the end is `scrollYLength.get() - scrollY.get()` (Motion 14.7.1).
