---
'@humanspeak/svelte-motion': patch
---

Calling `set()`, `jump()` or `setWithVelocity()` on a motion value inside `$effect` no longer makes that effect depend on the value. An effect such as `$effect(() => x.set(target))` now re-runs only when `target` changes, so it no longer overwrites an animation or drag that moves `x`.
