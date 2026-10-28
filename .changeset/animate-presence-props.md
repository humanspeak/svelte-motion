---
'@humanspeak/svelte-motion': minor
---

`AnimatePresence` accepts `anchorX`, `anchorY`, `root` and `propagate`, matching Motion. Behaviour change: a nested `AnimatePresence` inside an owned exiting child no longer exits its children with the parent unless it has `propagate` (Motion's default), and its own children's exits now animate.
