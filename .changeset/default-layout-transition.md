---
'@humanspeak/svelte-motion': patch
---

Layout animations with no `transition` now use Motion's default layout transition (0.45 s, ease `[0.4, 0, 0.1, 1]`) instead of a 0.3 s tween, matching Motion.
