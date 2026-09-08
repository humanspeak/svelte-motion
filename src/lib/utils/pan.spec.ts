import { frame, frameData } from 'motion-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachPan, type AttachPanCleanup, type PanHandlers } from './pan.js'

const flushFrame = async () => {
    await new Promise<void>((resolve) => frame.postRender(() => resolve()))
}

const pointer = (
    type: string,
    x: number,
    y: number,
    pointerId = 1,
    isPrimary = true,
    pointerType = 'mouse'
) =>
    new PointerEvent(type, {
        clientX: x,
        clientY: y,
        pointerId,
        pointerType,
        isPrimary,
        button: 0,
        buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0,
        bubbles: true
    })

describe('attachPan transformPagePoint', () => {
    let element: HTMLElement
    let cleanups: AttachPanCleanup[]

    beforeEach(() => {
        vi.useRealTimers()
        element = document.createElement('div')
        document.body.appendChild(element)
        cleanups = []
    })

    afterEach(() => {
        for (const cleanup of cleanups) cleanup()
        element.remove()
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    const attach = (handlers: PanHandlers, options = {}) => {
        const cleanup = attachPan(element, handlers, options)
        cleanups.push(cleanup)
        return cleanup
    }

    it('preserves the no-config point, delta, offset and terminal lifecycle', async () => {
        const handlers = {
            onSessionStart: vi.fn(),
            onStart: vi.fn(),
            onMove: vi.fn(),
            onEnd: vi.fn(),
            onSessionEnd: vi.fn()
        }
        attach(handlers)

        element.dispatchEvent(pointer('pointerdown', 10, 20))
        await flushFrame()
        window.dispatchEvent(pointer('pointermove', 20, 35))
        await flushFrame()
        window.dispatchEvent(pointer('pointerup', 25, 40))
        await flushFrame()

        expect(handlers.onSessionStart.mock.calls[0][1]).toMatchObject({
            point: { x: 10, y: 20 },
            delta: { x: 0, y: 0 },
            offset: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 }
        })
        expect(handlers.onMove.mock.calls[0][1]).toMatchObject({
            point: { x: 20, y: 35 },
            delta: { x: 10, y: 15 },
            offset: { x: 10, y: 15 }
        })
        expect(handlers.onEnd.mock.calls[0][1]).toMatchObject({
            point: { x: 25, y: 40 },
            offset: { x: 15, y: 20 }
        })
        expect(handlers.onSessionEnd).toHaveBeenCalledTimes(1)
    })

    it('reports nonuniform scaled and translated callback data', async () => {
        const onMove = vi.fn()
        attach(
            { onMove },
            {
                transformPagePoint: ({ x, y }: { x: number; y: number }) => ({
                    x: x * 2 + 100,
                    y: y * 3 - 50
                })
            }
        )

        element.dispatchEvent(pointer('pointerdown', 10, 20))
        window.dispatchEvent(pointer('pointermove', 20, 30))
        await flushFrame()

        const info = onMove.mock.calls[0][1]
        expect(info).toMatchObject({
            point: { x: 140, y: 40 },
            delta: { x: 20, y: 30 },
            offset: { x: 20, y: 30 }
        })
        expect(Number.isFinite(info.velocity.x)).toBe(true)
        expect(Number.isFinite(info.velocity.y)).toBe(true)
    })

    it('applies the distance threshold in corrected units', async () => {
        const onStart = vi.fn()
        const onMove = vi.fn()
        attach(
            { onStart, onMove },
            { transformPagePoint: ({ x, y }: { x: number; y: number }) => ({ x: x * 2, y }) }
        )

        element.dispatchEvent(pointer('pointerdown', 10, 10))
        window.dispatchEvent(pointer('pointermove', 11, 10))
        await flushFrame()
        expect(onStart).not.toHaveBeenCalled()

        window.dispatchEvent(pointer('pointermove', 12, 10))
        await flushFrame()
        expect(onStart).toHaveBeenCalledTimes(1)
        expect(onMove.mock.calls[0][1].offset.x).toBe(4)
    })

    it('uses the last corrected point for pointercancel', async () => {
        const onEnd = vi.fn()
        let scale = 2
        attach(
            { onEnd },
            {
                transformPagePoint: ({ x, y }: { x: number; y: number }) => ({
                    x: x * scale,
                    y: y * scale
                })
            }
        )

        element.dispatchEvent(pointer('pointerdown', 10, 10))
        window.dispatchEvent(pointer('pointermove', 20, 10))
        await flushFrame()
        scale = 4
        window.dispatchEvent(pointer('pointercancel', 100, 100))
        await flushFrame()

        expect(onEnd.mock.calls[0][1]).toMatchObject({
            point: { x: 40, y: 20 },
            offset: { x: 20, y: 0 }
        })
    })

    it('does not synthesize public terminal callbacks on teardown', async () => {
        const onEnd = vi.fn()
        const onSessionEnd = vi.fn()
        const cleanup = attach({ onEnd, onSessionEnd })

        element.dispatchEvent(pointer('pointerdown', 10, 10))
        window.dispatchEvent(pointer('pointermove', 20, 10))
        await flushFrame()
        cleanup()
        cleanup()

        expect(onEnd).not.toHaveBeenCalled()
        expect(onSessionEnd).not.toHaveBeenCalled()
    })

    it('ignores secondary pointers', async () => {
        const onSessionStart = vi.fn()
        attach({ onSessionStart })

        element.dispatchEvent(pointer('pointerdown', 10, 10, 2, false, 'touch'))
        window.dispatchEvent(pointer('pointermove', 20, 10, 2, false, 'touch'))
        await flushFrame()

        expect(onSessionStart).not.toHaveBeenCalled()
    })

    it('hot-swaps handlers but captures callback identity until the next gesture', async () => {
        const firstMove = vi.fn()
        const secondMove = vi.fn()
        const firstTransform = ({ x, y }: { x: number; y: number }) => ({ x: x * 2, y })
        const secondTransform = ({ x, y }: { x: number; y: number }) => ({ x: x * 3, y })
        const cleanup = attach({ onMove: firstMove }, { transformPagePoint: firstTransform })

        element.dispatchEvent(pointer('pointerdown', 10, 10, 3))
        cleanup.update({ onMove: secondMove }, { transformPagePoint: secondTransform })
        window.dispatchEvent(pointer('pointermove', 20, 10, 3))
        await flushFrame()
        expect(firstMove).not.toHaveBeenCalled()
        expect(secondMove.mock.calls[0][1].offset.x).toBe(20)
        window.dispatchEvent(pointer('pointerup', 20, 10, 3))
        await flushFrame()

        element.dispatchEvent(pointer('pointerdown', 10, 10, 4))
        window.dispatchEvent(pointer('pointermove', 20, 10, 4))
        await flushFrame()
        expect(secondMove.mock.calls[1][1].offset.x).toBe(30)
    })

    it('ordinary pan does not track page or ancestor scroll', async () => {
        const ancestor = document.createElement('div')
        ancestor.style.overflowX = 'auto'
        ancestor.style.overflowY = 'auto'
        element.remove()
        ancestor.appendChild(element)
        document.body.appendChild(ancestor)
        let pageScrollX = 0
        vi.spyOn(window, 'scrollX', 'get').mockImplementation(() => pageScrollX)
        const onMove = vi.fn()
        attach(
            { onMove },
            {
                transformPagePoint: ({ x, y }: { x: number; y: number }) => ({
                    x: x * 2,
                    y: y * 3
                })
            }
        )

        element.dispatchEvent(pointer('pointerdown', 10, 10, 5))
        window.dispatchEvent(pointer('pointermove', 20, 10, 5))
        await flushFrame()
        expect(onMove.mock.calls.at(-1)![1].offset.x).toBe(20)

        pageScrollX = 5
        window.dispatchEvent(new Event('scroll'))
        await flushFrame()
        expect(onMove.mock.calls.at(-1)![1].offset.x).toBe(20)

        ancestor.scrollLeft = 5
        ancestor.dispatchEvent(new Event('scroll', { bubbles: true }))
        await flushFrame()
        expect(onMove.mock.calls.at(-1)![1].offset.x).toBe(20)
        ancestor.remove()
    })

    it('re-evaluates a captured closure while retaining old mapped history', async () => {
        let scale = 2
        const onMove = vi.fn()
        const transformPagePoint = ({ x, y }: { x: number; y: number }) => ({
            x: x * scale,
            y: y * scale
        })
        attach({ onMove }, { transformPagePoint })

        element.dispatchEvent(pointer('pointerdown', 10, 10, 6))
        window.dispatchEvent(pointer('pointermove', 20, 10, 6))
        await flushFrame()
        expect(onMove.mock.calls.at(-1)![1].offset.x).toBe(20)

        scale = 4
        window.dispatchEvent(pointer('pointermove', 20, 10, 6))
        await flushFrame()
        expect(onMove.mock.calls.at(-1)![1].point.x).toBe(80)
        expect(onMove.mock.calls.at(-1)![1].offset.x).toBe(60)
    })

    it('matches the recorded corrected-frame velocity sequence deterministically', async () => {
        vi.useFakeTimers()
        const clock = vi.spyOn(performance, 'now').mockReturnValue(1000)
        frameData.timestamp = 1000
        const onMove = vi.fn()
        const onEnd = vi.fn()
        attach(
            { onMove, onEnd },
            {
                scheduleHandlers: false,
                transformPagePoint: ({ x, y }: { x: number; y: number }) => ({
                    x: x * 2,
                    y: y * 2
                })
            }
        )

        element.dispatchEvent(pointer('pointerdown', 10, 10, 7))
        clock.mockReturnValue(1016)
        await vi.runOnlyPendingTimersAsync()
        window.dispatchEvent(pointer('pointermove', 12, 11, 7))
        clock.mockReturnValue(1040)
        await vi.runOnlyPendingTimersAsync()
        window.dispatchEvent(pointer('pointermove', 40, 30, 7))
        clock.mockReturnValue(1080)
        await vi.runOnlyPendingTimersAsync()
        window.dispatchEvent(pointer('pointerup', 40, 30, 7))
        clock.mockReturnValue(1100)
        await vi.runOnlyPendingTimersAsync()

        const moveInfos = onMove.mock.calls.map((call) => call[1])
        expect(moveInfos[0]).toMatchObject({
            delta: { x: 4, y: 2 },
            offset: { x: 4, y: 2 },
            velocity: { x: 0, y: 0 }
        })
        expect(onEnd.mock.calls[0][1]).toMatchObject({
            delta: { x: 0, y: 0 },
            offset: { x: 60, y: 40 },
            velocity: { x: 750, y: 500 }
        })
    })
})
