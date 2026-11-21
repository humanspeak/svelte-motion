---
'@humanspeak/svelte-motion': patch
---

An `$effect` that calls `controls.start()`, `controls.set()` or `controls.stop()` no longer re-runs when another component subscribes to or unsubscribes from the same animation controls, so animations are not replayed.
