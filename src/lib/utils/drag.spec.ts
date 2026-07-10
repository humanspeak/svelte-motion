import { motionValue } from 'motion-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyElastic, attachDrag, buildDragTransform, resolveConstraints } from './drag.js'

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

    it('builds live drag transforms in upstream channel order', () => {
        expect(buildDragTransform({ skewX: 3, rotate: 8, x: 20 })).toBe(
            'translateX(20px) rotate(8deg) skewX(3deg)'
        )
    })

    it('passes live drag values through transformTemplate', () => {
        let received: Record<string, string | number> = {}
        const transform = buildDragTransform({ x: 20, rotateX: 30 }, '', (latest, generated) => {
            received = { ...latest }
            return `perspective(600px) ${generated}`
        })

        expect(received).toMatchObject({ x: '20px', rotateX: '30deg' })
        expect(transform).toBe('perspective(600px) translateX(20px) rotateX(30deg)')
    })

    it('leaves transform rendering to a bound MotionValue when no other channel is active', () => {
        const el = document.createElement('div')
        el.style.transform = 'rotate(12deg)'
        document.body.appendChild(el)
        const x = motionValue(0)
        const cleanup = attachDrag(el, {
            axis: 'x',
            mergedTransition: { duration: 0 },
            boundMotionValues: { x }
        })

        el.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 25, clientY: 10, pointerId: 1 })
        )

        expect(x.get()).toBe(15)
        expect(el.style.transform).toBe('rotate(12deg)')
        cleanup()
    })

    it('attachDrag: attaches pointerdown and animates during move', () => {
        const el = document.createElement('div')
        el.style.width = '100px'
        el.style.height = '100px'
        document.body.appendChild(el)
        const callbacks = {
            onStart: vi.fn(),
            onMove: vi.fn(),
            onEnd: vi.fn()
        }

        const cleanup = attachDrag(el, {
            axis: true,
            mergedTransition: { duration: 0 },
            callbacks
        })

        el.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 20, clientY: 30, pointerId: 1 })
        )
        window.dispatchEvent(
            new PointerEvent('pointerup', { clientX: 20, clientY: 30, pointerId: 1 })
        )

        expect(callbacks.onStart).toHaveBeenCalled()
        expect(callbacks.onMove).toHaveBeenCalled()
        expect(callbacks.onEnd).toHaveBeenCalled()
        expect(el.style.transform).toContain('translateX(10px)')
        expect(el.style.transform).toContain('translateY(20px)')
        cleanup()
    })

    it('attachDrag: ends the gesture when a child stops pointerup propagation (motion#3731)', () => {
        const el = document.createElement('div')
        const child = document.createElement('button')
        el.appendChild(child)
        document.body.appendChild(el)
        // A descendant swallowing pointerup (common for buttons inside
        // draggable/reorderable items) must not trap the gesture: the
        // window session listeners are capture-phase, so they see the
        // event before the child's bubble handler stops it.
        child.addEventListener('pointerup', (event) => event.stopPropagation())

        const callbacks = { onStart: vi.fn(), onMove: vi.fn(), onEnd: vi.fn() }
        const cleanup = attachDrag(el, {
            axis: true,
            mergedTransition: { duration: 0 },
            callbacks
        })

        el.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
        )
        child.dispatchEvent(
            new PointerEvent('pointermove', {
                clientX: 25,
                clientY: 25,
                pointerId: 1,
                bubbles: true
            })
        )
        child.dispatchEvent(
            new PointerEvent('pointerup', {
                clientX: 25,
                clientY: 25,
                pointerId: 1,
                bubbles: true
            })
        )

        expect(callbacks.onEnd).toHaveBeenCalled()

        // A fresh gesture still starts cleanly afterwards — the previous
        // session's listeners were fully removed despite the swallowed event.
        el.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 2 })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 30, clientY: 30, pointerId: 2 })
        )
        window.dispatchEvent(
            new PointerEvent('pointerup', { clientX: 30, clientY: 30, pointerId: 2 })
        )
        expect(callbacks.onEnd).toHaveBeenCalledTimes(2)
        cleanup()
    })
})
