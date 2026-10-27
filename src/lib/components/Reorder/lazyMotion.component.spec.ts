/**
 * Reorder with LazyMotion — ports of Motion 14.7.1
 * `components/Reorder/__tests__/lazy-motion.test.tsx` (#2232) and
 * `strict-warning.test.tsx` (#2094).
 *
 * `Reorder` from the `m` entry renders `m` components, so it gets drag and
 * layout from LazyMotion. The main `Reorder` renders `motion` components:
 * within `<LazyMotion strict>` it warns once and points at the `m` entry
 * instead of throwing. The `server.ssr.test.tsx` port lives in
 * `tests/consumer-vite6/verify.mjs` (vitest here always resolves Svelte's
 * client build).
 */
import { domMax, type FeatureBundle } from '$lib'
import { resetWarnOnceForTests } from '$lib/utils/motionKind'
import { render, screen } from '@testing-library/svelte'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import LazyReorderHarness from './__tests__/LazyReorderHarness.svelte'

// jsdom has no ResizeObserver; the items' `layout` prop observes one.
class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

const activePointers = new Map<number, { clientX: number; clientY: number }>()

/** Advance the controlled Motion frame used to sample drag pointer events. */
const flushFrame = async (ms = 1) => {
    await vi.advanceTimersByTimeAsync(ms)
}

const dispatchMousePointer = (
    target: EventTarget,
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    { clientX, clientY, pointerId }: { clientX: number; clientY: number; pointerId: number }
) => {
    target.dispatchEvent(
        new PointerEvent(type, {
            clientX,
            clientY,
            pointerId,
            pointerType: 'mouse',
            isPrimary: true,
            button: type === 'pointermove' ? -1 : 0,
            buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0
        })
    )
    if (type === 'pointercancel' || type === 'pointerup') {
        activePointers.delete(pointerId)
    } else {
        activePointers.set(pointerId, { clientX, clientY })
    }
}

/** jsdom has no layout, so stack the items 50px apart, in DOM order. */
const giveItemsLayout = () =>
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement
    ) {
        if (this.tagName !== 'LI') return new DOMRect()
        const index = Array.from(this.parentElement?.children ?? []).indexOf(this)
        return new DOMRect(0, index * 50, 100, 50)
    })

/** Drag past the next item, in two moves to give it a velocity. */
const dragDown = async (element: Element, pointerId: number) => {
    dispatchMousePointer(element, 'pointerdown', { clientX: 10, clientY: 25, pointerId })
    await flushFrame(16)
    dispatchMousePointer(window, 'pointermove', { clientX: 10, clientY: 75, pointerId })
    await flushFrame(16)
    dispatchMousePointer(window, 'pointermove', { clientX: 10, clientY: 125, pointerId })
    await flushFrame(16)
    dispatchMousePointer(window, 'pointerup', { clientX: 10, clientY: 125, pointerId })
    await flushFrame(16)
}

const lazyMotionWarnings = (warn: { mock: { calls: unknown[][] } }) =>
    warn.mock.calls.filter(([message]) => String(message).includes('LazyMotion'))

beforeAll(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterAll(() => {
    vi.unstubAllGlobals()
})

beforeEach(() => {
    resetWarnOnceForTests()
})

afterEach(async () => {
    try {
        for (const [pointerId, point] of [...activePointers]) {
            dispatchMousePointer(window, 'pointercancel', { ...point, pointerId })
        }
        await flushFrame()
    } finally {
        activePointers.clear()
        vi.restoreAllMocks()
    }
})

describe('Reorder with LazyMotion', () => {
    it('Reorder from the m entry is inert until LazyMotion loads its features', async () => {
        giveItemsLayout()
        let loadFeatures!: (features: FeatureBundle) => void
        const features = () =>
            new Promise<FeatureBundle>((resolve) => {
                loadFeatures = resolve
            })
        const onReorder = vi.fn()

        render(LazyReorderHarness, { props: { features, entry: 'm', onReorder } })
        await vi.advanceTimersByTimeAsync(1000)

        await dragDown(screen.getByTestId('a'), 1)
        expect(onReorder).not.toHaveBeenCalled()

        loadFeatures(domMax)
        await vi.advanceTimersByTimeAsync(1000)

        await dragDown(screen.getByTestId('a'), 2)
        expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c'])
    })

    it('Reorder from the m entry renders within LazyMotion strict without a strict-mode warning', async () => {
        giveItemsLayout()
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const onReorder = vi.fn()

        render(LazyReorderHarness, {
            props: { features: domMax, strict: true, entry: 'm', onReorder }
        })
        await vi.advanceTimersByTimeAsync(1000)

        await dragDown(screen.getByTestId('a'), 3)
        expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c'])
        expect(lazyMotionWarnings(warn)).toEqual([])
    })

    it('the main Reorder within LazyMotion strict warns once, with a fix', async () => {
        giveItemsLayout()
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const onReorder = vi.fn()

        let result!: ReturnType<typeof render>
        expect(() => {
            result = render(LazyReorderHarness, {
                props: { features: domMax, strict: true, entry: 'main', onReorder }
            })
        }).not.toThrow()
        await vi.advanceTimersByTimeAsync(1000)
        await result.rerender({ onReorder: (next: string[]) => onReorder(next) })
        await result.rerender({ onReorder })
        await vi.advanceTimersByTimeAsync(1000)

        await dragDown(screen.getByTestId('a'), 4)
        // Reorder still works with the features LazyMotion provides.
        expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c'])

        const strictWarnings = warn.mock.calls.filter(([message]) =>
            String(message).includes('within a `LazyMotion` component')
        )
        expect(strictWarnings).toHaveLength(1)
        expect(String(strictWarnings[0][0])).toContain(
            'For Reorder, import it from "@humanspeak/svelte-motion/m"'
        )
    })
})
