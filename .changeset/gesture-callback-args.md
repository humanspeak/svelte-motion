---
'@humanspeak/svelte-motion': patch
---

Gesture callbacks now receive Motion's arguments. `onHoverStart`, `onHoverEnd`, `onTapStart`, `onTap` and `onTapCancel` get `(event, info)`, with `info.point` the pointer's page position. The new `onViewportEnter` and `onViewportLeave` props get the `IntersectionObserverEntry`. `onInViewStart` and `onInViewEnd` keep working as aliases with the same entry. Viewport callbacks now run as soon as the observer reports, as in Motion, instead of after the next render. `EventInfo`, `TapInfo` and `ViewportEventHandler` are exported as types.
