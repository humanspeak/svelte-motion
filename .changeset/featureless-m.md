---
'@humanspeak/svelte-motion': patch
---

**Behaviour change (Motion parity):** `m` components now match Motion's `LazyMotion`. Without a `LazyMotion` above them, or while an async `features` bundle is loading, they have no animation runtime: they render `style`, `initial`, `tabindex` and the drag styles, and run no animation, gesture, drag, layout or exit (an `AnimatePresence` removes a direct child at once). When the bundle loads they animate in from `initial`. Previously an `m` outside `LazyMotion` had every feature and a pending bundle gave it `domMin`.

**Visible change:** as in Motion, `onTap`, `onTapStart` and `whileTap` now add `tabindex="0"` from props whenever `tabindex` is not set. This includes server-rendered markup, buttons and links, and `whileTap` variant labels that don't resolve. Previously only a resolved `whileTap` on a non-focusable element added it. Set `tabindex` yourself to opt out.
