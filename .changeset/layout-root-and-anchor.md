---
'@humanspeak/svelte-motion': minor
---

Add the `layoutRoot` and `layoutAnchor` props. Inside a `layoutRoot`, shared `layoutId` animations now move relative to the root when the previous element was inside it too, so a tab underline slides one tab even when the tab bar jumps in the same update (Motion 14.7.1, #1935). `layoutAnchor` sets the point a child's relative layout projection is anchored to, or `false` to turn it off. Both props no longer leak onto the DOM as attributes. A `layoutId` element that replaces a removed one now hands over from its on-screen box the way Motion does, which also makes `layout="position"` and `layout="size"` shared animations run.
