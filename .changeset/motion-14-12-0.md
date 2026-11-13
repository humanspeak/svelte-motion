---
'@humanspeak/svelte-motion': minor
---

Update Motion and motion-dom to 14.12.0. What arrives with the update:

- `pinch()`: a vanilla multitouch gesture that scales, rotates and moves an element with two touches, a trackpad pinch or Safari's gesture events. Its option and handler types are exported.
- Springs set with `visualDuration` (and `bounce`) now carry the velocity of the animation they interrupt, so reversing one mid-flight no longer stops dead. Springs set with `duration` still start from rest and end exactly on time.
- A press no longer ends when a second, non-primary touch lifts.
