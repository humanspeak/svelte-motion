# Svelte Motion — Product Requirements Document (PRD)

## 1) Vision and Context

Svelte Motion aims to bring a Framer Motion–style developer experience to Svelte by offering ergonomic, declarative animation primitives via `motion.<element>` components, interaction props, and composable configuration.

Reference: Framer Motion for React [`motion` on npm](https://www.npmjs.com/package/motion).

## 2) Current State Assessment (as of this repo)

- **Exports**:
    - `motion`: Object map of HTML and SVG tag components (e.g., `motion.div`, `motion.button`, `motion.svg`) generated from canonical lists, exported via `src/lib/html/`.
    - `MotionConfig` context component.
    - `AnimatePresence` wrapper enabling exit animations on unmount.
    - Types: `MotionInitial`, `MotionAnimate`, `MotionExit`, `MotionTransition`, `MotionWhileTap`.
    - Utilities: `useTime(id?)`, `useSpring`, `useTransform`.
- **Implemented props**: `initial`, `animate`, `transition`, `exit`, `whileTap`, `whileHover`, `onAnimationStart`, `onAnimationComplete`, `class`, `style`, `layout` (FLIP-based).
- **Presence / Exit**:
    - Exit animations are supported via `AnimatePresence`.
    - Transition precedence for exits (merged): `{ duration: 0.35 } < component transition (merged with MotionConfig) < exit.transition`.
- **Tap callbacks & a11y**: `onTapStart`, `onTap`, `onTapCancel` implemented, keyboard accessible.
- **SSR**: Initial styles reflected in server HTML; hydration-safe.
- **Tests**: Extensive unit tests for utils and components; E2E demos.

Gaps vs Framer Motion core:

- Variants API (`variants`, `initial`/`animate`/`exit` by variant key, inheritance).
- Gesture system beyond tap/hover (drag/pan).
- Motion values orchestration helpers (stagger, timelines).
- Shared layout / `layoutId` (planned).

## 3) Product Goals

Primary goal: API and behavioral parity for core day-1 Framer Motion features that enable common examples to “copy-paste translate” into Svelte with minimal changes.

## 4) Phased Roadmap

Phase 0 — Foundations (status)

- Core wrappers, SSR, `whileHover`, `whileTap`, lifecycle callbacks, FLIP layout. [Done]

Phase 1 — Variants and Presence

- Variants (MVP). [Planned]
- `AnimatePresence` for exit-on-unmount. [Done]
- Exit transition precedence and docs. [Done]

Phase 2 — Gestures and Motion Values

- `drag`/`pan`; motion values + transforms; timelines/stagger. [Planned]

Phase 3 — Ecosystem

- Docs with parity table and examples. [In progress]

### 4.1) Next Focus

- Variants MVP.
- Docs: Add presence/exit examples to homepage and README. [Done]
- E2E: Presence/exit tests. [Planned]

## 5) API Design Targets (Parity-Oriented)

- `initial`, `animate`, `transition`, `exit`, `variants`, `whileTap`, `whileHover`, `whileFocus`.
- Presence manager: `AnimatePresence`.

## 6) Exit Animations — Requirements

- Unmount-time exit animations orchestrated by `AnimatePresence`.
- Element API:
    - `exit`: keyframes; can include `transition` to override exit timing.
    - `transition`: component-level transition merged with `MotionConfig`.
- Precedence (merged left→right):
    - base `{ duration: 0.35 }`
    - component `transition` (with `MotionConfig`)
    - `exit.transition`
- Visual fidelity:
    - Clone preserves computed styles and last rect; absolute positioned relative to parent.
    - Pointer-events none; z-index elevated during exit.

## 7) Parity Matrix

| Capability                         | Framer Motion (React) | Svelte Motion (now)    | Phase |
| ---------------------------------- | --------------------- | ---------------------- | ----- |
| `initial`, `animate`, `transition` | Yes                   | Yes                    | 0     |
| `whileTap`                         | Yes                   | Yes                    | 0     |
| `whileHover`                       | Yes                   | Yes                    | 0     |
| `whileFocus`                       | Yes                   | No                     | 0     |
| `variants`                         | Yes                   | No                     | 1     |
| `exit` + presence                  | Yes                   | Yes                    | 1     |
| `drag`/`pan`                       | Yes                   | No                     | 2     |
| Motion values/transforms           | Yes                   | No                     | 2     |
| Timelines/stagger                  | Yes                   | No                     | 2     |
| Layout (single element)            | Yes                   | Yes (FLIP)             | 0     |
| SSR initial render parity          | Yes                   | Yes                    | 0     |
| Shared layout                      | Yes                   | No (prototype planned) | 3     |
| Docs/examples parity               | Yes                   | In progress            | 3     |

## 8) Testing and Quality

- Unit: presence context (register/update/unregister, clone create/remove, onExitComplete).
- Component: `_MotionContainer` behaviors.
- E2E: Exit animation visibility and cleanup. [Planned]
- Lint/typecheck in CI; workflow validation with artifact logs. [Done]

## 9) References

- Motion for React docs (exit animations): [motion.dev/docs/react](https://motion.dev/docs/react)

---

## Appendix A — Technical Approach Notes

- Leverage the `motion` JS engine already used for typing to drive keyframes/WAAPI under the hood.
- Encapsulate prop parsing into a shared container (`_MotionContainer.svelte`) to minimize duplication across elements.
- Implement interaction props as composed keyframe sets, merged with `transition` settings and interactive state.
- Layout: FLIP implementation using `ResizeObserver`. On size/position change we measure previous and next rects, pre-apply the inverted transform (translate/scale from previous to next) synchronously to avoid flashing, then animate back to identity using Motion's `animate`. `layout="position"` restricts to translation only; `layout` enables translation + scaling.
- Variants: resolve variant keys contextually, support nested inheritance, and per-prop `transition` overrides. [Planned]
- Presence: wrapper component coordinating mount/unmount and exit states with deferred DOM removal. [Done]
- Gestures: build on pointer events; compute velocity; apply inertial transitions via the motion engine. [Planned]
- Motion values: create Svelte stores for values and derived transforms; connect to style updates efficiently. [Planned]

## Appendix B — Shared Layout Plan (post-Variants/Presence)

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

## Appendix C — Featured Example Requirement — Fancy Like Button

Target UX: A like button inspired by Fancy Like Button (React, Framer Motion) [`DRlFTER/fancyLikeButton` on GitHub](https://github.com/DRlFTER/fancyLikeButton?utm_source=chatgpt.com).

Behavioral spec:

- The button acts as a toggle: first press sets "liked" and turns the button red; next press unlikes and returns to default styling.
- While the button is pressed and the state is "liked", emit animated hearts and accent circles at an interval until release.
- Short press toggles state; long-press also toggles to "liked" and continuously emits until release.
- Emitted items float upward with slight horizontal variation, fade out, and optionally scale.
- Input support: mouse and touch (`pointerdown`/`pointerup`/`pointercancel`).
- Accessibility: role="button" or `<button>`, `aria-pressed` reflects state, keyboard activation (Space/Enter) toggles state, focus ring.
- Performance: no dropped frames on typical devices; GC-friendly (cap max hearts on screen, recycle where possible).

Acceptance criteria:

- Toggle behavior works with both mouse and touch; keyboard toggles state.
- While pressed in the liked state, hearts/circles spawn continuously and animate smoothly.
- Releasing press stops spawning within ≤1 frame; ongoing animations complete.
- Toggling to unliked immediately updates styling and stops new spawns.
- No console errors; zero linter errors in example; Playwright test verifying spawn-while-hold and toggle visuals.

Deliverables for this feature:

- `src/routes/tests/random/fancy-like-button/+page.svelte` example. [Done]
- Aligned spawn origin container; size changes keep alignment. [Done]
- E2E: press-and-hold spawns, second press unlikes and stops. [Planned]

## Appendix D — Risks

- Gesture complexity across devices and browser quirks.
- Performance regressions with many concurrent animated nodes.
- API drift from Framer Motion causing migration friction.
