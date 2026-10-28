/**
 * `transition.out` (#1725) through our component, on the real animation state.
 *
 * Port of upstream `packages/framer-motion/src/motion/__tests__/transition-out.test.tsx`
 * @ v14.7.1 (commits `369c6fb5d`, `7a56387a9`, `6c6a96940`, `34968ee4b`).
 * `transition.out` is the transition a value uses when it leaves a state for a
 * lower-priority one. Like upstream, "instant" means `{ type: false }` and the
 * contrast is `delay: 10` / `duration: 10`, so a few frames tell them apart
 * however loaded the machine is.
 *
 * `motion` / `motion-dom` are deliberately NOT mocked: these tests must run
 * motion-dom's `createAnimationState`. Upstream's StrictMode `test.each` has no
 * Svelte equivalent, and its 17th test (exit while hovered) runs through
 * `AnimatePresence`, so it is covered by `e2e/motion/transition-out-gestures.spec.ts`.
 */
import TransitionOutVariantsHarness from '$lib/components/__tests__/TransitionOutVariantsHarness.svelte'
import type { MotionAnimate, MotionInitial } from '$lib/types'
import { sleep } from '$lib/utils/testing'
import { fireEvent, render } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MotionContainer from './_MotionContainer.svelte'

const latestValuesOf = (el: Element | null): Record<string, unknown> => {
    if (!el) return {}
    const ve = visualElementStore.get(el)
    return ve ? { ...ve.latestValues } : {}
}

const valueOf = (el: Element | null, key: string) => latestValuesOf(el)[key]

const frames = (n = 3) => sleep(20 * n)

/** A primary mouse pointer, as motion-dom's `press()` requires. */
const mouse = (pressed = false) => ({
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: pressed ? 1 : 0
})
const pointerEnter = (el: Element) => fireEvent.pointerEnter(el, mouse())
const pointerLeave = (el: Element) => fireEvent.pointerLeave(el, mouse())
const pointerDown = (el: Element) => fireEvent.pointerDown(el, mouse(true))
const pointerUp = (el: Element) => fireEvent.pointerUp(el, mouse())

const renderMotion = (props: Record<string, unknown>) => {
    const result = render(MotionContainer as unknown as any, { props: { tag: 'div', ...props } })
    const el = result.container.firstElementChild as HTMLElement
    return { ...result, el }
}

