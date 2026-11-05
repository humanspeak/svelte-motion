---
'@humanspeak/svelte-motion': patch
---

`dragConstraints` now accepts every form Motion 14.9 does: `false`, any `Element` (including SVG), a `{ current }` ref, and a function called when each drag starts. Also exports `DragConstraintsFunction`, `DragConstraintsContext` and `DragPointConstraint`.
