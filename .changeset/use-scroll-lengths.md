---
'@humanspeak/svelte-motion': minor
---

`useScroll` now also returns `scrollXLength` and `scrollYLength`, the maximum scroll offset of each axis, so the distance from the end is `scrollYLength.get() - scrollY.get()` (Motion 14.7.1).

`useScroll` now forwards `trackContentSize` to `scroll()`, as Motion's `useScroll` does, so the values recalculate when the container's content size changes without a scroll or resize.