describe('transition.out (#1725)', () => {
    beforeEach(() => {
        vi.useRealTimers()
        ;(globalThis as never as { requestAnimationFrame: unknown }).requestAnimationFrame = (
            callback: FrameRequestCallback
        ) => setTimeout(() => callback(performance.now()), 16) as unknown as number
        ;(globalThis as never as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (
            id: number
        ) => clearTimeout(id)
        vi.stubGlobal('matchMedia', (query: string) => {
            const matches = query.includes('(hover: hover)') || query.includes('(pointer: fine)')
            return {
                matches,
                media: query,
                onchange: null,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
                dispatchEvent() {
                    return false
                }
            } as unknown as MediaQueryList
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("initial's out transition is used for the mount animation only", async () => {
        const props = {
            initial: { opacity: 0, transition: { out: { type: false } } },
            transition: { delay: 10 }
        }
        const result = renderMotion({ ...props, animate: { opacity: 1 } })
        await frames()

        // initial -> animate uses initial's out transition, no delay
        expect(valueOf(result.el, 'opacity')).toBe(1)

        // Later changes to animate use the normal transition again
        await result.rerender({ tag: 'div', ...props, animate: { opacity: 0.5 } })
        await frames()
        expect(valueOf(result.el, 'opacity')).toBe(1)
    })

    it("initial's out transition from a variant label", async () => {
        const { el } = renderMotion({
            variants: {
                hidden: { opacity: 0, transition: { out: { type: false } } },
                visible: { opacity: 1, transition: { delay: 10 } }
            },
            initial: 'hidden',
            animate: 'visible'
        })
        await frames()
        expect(valueOf(el, 'opacity')).toBe(1)
    })

    it("variant children use the inherited initial's out transition on mount", async () => {
        const { getByTestId } = render(TransitionOutVariantsHarness, {
            props: {
                variants: {
                    hidden: { opacity: 0, transition: { out: { type: false } } },
                    visible: { opacity: 1, transition: { delay: 10 } }
                },
                initial: 'hidden',
                animate: 'visible'
            }
        })
        await frames()
        expect([
            valueOf(getByTestId('parent'), 'opacity'),
            valueOf(getByTestId('child'), 'opacity')
        ]).toEqual([1, 1])
    })

    it("initial's out doesn't apply to values initial doesn't change on mount", async () => {
        const props = {
            initial: { x: 0, transition: { out: { type: false } } },
            transition: { delay: 10 }
        }
        const result = renderMotion({ ...props, animate: { x: 0 } })
        await frames()

        await result.rerender({ tag: 'div', ...props, animate: { x: 10 } })
        await frames()
        expect(valueOf(result.el, 'x')).toBe(0)
    })

    it("the issue's example: delay applies to the mount animation, not hover end", async () => {
        const { el } = renderMotion({
            initial: { scale: 0, transition: { out: { delay: 10 } } },
            animate: { scale: 1, transition: { type: false } },
            whileHover: { scale: 2, transition: { type: false } }
        })
        await frames()
        expect(valueOf(el, 'scale')).toBe(0)

        // Hovering interrupts the delayed mount animation
        await pointerEnter(el)
        await frames()
        expect(valueOf(el, 'scale')).toBe(2)

        // Returning to animate uses animate's own transition, no delay
        await pointerLeave(el)
        await frames()
        expect(valueOf(el, 'scale')).toBe(1)
    })

    it("out: true reuses whileHover's transition when hover ends", async () => {
        const { el } = renderMotion({
            initial: false,
            animate: { opacity: 0.5, transition: { delay: 10 } },
            whileHover: { opacity: 1, transition: { type: false, out: true } }
        })
        await frames()

        await pointerEnter(el)
        await frames()
        expect(valueOf(el, 'opacity')).toBe(1)

        await pointerLeave(el)
        await frames()
        expect(valueOf(el, 'opacity')).toBe(0.5)
    })

    it('without out, the state being entered defines the transition (unchanged)', async () => {
        const { el } = renderMotion({
            initial: false,
            animate: { opacity: 0.5, transition: { delay: 10 } },
            whileHover: { opacity: 1, transition: { type: false } }
        })
        await frames()

        await pointerEnter(el)
        await frames()
        expect(valueOf(el, 'opacity')).toBe(1)

        await pointerLeave(el)
        await frames()
        expect(valueOf(el, 'opacity')).toBe(1)
    })

    it('out can be a separate transition for leaving', async () => {
        const { el } = renderMotion({
            initial: false,
            animate: { opacity: 0.5 },
            transition: { delay: 10 },
            whileHover: { opacity: 1, transition: { type: false, out: { type: false } } }
        })
        await frames()

        await pointerEnter(el)
        await frames()
        expect(valueOf(el, 'opacity')).toBe(1)

        await pointerLeave(el)
        await frames()
        expect(valueOf(el, 'opacity')).toBe(0.5)
    })

    it('applies when no lower state defines the value', async () => {
        const { el } = renderMotion({
            style: 'opacity: 0.5',
            transition: { delay: 10 },
            whileHover: { opacity: 1, transition: { type: false, out: true } }
        })
        await frames()

        await pointerEnter(el)
        await frames()
        expect(valueOf(el, 'opacity')).toBe(1)

        await pointerLeave(el)
        await frames()
        expect(valueOf(el, 'opacity')).toBe(0.5)
    })

    it('value-specific transitions inside an out transition', async () => {
        const { el } = renderMotion({
            initial: false,
            animate: { opacity: 0.5, x: 0 },
            transition: { delay: 10 },
            whileHover: {
                opacity: 1,
                x: 10,
                transition: { type: false, out: { delay: 10, opacity: { type: false } } }
            }
        })
        await frames()

        await pointerEnter(el)
        await frames()
        expect([valueOf(el, 'opacity'), valueOf(el, 'x')]).toEqual([1, 10])

        await pointerLeave(el)
        await frames()
        expect([valueOf(el, 'opacity'), valueOf(el, 'x')]).toEqual([0.5, 10])
    })

    it('a higher-priority state entering uses its own transition', async () => {
        const { el } = renderMotion({
            initial: false,
            animate: { scale: 1 },
            whileHover: { scale: 1.5, transition: { type: false, out: true } },
            whileTap: { scale: 0.5, transition: { delay: 10 } }
        })
        await frames()

        await pointerEnter(el)
        await frames()
        expect(valueOf(el, 'scale')).toBe(1.5)

        // Hover is overridden, not left: whileTap's delay applies
        await pointerDown(el)
        await frames()
        expect(valueOf(el, 'scale')).toBe(1.5)

        // Tap ends: entering whileHover again uses its transition
        await pointerUp(el)
        await frames()
        expect(valueOf(el, 'scale')).toBe(1.5)

        // Hover ends: its out transition is used
        await pointerLeave(el)
        await frames()
        expect(valueOf(el, 'scale')).toBe(1)
    })

    it('whileTap out applies when returning to whileHover', async () => {
        const { el } = renderMotion({
            initial: false,
            animate: { scale: 1 },
            transition: { delay: 10 },
            whileHover: { scale: 1.5 },
            whileTap: { scale: 0.5, transition: { type: false, out: true } }
        })
        await frames()

        await pointerEnter(el)
        await pointerDown(el)
        await frames()
        expect(valueOf(el, 'scale')).toBe(0.5)

        await pointerUp(el)
        await frames()
        expect(valueOf(el, 'scale')).toBe(1.5)
    })

    it('works with variants, including variant children', async () => {
        const { getByTestId } = render(TransitionOutVariantsHarness, {
            props: {
                variants: {
                    rest: { opacity: 0.5, transition: { delay: 10 } },
                    hover: { opacity: 1, transition: { type: false, out: true } }
                },
                initial: false,
                animate: 'rest',
                whileHover: 'hover'
            }
        })
        const parent = getByTestId('parent')
        const child = getByTestId('child')
        await frames()

        await pointerEnter(parent)
        await frames()
        expect([valueOf(parent, 'opacity'), valueOf(child, 'opacity')]).toEqual([1, 1])

        await pointerLeave(parent)
        await frames()
        expect([valueOf(parent, 'opacity'), valueOf(child, 'opacity')]).toEqual([0.5, 0.5])
    })

    it("is used once: the next change into animate uses animate's transition", async () => {
        const props = {
            initial: false,
            whileHover: { opacity: 1, transition: { type: false, out: true } }
        }
        const result = renderMotion({
            ...props,
            animate: { opacity: 0.5, transition: { delay: 10 } }
        })
        const { el } = result
        await frames()

        await pointerEnter(el)
        await frames()
        await pointerLeave(el)
        await frames()
        expect(valueOf(el, 'opacity')).toBe(0.5)

        await result.rerender({
            tag: 'div',
            ...props,
            animate: { opacity: 0, transition: { delay: 10 } }
        })
        await frames()
        expect(valueOf(el, 'opacity')).toBe(0.5)
    })

    it("setting only out keeps the value's default transition into the state", async () => {
        const { el } = renderMotion({
            initial: false,
            animate: { x: 0 },
            whileHover: { x: 100, transition: { out: { type: false } } }
        })
        await frames()

        const values: number[] = []
        const x = visualElementStore.get(el)!.getValue('x', 0)
        x.on('change', (v) => values.push(v as number))

        await pointerEnter(el)
        await frames(40)

        // x's default transition is an underdamped spring, which overshoots
        expect(Math.max(...values)).toBeGreaterThan(100)
    })

    it('with a list of labels, the last label that sets out applies to all its values', async () => {
        const { el } = renderMotion({
            initial: false,
            animate: 'rest',
            whileHover: ['fade', 'move'],
            variants: {
                rest: { opacity: 0.5, x: 0, transition: { delay: 10 } },
                fade: { opacity: 1, transition: { type: false, out: true } },
                move: { x: 10, transition: { type: false } }
            }
        })
        await frames()

        await pointerEnter(el)
        await frames()
        expect([valueOf(el, 'opacity'), valueOf(el, 'x')]).toEqual([1, 10])

        // out is tracked per state, not per value, so x (from "move", which
        // has no out) also leaves with "fade"'s out transition.
        await pointerLeave(el)
        await frames()
        expect([valueOf(el, 'opacity'), valueOf(el, 'x')]).toEqual([0.5, 0])
    })
})

/**
 * Compile-only: `initial` and `animate` objects accept an inline `transition`,
 * including `out`.
 */
function typeAssertions() {
    const i: MotionInitial = { opacity: 0, transition: { out: { delay: 1 } } }
    const a: MotionAnimate = { opacity: 1, transition: { out: true, duration: 0.2 } }
    void i
    void a
}

// Compile-time only: referenced so the checker keeps it, and lint sees a use.
void typeAssertions
