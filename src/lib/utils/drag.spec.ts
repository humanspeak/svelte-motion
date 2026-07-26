import { motionValue, visualElementStore, type MotionValue, type VisualElement } from 'motion-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyElastic, attachDrag, buildDragTransform, resolveConstraints } from './drag.js'

vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})
const { animate: animateMock } = (await import('motion')) as unknown as {
    animate: ReturnType<typeof vi.fn> & { mockClear: () => void; mock: { calls: unknown[][] } }
}

/**
 * Minimal stand-in for the element's VisualElement, registered in motion-dom's
 * `visualElementStore` exactly as a mounted node would be.
 *
 * Drag resolves its writer handles from that store (upstream
 * `VisualElementDragControls.getAxisMotionValue`), so a stub is enough to pin
 * WHAT drag writes and WHEN it renders, without standing up a real renderer.
 */
const registerStubNode = (element: HTMLElement, seed: Record<string, number> = {}) => {
    const values = new Map<string, MotionValue>()
    const latestValues: Record<string, unknown> = { ...seed }
    const render = vi.fn()
    const node = {
        values,
        latestValues,
        render,
        scheduleRender: vi.fn(),
        setStaticValue: (key: string, value: unknown) => {
            latestValues[key] = value
        },
        getValue: (key: string, defaultValue?: number) => {
            let value = values.get(key)
            if (!value) {
                value = motionValue(defaultValue ?? 0)
                values.set(key, value)
                latestValues[key] = value.get()
                value.on('change', (latest) => {
                    latestValues[key] = latest
                })
            }
            return value
        }
    }
    visualElementStore.set(element, node as unknown as VisualElement)
    return node
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
        el.remove()
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

    it('writes the axis MotionValues on the VisualElement and renders synchronously', () => {
        const el = document.createElement('div')
        document.body.appendChild(el)
        const node = registerStubNode(el)

        const cleanup = attachDrag(el, { axis: true, mergedTransition: { duration: 0 } })
        el.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
        )
        el.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 40, clientY: 25, pointerId: 1 })
        )

        // The gesture owns the node's x/y channels — no composed string of its
        // own, so the VisualElement stays the single writer of `transform`.
        expect(node.values.get('x')?.get()).toBe(30)
        expect(node.values.get('y')?.get()).toBe(15)
        expect(node.latestValues.x).toBe(30)
        expect(node.latestValues.y).toBe(15)
        // Synchronous render per pointer batch (upstream
        // `VisualElementDragControls.ts:216`) — a pointermove must paint in the
        // frame it arrives in.
        expect(node.render).toHaveBeenCalled()
        expect(el.style.transform).toBe('')
        expect(el.dataset.svelteMotionDragTransform).toBeUndefined()

        el.dispatchEvent(new PointerEvent('pointerup', { clientX: 40, clientY: 25, pointerId: 1 }))
        cleanup()
        el.remove()
    })

    it('composes an unbound drag axis onto its authored channel value', () => {
        const el = document.createElement('div')
        document.body.appendChild(el)
        // Authored `style={{ x: 40 }}`: drag is an offset from the authored
        // channel, and both live on the same node value.
        const node = registerStubNode(el, { x: 40 })

        const cleanup = attachDrag(el, {
            axis: 'x',
            mergedTransition: { duration: 0 },
            getBaseTransformValues: () => ({ x: 40 })
        })
        el.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
        )
        el.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 35, clientY: 10, pointerId: 1 })
        )

        expect(node.values.get('x')?.get()).toBe(65)
        cleanup()
        el.remove()
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
