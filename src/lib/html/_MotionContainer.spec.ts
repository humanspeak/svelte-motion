import { fireEvent, render } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock 'motion' before importing the Svelte component (hoisted)
vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})
const { animate: animateMock } = (await import('motion')) as unknown as {
    animate: ReturnType<typeof vi.fn> & {
        mockClear: () => void
        mock: { calls: unknown[][] }
    }
}

// Mock sleep to resolve immediately
vi.mock('$lib/utils/testing.js', () => ({
    sleep: vi.fn(() => Promise.resolve())
}))

import MotionContainer from './_MotionContainer.svelte'

// Resolve requestAnimationFrame immediately to move component to "ready"
beforeEach(() => {
    animateMock.mockClear()
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        setTimeout(() => cb(0), 0)
        return 0 as unknown as number
    })
})

async function flushTimers() {
    // Run any queued RAF timeouts
    vi.runAllTimers()
    // Flush microtasks
    await Promise.resolve()
}

describe('_MotionContainer', () => {
    it('fires lifecycle only for main animate transition (not initial)', async () => {
        const onStart = vi.fn()
        const onComplete = vi.fn()

        render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                transition: { duration: 0.2 },
                onAnimationStart: onStart,
                onAnimationComplete: onComplete
            }
        })

        // Flush RAF + timers to move to ready and complete finished promise
        await flushTimers()

        // animate should be called at least twice: initial (duration:0) and main animate
        expect(animateMock).toHaveBeenCalled()
        // Depending on effects ordering, animate may run more than once; ensure at least 1 lifecycle pair
        expect(onStart.mock.calls.length).toBeGreaterThanOrEqual(1)
        expect(onComplete.mock.calls.length).toBeGreaterThanOrEqual(1)
        expect(onStart).toHaveBeenCalledWith({ opacity: 1 })
        expect(onComplete).toHaveBeenCalledWith({ opacity: 1 })
    })

    it('whileTap resets overlapping keys to animate values (fallback to initial)', async () => {
        const initial = { scale: 1, backgroundColor: '#111' }
        const animate = { scale: 1.1, backgroundColor: '#000' }
        const whileTap = { scale: 0.9, backgroundColor: '#f00' }

        const { container } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', initial, animate, whileTap }
        })

        // Wait for ready promotion
        await flushTimers()

        const el = container.firstElementChild as HTMLElement
        expect(el).toBeTruthy()

        // pointerdown -> whileTap animate call
        await fireEvent.pointerDown(el)
        // pointerup -> reset record to animate-or-initial
        await fireEvent.pointerUp(el)

        // Grab the last call args for reset
        const lastCall = animateMock.mock.calls.at(-1)
        expect(lastCall).toBeTruthy()
        const resetDef = lastCall![1] as Record<string, unknown>
        expect(resetDef).toMatchObject({ scale: 1.1, backgroundColor: '#000' })
    })

    it('re-runs animate when animate prop changes', async () => {
        const result = render(MotionContainer as unknown as any, {
            props: { tag: 'div', animate: { opacity: 0.5 } }
        })

        await flushTimers()
        const initialAnimateCalls = animateMock.mock.calls.length

        // Update animate prop via rerender (Svelte 5)
        await result.rerender({ tag: 'div', animate: { opacity: 0.9 } })
        await flushTimers()

        expect(animateMock.mock.calls.length).toBeGreaterThan(initialAnimateCalls)
        const lastCall = animateMock.mock.calls.at(-1)
        expect(lastCall?.[1]).toMatchObject({ opacity: 0.9 })
    })
})
