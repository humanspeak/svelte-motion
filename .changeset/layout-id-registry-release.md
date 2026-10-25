---
'@humanspeak/svelte-motion': patch
---

`layoutId`: snapshots of unmounted elements are released when no element takes them over, so unique `layoutId`s no longer leak detached elements and a much later arrival no longer animates from a stale position (Motion 14.3.1 #3940).
