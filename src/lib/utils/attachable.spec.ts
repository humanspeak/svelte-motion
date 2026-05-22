import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAttachable } from './attachable.js'

/**
 * Direct coverage for `createAttachable`. This primitive is consumed by
 * `useInView` (and historically `useScroll`, before W4.5 moved that to
 * inline microtask-defer). The hooks built on it test the end-to-end
 * behavior; these tests target the primitive's invariants: refcount
 * lifecycle, the ref-pending gate, the re-entrant `stop()` guard, and
 * the `isLatched` short-circuit.
 *
 * The dynamic hydration retry path (getter that starts undefined and
 * resolves later) is end-to-end tested via the `useInView` and
 * `useScroll` specs. Running it here in isolation is gated by
 * motion-dom's microtask batcher needing an external wake event
 * (`allowKeepAlive: false`), which doesn't naturally fire in vitest's
 * jsdom environment.
 */
const drainMicrotasks = async (ticks = 4) => {
    for (let i = 0; i < ticks; i++) await Promise.resolve()
}

describe('utils/attachable:createAttachable', () => {
    beforeEach(() => {
        vi.useRealTimers()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('runs onAttach synchronously on the first subscribe when refs resolve immediately', () => {
        const el = document.createElement('div')
        const onAttach = vi.fn(() => undefined as VoidFunction | void)
        const attachable = createAttachable({ refs: { target: el }, onAttach })

        const release = attachable.subscribe()
        expect(onAttach).toHaveBeenCalledTimes(1)
        expect((onAttach.mock.calls[0] as unknown as [{ target: HTMLElement }])[0]).toEqual({
            target: el
        })
        release()
    })

    it('refcounts subscribers — onAttach runs once, cleanup runs on last release', () => {
        const el = document.createElement('div')
        const cleanup = vi.fn()
        const onAttach = vi.fn(() => cleanup)
        const attachable = createAttachable({ refs: { target: el }, onAttach })

        const r1 = attachable.subscribe()
        const r2 = attachable.subscribe()
        const r3 = attachable.subscribe()
        expect(onAttach).toHaveBeenCalledTimes(1)

        r1()
        r2()
        expect(cleanup).not.toHaveBeenCalled()
        r3()
        expect(cleanup).toHaveBeenCalledTimes(1)
    })

    it('does not attach when a getter ref returns undefined', async () => {
        const ref: { current?: HTMLElement } = {}
        const onAttach = vi.fn(() => undefined as VoidFunction | void)
        const attachable = createAttachable({
            refs: { target: () => ref.current },
            onAttach
        })

        const release = attachable.subscribe()
        await drainMicrotasks()
        expect(onAttach).not.toHaveBeenCalled()
        release()
    })

    it('handles re-entrant stop() during onAttach (synchronous latch)', () => {
        // motion's `inView` once-latch calls stop() synchronously inside the
        // entry callback, before the returned cleanup has been assigned.
        // createAttachable defers the teardown so the just-returned disposer
        // still gets invoked. Test exercises that guard.
        const el = document.createElement('div')
        const cleanup = vi.fn()
        const attachable = createAttachable({
            refs: { target: el },
            onAttach: (_els, stop) => {
                stop() // re-entrant call before we've returned cleanup
                return cleanup
            }
        })

        const release = attachable.subscribe()
        // The deferred stop runs the cleanup function we just returned.
        expect(cleanup).toHaveBeenCalledTimes(1)
        // Subsequent release is a no-op (cleanup already torn down).
        release()
        expect(cleanup).toHaveBeenCalledTimes(1)
    })

    it('honors isLatched short-circuit — onAttach does not run when latched', () => {
        let latched = false
        const el = document.createElement('div')
        const onAttach = vi.fn(() => undefined as VoidFunction | void)
        const attachable = createAttachable({
            refs: { target: el },
            isLatched: () => latched,
            onAttach
        })

        // First subscribe: latched is false → attaches normally.
        const r1 = attachable.subscribe()
        expect(onAttach).toHaveBeenCalledTimes(1)
        r1()

        // Latch and resubscribe: onAttach is gated.
        latched = true
        const r2 = attachable.subscribe()
        expect(onAttach).toHaveBeenCalledTimes(1)
        r2()
    })

    it('does not attach until all refs hydrate (multiple pending refs)', async () => {
        const onAttach = vi.fn(() => undefined as VoidFunction | void)
        const attachable = createAttachable({
            refs: {
                container: () => undefined as HTMLElement | undefined,
                target: () => undefined as HTMLElement | undefined
            },
            onAttach
        })

        attachable.subscribe()
        await drainMicrotasks()
        expect(onAttach).not.toHaveBeenCalled()
    })

    it('attaches synchronously when all multiple refs resolve at subscribe time', () => {
        const container = document.createElement('div')
        const target = document.createElement('span')
        const onAttach = vi.fn(() => undefined as VoidFunction | void)
        const attachable = createAttachable({
            refs: { container: () => container, target: () => target },
            onAttach
        })

        attachable.subscribe()
        expect(onAttach).toHaveBeenCalledTimes(1)
        expect(
            (
                onAttach.mock.calls[0] as unknown as [
                    { container?: HTMLElement; target?: HTMLElement }
                ]
            )[0]
        ).toEqual({ container, target })
    })

    it('release() is idempotent past zero subscribers', () => {
        const el = document.createElement('div')
        const cleanup = vi.fn()
        const onAttach = vi.fn(() => cleanup)
        const attachable = createAttachable({ refs: { target: el }, onAttach })

        const release = attachable.subscribe()
        release()
        // Calling release a second time should not re-run cleanup or throw.
        release()
        release()
        expect(cleanup).toHaveBeenCalledTimes(1)
    })
})
