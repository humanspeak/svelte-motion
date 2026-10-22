import type { VisualElementDragControls } from 'motion-dom'
import { describe, expect, it, vi } from 'vitest'
import { createDragControls } from './dragControls.js'

/**
 * `createDragControls` mirrors framer-motion's `DragControls`
 * (`gestures/drag/use-drag-controls.ts` @ v14.5.0): a set of subscribed
 * `VisualElementDragControls`, with `start`/`cancel`/`stop` fanning out to all.
 */

/** A stand-in for an element's `VisualElementDragControls`, plus its spies. */
const fakeControls = () => {
    const start = vi.fn()
    const cancel = vi.fn()
    const stop = vi.fn()
    const controls = { start, cancel, stop } as unknown as VisualElementDragControls
    return { controls, start, cancel, stop }
}

const pointerDown = () => new PointerEvent('pointerdown', { clientX: 10, clientY: 20 })

describe('createDragControls', () => {
    it('fans start, cancel and stop out to every subscribed controller', () => {
        const controls = createDragControls()
        const a = fakeControls()
        const b = fakeControls()
        controls.subscribe(a.controls)
        controls.subscribe(b.controls)

        const event = pointerDown()
        controls.start(event, { snapToCursor: true })
        controls.cancel()
        controls.stop()

        // Both subscribers are driven, not only the most recent one.
        for (const subscriber of [a, b]) {
            expect(subscriber.start).toHaveBeenCalledExactlyOnceWith(event, {
                snapToCursor: true
            })
            expect(subscriber.cancel).toHaveBeenCalledOnce()
            expect(subscriber.stop).toHaveBeenCalledOnce()
        }
    })

    it('stops driving a controller once it unsubscribes', () => {
        const controls = createDragControls()
        const a = fakeControls()
        const b = fakeControls()
        const unsubscribeA = controls.subscribe(a.controls)
        controls.subscribe(b.controls)

        unsubscribeA()
        controls.start(pointerDown())
        controls.cancel()
        controls.stop()

        expect(a.start).not.toHaveBeenCalled()
        expect(a.cancel).not.toHaveBeenCalled()
        expect(a.stop).not.toHaveBeenCalled()
        expect(b.start).toHaveBeenCalledOnce()
        expect(b.cancel).toHaveBeenCalledOnce()
        expect(b.stop).toHaveBeenCalledOnce()
    })

    it('passes distanceThreshold through to each controller', () => {
        const controls = createDragControls()
        const a = fakeControls()
        controls.subscribe(a.controls)

        const event = pointerDown()
        controls.start(event, { distanceThreshold: 12 })

        expect(a.start).toHaveBeenCalledExactlyOnceWith(event, { distanceThreshold: 12 })
    })

    it('is a no-op with no subscribers', () => {
        const controls = createDragControls()
        expect(() => {
            controls.start(pointerDown())
            controls.cancel()
            controls.stop()
        }).not.toThrow()
    })
})
