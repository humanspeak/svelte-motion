---
'@humanspeak/svelte-motion': patch
---

`useTransform` values mapped from `useScroll` progress now run as native ScrollTimeline/ViewTimeline animations when the browser supports them, matching Motion 13.4.7 (including its clamped end values). Chained transforms, `clamp: false`, function transformers, and input stops outside ascending 0–1 stay on the JavaScript path.
