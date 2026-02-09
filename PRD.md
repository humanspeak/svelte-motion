# Svelte Motion — Product Requirements Document (PRD)

## 1) Vision

Svelte Motion brings Framer Motion-style ergonomics to Svelte 5 with:

- `motion.<element>` components
- Declarative animation props
- Gesture props and callbacks
- Presence orchestration for exit animations
- Composable defaults via `MotionConfig`

Target outcome: React Motion examples should translate to Svelte with minimal conceptual changes.

## 2) Current state (verified)

This section reflects the current codebase state as of February 8, 2026.

### 2.1 Public API

From `src/lib/index.ts` and `src/lib/types.ts`:

- `motion` object with generated HTML/SVG components
- Components: `AnimatePresence`, `MotionConfig`
- Hooks/utilities: `useAnimationFrame`, `useSpring`, `useTime`, `useTransform`, `styleString`, `createDragControls`
- Deprecated export: `stringifyStyleObject`
- Re-exports from `motion`: `animate`, `stagger`, `transform`, `hover`, `press`, `scroll`, `inView`, easing and utility helpers

### 2.2 Implemented component props

Core animation and lifecycle:

- `initial`, `animate`, `exit`, `transition`, `variants`
- `onAnimationStart`, `onAnimationComplete`

Gestures and in-view:

- `whileHover`, `onHoverStart`, `onHoverEnd`
- `whileTap`, `onTapStart`, `onTap`, `onTapCancel`
- `whileFocus`, `onFocusStart`, `onFocusEnd`
- `whileInView`, `onInViewStart`, `onInViewEnd`

Drag:

- `drag`, `whileDrag`
- `dragConstraints`, `dragElastic`, `dragMomentum`, `dragTransition`
- `dragDirectionLock`, `dragPropagation`, `dragSnapToOrigin`
- `dragListener`, `dragControls`
- `onDragStart`, `onDrag`, `onDragEnd`, `onDirectionLock`, `onDragTransitionEnd`

Layout and element access:

- `layout` and `layout="position"` (single-element FLIP)
- `bind:ref` support via `ref`

### 2.3 Presence behavior

`AnimatePresence` supports:

- `initial` (skip first enter animations)
- `mode`: `sync | wait | popLayout`
- `onExitComplete`

Additional behavior:

- Direct children of `AnimatePresence` require `key`
- Exit transition precedence:
    1. Base `{ duration: 0.35 }`
    2. Merged component `transition` (including `MotionConfig` defaults)
    3. `exit.transition`

### 2.4 SSR behavior

Motion components render initial visual state during SSR and promote safely on hydration.

### 2.5 Test/quality snapshot

Local verification run:

- `pnpm run test:only`: `31 files`, `259 tests` passed
- `pnpm run check`: no type errors (warnings present)
- `pnpm run test:e2e`: `78 passed`, `1 skipped`

## 3) Parity assessment vs Framer Motion

### 3.1 Core parity achieved

- Declarative motion component model (`motion.<tag>`)
- Core animation props (`initial`/`animate`/`transition`/`exit`)
- Variants with key resolution and inheritance
- Gestures: hover, tap, focus, in-view, drag
- Presence orchestration with wait/popLayout modes
- Basic layout FLIP (`layout`, `layout="position"`)

### 3.2 Partial parity

- Motion value ecosystem: usable hooks exist (`useTime`, `useTransform`, `useSpring`) but not full Framer MotionValue API surface
- `MotionConfig`: currently scoped to transition defaults (not full Framer config parity)
- In-view API: supports `whileInView`, but not Framer-style `viewport` configuration options

### 3.3 Missing parity

- Shared layout identity: `layoutId` / `LayoutGroup`
- Pan gesture API: `whilePan`, `onPan`, `onPanStart`, `onPanEnd`
- Framer-specific feature flags/config (for example `features`, `transformPagePoint`)
- Reduced-motion config parity

## 4) Product goals

### 4.1 Primary goal

Reach practical API and behavior parity for high-value Framer Motion patterns in Svelte.

### 4.2 Success criteria

- Most documented Motion React examples can be translated with only syntax-level changes
- Clear docs parity matrix for Supported / Partial / Not Yet
- High confidence via unit + e2e coverage for every advertised capability

## 5) Next-stage roadmap

### Stage A — Documentation and parity truth (short-term)

- Align README/docs/PRD with current runtime behavior
- Publish explicit “partial vs missing” parity table
- Add docs pages for drag and in-view API details, including current limitations

### Stage B — Shared layout (`layoutId`) MVP

- Add `layoutId` to motion props
- Implement same-tree shared FLIP transitions first
- Integrate with `AnimatePresence` handoff for exit→enter transitions
- Add targeted unit + e2e tests for no-flicker, correct stacking, and cleanup

### Stage C — Feature parity hardening

- Add pan gesture API
- Add viewport options for in-view behavior
- Expand `MotionConfig` parity (`reducedMotion` and feature configuration)
- Evaluate additional parity surfaces (`LayoutGroup`, advanced orchestration semantics)

## 6) Parity matrix

| Capability                         | Framer Motion (React) | Svelte Motion (current) | Status            |
| ---------------------------------- | --------------------- | ----------------------- | ----------------- |
| `initial`, `animate`, `transition` | Yes                   | Yes                     | Supported         |
| `exit` + presence                  | Yes                   | Yes                     | Supported         |
| Variants + inheritance             | Yes                   | Yes                     | Supported         |
| `whileHover`                       | Yes                   | Yes                     | Supported         |
| `whileTap`                         | Yes                   | Yes                     | Supported         |
| `whileFocus`                       | Yes                   | Yes                     | Supported         |
| `whileInView`                      | Yes                   | Yes                     | Supported (basic) |
| Drag core API                      | Yes                   | Yes                     | Supported         |
| `AnimatePresence` modes            | Yes                   | Yes                     | Supported         |
| Layout single-element FLIP         | Yes                   | Yes                     | Supported         |
| Motion values ecosystem            | Yes                   | Partial                 | Partial           |
| Shared layout (`layoutId`)         | Yes                   | No                      | Missing           |
| Pan gesture API                    | Yes                   | No                      | Missing           |
| `MotionConfig` full parity         | Yes                   | Partial                 | Partial           |

## 7) Risks

- Overstating parity before docs and test coverage match runtime details
- Shared layout complexity (stacking contexts, clipping, nested scroll containers)
- Performance regressions with many concurrent animated nodes
- API drift from Framer Motion reducing migration ergonomics

## 8) References

- [Motion for React docs](https://motion.dev/docs/react)
- [Svelte Motion package](https://www.npmjs.com/package/@humanspeak/svelte-motion)
