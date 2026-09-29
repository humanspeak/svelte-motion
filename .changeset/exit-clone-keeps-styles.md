---
'@humanspeak/svelte-motion': patch
---

AnimatePresence exit clones now keep the exact look of the element they replace — including styles from ancestor and structural selectors — for the whole exit, even after Svelte has detached the element.
