---
'@humanspeak/svelte-motion': patch
---

Update Motion and motion-dom to 13.5.0. `useScroll` with a `target` now runs more offsets on a native ViewTimeline, matching Motion (for example `["start end", "end start"]`). A page or container `useScroll` with an `offset` now stays on the JavaScript path, because a ScrollTimeline cannot apply an offset. Previously it ran natively and ignored the offset.
