import { domMax, pinchFeatures } from '$lib'
import { resetWarnOnceForTests } from '$lib/utils/motionKind'
import { render, screen } from '@testing-library/svelte'
import { frame, motionValue } from 'motion-dom'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PinchProbe from './__tests__/PinchProbe.svelte'

/**
 * The `pinch` prop, `whilePinch` and the `pinchFeatures` bundle.
 *
 * Port of upstream `packages/framer-motion/src/gestures/__tests__/pinch.test.tsx`
 * at v14.12.0 (19 tests, by name), plus three svelte-motion tests at the end
 * of the "pinch prop" block for the per-node LazyMotion gating.
 */

/**
 * Verbatim from upstream `pinch.test.tsx`.
 */
function pointer(
    target: EventTarget,
    type: string,
    pointerId: number,
    clientX: number,
    clientY = 0
) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, {
        pointerId,
        isPrimary: pointerId === 1,
        button: 0,
        pointerType: 'touch',
        clientX,
        clientY,
        pageX: clientX,
        pageY: clientY
    })
    target.dispatchEvent(event)
}

/**
 * Upstream `gestures/__tests__/utils.ts` `nextFrame`.
 */
const nextFrame = () =>
    new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })

/**
 * Spread two touches either side of the origin (where JSDOM puts every
 * element's centre) from 100px apart to 200px apart. Verbatim from upstream.
 */
async function spread(element: Element) {
    pointer(element, 'pointerdown', 1, -50)
    pointer(element, 'pointerdown', 2, 50)
    await nextFrame()
    pointer(window, 'pointermove', 1, -100)
    pointer(window, 'pointermove', 2, 100)
    await nextFrame()
    pointer(window, 'pointerup', 1, -100)
    pointer(window, 'pointerup', 2, 100)
    await nextFrame()
}

const features = { ...domMax, ...pinchFeatures }

/** Mount settles over a few frames (`mounting` → `ready`). */
const settle = async () => {
    await tick()
    await nextFrame()
    await nextFrame()
    await tick()
}

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

