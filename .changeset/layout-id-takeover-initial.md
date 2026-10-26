---
'@humanspeak/svelte-motion': patch
---

An element that takes over a `layoutId` from one already on screen no longer replays its `initial` entrance; it carries on from the shared layout animation (Motion 14.6.0, #2362). Elements without an `initial` are unchanged.
