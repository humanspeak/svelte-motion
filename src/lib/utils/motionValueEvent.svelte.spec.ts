import { motionValue as rawMotionValue, type StartAnimation } from 'motion-dom'
import { writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMotionValue } from './motionValue.svelte.js'
import { useMotionValueEvent } from './motionValueEvent.js'

/**
 * `useMotionValueEvent` mirrors framer-motion's hook: it subscribes to any of
 * a motion value's five events through `value.on(event, callback)`, and keeps
 * accepting a Svelte readable store for `'change'`. A stub animation drives
 * `start()` so no frameloop is needed.
 *
 * `useMotionValue` registers `$effect` teardown, so augmented values are
 * created inside `$effect.root`.
 */
describe('utils/motionValueEvent - useMotionValueEvent', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        vi.useRealTimers()
        cleanups = []
    })

    afterEach(() => {
        for (const fn of cleanups) fn()
    })

    const inRoot = <T>(fn: () => T): T => {
        let result: T
        const stop = $effect.root(() => {
            result = fn()
        })
        cleanups.push(stop)
        return result!
    }

    const startStub = (value: { start: (s: StartAnimation) => Promise<void> }) => {
        let complete!: () => void
        void value.start((done) => {
            complete = done
            return { stop: vi.fn() } as unknown as ReturnType<StartAnimation>
        })
        return () => complete()
    }

    it("fires 'change' on a raw motion-dom value, not on subscribe", () => {
        const v = rawMotionValue(0)
        const cb = vi.fn()
        useMotionValueEvent(v, 'change', cb)
        expect(cb).not.toHaveBeenCalled()
        v.set(5)
        expect(cb).toHaveBeenCalledTimes(1)
        expect(cb).toHaveBeenCalledWith(5)
    })

    it("fires 'animationStart' and 'animationComplete' on an augmented value", () => {
        inRoot(() => {
            const v = useMotionValue(0)
            const onStart = vi.fn()
            const onComplete = vi.fn()
            useMotionValueEvent(v, 'animationStart', onStart)
            useMotionValueEvent(v, 'animationComplete', onComplete)

            const finish = startStub(v)
            expect(onStart).toHaveBeenCalledTimes(1)
            expect(onComplete).not.toHaveBeenCalled()

            finish()
            expect(onComplete).toHaveBeenCalledTimes(1)

            v.set(9)
            expect(onStart).toHaveBeenCalledTimes(1)
            expect(onComplete).toHaveBeenCalledTimes(1)
        })
    })

    it("fires 'animationCancel' when a running animation is stopped", () => {
        const v = rawMotionValue(0)
        const onCancel = vi.fn()
        useMotionValueEvent(v, 'animationCancel', onCancel)
        startStub(v)
        v.stop()
        expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it("fires 'destroy' when the value is destroyed", () => {
        const v = rawMotionValue(0)
        const onDestroy = vi.fn()
        useMotionValueEvent(v, 'destroy', onDestroy)
        v.destroy()
        expect(onDestroy).toHaveBeenCalledTimes(1)
    })

    it('stops calling the callback after unsubscribe', () => {
        const v = rawMotionValue(0)
        const cb = vi.fn()
        const off = useMotionValueEvent(v, 'animationStart', cb)
        off()
        startStub(v)
        expect(cb).not.toHaveBeenCalled()
    })

    it("keeps 'change' semantics for a readable store", () => {
        const s = writable(1)
        const cb = vi.fn()
        const off = useMotionValueEvent(s, 'change', cb)
        expect(cb).not.toHaveBeenCalled()
        s.set(2)
        expect(cb).toHaveBeenCalledTimes(1)
        expect(cb).toHaveBeenCalledWith(2)
        off()
        s.set(3)
        expect(cb).toHaveBeenCalledTimes(1)
    })

    it("keeps 'change' semantics for an augmented value", () => {
        inRoot(() => {
            const v = useMotionValue(0)
            const cb = vi.fn()
            useMotionValueEvent(v, 'change', cb)
            expect(cb).not.toHaveBeenCalled()
            v.set(4)
            expect(cb).toHaveBeenCalledTimes(1)
            expect(cb).toHaveBeenCalledWith(4)
        })
    })

    it('types', () => {
        if (false as boolean) {
            const n = rawMotionValue(0)
            useMotionValueEvent(n, 'change', (latest) => {
                const x: number = latest
                void x
            })
            useMotionValueEvent(n, 'animationComplete', () => {})
            const s = writable('a')
            useMotionValueEvent(s, 'change', (latest) => {
                const x: string = latest
                void x
            })
            // @ts-expect-error readable stores only emit 'change'
            useMotionValueEvent(s, 'animationStart', () => {})
            // @ts-expect-error not a MotionValue event
            useMotionValueEvent(n, 'animationEnd', () => {})
            inRoot(() => {
                useMotionValueEvent(useMotionValue(0), 'animationStart', () => {})
            })
        }
    })
})
