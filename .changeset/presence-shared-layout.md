---
'@humanspeak/svelte-motion': minor
---

`AnimatePresence` children with a `layoutId` now take part in shared layout animations while they exit, as in Motion. The exiting element follows the new one and crossfades out, and it stays mounted until that animation finishes, even without an `exit` prop. Closing a card shrinks it back into the thumbnail it came from. Works with direct children and with the `present` + `child` syntax. Exiting `layout` elements keep animating their layout during the exit, through the same projection as before. Adds `onLayoutAnimationStart` and `onLayoutAnimationComplete`.
