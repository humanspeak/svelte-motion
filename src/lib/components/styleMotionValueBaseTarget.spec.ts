import { resetWarnOnceForTests } from '$lib/utils/motionKind'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { frame, motionValue } from 'motion-dom'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StyleBaseTargetProbe from './__tests__/StyleBaseTargetProbe.svelte'

/**
 * A value bound through a `style` motion value animates back to its
 * mount-time value when a `while*` state ends, as upstream: the VisualElement
 * constructor copies `latestValues` (which `makeLatestValues` filled from the
 * style motion values) into `baseTarget`, and `animateChanges` animates each
 * removed key back to `getBaseTarget(key)`.
 */

/** Upstream `gestures/__tests__/utils.ts` `nextFrame`. */
const nextFrame = () =>
    new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })

/** Mount settles over a few frames (`mounting` → `ready`). */
const settle = async () => {
    await tick()
    await nextFrame()
    await nextFrame()
    await tick()
}

/** Let an instant (`duration: 0`) animation land. */
const frames = async () => {
    await nextFrame()
    await nextFrame()
}

/** A primary mouse pointer, as motion-dom's `hover()` and `press()` require. */
const mouse = (pressed = false) => ({
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: pressed ? 1 : 0
})

const box = () => screen.getByTestId('box')

beforeEach(() => {
    resetWarnOnceForTests()
    vi.useRealTimers()
    ;(globalThis as never as { requestAnimationFrame: unknown }).requestAnimationFrame = (
        callback: FrameRequestCallback
    ) => setTimeout(() => callback(performance.now()), 16) as unknown as number
    ;(globalThis as never as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (
        id: number
    ) => clearTimeout(id)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('while* gestures restore style motion values', () => {
    it('whileHover animates a style motion value back on hover end', async () => {
        const opacity = motionValue(1)
        render(StyleBaseTargetProbe, {
            style: { opacity },
            whileHover: { opacity: 0.5 },
            transition: { duration: 0 }
        })
        await settle()

        await fireEvent.pointerEnter(box(), mouse())
        await frames()
        expect(opacity.get()).toBe(0.5)

        await fireEvent.pointerLeave(box(), mouse())
        await frames()
        expect(opacity.get()).toBe(1)
    })

    it('whileTap animates a style motion value back on pointer up', async () => {
        const opacity = motionValue(1)
        render(StyleBaseTargetProbe, {
            style: { opacity },
            whileTap: { opacity: 0.5 },
            transition: { duration: 0 }
        })
        await settle()

        await fireEvent.pointerDown(box(), mouse(true))
        await frames()
        expect(opacity.get()).toBe(0.5)

        await fireEvent.pointerUp(box(), mouse())
        await frames()
        expect(opacity.get()).toBe(1)
    })

    it('whileFocus animates a style motion value back on blur', async () => {
        const opacity = motionValue(1)
        render(StyleBaseTargetProbe, {
            style: { opacity },
            whileFocus: { opacity: 0.5 },
            transition: { duration: 0 }
        })
        await settle()

        // jsdom reports `:focus-visible` as false for a dispatched focus event;
        // stub the match as `gestures.spec.ts` does so the gesture applies.
        const element = box()
        const matches = element.matches.bind(element)
        vi.spyOn(element, 'matches').mockImplementation(
            (selector: string) => selector === ':focus-visible' || matches(selector)
        )

        await fireEvent.focus(element)
        await frames()
        expect(opacity.get()).toBe(0.5)

        await fireEvent.blur(element)
        await frames()
        expect(opacity.get()).toBe(1)
    })

    it('a transform shorthand (x) animates back on hover end', async () => {
        const x = motionValue(20)
        render(StyleBaseTargetProbe, {
            style: { x },
            whileHover: { x: 100 },
            transition: { duration: 0 }
        })
        await settle()

        await fireEvent.pointerEnter(box(), mouse())
        await frames()
        expect(x.get()).toBe(100)

        await fireEvent.pointerLeave(box(), mouse())
        await frames()
        expect(x.get()).toBe(20)
    })

    it('a key set in initial returns to the initial value, not the motion value', async () => {
        // Upstream `animateChanges` (motion-dom `render/utils/animation-state.ts`,
        // the removed-keys fallback): a key present in `initial` animates back
        // to the `initial` value before the `baseTarget` fallback is consulted,
        // so the gesture's end lands on 0.2.
        const opacity = motionValue(1)
        render(StyleBaseTargetProbe, {
            style: { opacity },
            initial: { opacity: 0.2 },
            whileHover: { opacity: 0.5 },
            transition: { duration: 0 }
        })
        await settle()
        // With `initial` and no `animate` the node promotes to `ready` (which
        // attaches the gestures) on a later animation frame.
        await new Promise((resolve) => setTimeout(resolve, 100))

        await fireEvent.pointerEnter(box(), mouse())
        await frames()
        expect(opacity.get()).toBe(0.5)

        await fireEvent.pointerLeave(box(), mouse())
        await frames()
        expect(opacity.get()).toBe(0.2)
    })
})
