import { render, screen } from '@testing-library/svelte'
import { motionValue } from 'motion-dom'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import ItemMotionValueProbe from './__tests__/ItemMotionValueProbe.svelte'

// jsdom has no ResizeObserver; the items' `layout` prop observes one.
class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

beforeAll(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver as unknown as typeof ResizeObserver)
})

afterAll(() => {
    vi.unstubAllGlobals()
})

// Isolated in its own file: it drives motion-dom's shared frame loop
// through fake timers, and frame-loop state left behind by other
// renders in the same worker makes the propagation timing unreliable.
describe('Reorder.Item MotionValue reuse', () => {
    it('reuses a consumer x MotionValue and floats the item while offset', async () => {
        const x = motionValue(0)
        render(ItemMotionValueProbe, { props: { x } })
        const item = await screen.findByTestId('probe-item')
        // Let the container finish loading — the live style effect (and
        // its MotionValue subscriptions) only attach once it's ready.
        await vi.advanceTimersByTimeAsync(1000)
        expect(item.style.zIndex).toBe('unset')

        x.set(50)
        await vi.advanceTimersByTimeAsync(500)
        expect(item.style.zIndex).toBe('1')
        expect(item.style.transform).toContain('translateX(50px)')

        x.set(0)
        await vi.advanceTimersByTimeAsync(500)
        expect(item.style.zIndex).toBe('unset')
    })
})
