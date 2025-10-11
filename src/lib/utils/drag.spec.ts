import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyElastic, attachDrag, resolveConstraints } from './drag.js'

vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})
const { animate: animateMock } = (await import('motion')) as unknown as {
    animate: ReturnType<typeof vi.fn> & { mockClear: () => void; mock: { calls: unknown[][] } }
}

describe('utils/drag', () => {
    beforeEach(() => {
        animateMock.mockClear()
        document.body.innerHTML = ''
    })

    it('applyElastic clamps within bounds and eases overflow', () => {
        expect(applyElastic(50, 0, 100, 0.5)).toBe(50)
        expect(applyElastic(-10, 0, 100, 0.5)).toBeCloseTo(-5, 3)
        expect(applyElastic(110, 0, 100, 0.5)).toBeCloseTo(105, 3)
    })

    it('resolveConstraints: pixel object passthrough', () => {
        const c = resolveConstraints(null, { top: -10, left: -5, right: 5, bottom: 10 })
        expect(c).toMatchObject({ top: -10, left: -5, right: 5, bottom: 10 })
    })

    it('attachDrag: attaches pointerdown and animates during move', async () => {
        const el = document.createElement('div')
        el.style.width = '100px'
        el.style.height = '100px'
        document.body.appendChild(el)

        const cleanup = attachDrag(el, {
            axis: true,
            mergedTransition: { duration: 0 },
            callbacks: {
                onStart: vi.fn(),
                onMove: vi.fn(),
                onEnd: vi.fn()
            }
        } as unknown as Parameters<typeof attachDrag>[1])

        el.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 20, clientY: 30, pointerId: 1 })
        )
        window.dispatchEvent(
            new PointerEvent('pointerup', { clientX: 20, clientY: 30, pointerId: 1 })
        )

        // One or more animate() calls expected
        expect(animateMock).toHaveBeenCalled()
        cleanup()
    })
})



