---
'@humanspeak/svelte-motion': patch
---

`useMotionValueEvent` now subscribes to every motion value event, as in Motion: `change`, `animationStart`, `animationComplete`, `animationCancel` and `destroy`. Raw motion-dom values work too, and Svelte readable stores are still accepted for `change`.
