import {
    frameData,
    isDragActive,
    motionValue,
    visualElementStore,
    type MotionValue,
    type VisualElement
} from 'motion-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyElastic, attachDrag, buildDragTransform, resolveConstraints } from './drag.js'
import { createDragControls } from './dragControls.js'

vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})
const { animate: animateMock } = (await import('motion')) as unknown as {
    animate: ReturnType<typeof vi.fn> & { mockClear: () => void; mock: { calls: unknown[][] } }
}

/** Advance the controlled Motion frame used by drag's PanSession bookkeeping. */
const flushFrame = async (ms = 16) => {
    await vi.advanceTimersByTimeAsync(ms)
}

const NativePointerEvent = globalThis.PointerEvent
class PointerEvent extends NativePointerEvent {
    constructor(type: string, init: PointerEventInit = {}) {
        super(type, {
            pointerType: 'mouse',
            isPrimary: true,
            button: type === 'pointermove' ? -1 : 0,
            buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0,
            ...init
        })
    }
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

    afterEach(async () => {
        window.dispatchEvent(
            new PointerEvent('pointerup', {
                clientX: 0,
                clientY: 0,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true
            })
        )
        await flushFrame()
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

    it('leaves transform rendering to a bound MotionValue when no other channel is active', async () => {
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
            new PointerEvent('pointerdown', {
                clientX: 10,
                clientY: 10,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
                button: 0,
                buttons: 1
            })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', {
                clientX: 25,
                clientY: 10,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
                buttons: 1
            })
        )
        await flushFrame()

        expect(x.get()).toBe(15)
        expect(el.style.transform).toBe('rotate(12deg)')
        cleanup()
        el.remove()
    })

    describe('transformPagePoint', () => {
        it('corrects bound MotionValue movement into the configured coordinate space', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const x = motionValue(0)
            const options = {
                axis: 'x' as const,
                momentum: false,
                mergedTransition: { duration: 0 },
                boundMotionValues: { x },
                transformPagePoint: ({ x, y }: { x: number; y: number }) => ({
                    x: x * 2,
                    y: y * 2
                })
            }
            const cleanup = attachDrag(el, options)

            el.dispatchEvent(
                new PointerEvent('pointerdown', {
                    clientX: 10,
                    clientY: 10,
                    pointerId: 1,
                    button: 0,
                    isPrimary: true
                })
            )
            window.dispatchEvent(
                new PointerEvent('pointermove', {
                    clientX: 30,
                    clientY: 10,
                    pointerId: 1,
                    buttons: 1,
                    isPrimary: true
                })
            )
            await flushFrame()

            cleanup()
            el.remove()
            expect(x.get()).toBe(40)
        })

        it('preserves unconfigured pointer coordinates', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const x = motionValue(0)
            const options = {
                axis: 'x' as const,
                momentum: false,
                mergedTransition: { duration: 0 },
                boundMotionValues: { x }
            }
            const cleanup = attachDrag(el, options)

            el.dispatchEvent(
                new PointerEvent('pointerdown', {
                    clientX: 10,
                    clientY: 10,
                    pointerId: 2,
                    button: 0,
                    isPrimary: true
                })
            )
            window.dispatchEvent(
                new PointerEvent('pointermove', {
                    clientX: 30,
                    clientY: 10,
                    pointerId: 2,
                    buttons: 1,
                    isPrimary: true
                })
            )
            await flushFrame()

            cleanup()
            el.remove()
            expect(x.get()).toBe(20)
        })

        it('reports nonuniformly corrected callback data and bound values', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const x = motionValue(0)
            const y = motionValue(0)
            const onMove = vi.fn()
            const cleanup = attachDrag(el, {
                axis: true,
                momentum: false,
                mergedTransition: { duration: 0 },
                boundMotionValues: { x, y },
                callbacks: { onMove },
                transformPagePoint: (point) => ({ x: point.x * 2, y: point.y * 3 })
            })

            el.dispatchEvent(
                new PointerEvent('pointerdown', {
                    clientX: 10,
                    clientY: 10,
                    pointerId: 3,
                    pointerType: 'mouse',
                    button: 0,
                    buttons: 1
                })
            )
            window.dispatchEvent(
                new PointerEvent('pointermove', {
                    clientX: 30,
                    clientY: 20,
                    pointerId: 3,
                    pointerType: 'mouse',
                    button: -1,
                    buttons: 1
                })
            )
            await flushFrame()

            expect(x.get()).toBe(40)
            expect(y.get()).toBe(30)
            expect(onMove.mock.calls[0][1]).toMatchObject({
                point: { x: 60, y: 60 },
                delta: { x: 40, y: 30 },
                offset: { x: 40, y: 30 }
            })
            cleanup()
            el.remove()
        })

        it('cancels affine translation when calculating movement deltas', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const x = motionValue(0)
            const cleanup = attachDrag(el, {
                axis: 'x',
                momentum: false,
                mergedTransition: { duration: 0 },
                boundMotionValues: { x },
                transformPagePoint: (point) => ({ x: point.x * 2 + 100, y: point.y - 75 })
            })

            el.dispatchEvent(
                new PointerEvent('pointerdown', {
                    clientX: 10,
                    clientY: 10,
                    pointerId: 4,
                    pointerType: 'mouse',
                    button: 0,
                    buttons: 1
                })
            )
            window.dispatchEvent(
                new PointerEvent('pointermove', {
                    clientX: 30,
                    clientY: 10,
                    pointerId: 4,
                    pointerType: 'mouse',
                    button: -1,
                    buttons: 1
                })
            )
            await flushFrame()

            cleanup()
            el.remove()
            expect(x.get()).toBe(40)
        })

        it('keeps numeric constraints in authored local units', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const x = motionValue(0)
            const cleanup = attachDrag(el, {
                axis: 'x',
                constraints: { left: 0, right: 25 },
                elastic: 0,
                momentum: false,
                mergedTransition: { duration: 0 },
                boundMotionValues: { x },
                transformPagePoint: (point) => ({ x: point.x * 2, y: point.y * 2 })
            })

            el.dispatchEvent(
                new PointerEvent('pointerdown', {
                    clientX: 10,
                    clientY: 10,
                    pointerId: 5,
                    pointerType: 'mouse',
                    button: 0,
                    buttons: 1
                })
            )
            window.dispatchEvent(
                new PointerEvent('pointermove', {
                    clientX: 30,
                    clientY: 10,
                    pointerId: 5,
                    pointerType: 'mouse',
                    button: -1,
                    buttons: 1
                })
            )
            await flushFrame()

            cleanup()
            el.remove()
            expect(x.get()).toBe(25)
        })

        it('maps both element-ref constraint rectangles before subtracting them', () => {
            const bounds = document.createElement('div')
            const el = document.createElement('div')
            document.body.append(bounds, el)
            vi.spyOn(bounds, 'getBoundingClientRect').mockReturnValue(new DOMRect(80, 80, 100, 100))
            vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 20, 20))

            const mapped = resolveConstraints(el, bounds, (point) => ({
                x: point.x * 2,
                y: point.y / 2
            }))

            expect(mapped).toEqual({ top: -10, left: -40, right: 120, bottom: 30 })
            bounds.remove()
            el.remove()
        })

        it('keeps the captured callback when options change during a drag', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const x = motionValue(0)
            const first = (point: { x: number; y: number }) => ({
                x: point.x * 2,
                y: point.y * 2
            })
            const second = (point: { x: number; y: number }) => ({
                x: point.x * 3,
                y: point.y * 3
            })
            const onMove = vi.fn()
            const baseOptions = {
                axis: 'x' as const,
                momentum: false,
                mergedTransition: { duration: 0 },
                boundMotionValues: { x },
                callbacks: { onMove }
            }
            const cleanup = attachDrag(el, { ...baseOptions, transformPagePoint: first })

            el.dispatchEvent(
                new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 6 })
            )
            cleanup.updateOptions({ ...baseOptions, transformPagePoint: second })
            window.dispatchEvent(
                new PointerEvent('pointermove', { clientX: 20, clientY: 10, pointerId: 6 })
            )
            await flushFrame()
            window.dispatchEvent(
                new PointerEvent('pointerup', { clientX: 20, clientY: 10, pointerId: 6 })
            )
            await flushFrame()
            expect(x.get()).toBe(20)
            expect(onMove.mock.calls.at(-1)![1].offset).toEqual({ x: 20, y: 0 })

            el.dispatchEvent(
                new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 7 })
            )
            window.dispatchEvent(
                new PointerEvent('pointermove', { clientX: 20, clientY: 10, pointerId: 7 })
            )
            await flushFrame()

            cleanup()
            el.remove()
            expect(x.get()).toBe(50)
            expect(onMove.mock.calls.at(-1)![1].offset).toEqual({ x: 30, y: 0 })
        })

        it('uses corrected units for deterministic release velocity', async () => {
            const clock = vi.spyOn(performance, 'now').mockReturnValue(1000)
            frameData.timestamp = 1000
            const el = document.createElement('div')
            document.body.appendChild(el)
            const onMove = vi.fn()
            const onEnd = vi.fn()
            const cleanup = attachDrag(el, {
                axis: 'x',
                momentum: false,
                mergedTransition: { duration: 0 },
                callbacks: { onMove, onEnd },
                transformPagePoint: (point) => ({ x: point.x * 2, y: point.y * 2 })
            })

            el.dispatchEvent(
                new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 8 })
            )
            clock.mockReturnValue(1016)
            await flushFrame(16)
            window.dispatchEvent(
                new PointerEvent('pointermove', { clientX: 12, clientY: 11, pointerId: 8 })
            )
            clock.mockReturnValue(1040)
            await flushFrame(24)
            window.dispatchEvent(
                new PointerEvent('pointermove', { clientX: 40, clientY: 30, pointerId: 8 })
            )
            clock.mockReturnValue(1080)
            await flushFrame(40)
            window.dispatchEvent(
                new PointerEvent('pointerup', { clientX: 40, clientY: 30, pointerId: 8 })
            )
            clock.mockReturnValue(1100)
            await flushFrame(20)

            expect(onMove.mock.calls[0][1].velocity).toEqual({ x: 0, y: 0 })
            expect(onMove.mock.calls[1][1].velocity).toEqual({ x: 100, y: 50 })
            expect(onEnd.mock.calls[0][1].velocity).toEqual({ x: 750, y: 500 })
            cleanup()
            el.remove()
            clock.mockRestore()
        })

        it('uses the raw page point against the transformed projection center for controlled snap', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const node = registerStubNode(el) as ReturnType<typeof registerStubNode> & {
                projection?: {
                    layout: {
                        layoutBox: {
                            x: { min: number; max: number }
                            y: { min: number; max: number }
                        }
                    }
                }
            }
            node.projection = {
                layout: {
                    // The VisualElement projection has already consumed the
                    // scale-2 transformPagePoint mapping.
                    layoutBox: {
                        x: { min: 200, max: 240 },
                        y: { min: 80, max: 120 }
                    }
                }
            }
            const x = motionValue(0)
            const y = motionValue(0)
            const controls = createDragControls()
            const cleanup = attachDrag(el, {
                axis: true,
                controls,
                momentum: false,
                mergedTransition: { duration: 0 },
                boundMotionValues: { x, y },
                transformPagePoint: (point) => ({ x: point.x * 2, y: point.y * 2 })
            })

            controls.start(
                new PointerEvent('pointerdown', { clientX: 130, clientY: 50, pointerId: 9 }),
                { snapToCursor: true }
            )
            await flushFrame()

            cleanup()
            el.remove()
            // Raw page point (130, 50) minus transformed layout center
            // (220, 100). Reusing mapped info.point would incorrectly yield
            // (40, 0), the exact scaled/scrolled public parity regression.
            expect({ x: x.get(), y: y.get() }).toEqual({ x: -90, y: -50 })
        })
    })

    it('attachDrag: attaches pointerdown and animates during move', async () => {
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
            momentum: false,
            mergedTransition: { duration: 0 },
            callbacks
        })

        el.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 20, clientY: 30, pointerId: 1 })
        )
        await flushFrame()
        window.dispatchEvent(
            new PointerEvent('pointerup', { clientX: 20, clientY: 30, pointerId: 1 })
        )
        await flushFrame()

        expect(callbacks.onStart).toHaveBeenCalled()
        expect(callbacks.onMove).toHaveBeenCalled()
        expect(callbacks.onEnd).toHaveBeenCalled()
        expect(el.style.transform).toContain('translateX(10px)')
        expect(el.style.transform).toContain('translateY(20px)')
        cleanup()
    })

    it('writes the axis MotionValues on the VisualElement in the sampled frame', async () => {
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
        await flushFrame()

        // The gesture owns the node's x/y channels — no composed string of its
        // own, so the VisualElement stays the single writer of `transform`.
        expect(node.values.get('x')?.get()).toBe(30)
        expect(node.values.get('y')?.get()).toBe(15)
        expect(node.latestValues.x).toBe(30)
        expect(node.latestValues.y).toBe(15)
        // Synchronous render inside the sampled Motion frame (upstream
        // `VisualElementDragControls.ts:216`) — a pointermove must paint in the
        // frame it arrives in.
        expect(node.render).toHaveBeenCalled()
        expect(el.style.transform).toBe('')
        expect(el.dataset.svelteMotionDragTransform).toBeUndefined()

        el.dispatchEvent(new PointerEvent('pointerup', { clientX: 40, clientY: 25, pointerId: 1 }))
        await flushFrame()
        cleanup()
        el.remove()
    })

    it('shifts the live MotionValue and drag origin when its layout slot moves', async () => {
        const el = document.createElement('div')
        document.body.appendChild(el)
        const node = registerStubNode(el)

        const cleanup = attachDrag(el, { axis: 'x', mergedTransition: { duration: 0 } })
        el.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 200, clientY: 10, pointerId: 1 })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 140, clientY: 10, pointerId: 1 })
        )
        await flushFrame()
        expect(node.values.get('x')?.get()).toBe(-60)

        // A keyed reorder moved the element's underlying slot 100px left.
        // Projection reports previous - next (+100), which must immediately
        // move the displayed transform and the gesture origin together.
        cleanup.adjustOrigin(100, 0)
        expect(node.values.get('x')?.get()).toBe(40)

        // A stationary pointer sample must retain the compensated value. If
        // only the visual value moved (and not the origin), this snaps to -60.
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 140, clientY: 10, pointerId: 1 })
        )
        await flushFrame()
        expect(node.values.get('x')?.get()).toBe(40)

        window.dispatchEvent(
            new PointerEvent('pointerup', { clientX: 140, clientY: 10, pointerId: 1 })
        )
        await flushFrame()
        cleanup()
        el.remove()
    })

    it('composes an unbound drag axis onto its authored channel value', async () => {
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
        await flushFrame()

        expect(node.values.get('x')?.get()).toBe(65)
        cleanup()
        el.remove()
    })

    describe('global drag lock', () => {
        // A leaked lock is worse than no lock: `isDragActive()` gates
        // motion-dom's own hover()/press() recognizers globally, so every route
        // out of a drag session is pinned here.
        const drag = async (el: HTMLElement, id = 1) => {
            el.dispatchEvent(
                new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId: id })
            )
            window.dispatchEvent(
                new PointerEvent('pointermove', { clientX: 25, clientY: 5, pointerId: id })
            )
            await flushFrame()
        }

        it('holds the lock for the pointer session and releases it on pointerup', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const cleanup = attachDrag(el, { axis: 'x', mergedTransition: { duration: 0 } })

            expect(isDragActive()).toBe(false)
            await drag(el)
            expect(isDragActive()).toBe(true)
            window.dispatchEvent(
                new PointerEvent('pointerup', { clientX: 25, clientY: 5, pointerId: 1 })
            )
            await flushFrame()
            // Released at pointer-up, NOT after the momentum glide — this is what
            // lets hover respond mid-glide (e2e/drag/hover-during-glide).
            expect(isDragActive()).toBe(false)

            cleanup()
            el.remove()
        })

        it('releases on pointercancel and keeps an unmounted active session until terminal', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const x = motionValue(0)
            const terminalBoundValues: number[] = []
            const cleanup = attachDrag(el, {
                axis: 'x',
                momentum: false,
                mergedTransition: { duration: 0 },
                boundMotionValues: { x },
                callbacks: { onEnd: () => terminalBoundValues.push(x.get()) }
            })

            await drag(el)
            window.dispatchEvent(
                new PointerEvent('pointercancel', { clientX: 25, clientY: 5, pointerId: 1 })
            )
            await flushFrame()
            expect(isDragActive()).toBe(false)

            // Unmount mid-drag: teardown is the only remaining exit.
            await drag(el, 2)
            expect(isDragActive()).toBe(true)
            cleanup()
            expect(isDragActive()).toBe(true)
            el.remove()
            window.dispatchEvent(
                new PointerEvent('pointerup', { clientX: 25, clientY: 5, pointerId: 2 })
            )
            await flushFrame()
            expect(isDragActive()).toBe(false)
            expect(terminalBoundValues.at(-1)).toBe(0)
        })

        it('does not take the lock when propagation is allowed', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const cleanup = attachDrag(el, {
                axis: 'x',
                mergedTransition: { duration: 0 },
                propagation: true
            })

            await drag(el)
            // `dragPropagation` opts out of the lock so nested draggables move
            // together — upstream `VisualElementDragControls.ts:121`.
            expect(isDragActive()).toBe(false)
            window.dispatchEvent(
                new PointerEvent('pointerup', { clientX: 25, clientY: 5, pointerId: 1 })
            )
            await flushFrame()
            cleanup()
            el.remove()
        })

        it('a second element cannot start a drag while the lock is held', async () => {
            const first = document.createElement('div')
            const second = document.createElement('div')
            document.body.append(first, second)
            const stopFirst = attachDrag(first, { axis: 'x', mergedTransition: { duration: 0 } })
            const onStart = vi.fn()
            const stopSecond = attachDrag(second, {
                axis: 'x',
                mergedTransition: { duration: 0 },
                callbacks: { onStart }
            })

            await drag(first)
            second.dispatchEvent(
                new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId: 9 })
            )
            expect(onStart).not.toHaveBeenCalled()

            // …and once the first session ends, the second element can drag.
            window.dispatchEvent(
                new PointerEvent('pointerup', { clientX: 25, clientY: 5, pointerId: 1 })
            )
            await flushFrame()
            await drag(second, 10)
            expect(onStart).toHaveBeenCalled()
            expect(isDragActive()).toBe(true)

            window.dispatchEvent(
                new PointerEvent('pointerup', { clientX: 25, clientY: 5, pointerId: 10 })
            )
            await flushFrame()
            expect(isDragActive()).toBe(false)
            stopFirst()
            stopSecond()
            first.remove()
            second.remove()
        })
    })

    it('attachDrag: ends the gesture when a child stops pointerup propagation (motion#3731)', async () => {
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
        await flushFrame()
        child.dispatchEvent(
            new PointerEvent('pointerup', {
                clientX: 25,
                clientY: 25,
                pointerId: 1,
                bubbles: true
            })
        )
        await flushFrame()

        expect(callbacks.onEnd).toHaveBeenCalled()

        // A fresh gesture still starts cleanly afterwards — the previous
        // session's listeners were fully removed despite the swallowed event.
        el.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 2 })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 30, clientY: 30, pointerId: 2 })
        )
        await flushFrame()
        window.dispatchEvent(
            new PointerEvent('pointerup', { clientX: 30, clientY: 30, pointerId: 2 })
        )
        await flushFrame()
        expect(callbacks.onEnd).toHaveBeenCalledTimes(2)
        cleanup()
    })

    describe('release cleanup routes', () => {
        /**
         * One idempotent `finalizeRelease` serves every way a release can end.
         * These pin all four routes, and in particular that `onDragTransitionEnd`
         * fires ONLY for a release that ran out naturally — upstream's
         * `Promise.all(momentumAnimations).then(onDragTransitionEnd)`
         * (`VisualElementDragControls.ts:511`) never settles for an interrupted
         * release, because `MotionValue.start()` resolves only from the
         * animation's `onComplete` (motion-dom `value/index.mjs:260-274`) and
         * `JSAnimation.stop()` calls `onStop` instead
         * (`animation/JSAnimation.mjs:44-54`).
         */
        const fling = async (el: HTMLElement, id = 1) => {
            el.dispatchEvent(
                new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: id })
            )
            window.dispatchEvent(
                new PointerEvent('pointermove', { clientX: 60, clientY: 10, pointerId: id })
            )
            await flushFrame(16)
            window.dispatchEvent(
                new PointerEvent('pointermove', { clientX: 140, clientY: 10, pointerId: id })
            )
            await flushFrame(16)
            window.dispatchEvent(
                new PointerEvent('pointerup', { clientX: 140, clientY: 10, pointerId: id })
            )
            await flushFrame()
        }

        /** A stand-in foreign animation, registered as the value's own. */
        const takeOver = (value: MotionValue) =>
            void value.start(() => ({ stop: vi.fn() }) as never)

        it('route 1 — natural completion fires onDragTransitionEnd exactly once', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            registerStubNode(el)
            const onTransitionEnd = vi.fn()

            // `elastic: 0` with no momentum settles synchronously, which is the
            // natural-completion route with no frameloop in the way.
            const cleanup = attachDrag(el, {
                axis: 'x',
                elastic: 0,
                momentum: false,
                mergedTransition: { duration: 0 },
                callbacks: { onTransitionEnd }
            })
            await fling(el)

            expect(onTransitionEnd).toHaveBeenCalledTimes(1)
            cleanup()
            el.remove()
        })

        it('route 2 — our own cancel stops the axis and skips onDragTransitionEnd', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const node = registerStubNode(el)
            const onTransitionEnd = vi.fn()
            const controls = createDragControls()

            const cleanup = attachDrag(el, {
                axis: 'x',
                controls,
                mergedTransition: { duration: 0 },
                callbacks: { onTransitionEnd }
            })
            await fling(el)
            const x = node.values.get('x') as MotionValue
            expect(x.isAnimating()).toBe(true)

            controls.cancel()

            expect(x.isAnimating()).toBe(false)
            expect(onTransitionEnd).not.toHaveBeenCalled()
            cleanup()
            el.remove()
        })

        it('route 3 — a foreign takeover cleans up without stopping the new owner', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const node = registerStubNode(el)
            const onTransitionEnd = vi.fn()
            const controls = createDragControls()

            const cleanup = attachDrag(el, {
                axis: 'x',
                controls,
                mergedTransition: { duration: 0 },
                callbacks: { onTransitionEnd }
            })
            await fling(el)
            const x = node.values.get('x') as MotionValue

            takeOver(x)
            expect(x.isAnimating()).toBe(true)
            expect(onTransitionEnd).not.toHaveBeenCalled()

            // The dead release disarmed itself, so cancelling the finished drag
            // cannot reach an axis it no longer owns.
            controls.cancel()
            expect(x.isAnimating()).toBe(true)

            cleanup()
            el.remove()
        })

        it('route 4 — teardown drops the bookkeeping without killing the glide', async () => {
            const el = document.createElement('div')
            document.body.appendChild(el)
            const node = registerStubNode(el)
            const onTransitionEnd = vi.fn()
            const controls = createDragControls()

            const cleanup = attachDrag(el, {
                axis: 'x',
                controls,
                mergedTransition: { duration: 0 },
                callbacks: { onTransitionEnd }
            })
            await fling(el)
            const x = node.values.get('x') as MotionValue

            // A detach can be a benign re-attach (the drag effect re-running), so
            // a legitimate glide must survive it.
            cleanup()
            expect(x.isAnimating()).toBe(true)
            expect(onTransitionEnd).not.toHaveBeenCalled()

            controls.cancel()
            expect(x.isAnimating()).toBe(true)
            el.remove()
        })
    })
})
