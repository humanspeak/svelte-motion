---
'@humanspeak/svelte-motion': patch
---

`Reorder`: edge auto-scroll skips ancestors that have `overflow: auto` but nothing to scroll on that axis, and keeps its scroll state per axis (Motion 14.10).
