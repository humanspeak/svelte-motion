---
'@humanspeak/svelte-motion': patch
---

`inherit={false}` on a motion element now stops it, and its descendants, from following the parent's variant changes, matching Motion 13.5.1.
