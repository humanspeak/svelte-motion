---
'@humanspeak/svelte-motion': minor
---

Update Motion and motion-dom to 14.1.0. Fixes that arrive with the update:

- Animations no longer jump ahead when they start more than 40ms after they were requested, for example while the main thread is busy.
- `whileHover`/`whileTap` no longer stay applied after `initial` is removed.
- `scroll`/`useScroll` report elastic overscroll as backward scroll.
- JS animations no longer jump ahead when played after a pause at a speed other than `1`.
- Layout animations now run inside dragged elements.
