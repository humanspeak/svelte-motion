---
'@humanspeak/svelte-motion': minor
---

Pan gestures now run on Motion's `PanSession`: `onPanSessionStart`, `onPanStart` and `onPan` are delivered on Motion's `frame.update` step and `onPanEnd` on `frame.postRender`, and handler changes reach a live pan without restarting it. As in Motion, an element with both `drag` and `onPan*` now runs both gestures: it drags and also reports pan. **Removed `whilePan`**: it was never a Motion prop. Use `whileTap` for press-time styles, or `onPanStart`/`onPanEnd` to toggle state.
