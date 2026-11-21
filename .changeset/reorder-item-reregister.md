---
'@humanspeak/svelte-motion': patch
---

`Reorder.Item` now re-registers itself when its `value` is replaced by a new object under the same `{#each}` key (for example `items = items.map((i) => (i.id === id ? { ...i, done: true } : i))`). The item stays reachable with the arrow keys, keeps the group's tab stop, and can still be dragged or moved with the keyboard, as in Motion.
