---
'@humanspeak/svelte-motion': patch
---

Layout animations stay correct after scrolling or resizing: cached layouts now account for scroll containers that aren't `layoutScroll`, fixed elements on a scrolled page, and window resizes, so changing a list after scrolling no longer makes its items jump by the scroll distance. A `layout` element's exit clone now moves with the content when a `popLayout` exit clamps the scroll position, as in Motion.
