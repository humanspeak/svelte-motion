---
'@humanspeak/svelte-motion': patch
---

An `AnimatePresence` exit no longer leaves `position: relative` on a statically positioned parent. The parent's own inline `position` comes back once the last exit animating against it ends, is reversed, or its boundary is removed, so the app's absolutely positioned elements stay where they were.
