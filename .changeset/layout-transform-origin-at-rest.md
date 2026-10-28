---
'@humanspeak/svelte-motion': patch
---

Elements with `layout` no longer get an inline `transform-origin: 0 0` and `will-change: transform` while they are at rest, matching Motion. A `scale` or `rotate` on a `layout` element, such as an `AnimatePresence` `popLayout` exit or a `whileHover` scale, now pivots on the element's centre instead of its top-left corner, and `position: fixed` children of a `layout` element are positioned against the viewport again. A `willChange` or `transformOrigin` you set in the inline `style` of a `layout` element is no longer overwritten when layout is set up, or cleared when the element unmounts or `layout` is turned off.
