---
'@humanspeak/svelte-motion': minor
---

Add `@humanspeak/svelte-motion/three` and `/vgpu` subpaths re-exporting Motion 13.2's `threeEffect` and `vgpuEffect`, re-typed for this library's augmented motion values. Register with `animate.addEffect(threeEffect)` to animate Three.js meshes, materials and shader uniforms. `three` / `vgpu` remain your own dependencies; nothing is added to the root bundle.
