---
'@humanspeak/svelte-motion': patch
---

`AnimatePresence`: `onExitComplete` now fires after exiting children held by `PresenceChild` (including the `present` + `child` form) have unmounted (Motion 14.3.1, #2538).
