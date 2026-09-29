---
'@humanspeak/svelte-motion': patch
---

AnimatePresence exit clones now keep the exact look of the element they replace — including styles from ancestor and structural selectors — for the whole exit, even after Svelte has detached the element.

Showing a child again while its exit is still running now reverses the exit like upstream: the child animates back from where the exit had got to, instead of a fresh copy fading in over the still-fading old one.
