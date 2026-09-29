---
'@humanspeak/svelte-motion': patch
---

AnimatePresence exit placeholders keep the exiting element's margins and flex/grid placement even after the element has been detached, so siblings no longer shift while an exit is still running.
