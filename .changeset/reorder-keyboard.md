---
'@humanspeak/svelte-motion': minor
---

`Reorder.Item` is now keyboard reorderable (Motion 14.6.0): Space grabs and drops the focused item, arrow keys along the group's axis move it, and Escape restores the order. Items are focusable by default (`tabindex={0}`; `tabindex={-1}` removes the Tab stop, an `onkeydown` that calls `preventDefault()` turns keyboard reordering off). The grabbed item gets its `whileDrag` state.
