---
'@humanspeak/svelte-motion': patch
---

`AnimatePresence` exits now use the exiting element's own document for placeholders, scroll snapshots and clone fallbacks, so exits work when rendering into another window or iframe (e.g. via `window.open()`), matching Motion 14.1.0's `popLayout` fix.
