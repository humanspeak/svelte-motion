import { animate as animateCore } from 'motion'
import { describe, expect, it, vi } from 'vitest'
import { animate } from './animateValue.js'
import { motionValue } from './vanillaValues.svelte.js'

/**
 * `animate` re-exported from `./animateValue` is motion's `animate` re-typed so
 * this library's Svelte-augmented motion values are accepted as the animation
 * subject without a cast. These tests lock two guarantees:
 *
 *  1. Runtime identity — it must be the SAME function object as motion's
 *     `animate` (pure type-level cast, no wrapper), so behavior and stack
 *     traces are unchanged.
 *  2. Types — an `AugmentedMotionValue<T>` compiles as the subject (the exact
 *     shape that used to force `as unknown as RawMotionValue<T>`), while genuine
 *     misuse is still rejected (we did not weaken to `any`).
 *
 * The `@ts-expect-error` lines below are validated by `pnpm check`; if the
 * wrapper ever stops rejecting those calls, the type check fails.
 */
describe('utils/animateValue - animate', () => {
    it("is motion's animate (pure re-type, no runtime wrapper)", () => {
        expect(animate).toBe(animateCore)
    })

    it('accepts an augmented motion value and drives it to its target', async () => {
        const mv = motionValue(0)
        const controls = animate(mv, 100, { duration: 0.5 })
        expect(typeof controls.stop).toBe('function')

        await vi.advanceTimersByTimeAsync(600)
        expect(mv.get()).toBe(100)
    })

    it('accepts an augmented motion value with an array keyframe target', async () => {
        const mv = motionValue(0)
        const controls = animate(mv, [0, 1], { duration: 0.5 })
        expect(typeof controls.stop).toBe('function')

        await vi.advanceTimersByTimeAsync(600)
        expect(mv.get()).toBe(1)
    })
})

/**
 * Compile-only assertions — never invoked. Their presence makes `pnpm check`
 * validate the wrapper's overload set: augmented subjects and every passthrough
 * overload (numbers, strings, elements, sequences) must compile, and the
 * `@ts-expect-error` cases must stay errors.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function typeAssertions() {
    const numMv = motionValue(0)
    const strMv = motionValue('0px')

    // Augmented motion values compile without a cast (the papercut this fixes).
    animate(numMv, [0, 1], { duration: 0.5 })
    animate(numMv, 100)
    animate(strMv, '10px')

    // Passthrough overloads still typecheck.
    animate(document.createElement('div'), { opacity: 0.5 }, { duration: 0.1 })
    animate([['.a', { opacity: 0.5 }, { duration: 0.001 }]], { duration: 0.01 })

    // @ts-expect-error keyframes must match the motion value's value type
    animate(numMv, 'not-a-number')
    // @ts-expect-error a boolean is not a valid animation subject
    animate(true, 1)
}
