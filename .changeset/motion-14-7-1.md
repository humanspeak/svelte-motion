---
'@humanspeak/svelte-motion': minor
---

Update Motion and motion-dom to 14.7.1. What arrives with the update:

- `backgroundColor` animations run in JavaScript instead of WAAPI, so interrupting one continues from the colour on screen instead of jumping. As a result `useWillChange()` no longer switches to `transform` for a `backgroundColor` animation, and a scroll-linked `useTransform` bound to `backgroundColor` updates in JavaScript. Colours only the browser can mix (like `oklch()`) still use WAAPI.
- An element whose transforms are running on the compositor is no longer distorted when a sibling's or child's layout animation measures it (for example, a looping 3D rotation next to a `layout` element) (Motion #4022).
- Changing the playback speed of an accelerated transform animation no longer flashes for a frame.
- Slow overdamped springs no longer snap to their target part-way through (#1207), and reversed long springs finish at their start.
- `drag`: a fast flick from a standstill keeps its release velocity instead of the inertia stopping dead (#1747, `749cc1360`).
- `drag`: ref `dragConstraints` stay correct after a `layoutScroll` ancestor scrolls, so a `Reorder.Item` no longer jumps after its group is scrolled (#2024, `cc260d322`, `cc84e31ad`, `8e2a53308`, `a04f5e6ee`, `6e56b3883`).
- `drag`: releasing a drag fires `onAnimationComplete` once instead of once per `animate` variant (#1831, `a280595ea`).
- `drag`: inertia starts exactly at the release point (`ca04dba9d`).
