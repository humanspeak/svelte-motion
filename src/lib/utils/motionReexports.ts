import {
    animateMini as animateMiniCore,
    inertia as inertiaCore,
    keyframes as keyframesCore,
    resolveElements as resolveElementsCore
} from 'motion'

// Motion's public, framework-agnostic generators and helpers, re-exported
// unchanged. Each binding is `===` to motion's own function (no wrapper), so
// behaviour and tree-shaking match `motion` exactly.

/**
 * The decelerating "inertia" generator — the function behind
 * `transition.type: 'inertia'`. A value starting at `keyframes[0]` coasts
 * toward `origin + power × velocity` and settles; with `min`/`max` it springs
 * back inside the boundary. Pass it as `type` or sample it with `next(ms)`.
 *
 * @param options - `keyframes` (`[origin]`), `velocity`, `power` (0.8),
 *   `timeConstant` (325 ms), `min`/`max`, `bounceStiffness`/`bounceDamping`
 *   for the boundary spring, `modifyTarget`, `restDelta`/`restSpeed`.
 * @returns A `KeyframeGenerator<number>`: call `next(ms)` for `{ value, done }`.
 *
 * @example
 * ```ts
 * import { animate, inertia, motionValue } from '@humanspeak/svelte-motion'
 *
 * const x = motionValue(0)
 * animate(x, [0], { type: inertia, velocity: 1000, max: 240 })
 * ```
 *
 * @see {@link https://motion.dev/docs/animate#type}
 */
export const inertia: typeof inertiaCore = inertiaCore

/**
 * The tween generator behind `type: 'keyframes'` / `'tween'`, the engine's
 * default. Interpolates through `keyframes` over `duration`.
 *
 * @param options - `keyframes`, `duration` (ms, default 300), `times`, `ease`
 *   (default `'easeInOut'`).
 * @returns A `KeyframeGenerator`: call `next(ms)` for `{ value, done }`.
 *
 * @example
 * ```ts
 * import { keyframes } from '@humanspeak/svelte-motion'
 *
 * const tween = keyframes({ keyframes: [0, 100], duration: 1000, ease: 'linear' })
 * tween.next(250).value // 25
 * ```
 *
 * @see {@link https://motion.dev/docs/animate#type}
 */
export const keyframes: typeof keyframesCore = keyframesCore

/**
 * Resolve a selector, element, `NodeList` or array to an `Element[]`.
 * Selectors resolve inside the optional scope's `current` (accepts
 * `useAnimate()`'s scope); with no scope, an active `scopeMotion` root is
 * used, otherwise `document`. `null`/`undefined` → `[]`; `null` list entries
 * are dropped.
 *
 * @param elementOrSelector - A selector, element, or list of elements.
 * @param scope - Optional scope whose `current` limits selector resolution.
 * @param selectorCache - Optional cache of already-resolved selectors.
 * @returns The resolved elements.
 *
 * @example
 * ```ts
 * import { resolveElements } from '@humanspeak/svelte-motion'
 *
 * const items = resolveElements('li', { current: list, animations: [] })
 * ```
 *
 * @see {@link https://motion.dev/docs/resolve-elements}
 */
export const resolveElements: typeof resolveElementsCore = resolveElementsCore

/**
 * The Web Animations-only `animate` (what Motion ships as `animate` from
 * `motion/mini`). Animates HTML/SVG elements and selectors only — no motion
 * values, objects or sequences — and runs hardware-accelerated where the
 * browser allows.
 *
 * @param elementOrSelector - Element(s) or a CSS selector.
 * @param keyframes - DOM keyframes, e.g. `{ opacity: 0.25 }`.
 * @param options - Animation options (`duration`, `ease`, `delay`, …).
 * @returns `AnimationPlaybackControlsWithThen` — awaitable playback controls.
 *
 * @example
 * ```ts
 * import { animateMini } from '@humanspeak/svelte-motion'
 *
 * await animateMini('.box', { opacity: 0.25 }, { duration: 0.6 })
 * ```
 *
 * @see {@link https://motion.dev/docs/animate}
 */
export const animateMini: typeof animateMiniCore = animateMiniCore
