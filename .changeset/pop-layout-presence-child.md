---
'@humanspeak/svelte-motion': patch
---

`AnimatePresence mode="popLayout"`: content held by `PresenceChild` (including the `present` + `child` form) is now popped out of the layout while it exits, so siblings reflow immediately (Motion 14.3.1 #2503).
