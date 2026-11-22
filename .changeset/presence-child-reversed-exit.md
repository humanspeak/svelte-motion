---
'@humanspeak/svelte-motion': patch
---

`onExitComplete` no longer fires when an exit held by `PresenceChild` (or the owned `<AnimatePresence present>` form) is reversed by setting `present` back to `true` before it finishes, matching Motion.
