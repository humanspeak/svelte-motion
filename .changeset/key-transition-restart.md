---
'@humanspeak/svelte-motion': patch
---

A direct `AnimatePresence` child whose `key` changes in place no longer gets stuck invisible when the key changes again during its exit. As in Motion, the latest key always ends visible: a change to another key enters once the exit finishes, and a change back to the exiting key reverses the exit.
