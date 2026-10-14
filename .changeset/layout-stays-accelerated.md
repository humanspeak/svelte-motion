---
'@humanspeak/svelte-motion': patch
---

`layout` elements keep Motion 14.2's hardware-accelerated transforms. Mounting no longer runs a layout update, and layout measurements ignore an in-flight accelerated transform, so a `layout` element that changes size mid-animation doesn't jump.