describe('pinch prop', () => {
    it('m component scales with pinchFeatures loaded', async () => {
        const scale = motionValue(1)
        render(PinchProbe, { kind: 'm', features, pinch: true, style: { scale } })
        await settle()

        await spread(box())

        expect(scale.get()).toBeCloseTo(2)
        expect(box().style.touchAction).toBe('none')
    })

    it('motion component scales with pinchFeatures loaded', async () => {
        const scale = motionValue(1)
        render(PinchProbe, { kind: 'motion', features, pinch: true, style: { scale } })
        await settle()

        await spread(box())

        expect(scale.get()).toBeCloseTo(2)
    })

    it('motion component scales with only pinchFeatures loaded', async () => {
        const scale = motionValue(1)
        render(PinchProbe, {
            kind: 'motion',
            features: pinchFeatures,
            pinch: true,
            style: { scale }
        })
        await settle()

        await spread(box())

        expect(scale.get()).toBeCloseTo(2)
    })

    it('m component scales with only pinchFeatures loaded', async () => {
        const scale = motionValue(1)
        render(PinchProbe, {
            kind: 'm',
            features: pinchFeatures,
            strict: true,
            pinch: true,
            style: { scale }
        })
        await settle()

        await spread(box())

        expect(scale.get()).toBeCloseTo(2)
    })

    it('passes options and callbacks', async () => {
        const scale = motionValue(1)
        const onEnd = vi.fn()
        render(PinchProbe, {
            features,
            pinch: { scale: { max: 1.5 }, elastic: 0, onEnd },
            style: { scale }
        })
        await settle()

        await spread(box())

        expect(scale.get()).toBeCloseTo(1.5)
        expect(onEnd).toHaveBeenCalledTimes(1)
        expect(onEnd.mock.calls[0][1].scale).toBeCloseTo(2)
    })

    it('calls onStart, onMove and onEnd once per gesture, with info', async () => {
        const onStart = vi.fn()
        const onMove = vi.fn()
        const onEnd = vi.fn()
        render(PinchProbe, { features, pinch: { onStart, onMove, onEnd } })
        await settle()
        const element = box()

        await spread(element)

        expect(onStart).toHaveBeenCalledTimes(1)
        expect(onStart.mock.calls[0][0].type).toBe('pointerdown')
        expect(onStart.mock.calls[0][1]).toEqual({
            point: { x: 0, y: 0 },
            offset: { x: 0, y: 0 },
            scale: 1,
            rotate: 0
        })
        expect(onMove).toHaveBeenCalledTimes(1)
        expect(onMove.mock.calls[0][1].scale).toBeCloseTo(2)
        expect(onEnd).toHaveBeenCalledTimes(1)
        expect(onEnd.mock.calls[0][0].type).toBe('pointerup')

        // A new gesture starts again.
        await spread(element)

        expect(onStart).toHaveBeenCalledTimes(2)
        expect(onMove).toHaveBeenCalledTimes(2)
        expect(onEnd).toHaveBeenCalledTimes(2)
    })

    it('uses the latest callbacks mid-gesture', async () => {
        const first = vi.fn()
        const second = vi.fn()
        const { rerender } = render(PinchProbe, { features, pinch: { onEnd: first } })
        await settle()
        const element = box()

        pointer(element, 'pointerdown', 1, -50)
        pointer(element, 'pointerdown', 2, 50)
        await rerender({ pinch: { onEnd: second } })
        pointer(window, 'pointerup', 1, -50)
        pointer(window, 'pointerup', 2, 50)

        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledTimes(1)
    })

    it('uses the latest options', async () => {
        const scale = motionValue(1)
        const { rerender } = render(PinchProbe, {
            features,
            pinch: { scale: { max: 4 }, elastic: 0 },
            style: { scale }
        })
        await settle()

        await rerender({ pinch: { scale: { max: 1.25 }, elastic: 0 } })
        await spread(box())

        expect(scale.get()).toBeCloseTo(1.25)
    })

    it("pinch={false} doesn't pinch", async () => {
        const scale = motionValue(1)
        const { rerender } = render(PinchProbe, { features, pinch: true, style: { scale } })
        await settle()

        await rerender({ pinch: false })
        await spread(box())

        expect(scale.get()).toBe(1)
    })

    it('pinch={false} gives the page its touch gestures back', async () => {
        const { rerender } = render(PinchProbe, { features, pinch: true })
        await settle()
        const element = box()

        expect(element.style.touchAction).toBe('none')
        await rerender({ pinch: false })
        expect(element.style.touchAction).not.toBe('none')
        await rerender({ pinch: true })
        expect(element.style.touchAction).toBe('none')
    })

    it("keeps touch gestures off when drag's axis changes", async () => {
        const { rerender } = render(PinchProbe, { features, pinch: true, drag: 'x' })
        await settle()
        const element = box()

        expect(element.style.touchAction).toBe('none')
        await rerender({ drag: 'y' })
        expect(element.style.touchAction).toBe('none')
    })

    it('keeps a touch-action set in style, so a pinchable list can scroll', async () => {
        const { rerender } = render(PinchProbe, {
            features,
            pinch: true,
            style: { touchAction: 'pan-y' }
        })
        await settle()
        const element = box()

        expect(element.style.touchAction).toBe('pan-y')
        await rerender({ style: { touchAction: 'pan-y', opacity: 0.5 } })
        expect(element.style.touchAction).toBe('pan-y')
    })

    it('pinch={false} mid-gesture ends it', async () => {
        const scale = motionValue(1)
        const onEnd = vi.fn()
        const { rerender } = render(PinchProbe, {
            features,
            pinch: { scale: { max: 1.2 }, onEnd },
            style: { scale }
        })
        await settle()
        const element = box()

        pointer(element, 'pointerdown', 1, -50)
        pointer(element, 'pointerdown', 2, 50)
        await nextFrame()
        await rerender({ pinch: false })
        pointer(window, 'pointermove', 1, -100)
        pointer(window, 'pointermove', 2, 100)
        await nextFrame()

        expect(scale.get()).toBe(1)
        expect(onEnd).toHaveBeenCalledTimes(1)

        pointer(window, 'pointerup', 1, -100)
        pointer(window, 'pointerup', 2, 100)
    })

    it('removes listeners on unmount', async () => {
        const onStart = vi.fn()
        const { rerender } = render(PinchProbe, { features, pinch: { onStart } })
        await settle()
        const element = box()

        await rerender({ show: false })
        await spread(element)

        expect(onStart).not.toHaveBeenCalled()
    })

    it("isn't forwarded to the DOM", async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const a = render(PinchProbe, { kind: 'motion', pinch: true })
        await settle()
        const b = render(PinchProbe, { kind: 'motion', pinch: { scale: { max: 2 } } })
        await settle()

        const boxA = a.container.querySelector('[data-testid="box"]')
        const boxB = b.container.querySelector('[data-testid="box"]')
        expect(boxA?.hasAttribute('pinch')).toBe(false)
        expect(boxB?.hasAttribute('pinch')).toBe(false)
        expect(error).not.toHaveBeenCalled()
    })

    // svelte-motion: per-node gating on the nearest LazyMotion's bundle.

    it("a motion component outside LazyMotion doesn't pinch", async () => {
        const scale = motionValue(1)
        render(PinchProbe, { kind: 'motion', pinch: true, style: { scale } })
        await settle()

        await spread(box())

        expect(scale.get()).toBe(1)
        expect(box().style.touchAction).not.toBe('none')
    })

    it("an m component under domMax without pinchFeatures doesn't pinch", async () => {
        const scale = motionValue(1)
        render(PinchProbe, { kind: 'm', features: domMax, pinch: true, style: { scale } })
        await settle()

        await spread(box())

        expect(scale.get()).toBe(1)
        expect(box().style.touchAction).not.toBe('none')
    })

    it('pinch turned on after mount attaches', async () => {
        const scale = motionValue(1)
        const { rerender } = render(PinchProbe, { features, pinch: false, style: { scale } })
        await settle()

        await rerender({ pinch: true })
        await spread(box())

        expect(scale.get()).toBeCloseTo(2)
    })
})

