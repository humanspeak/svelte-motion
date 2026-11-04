---
'@humanspeak/svelte-motion': patch
---

Layout animations around `AnimatePresence` and list changes follow Motion's render model. Adding, removing or popping out an item now animates the other items, including those in separate `AnimatePresence` boundaries, and `layout` elements after the list such as a footer. When an exit completes, only elements in the same `AnimatePresence`, or in its `LayoutGroup`, animate; others move instantly, as in Motion.
