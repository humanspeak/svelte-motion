---
'@humanspeak/svelte-motion': minor
---

`useAnimationFrame` now runs on Motion's frameloop, like Motion's own hook. The callback receives `(time, delta)`: `time` counts from the loop's first frame instead of the page's time origin, and `delta` is the frame's elapsed time. Code that only uses differences between frames or periodic functions of `time` is unaffected. It can now be driven by `processFrame()` and manual timing.
