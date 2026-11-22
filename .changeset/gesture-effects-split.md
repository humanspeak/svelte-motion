---
'@humanspeak/svelte-motion': patch
---

Hover, focus and in-view gestures are now attached once per element, as in Motion. Changing `whileHover`, `whileFocus`, `whileInView` or a gesture callback during the gesture no longer leaves the hover or focus state stuck or loses `onHoverEnd`/`onFocusEnd`, and no longer fires `onInViewStart` again (`viewport.once` fires once). Changing `viewport.amount`, `margin` or `root` restarts the observer without re-firing.
