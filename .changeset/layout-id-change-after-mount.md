---
'@humanspeak/svelte-motion': patch
---

A `layoutId` that changes after mount now moves the element to the new id's shared layout, as in Motion 14.7.1 (#1411). Tabs can give `layoutId` only to the selected highlight, an open card can change its `layoutId`, and an element that takes an id from one on screen takes over without animating.