describe('whilePinch', () => {
    async function pinchOpen(element: Element) {
        pointer(element, 'pointerdown', 1, -50)
        pointer(element, 'pointerdown', 2, 50)
        await nextFrame()
        pointer(window, 'pointermove', 1, -100)
        pointer(window, 'pointermove', 2, 100)
        await nextFrame()
        await nextFrame()
    }

    async function release() {
        pointer(window, 'pointerup', 1, -100)
        pointer(window, 'pointerup', 2, 100)
        await nextFrame()
        await nextFrame()
    }

    it('animates while pinching and back on release', async () => {
        const opacity = motionValue(1)
        render(PinchProbe, {
            features,
            pinch: true,
            whilePinch: { opacity: 0.5 },
            transition: { duration: 0 },
            style: { opacity }
        })
        await settle()
        const element = box()

        await pinchOpen(element)
        expect(opacity.get()).toBe(0.5)

        await release()
        expect(opacity.get()).toBe(1)
    })

    it('variant labels propagate to children', async () => {
        const opacity = motionValue(1)
        render(PinchProbe, {
            features,
            pinch: true,
            whilePinch: 'pinching',
            child: {
                variants: { pinching: { opacity: 0.5 } },
                transition: { duration: 0 },
                style: { opacity }
            }
        })
        await settle()
        const element = box()

        await pinchOpen(element)
        expect(opacity.get()).toBe(0.5)

        await release()
        expect(opacity.get()).toBe(1)
    })

    it('pinch={false} mid-gesture ends whilePinch', async () => {
        const opacity = motionValue(1)
        const { rerender } = render(PinchProbe, {
            features,
            pinch: true,
            whilePinch: { opacity: 0.5 },
            transition: { duration: 0 },
            style: { opacity }
        })
        await settle()
        const element = box()

        await pinchOpen(element)
        expect(opacity.get()).toBe(0.5)

        await rerender({ pinch: false })
        await nextFrame()
        await nextFrame()
        expect(opacity.get()).toBe(1)

        await release()
    })

    it("isn't forwarded to the DOM", async () => {
        render(PinchProbe, { features, pinch: true, whilePinch: { opacity: 0.5 } })
        await settle()

        expect(box().hasAttribute('whilePinch')).toBe(false)
        expect(box().hasAttribute('whilepinch')).toBe(false)
    })
})

describe('pinch limits', () => {
    it('scale resists past max and springs back on release', async () => {
        const scale = motionValue(1)
        render(PinchProbe, {
            features,
            pinch: { scale: { max: 1.5 }, rotate: false },
            style: { scale }
        })
        await settle()
        const element = box()

        pointer(element, 'pointerdown', 1, -50)
        pointer(element, 'pointerdown', 2, 50)
        await nextFrame()
        pointer(window, 'pointermove', 1, -100)
        pointer(window, 'pointermove', 2, 100)
        await nextFrame()
        expect(scale.get()).toBeCloseTo(1.5 + 0.5 * 0.35)

        pointer(window, 'pointerup', 1, -100)
        pointer(window, 'pointerup', 2, 100)
        await new Promise((resolve) => setTimeout(resolve, 1500))
        expect(scale.get()).toBeCloseTo(1.5, 3)
    }, 10_000)
})
