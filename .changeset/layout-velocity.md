---
'@humanspeak/svelte-motion': minor
---

Layout animations with a spring transition (`type: 'spring'`) now start with the element's current velocity when they interrupt a running layout animation, as in Motion 14.13. Tweens and springs set with `duration` still start from rest.
