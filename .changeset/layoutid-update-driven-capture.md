---
'@humanspeak/svelte-motion': patch
---

Shared-layout `layoutId` elements no longer measure themselves every animation frame; their handoff rect is captured on updates, matching Motion.
