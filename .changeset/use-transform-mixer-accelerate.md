---
'@humanspeak/svelte-motion': patch
---

`useTransform` with a `mixer` option no longer runs on a scroll-linked Web Animation, which can't call the mixer, so the mixer is applied (Motion 14.8).
