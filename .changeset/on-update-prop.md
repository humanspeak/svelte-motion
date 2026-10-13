---
'@humanspeak/svelte-motion': minor
---

Motion components accept `onUpdate(latest)`, called once per frame while any of the element's values change, with every latest value (e.g. `{ x: 42, opacity: 0.5 }`), as in Motion. Having it keeps the element's transforms on the main thread, and adding it while an accelerated animation is playing moves that animation to the main thread. The `MotionOnUpdate` type is exported.
