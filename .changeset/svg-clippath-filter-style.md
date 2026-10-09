---
'@humanspeak/svelte-motion': patch
---

Server-render SVG `clipPath` and `filter` MotionValues as inline style rather than presentation attributes, matching Motion 14.1.0, which now renders both through style so a WAAPI-accelerated animation's final style can't override later attribute writes (motion #3790).
