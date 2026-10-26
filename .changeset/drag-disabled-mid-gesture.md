---
'@humanspeak/svelte-motion': patch
---

Turning `drag` off while a drag is in progress (for example from `onDrag`) now ends the gesture and animates the element back, instead of leaving it stuck with an offset (Motion 14.6.0, #2248).
