---
'@humanspeak/svelte-motion': patch
---

Match Motion's mount-vs-update rules for `layout` and `layoutId` elements:

- A size or position change made while a `layout` element's enter animation is still starting (for example from `onAnimationStart`) now animates instead of jumping.
- Turning `layout` or `layoutId` off and back on counts as a fresh mount, like Motion: it no longer moves the element's accelerated transforms to the main thread, no longer animates a change made in the same update, and a `layoutId` element no longer animates from its own earlier position.
- Once any layout update has happened, a newly mounted layout element joins the next root layout update, as Motion's does.
- Layout measurements now only set aside the element's own accelerated Motion transform animation. A transform animation the page runs itself (`element.animate(...)` or `animate(element, { transform })`) stays part of the measured box, so it no longer adds a spurious layout animation.
- A `layout` element offset by a finished `animate(element, { transform })` is now measured with that transform, as Motion does, so widening it drops it into its row in one frame instead of jumping up 80px and sliding back.
- A layout change made right after a `layout` element mounts (from a parent's `onMount` or `$effect`), on a server-rendered page or after a client-side navigation, now animates instead of snapping.
- A Svelte-driven layout change that lands after the current frame's animation loop has run is now projected before that frame is painted, so the element no longer flashes at its new size for one frame.
- An update that doesn't move a `layout` element (for example a colour change) now ends its finished layout projection, as a React re-render does in Motion, so the element's own transform shows again. A box sliding with `animate={{ transform }}` no longer drops back to its row when the slide ends.
