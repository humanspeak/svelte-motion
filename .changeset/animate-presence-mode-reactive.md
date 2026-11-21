---
'@humanspeak/svelte-motion': patch
---

`AnimatePresence` now follows a change to its `mode` prop at runtime instead of keeping the mode it mounted with, matching Motion. Exits already running keep the mode they started with, and enters held by `mode="wait"` are released when those exits finish.
