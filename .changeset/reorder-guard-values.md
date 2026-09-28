---
'@humanspeak/svelte-motion': patch
---

`Reorder.Group` no longer calls `onReorder` twice with the same order when the new order is applied asynchronously. The swap guard now clears only when `values` changes, matching Motion 13.4.5; a rejected proposal isn't re-sent until `values` changes.
