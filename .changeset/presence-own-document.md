---
'@humanspeak/svelte-motion': patch
---

`AnimatePresence` exits now use the exiting element's own document for placeholders, scroll snapshots and clone fallbacks, so exits work when rendering into another window or iframe (e.g. via `window.open()`), matching Motion 14.0.1's `popLayout` fix.
