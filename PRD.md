# Svelte Motion — Product Requirements Document (PRD)

## 1) Vision and Context

Svelte Motion aims to bring a Framer Motion–style developer experience to Svelte by offering ergonomic, declarative animation primitives via `motion.<element>` components, interaction props, and composable configuration.

Reference: Framer Motion for React [`motion` on npm](https://www.npmjs.com/package/motion).

## 2) Current State Assessment (as of this repo)

- **Exports**:
    - `motion`: Object map of HTML tag components (e.g., `motion.div`, `motion.button`) in `src/lib/html/`.
    - `MotionConfig` context component.
    - Types: `MotionInitial`, `MotionAnimate`, `MotionTransition`, `MotionWhileTap`.
- **Implemented props**: `initial`, `animate`, `transition`, `whileTap`, `onAnimationStart`, `onAnimationComplete`, `class`, `style`, `layout` (FLIP-based).
- **Coverage of HTML elements**: Many intrinsic HTML components implemented under `src/lib/html/`.
- **Tests**: Unit tests for utils and `_MotionContainer` lifecycles/whileTap/reset, E2E for enter animation and HTML content.

Gaps vs Framer Motion core:

- Variants API (`variants`, `initial`/`animate`/`exit` by variant key, `inherit` semantics).
- Exit animations and an equivalent to `AnimatePresence`.
- Interaction props beyond `whileTap`: `whileHover`, `whileFocus`, `whileInView`, `onViewportEnter/Leave`.
- Gesture system: `drag`/`pan` with constraints, momentum, elasticity.
- Motion values and transforms: motion value store, derived transforms, `stagger`, `delayChildren`.
- `animate` imperative API for non-components, `useAnimation`-like controls, timelines.
- Layout animations, shared layout transitions. [Layout for single elements: Done]
- Event callbacks: `onAnimationStart`, `onAnimationComplete`, per-keyframe lifecycle where applicable.
- Documentation site, examples, and comprehensive test coverage.

## 3) Product Goals

Primary goal: API and behavioral parity for core day-1 Framer Motion features that enable common examples to “copy-paste translate” into Svelte with minimal changes.

Non-goals (initial phases):

- Visual editor tooling (Studio), premium examples, and non-essential React-specific hooks.
- Advanced shared layout/FLIP until core animations are robust.

## 4) Phased Roadmap

Phase 0 — Foundations (status)

- Solidify `motion.<tag>` wrappers and prop pass-through. [Done]
- Ensure SSR-friendly behavior and hydration safety (instant `initial`, promote to `ready`, then animate). [Done]
- Add `whileHover`, `whileFocus` to interaction set. [Planned]
- Introduce `onAnimationStart`/`onAnimationComplete`. [Done]
- Expand tests: unit for utils, component tests for container, E2E demos. [Done]

Phase 1 — Variants and Presence

- `variants` object with per-state definitions and per-property `transition` overrides.
- Support `initial`, `animate`, `exit` by variant key.
- Add `AnimatePresence`-equivalent Svelte component for exit-on-unmount.
- Nested variant orchestration (inheritance and overrides).

Phase 2 — Gestures and Motion Values

- `drag`/`pan` with axis constraints, bounds, momentum, velocity-based transitions.
- Motion value store primitive and transform utilities (e.g., derived values, interpolation).
- Timelines and stagger helpers.

Phase 3 — Ecosystem

- Documentation with parity table and migration guide for React users.
- Gallery of examples ported from Framer Motion samples.
- Performance profiling and benchmarks.

## 5) API Design Targets (Parity-Oriented)

- `initial`, `animate`, `transition`, `exit`, `variants` (object map), `whileTap`, `whileHover`, `whileFocus`.
- Event handlers: `onAnimationStart`, `onAnimationComplete`. [Implemented]
- Presence manager: `AnimatePresence`-like Svelte component.
- Gesture props: `drag`, `dragConstraints`, `dragMomentum`, `dragElastic` (Phase 2).
- Motion values: `motionValue`, `derived`, `stagger` helpers (Phase 2).

## 6) Featured Example Requirement — Fancy Like Button

Target UX: A like button inspired by Fancy Like Button (React, Framer Motion) [`DRlFTER/fancyLikeButton` on GitHub](https://github.com/DRlFTER/fancyLikeButton?utm_source=chatgpt.com).

Behavioral spec:

- The button acts as a toggle: first press sets "liked" and turns the button red; next press unlikes and returns to default styling.
- While the button is pressed and the state is "liked", emit animated hearts and accent circles at an interval until release.
- Short press toggles state; long-press also toggles to "liked" and continuously emits until release.
- Emitted items float upward with slight horizontal variation, fade out, and optionally scale.
- Input support: mouse and touch (`pointerdown`/`pointerup`/`pointercancel`).
- Accessibility: role="button" or `<button>`, `aria-pressed` reflects state, keyboard activation (Space/Enter) toggles state, focus ring.
- Performance: no dropped frames on typical devices; GC-friendly (cap max hearts on screen, recycle where possible).

Svelte usage sketch (illustrative only):

```svelte
<script lang="ts">
    import { motion } from '$lib'
    let isLiked = false
    let spawnInterval: ReturnType<typeof setInterval> | null = null
    const startSpawning = () => {
        if (!isLiked) return // only while liked
        if (spawnInterval) return
        spawnInterval = setInterval(() => addHeart(), 120)
    }
    const stopSpawning = () => {
        if (spawnInterval) {
            clearInterval(spawnInterval)
            spawnInterval = null
        }
    }
    function toggleLike() {
        isLiked = !isLiked
        if (!isLiked) stopSpawning()
    }
    function addHeart() {
        /* push a heart descriptor into a list for rendering */
    }
    $: buttonClass = isLiked ? 'bg-red-500' : 'bg-gray-700'
</script>

<motion.button
    class={buttonClass}
    whileTap={{ scale: 0.95 }}
    on:pointerdown={() => {
        if (!isLiked) isLiked = true
        startSpawning()
    }}
    on:pointerup={stopSpawning}
    on:pointercancel={stopSpawning}
    on:click|preventDefault={toggleLike}
    aria-pressed={isLiked}
>
    <!-- icon/content -->
</motion.button>

{#each hearts as heart (heart.id)}
    <motion.div
        class="absolute"
        initial={{ opacity: 1, x: 0, y: 0, scale: heart.scale }}
        animate={{ x: heart.dx, y: -heart.dy, opacity: 0 }}
        transition={{
            x: { duration: 0.3 },
            y: { duration: 0.8 },
            opacity: { delay: 0.6, duration: 0.4 }
        }}
    />
{/each}
```

Acceptance criteria:

- Toggle behavior works with both mouse and touch; keyboard toggles state.
- While pressed in the liked state, hearts/circles spawn continuously and animate smoothly.
- Releasing press stops spawning within ≤1 frame; ongoing animations complete.
- Toggling to unliked immediately updates styling and stops new spawns.
- No console errors; zero linter errors in example; Playwright test verifying spawn-while-hold and toggle visuals.

Deliverables for this feature:

- `src/routes/tests/random/fancy-like-button/+page.svelte` example. [Done]
- Aligned spawn origin container; size changes keep alignment. [Done]
- E2E: Pending (press-and-hold spawns, second press unlikes and stops). [Planned]

Status against spec:

- Toggle like/unlike works (mouse/touch/keyboard). [Done]
- Hold-to-spawn hearts and circles; release stops; cleanup timers. [Done]
- Performance acceptable; emitters are pointer-events-none. [Done]

## 7) Parity Matrix (Initial cut)

| Capability                         | Framer Motion (React) | Svelte Motion (now)    | Phase |
| ---------------------------------- | --------------------- | ---------------------- | ----- |
| `initial`, `animate`, `transition` | Yes                   | Yes                    | 0     |
| `whileTap`                         | Yes                   | Yes                    | 0     |
| `whileHover`, `whileFocus`         | Yes                   | No                     | 0     |
| `variants`                         | Yes                   | No                     | 1     |
| `exit` + presence                  | Yes                   | No                     | 1     |
| `drag`/`pan`                       | Yes                   | No                     | 2     |
| Motion values/transforms           | Yes                   | No                     | 2     |
| Timelines/stagger                  | Yes                   | No                     | 2     |
| Layout (single element)            | Yes                   | Yes (FLIP, no flicker) | 0     |
| Shared layout                      | Yes                   | No (prototype planned) | 3     |
| Docs/examples parity               | Yes                   | Minimal                | 3     |

## 8) Technical Approach Notes

- Leverage the `motion` JS engine already used for typing to drive keyframes/WAAPI under the hood.
- Encapsulate prop parsing into a shared container (`_MotionContainer.svelte`) to minimize duplication across elements.
- Implement interaction props as composed keyframe sets, merged with `transition` settings and interactive state.
- Layout: FLIP implementation using `ResizeObserver`. On size/position change we measure previous and next rects, pre-apply the inverted transform (translate/scale from previous to next) synchronously to avoid flashing, then animate back to identity using Motion's `animate`. `layout="position"` restricts to translation only; `layout` enables translation + scaling.
- Variants: resolve variant keys contextually, support nested inheritance, and per-prop `transition` overrides.
- Presence: wrapper component coordinating mount/unmount and exit states with deferred DOM removal.
- Gestures: build on pointer events; compute velocity; apply inertial transitions via the motion engine.
- Motion values: create Svelte stores for values and derived transforms; connect to style updates efficiently.

## 9) Testing and Quality

- Unit tests for utils and `_MotionContainer` lifecycles and whileTap reset. [Done]
- E2E Playwright: enter animation, HTML content. [Done] Fancy Like Button, presence/variants tests. [Planned]
- Lint/typecheck in CI; workflow validation with artifact logs. [Done]

## 10) Risks

- Gesture complexity across devices and browser quirks.
- Performance regressions with many concurrent animated nodes (e.g., heart spawns).
- API drift from Framer Motion causing migration friction.

## 11) References

- Framer Motion on npm: [`framer-motion`](https://www.npmjs.com/package/framer-motion)
- Fancy Like Button inspiration: [`DRlFTER/fancyLikeButton`](https://github.com/DRlFTER/fancyLikeButton?utm_source=chatgpt.com)
