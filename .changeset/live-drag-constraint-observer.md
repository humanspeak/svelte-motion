---
'@humanspeak/svelte-motion': patch
---

Keep drag constraint resize observation attached to the current element when switching between element refs or numeric bounds, while preserving an active drag. Reuse Motion's shared resize subscriptions and remove stale callbacks on replacement and cleanup.

Keep freshly measured element bounds paired with their current drag offset during active target changes, and reset that measurement base for numeric constraints without changing the pointer origin.
