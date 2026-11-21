---
'@humanspeak/svelte-motion': patch
---

Under `<MotionConfig reducedMotion="always">`, or `"user"` when the OS asks for reduced motion, transform and layout values (`x`, `y`, `scale`, `rotate`, `width`, `height`, `top`, `left`, …) now jump straight to their target instead of being dropped, as in Motion. `animate={{ x: 200, opacity: 1 }}` puts the element at 200 at once and fades it in; before, it stayed at 0. Opacity, colour and other values still animate. Exit animations follow the same rule.
