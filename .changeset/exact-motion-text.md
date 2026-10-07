---
'@humanspeak/svelte-motion': patch
---

Preserve exact consumer text by removing generated sibling whitespace from motion elements, including MotionValue children, SVG, and void elements, while retaining optimized-appear SSR bootstraps.
