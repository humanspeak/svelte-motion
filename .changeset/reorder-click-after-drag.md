---
'@humanspeak/svelte-motion': patch
---

Releasing a drag that reordered a `Reorder` list no longer clicks the item or the group, whichever direction it was dragged (Motion 14.1.1, #2682). Before, whether the release clicked depended on which DOM nodes the reorder moved: dragging an item up clicked it and its group, dragging it down didn't. Other clicks are unchanged: a drag that doesn't reorder, a plain click, and keyboard-initiated clicks all fire as before.
