import type { AnimationControls, AnimationControlsDefinition } from '$lib/types.js'
import { SvelteSet } from 'svelte/reactivity'

const mountedError =
    'controls.start() should only be called after a component has mounted. Consider calling within a $effect.'
const setMountedError =
    'controls.set() should only be called after a component has mounted. Consider calling within a $effect.'

/**
 * Returns true when a value looks like Motion's legacy animation controls.
 *
 * Upstream `motion-dom` treats any non-null object with a `start`
 * function as animation controls. Matching that narrow check keeps
 * `animate={controls}` detection compatible with Motion's public shape.
 *
 * @param value Value passed to `animate`.
 * @returns Whether `value` is an animation controls object.
 *
 * @example
 * ```ts
 * const controls = useAnimationControls()
 * isAnimationControls(controls) // true
 * isAnimationControls({ opacity: 1 }) // false
 * ```
 */
export const isAnimationControls = (value: unknown): value is AnimationControls => {
    return (
        value !== null &&
        typeof value === 'object' &&
        typeof (value as AnimationControls).start === 'function'
    )
}

/**
 * Create legacy animation controls.
 *
 * This mirrors upstream Motion's `animationControls()`: controls collect
 * subscribed motion components, guard `start`/`set` until mounted, fan out
 * starts to every subscriber, and stop all subscribers on unmount.
 *
 * @returns Animation controls with `subscribe`, `start`, `set`, `stop`,
 *   and `mount`.
 *
 * @example
 * ```ts
 * const controls = animationControls()
 * const cleanup = controls.mount()
 * await controls.start({ opacity: 1 })
 * cleanup()
 * ```
 */
export const animationControls = (): AnimationControls => {
    let hasMounted = false
    const subscribers = new SvelteSet<Parameters<AnimationControls['subscribe']>[0]>()

    const controls: AnimationControls = {
        subscribe(subscriber) {
            subscribers.add(subscriber)
            return () => {
                subscribers.delete(subscriber)
            }
        },
        start(definition: AnimationControlsDefinition, transitionOverride) {
            if (!hasMounted) {
                throw new Error(mountedError)
            }

            const animations: Promise<unknown>[] = []
            subscribers.forEach((subscriber) => {
                animations.push(subscriber.start(definition, transitionOverride))
            })
            return Promise.all(animations)
        },
        set(definition: AnimationControlsDefinition) {
            if (!hasMounted) {
                throw new Error(setMountedError)
            }

            subscribers.forEach((subscriber) => subscriber.set(definition))
        },
        stop() {
            subscribers.forEach((subscriber) => subscriber.stop())
        },
        mount() {
            hasMounted = true

            return () => {
                hasMounted = false
                controls.stop()
            }
        }
    }

    return controls
}

/**
 * Create imperative controls for one or more `motion.*` components.
 *
 * Pass the returned object to `animate={controls}`. Once mounted, call
 * `controls.start(definition)`, `controls.set(definition)`, or
 * `controls.stop()` to coordinate every subscribed component.
 *
 * @returns Mounted animation controls.
 * @see https://motion.dev/docs/react-use-animation-controls
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { motion, useAnimationControls } from '@humanspeak/svelte-motion'
 *
 *   const controls = useAnimationControls()
 * </script>
 *
 * <button onclick={() => controls.start({ scale: 1.2 })}>Pop</button>
 * <motion.div animate={controls} />
 * ```
 */
export const useAnimationControls = (): AnimationControls => {
    const controls = animationControls()

    $effect(() => controls.mount())

    return controls
}

/** Alias matching Motion's legacy `useAnimation` export. */
export const useAnimation = useAnimationControls
