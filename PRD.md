# Svelte Motion — Product Requirements Document (PRD)

## 1) Vision and Context

Svelte Motion aims to bring a Framer Motion–style developer experience to Svelte by offering ergonomic, declarative animation primitives via `motion.<element>` components, interaction props, and composable configuration.

Reference: Framer Motion for React [`motion` on npm](https://www.npmjs.com/package/motion).

## 2) Current State Assessment (as of this repo)

- **Exports**:
    - `motion`: Object map of HTML and SVG tag components (e.g., `motion.div`, `motion.button`, `motion.svg`) generated from canonical lists, exported via `src/lib/html/`.
    - `MotionConfig` context component.
    - Types: `MotionInitial`, `MotionAnimate`, `MotionTransition`, `MotionWhileTap`.
- **Implemented props**: `initial`, `animate`, `transition`, `whileTap`, `whileHover`, `onAnimationStart`, `onAnimationComplete`, `class`, `style`, `layout` (FLIP-based).
- **Tap callbacks & a11y**: `onTapStart`, `onTap`, `onTapCancel` implemented. Tap is keyboard-accessible: Enter down starts tap, Enter up completes, blur cancels; `tabindex` added when needed for focusability.
    - SSR: Initial styles are reflected in server HTML by merging `style` with `initial` or first `animate` keyframe (no flicker).
- **Coverage of elements**: Full HTML + SVG coverage generated; void elements documented distinctly. Dashed names exported as PascalCase.
- **Tests**: Extensive unit tests for utils (animation, hover, interaction, layout, promise, style), SSR component tests for `_MotionContainer`, and E2E for enter animation, HTML content, and keyframes (shape + scale).

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
    - Merge SSR inline styles from `initial`/`animate[0]` to match starting appearance. [Done]
- Add `whileHover` to interaction set. [Done]
- Add `whileFocus` to interaction set. [Planned]
- Introduce `onAnimationStart`/`onAnimationComplete`. [Done]
- Add tap callbacks + keyboard accessibility for tap. [Done]
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

### 4.1) Next Focus (next 1–2 weeks)

- Priority 1 — whileFocus interaction
    - Add `whileFocus` prop with capability parity to `whileHover`/`whileTap`.
    - Tests: utils where needed and `_MotionContainer` behavior (enter/leave focus, nested transition support).
    - Docs: brief API reference and example.

- Priority 2 — Shared Layout (Prototype)
    - Introduce `layoutId` for same-tree shared layout transitions (translate + scale).
    - Coalesce measurements with RAF; use compositor hints; no overlay/portal in MVP.
    - Tests: card grid reorder and list item move using `layoutId`.

- Priority 3 — Variants (MVP)
    - Support `variants` object and `initial`/`animate` by variant key.
    - Allow per-property `transition` inside variants.
    - Tests: component-level resolution and overrides; no `exit` yet.

- Priority 4 — Presence (MVP)
    - Minimal `AnimatePresence`-like wrapper enabling exit animations on unmount for simple lists.
    - SSR/hydration-safe behavior; component tests verifying exit timing.

- Priority 5 — Testing and docs
    - E2E: Fancy Like Button press-and-hold spawns + un-like stop.
    - Docs site skeleton: Quickstart + API for `motion.<tag>`, `MotionConfig`, `while*` props.

- Ongoing — Performance hardening
    - Coalesce observers via `requestAnimationFrame` across utilities (done for layout observers); audit other hotspots.
    - Add canary perf test with many animated nodes and frequent layout changes.

### 4.2) Shared Layout Plan (post-Variants/Presence)

- Goal
    - Seamless position/size morph between elements that share identity across renders, supporting both same-tree moves and exit→enter handoff.

- API
    - `layoutId={string}` on `motion.*` elements to opt into shared layout transitions.
    - Optional `layout` mode: `true | 'position' | 'scale' | 'crossfade'` (default `true` → translate + scale; may iterate during prototype).

- Behavior
    - Same-tree reflow: elements with `layoutId` animate between measured previous and next rects using FLIP.
    - Handoff on unmount→mount: when an element with `layoutId` unmounts and another mounts with the same id, animate from last snapshot to the new rect; integrates with Presence so exit performs the handoff.
    - Stacking: during transition, temporarily elevate to an overlay layer to avoid clipping, then restore.

- Implementation outline
    - Registry in context mapping `layoutId → { el, rect, time, styleSnapshot }`.
    - On mount/resize/mutation: measure via `measureRect` and coalesced observers (RAF) from `observeLayoutChanges`.
    - On unmount: store a snapshot for a short TTL (e.g., 120ms) to allow handoff.
    - When a new element with the same `layoutId` mounts within TTL, run shared FLIP from prior snapshot to next rect; apply compositor hints during the transition.
    - Overlay layer: create a portal layer (single absolute container) to move animating elements temporarily; restore DOM position afterward.

- Milestones
    1. Prototype same-tree shared layout with `layoutId` (translate+scale).
    2. Integrate with `AnimatePresence` for exit→enter handoff across lists/routes.
    3. Add mode switches: `'position'` (no scale) and optional `'crossfade'`.
    4. Hardening: scrolling containers, transforms, overflow/clipping, border-radius.

- Testing
    - Unit: registry lifecycle; measurement/coalescing; overlay attach/detach.
    - Component: card grid reorder; list item move; exit→enter handoff with `layoutId`.
    - E2E: reorder animation smoothness; no flicker; correct z-order.

- Risks
    - Stacking contexts and transformed ancestors may disrupt overlay positioning.
    - Forced reflow if measurement is not batched; mitigated via RAF batching already in place.
    - Scroll offset and nested scroll containers affecting rect accuracy.

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
| `whileHover`                       | Yes                   | Yes                    | 0     |
| `whileFocus`                       | Yes                   | No                     | 0     |
| `variants`                         | Yes                   | No                     | 1     |
| `exit` + presence                  | Yes                   | No                     | 1     |
| `drag`/`pan`                       | Yes                   | No                     | 2     |
| Motion values/transforms           | Yes                   | No                     | 2     |
| Timelines/stagger                  | Yes                   | No                     | 2     |
| Layout (single element)            | Yes                   | Yes (FLIP, no flicker) | 0     |
| SSR initial render parity          | Yes                   | Yes                    | 0     |
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

- Unit tests for utils and `_MotionContainer` lifecycles, whileTap reset, style SSR merging. [Done]
- E2E Playwright: enter animation, HTML content, keyframes (shape/scale). [Done] Fancy Like Button, presence/variants tests. [Planned]
- Lint/typecheck in CI; workflow validation with artifact logs. [Done]

## 10) Risks

- Gesture complexity across devices and browser quirks.
- Performance regressions with many concurrent animated nodes (e.g., heart spawns).
- API drift from Framer Motion causing migration friction.

## 11) References

- Framer Motion on npm: [`framer-motion`](https://www.npmjs.com/package/framer-motion)
- Fancy Like Button inspiration: [`DRlFTER/fancyLikeButton`](https://github.com/DRlFTER/fancyLikeButton?utm_source=chatgpt.com)
