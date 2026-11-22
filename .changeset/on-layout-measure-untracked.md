---
'@humanspeak/svelte-motion': patch
---

`onLayoutMeasure` now runs outside the library's internal effects, as in Motion. A callback that reads and writes `$state` (for example a counter or a record of boxes) no longer triggers `effect_update_depth_exceeded`.
