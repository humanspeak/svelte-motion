import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attachWhileFocus, computeFocusBaseline, splitFocusDefinition } from './focus.js'

// Mock motion.animate
vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})
const { animate: animateMock } = (await import('motion')) as unknown as {
    animate: ReturnType<typeof vi.fn> & { mockClear: () => void; mock: { calls: unknown[][] } }
}

describe('utils/focus', () => {
    beforeEach(() => {
        animateMock.mockClear()
    })

    it('splitFocusDefinition: extracts nested transition when present', () => {
        const def = { scale: 1.2, transition: { duration: 0.12 } }
        const { keyframes, transition } = splitFocusDefinition(def)
        expect(keyframes).toMatchObject({ scale: 1.2 })
        expect(transition).toMatchObject({ duration: 0.12 })
    })

    it('splitFocusDefinition: handles no transition', () => {
        const def = { x: 100 }
        const { keyframes, transition } = splitFocusDefinition(def)
        expect(keyframes).toMatchObject({ x: 100 })
        expect(transition).toBeUndefined()
    })

    it('computeFocusBaseline: prefers animate over initial', () => {
        const el = document.createElement('div')
        const baseline = computeFocusBaseline(el, {
            initial: { scale: 1, opacity: 0.5 },
            animate: { scale: 1.2, opacity: 0.8 },
            whileFocus: { scale: 1.5, opacity: 1 }
        })
        expect(baseline).toMatchObject({ scale: 1.2, opacity: 0.8 })
    })

    it('computeFocusBaseline: falls back to initial when animate is missing key', () => {
        const el = document.createElement('div')
        const baseline = computeFocusBaseline(el, {
            initial: { x: 10 },
            animate: {},
            whileFocus: { x: 100 }
        })
        expect(baseline).toMatchObject({ x: 10 })
    })

    it('computeFocusBaseline: uses neutral defaults for transform props', () => {
        const el = document.createElement('div')
        const baseline = computeFocusBaseline(el, {
            whileFocus: { scale: 2, rotate: 90 }
        })
        expect(baseline.scale).toBe(1)
        expect(baseline.rotate).toBe(0)
    })

    it('attachWhileFocus: animates on focus and restores on blur', async () => {
        const el = document.createElement('button')
        animateMock.mockClear()
        const onStart = vi.fn()
        const onEnd = vi.fn()
        const cleanup = attachWhileFocus(
            el,
            { scale: 1.1, outline: '2px solid blue' },
            { duration: 0.3 },
            { onStart, onEnd },
            {
                initial: { scale: 1 },
                animate: { scale: 1.05 }
            }
        )

        // Focus should trigger animation
        el.dispatchEvent(new FocusEvent('focus'))
        await Promise.resolve()
        expect(onStart).toHaveBeenCalledTimes(1)
        expect(animateMock).toHaveBeenCalledTimes(1)
        const focusCall = animateMock.mock.calls[0]
        expect(focusCall?.[1]).toMatchObject({ scale: 1.1, outline: '2px solid blue' })

        // Blur should restore baseline (scale should restore, outline may not be in baseline)
        el.dispatchEvent(new FocusEvent('blur'))
        await Promise.resolve()
        expect(onEnd).toHaveBeenCalledTimes(1)
        expect(animateMock).toHaveBeenCalledTimes(2)
        const blurCall = animateMock.mock.calls[1]
        expect(blurCall?.[1]).toMatchObject({ scale: 1.05 })

        cleanup()
    })

    it('attachWhileFocus: uses nested transition when provided', () => {
        const el = document.createElement('button')
        animateMock.mockClear()
        const cleanup = attachWhileFocus(
            el,
            { scale: 1.2, transition: { duration: 0.15 } },
            { duration: 0.5 }
        )

        el.dispatchEvent(new FocusEvent('focus'))
        expect(animateMock).toHaveBeenCalledTimes(1)
        const call = animateMock.mock.calls[0]
        expect(call?.[2]).toMatchObject({ duration: 0.15 })

        cleanup()
    })

    it('attachWhileFocus: cleanup removes listeners', () => {
        const el = document.createElement('button')
        const addSpy = vi.spyOn(el, 'addEventListener')
        const removeSpy = vi.spyOn(el, 'removeEventListener')

        const cleanup = attachWhileFocus(el, { scale: 1.1 }, {})

        expect(addSpy).toHaveBeenCalledWith('focus', expect.any(Function))
        expect(addSpy).toHaveBeenCalledWith('blur', expect.any(Function))

        cleanup()

        expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function))
        expect(removeSpy).toHaveBeenCalledWith('blur', expect.any(Function))
    })

    it('attachWhileFocus: returns noop when whileFocus is undefined', () => {
        const el = document.createElement('button')
        const cleanup = attachWhileFocus(el, undefined, {})
        expect(typeof cleanup).toBe('function')
        animateMock.mockClear()
        el.dispatchEvent(new FocusEvent('focus'))
        expect(animateMock).not.toHaveBeenCalled()
        cleanup()
    })
})
